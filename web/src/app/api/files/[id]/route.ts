import { readFile } from "node:fs/promises";
import path from "node:path";
import { currentUser } from "@/lib/auth";
import { getMeeting, getStoredFile, getTask, uploadsDirectory } from "@/lib/db";
import { canAccessMeeting, canManageTeam } from "@/lib/domain";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const id = Number((await params).id);
  const file = Number.isInteger(id) ? getStoredFile(id) : undefined;
  if (!file) return Response.json({ error: "File not found." }, { status: 404 });
  const meeting = getMeeting(file.meetingId);
  if (!meeting || !canAccessMeeting(user.role, user.team, user.id, meeting.accessRules)) {
    return Response.json({ error: "File not found." }, { status: 404 });
  }
  if (file.taskId) {
    const task = getTask(file.taskId);
    if (!task || (task.assigneeId !== user.id && !canManageTeam(user.role, user.team, task.assigneeTeam))) return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const body = await readFile(path.join(uploadsDirectory, file.storedName));
    const disposition = file.kind === "audio" || file.mimeType === "application/pdf" ? "inline" : "attachment";
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.size),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return Response.json({ error: "Stored file is unavailable." }, { status: 404 });
  }
}
