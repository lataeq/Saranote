import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { addFile, getMeeting, getSetting, getTask, listUsers, submitTask, uploadsDirectory } from "@/lib/db";
import { canAccessMeeting, canManageTeam, canSubmitTask } from "@/lib/domain";

export const runtime = "nodejs";
const MAX_FILE_SIZE = 25 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const taskId = Number((await params).id);
  const task = Number.isInteger(taskId) ? getTask(taskId) : undefined;
  const meeting = task ? getMeeting(task.meetingId) : undefined;
  if (!task || !task.publishedAt || task.cancelledAt || !meeting) return Response.json({ error: "Assignment not found." }, { status: 404 });
  if (
    !canAccessMeeting(user.role, user.team, user.id, meeting.accessRules)
    || !canSubmitTask(user.id, task.assigneeId, task.status)
  ) {
    return Response.json({ error: "You cannot submit this assignment." }, { status: 403 });
  }

  const formData = await request.formData();
  const text = String(formData.get("text") ?? "").trim();
  const candidate = formData.get("file");
  const file = candidate instanceof File && candidate.size ? candidate : null;
  if (!text && !file) return Response.json({ error: "Add a submission note or attach a file." }, { status: 400 });
  if (file && file.size > MAX_FILE_SIZE) return Response.json({ error: "Files must be 25 MB or smaller." }, { status: 413 });

  let destination: string | null = null;
  let submittedFileName: string | null = null;
  if (file) {
    const originalName = path.basename(file.name).replace(/[\u0000-\u001f]/g, "");
    submittedFileName = originalName;
    const storedName = `${randomUUID()}${path.extname(originalName).toLowerCase()}`;
    destination = path.join(uploadsDirectory, storedName);
    await mkdir(uploadsDirectory, { recursive: true });
    await writeFile(destination, new Uint8Array(await file.arrayBuffer()));
    try {
      addFile({ meetingId: task.meetingId, taskId: task.id, originalName, storedName, mimeType: file.type || "application/octet-stream", kind: "submission", size: file.size, uploadedBy: user.id });
    } catch (error) {
      await unlink(destination).catch(() => undefined);
      throw error;
    }
  }

  submitTask(task.id, text);
  let notification: "not_configured" | "sent" | "failed" = "not_configured";
  const webhookUrl = process.env.N8N_TASK_SUBMITTED_WEBHOOK_URL;
  const webhookSecret = process.env.SARANOTE_N8N_WEBHOOK_SECRET;
  const notificationMailbox = getSetting("notification_email") || process.env.SARANOTE_NOTIFICATION_EMAIL;
  const reviewers = listUsers().filter((reviewer) => (
    reviewer.role !== "team_member"
    && canManageTeam(reviewer.role, reviewer.team, task.assigneeTeam)
    && canAccessMeeting(reviewer.role, reviewer.team, reviewer.id, meeting.accessRules)
  ));
  if (webhookUrl && webhookSecret && notificationMailbox && reviewers.length) {
    try {
      const appBaseUrl = process.env.SARANOTE_APP_BASE_URL?.replace(/\/+$/, "");
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json", "x-saranote-secret": webhookSecret },
        body: JSON.stringify({
          event: "assignment.submitted",
          occurredAt: new Date().toISOString(),
          task: { id: task.id, title: task.title, description: task.description, dueAt: task.dueAt, url: appBaseUrl ? `${appBaseUrl}/review` : null },
          meeting: { id: meeting.id, title: meeting.title, url: appBaseUrl ? `${appBaseUrl}/meetings/${meeting.id}` : null },
          assignee: { name: user.name, email: user.email, role: user.role, team: user.team },
          submission: { text, fileName: submittedFileName },
          reviewers: reviewers.map(({ name, email, role }) => ({ name, email: notificationMailbox, employeeEmail: email, role })),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      notification = response.ok ? "sent" : "failed";
    } catch {
      notification = "failed";
    }
  }

  revalidatePath("/work");
  revalidatePath("/review");
  revalidatePath(`/meetings/${task.meetingId}`);
  return Response.json({ ok: true, notification });
}
