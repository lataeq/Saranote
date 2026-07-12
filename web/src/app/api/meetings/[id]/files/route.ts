import { execFile } from "node:child_process";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { addFile, failMeetingProcessing, finishMeetingProcessing, getMeeting, getSetting, startMeetingProcessing, uploadsDirectory, type DetectedAction } from "@/lib/db";
import { canAccessMeeting } from "@/lib/domain";

export const runtime = "nodejs";
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const DOCUMENT_EXTENSIONS = new Set([".pdf", ".ppt", ".pptx", ".doc", ".docx", ".txt"]);
const TYPHOON_AUDIO_EXTENSIONS = new Set([".wav", ".mp3", ".flac", ".ogg", ".opus"]);
const execFileAsync = promisify(execFile);

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
  if (file.size > MAX_FILE_SIZE) return Response.json({ error: "Files must be 25 MB or smaller." }, { status: 413 });
  if (kind !== "audio" && kind !== "document") return Response.json({ error: "Unsupported file category." }, { status: 400 });

  const originalName = path.basename(file.name).replace(/[\u0000-\u001f]/g, "");
  const extension = path.extname(originalName).toLowerCase();
  if (kind === "document" && !DOCUMENT_EXTENSIONS.has(extension)) return Response.json({ error: "Use PDF, PowerPoint, Word, or text documents." }, { status: 415 });
  if (kind === "audio" && !file.type.startsWith("audio/") && ![".wav", ".mp3", ".m4a", ".flac", ".webm"].includes(extension)) return Response.json({ error: "Use a supported audio file." }, { status: 415 });

  const storedName = `${randomUUID()}${extension || (kind === "audio" ? ".webm" : "")}`;
  const destination = path.join(uploadsDirectory, storedName);
  await mkdir(uploadsDirectory, { recursive: true });
  await writeFile(destination, new Uint8Array(await file.arrayBuffer()));
  try {
    const id = addFile({ meetingId, taskId: null, originalName, storedName, mimeType: file.type || "application/octet-stream", kind, size: file.size, uploadedBy: user.id });
    let processing: { status: "completed"; actions: number; assigned: number } | { status: "failed"; error: string } | undefined;
    if (kind === "audio") {
      startMeetingProcessing(meetingId);
      try {
        const projectRoot = process.env.SARANOTE_PROJECT_ROOT || path.resolve(process.cwd(), "..");
        const python = process.env.SARANOTE_PYTHON || path.join(projectRoot, ".venv", "bin", "python");
        const typhoonApiKey = getSetting("typhoon_api_key") || process.env.TYPHOON_API_KEY;
        const transcriptionPath = TYPHOON_AUDIO_EXTENSIONS.has(extension) ? destination : `${destination}.wav`;
        let stdout: string;
        try {
          if (transcriptionPath !== destination) {
            await execFileAsync("ffmpeg", ["-y", "-i", destination, "-ar", "16000", "-ac", "1", transcriptionPath], { timeout: 120_000 });
          }
          ({ stdout } = await execFileAsync(python, [
            "-m", "src.pipeline.run_demo",
            "--audio", transcriptionPath,
            "--config", path.join(projectRoot, "configs", "final_demo.yaml"),
            "--process",
          ], { cwd: projectRoot, env: { ...process.env, ...(typhoonApiKey ? { TYPHOON_API_KEY: typhoonApiKey } : {}) }, timeout: 180_000, maxBuffer: 10 * 1024 * 1024 }));
        } finally {
          if (transcriptionPath !== destination) await unlink(transcriptionPath).catch(() => undefined);
        }
        const result = JSON.parse(stdout) as { transcript: string; action_items: DetectedAction[] };
        const assigned = finishMeetingProcessing(meetingId, result.transcript, result.action_items, user.id);
        processing = { status: "completed", actions: result.action_items.length, assigned };
      } catch (error) {
        const detail = error instanceof Error ? error.message : "";
        const apiError = detail.match(/Typhoon ASR failed: ([^\n]+)/)?.[1];
        const message = detail.includes("TYPHOON_API_KEY")
          ? "Typhoon API key is not configured on the web server."
          : apiError || "Audio was saved, but automatic transcription failed.";
        failMeetingProcessing(meetingId, message);
        processing = { status: "failed", error: message };
      }
    }
    revalidatePath(`/meetings/${meetingId}`);
    return Response.json({ id, processing }, { status: 201 });
  } catch (error) {
    await unlink(destination).catch(() => undefined);
    throw error;
  }
}
