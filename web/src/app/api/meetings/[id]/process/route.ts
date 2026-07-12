import path from "node:path";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { getMeeting, listMeetingFiles, uploadsDirectory } from "@/lib/db";
import { canAccessMeeting } from "@/lib/domain";
import { processMeetingAudio } from "@/lib/meeting-processing";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (user.role === "team_member") return Response.json({ error: "Only managers and team leaders can retry processing." }, { status: 403 });
  const meetingId = Number((await params).id);
  const meeting = Number.isInteger(meetingId) ? getMeeting(meetingId) : undefined;
  if (!meeting || !canAccessMeeting(user.role, user.team, user.id, meeting.accessRules)) {
    return Response.json({ error: "Meeting not found." }, { status: 404 });
  }
  const audio = listMeetingFiles(meetingId).find((file) => file.kind === "audio");
  if (!audio) return Response.json({ error: "No saved audio is available." }, { status: 404 });

  const processing = await processMeetingAudio(meetingId, path.join(uploadsDirectory, audio.storedName), user.id);
  revalidatePath(`/meetings/${meetingId}`);
  return Response.json({ processing });
}
