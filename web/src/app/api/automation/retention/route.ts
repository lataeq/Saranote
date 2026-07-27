import { timingSafeEqual } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { applyRetentionPolicy, getSetting, listRetentionNotices, markRetentionNoticeSent, uploadsDirectory } from "@/lib/db";

export const runtime = "nodejs";

function authorized(request: Request): boolean {
  const secret = process.env.SARANOTE_N8N_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(secret);
  const provided = Buffer.from(request.headers.get("x-saranote-secret") ?? "");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const mailbox = getSetting("pilot_email_sink") || process.env.SARANOTE_PILOT_EMAIL_SINK;
  if (!mailbox) return Response.json({ error: "Controlled pilot mailbox is not configured." }, { status: 503 });

  const expired = applyRetentionPolicy();
  await Promise.all(expired.storedNames.map((storedName) => unlink(path.join(uploadsDirectory, storedName)).catch(() => undefined)));
  const appBaseUrl = process.env.SARANOTE_APP_BASE_URL?.replace(/\/+$/, "") ?? new URL(request.url).origin;
  const notices = listRetentionNotices().map((notice) => {
    const deleted = notice.stage === "deleted";
    const day = notice.stage === "day_23" ? "7 days" : "1 day";
    const subject = deleted
      ? `[Saranote] Deleted expired artifacts: ${notice.title}`
      : `[Saranote] ${notice.title} artifacts expire in ${day}`;
    const detail = deleted
      ? "The raw audio, transcript, summary, and meeting documents were deleted. Published assignments remain on their own retention schedule."
      : `The meeting artifacts will be deleted in ${day}. Export them or use the one-time 30-day extension before expiry.`;
    return {
      meetingId: notice.meetingId,
      stage: notice.stage,
      email: mailbox,
      subject,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#222"><p>Organizer: ${escapeHtml(notice.organizerName)}</p><p><strong>${escapeHtml(notice.title)}</strong></p><p>${detail}</p><p><a href="${escapeHtml(`${appBaseUrl}/meetings/${notice.meetingId}`)}">Open meeting</a></p></div>`,
    };
  });
  return Response.json({ notices });
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null) as { meetingId?: unknown; stage?: unknown } | null;
  const meetingId = Number(body?.meetingId);
  const stage = body?.stage;
  if (!Number.isInteger(meetingId) || meetingId < 1 || (stage !== "day_23" && stage !== "day_29" && stage !== "deleted")) {
    return Response.json({ error: "Invalid retention notice." }, { status: 400 });
  }
  return Response.json({ acknowledged: markRetentionNoticeSent(meetingId, stage) });
}
