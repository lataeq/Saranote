import { execFile } from "node:child_process";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { failMeetingProcessing, finishMeetingProcessing, getSetting, type DetectedAction, type DocumentSection, type MeetingSummary, type TranscriptCorrection } from "@/lib/db";

const execFileAsync = promisify(execFile);
const TYPHOON_AUDIO_EXTENSIONS = new Set([".wav", ".mp3", ".flac", ".ogg", ".opus"]);

export type ProcessingResult =
  | { status: "completed"; actions: number; assigned: number }
  | { status: "failed"; error: string };

function pythonRuntime() {
  const projectRoot = process.env.SARANOTE_PROJECT_ROOT || path.resolve(process.cwd(), "..");
  return {
    projectRoot,
    python: process.env.SARANOTE_PYTHON || path.join(projectRoot, ".venv", "bin", "python"),
  };
}

export async function extractDocumentSections(documentPath: string): Promise<DocumentSection[]> {
  const { projectRoot, python } = pythonRuntime();
  const { stdout } = await execFileAsync(
    python,
    ["-m", "src.documents.presentation", documentPath],
    { cwd: projectRoot, timeout: 60_000, maxBuffer: 10 * 1024 * 1024 },
  );
  const rows = JSON.parse(stdout) as Array<{ location?: unknown; text?: unknown }>;
  if (!Array.isArray(rows)) throw new Error("Document extraction returned invalid data.");
  return rows
    .filter((row) => typeof row.location === "string" && typeof row.text === "string")
    .map((row) => ({ location: row.location as string, text: row.text as string }));
}

export async function processMeetingAudio(meetingId: number, audioPath: string, createdBy: number): Promise<ProcessingResult> {
  try {
    const { projectRoot, python } = pythonRuntime();
    const typhoonApiKey = getSetting("typhoon_api_key") || process.env.TYPHOON_API_KEY;
    const geminiApiKey = getSetting("gemini_api_key") || process.env.GEMINI_API_KEY;
    const transcriptionPath = TYPHOON_AUDIO_EXTENSIONS.has(path.extname(audioPath).toLowerCase()) ? audioPath : `${audioPath}.wav`;
    let stdout: string;
    try {
      if (transcriptionPath !== audioPath) {
        await execFileAsync("ffmpeg", ["-y", "-i", audioPath, "-ar", "16000", "-ac", "1", transcriptionPath], { timeout: 600_000 });
      }
      ({ stdout } = await execFileAsync(python, [
        "-m", "src.pipeline.run_demo",
        "--audio", transcriptionPath,
        "--config", path.join(projectRoot, "configs", "final_demo.yaml"),
        "--process",
      ], {
        cwd: projectRoot,
        env: {
          ...process.env,
          ...(typhoonApiKey ? { TYPHOON_API_KEY: typhoonApiKey } : {}),
          ...(geminiApiKey ? { GEMINI_API_KEY: geminiApiKey } : {}),
        },
        timeout: 900_000,
        maxBuffer: 10 * 1024 * 1024,
      }));
    } finally {
      if (transcriptionPath !== audioPath) await unlink(transcriptionPath).catch(() => undefined);
    }
    const result = JSON.parse(stdout) as {
      raw_transcript?: string;
      transcript: string;
      corrections?: TranscriptCorrection[];
      refinement_error?: string;
      action_items: DetectedAction[];
      summary: MeetingSummary;
    };
    const assigned = finishMeetingProcessing(
      meetingId,
      result.transcript,
      result.action_items,
      result.summary,
      createdBy,
      result.raw_transcript ?? result.transcript,
      result.corrections ?? [],
      result.refinement_error ?? "",
    );
    if (result.refinement_error) {
      const message = result.refinement_error.includes("GEMINI_API_KEY")
        ? "Gemini API key is not configured on the web server."
        : "Gemini transcript refinement failed.";
      failMeetingProcessing(meetingId, message);
      return { status: "failed", error: message };
    }
    return { status: "completed", actions: result.action_items.length, assigned };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    const apiError = detail.match(/Typhoon ASR failed: ([^\n]+)/)?.[1];
    const message = detail.includes("TYPHOON_API_KEY")
      ? "Typhoon API key is not configured on the web server."
      : apiError || "Automatic transcription failed.";
    failMeetingProcessing(meetingId, message);
    return { status: "failed", error: message };
  }
}
