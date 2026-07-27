import path from "node:path";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { currentUser } from "@/lib/auth";
import { getMeeting, listMeetingFiles, startMeetingProcessing, uploadsDirectory } from "@/lib/db";
import { canAccessMeeting } from "@/lib/domain";
import { processMeetingAudio } from "@/lib/meeting-processing";

export const runtime = "nodejs";
export const maxDuration = 900;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const meetingId = Number((await params).id);
  const meeting = Number.isInteger(meetingId) ? getMeeting(meetingId) : undefined;
  if (!meeting || !canAccessMeeting(user.role, user.team, user.id, meeting.accessRules)) {
    return Response.json({ error: "Meeting not found." }, { status: 404 });
  }
  return Response.json({ status: meeting.processingStatus, error: meeting.processingError });
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const meetingId = Number((await params).id);
  const meeting = Number.isInteger(meetingId) ? getMeeting(meetingId) : undefined;
  if (!meeting || !canAccessMeeting(user.role, user.team, user.id, meeting.accessRules)) {
    return Response.json({ error: "Meeting not found." }, { status: 404 });
  }
  if (user.id !== meeting.createdById && user.id !== meeting.reviewerId) {
    return Response.json({ error: "Only the organizer or delegated reviewer can retry processing." }, { status: 403 });
  }
  const audio = listMeetingFiles(meetingId).find((file) => file.kind === "audio");
  if (!audio) return Response.json({ error: "No saved audio is available." }, { status: 404 });
  if (!startMeetingProcessing(meetingId)) {
    return Response.json({ error: "Meeting audio is already being processed." }, { status: 409 });
  }

  after(async () => {
    await processMeetingAudio(meetingId, path.join(uploadsDirectory, audio.storedName), meeting.createdById);
    revalidatePath(`/meetings/${meetingId}`);
  });
  revalidatePath(`/meetings/${meetingId}`);
  return Response.json({ processing: { status: "processing" } }, { status: 202 });
}
