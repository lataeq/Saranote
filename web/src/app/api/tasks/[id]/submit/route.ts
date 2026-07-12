import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { addFile, getMeeting, getTask, submitTask, uploadsDirectory } from "@/lib/db";
import { canAccessMeeting, canSubmitTask } from "@/lib/domain";

export const runtime = "nodejs";
const MAX_FILE_SIZE = 25 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const taskId = Number((await params).id);
  const task = Number.isInteger(taskId) ? getTask(taskId) : undefined;
  if (!task) return Response.json({ error: "Assignment not found." }, { status: 404 });
  if (
    !canAccessMeeting(user.role, user.team, user.id, getMeeting(task.meetingId)?.accessRules ?? [])
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
  if (file) {
    const originalName = path.basename(file.name).replace(/[\u0000-\u001f]/g, "");
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
  revalidatePath("/work");
  revalidatePath("/review");
  revalidatePath(`/meetings/${task.meetingId}`);
  return Response.json({ ok: true });
}
