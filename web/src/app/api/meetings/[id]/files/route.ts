import { chmod, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { currentUser } from "@/lib/auth";
import { addFile, getMeeting, startMeetingProcessing, uploadsDirectory } from "@/lib/db";
import { canAccessMeeting } from "@/lib/domain";
import { extractDocumentSections, processMeetingAudio } from "@/lib/meeting-processing";

export const runtime = "nodejs";
export const maxDuration = 900;
const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024;
const MAX_AUDIO_SIZE = 200 * 1024 * 1024;
const DOCUMENT_EXTENSIONS = new Set([".pdf", ".ppt", ".pptx", ".doc", ".docx", ".txt"]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (user.role === "team_member") return Response.json({ error: "Only managers and team leaders can add meeting files." }, { status: 403 });
  const meetingId = Number((await params).id);
  const meeting = Number.isInteger(meetingId) ? getMeeting(meetingId) : undefined;
  if (!meeting || !canAccessMeeting(user.role, user.team, user.id, meeting.accessRules)) {
    return Response.json({ error: "Meeting not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = String(formData.get("kind") ?? "");
  if (!(file instanceof File) || !file.size) return Response.json({ error: "Choose a file to upload." }, { status: 400 });
  if (kind !== "audio" && kind !== "document") return Response.json({ error: "Unsupported file category." }, { status: 400 });
  const maxSize = kind === "audio" ? MAX_AUDIO_SIZE : MAX_DOCUMENT_SIZE;
  if (file.size > maxSize) return Response.json({ error: `${kind === "audio" ? "Audio" : "Documents"} must be ${maxSize / 1024 / 1024} MB or smaller.` }, { status: 413 });

  const originalName = path.basename(file.name).replace(/[\u0000-\u001f]/g, "");
  const extension = path.extname(originalName).toLowerCase();
  if (kind === "document" && !DOCUMENT_EXTENSIONS.has(extension)) return Response.json({ error: "Use PDF, PowerPoint, Word, or text documents." }, { status: 415 });
  if (kind === "audio" && !file.type.startsWith("audio/") && ![".wav", ".mp3", ".m4a", ".flac", ".webm"].includes(extension)) return Response.json({ error: "Use a supported audio file." }, { status: 415 });

  const storedName = `${randomUUID()}${extension || (kind === "audio" ? ".webm" : "")}`;
  const destination = path.join(uploadsDirectory, storedName);
  await mkdir(uploadsDirectory, { recursive: true });
  await writeFile(destination, new Uint8Array(await file.arrayBuffer()));
  await chmod(destination, 0o600);
  try {
    const documentSections = kind === "document" && [".pdf", ".pptx"].includes(extension)
      ? await extractDocumentSections(destination)
      : [];
    const id = addFile({ meetingId, taskId: null, originalName, storedName, mimeType: file.type || "application/octet-stream", kind, size: file.size, uploadedBy: user.id, documentSections });
    if (kind === "audio") {
      if (startMeetingProcessing(meetingId)) {
        after(async () => {
          await processMeetingAudio(meetingId, destination, user.id);
          revalidatePath(`/meetings/${meetingId}`);
        });
      }
      revalidatePath(`/meetings/${meetingId}`);
      return Response.json({ id, processing: { status: "processing" } }, { status: 201 });
    }
    revalidatePath(`/meetings/${meetingId}`);
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    await unlink(destination).catch(() => undefined);
    const message = kind === "document" && [".pdf", ".pptx"].includes(extension)
      ? "The document could not be read. Check that the PDF or PowerPoint contains selectable text."
      : error instanceof Error ? error.message : "Upload failed.";
    return Response.json({ error: message }, { status: 422 });
  }
}
