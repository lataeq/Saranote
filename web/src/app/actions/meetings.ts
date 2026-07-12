"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager, requireWorkManager } from "@/lib/auth";
import {
  createMeeting,
  createTask,
  deleteTask,
  getMeeting,
  getTask,
  getUser,
  reviewTask,
  updateMeetingTeam,
  updateMeetingTranscript,
  updateTask,
} from "@/lib/db";
import {
  canAccessMeeting,
  canManageTeam,
  isMeetingAudience,
  isMeetingParticipant,
  isReviewDecision,
  isSpecialtyTeam,
  type MeetingAccessRule,
} from "@/lib/domain";

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function positiveId(value: FormDataEntryValue | null): number {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : 0;
}

export async function createMeetingAction(formData: FormData): Promise<void> {
  const manager = await requireWorkManager();
  const title = field(formData, "title");
  const heldAt = field(formData, "heldAt");
  if (!title || !heldAt) redirect("/meetings?error=Meeting+title+and+date+are+required.");

  let accessRules: MeetingAccessRule[] = [];
  if (manager.role === "manager") {
    const teams = formData.getAll("team").map(String);
    const audiences = formData.getAll("audience").map(String);
    const userIds = formData.getAll("audienceUserId").map((value) => Number(value) || null);
    if (!teams.length || new Set(teams).size !== teams.length || teams.length !== audiences.length) {
      redirect("/meetings?error=Choose+each+meeting+specialty+once.");
    }
    accessRules = teams.map((rawTeam, index) => {
      const rawAudience = audiences[index];
      const audienceUserId = userIds[index] ?? null;
      if (!isSpecialtyTeam(rawTeam) || !isMeetingAudience(rawAudience)) {
        redirect("/meetings?error=Choose+a+valid+specialty+and+audience.");
      }
      const selectedUser = rawAudience === "specific_user" && audienceUserId ? getUser(audienceUserId) : undefined;
      if (rawAudience === "specific_user" && (!selectedUser || selectedUser.team !== rawTeam || selectedUser.role === "manager")) {
        redirect("/meetings?error=Select+a+person+from+each+meeting+specialty.");
      }
      return { team: rawTeam, audience: rawAudience, audienceUserId: selectedUser?.id ?? null };
    });
  } else if (manager.team) {
    accessRules = [{ team: manager.team, audience: "all_team", audienceUserId: null }];
  }
  if (!accessRules.length) redirect("/meetings?error=Choose+at+least+one+specialty.");

  const id = createMeeting({
    title,
    heldAt: new Date(heldAt).toISOString(),
    accessRules,
    createdBy: manager.id,
  });
  redirect(`/meetings/${id}`);
}

export async function updateTranscriptAction(formData: FormData): Promise<void> {
  const manager = await requireWorkManager();
  const meetingId = positiveId(formData.get("meetingId"));
  const transcript = field(formData, "transcript");
  const meeting = getMeeting(meetingId);
  if (
    !meeting
    || (manager.role !== "manager" && manager.role !== "team_leader")
    || !canAccessMeeting(manager.role, manager.team, manager.id, meeting.accessRules)
  ) return;
  updateMeetingTranscript(meetingId, transcript);
  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/meetings");
}

export async function updateMeetingTeamAction(formData: FormData): Promise<void> {
  await requireManager();
  const meetingId = positiveId(formData.get("meetingId"));
  const team = field(formData, "team");
  const meeting = getMeeting(meetingId);
  if (!meeting || meeting.taskCount > 0 || !isSpecialtyTeam(team)) return;
  updateMeetingTeam(meetingId, team);
  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/meetings");
}

export async function createTaskAction(formData: FormData): Promise<void> {
  const manager = await requireWorkManager();
  const meetingId = positiveId(formData.get("meetingId"));
  const assigneeId = positiveId(formData.get("assigneeId"));
  const title = field(formData, "title");
  const description = field(formData, "description");
  const dueAtRaw = field(formData, "dueAt");

  const meeting = getMeeting(meetingId);
  const assignee = getUser(assigneeId);
  if (
    !meeting
    || !assignee
    || !title
    || !canManageTeam(manager.role, manager.team, assignee.team)
    || assignee.role === "manager"
    || !canAccessMeeting(manager.role, manager.team, manager.id, meeting.accessRules)
    || !isMeetingParticipant(
      assignee.role,
      assignee.team,
      assignee.id,
      meeting.accessRules,
    )
  ) return;
  createTask({
    meetingId,
    title,
    description,
    assigneeId,
    dueAt: dueAtRaw ? new Date(dueAtRaw).toISOString() : null,
    createdBy: manager.id,
  });
  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/work");
}

export async function updateTaskAction(formData: FormData): Promise<void> {
  const manager = await requireWorkManager();
  const taskId = positiveId(formData.get("taskId"));
  const assigneeId = positiveId(formData.get("assigneeId"));
  const title = field(formData, "title");
  const description = field(formData, "description");
  const dueAtRaw = field(formData, "dueAt");
  const task = getTask(taskId);
  const meeting = task ? getMeeting(task.meetingId) : undefined;
  const assignee = getUser(assigneeId);
  if (
    !task || task.status !== "pending" || !meeting || !assignee || !title
    || !canAccessMeeting(manager.role, manager.team, manager.id, meeting.accessRules)
    || !canManageTeam(manager.role, manager.team, task.assigneeTeam)
    || !canManageTeam(manager.role, manager.team, assignee.team)
    || assignee.role === "manager"
    || !isMeetingParticipant(assignee.role, assignee.team, assignee.id, meeting.accessRules)
  ) return;
  updateTask(task.id, {
    title,
    description,
    assigneeId: assignee.id,
    dueAt: dueAtRaw ? new Date(dueAtRaw).toISOString() : null,
  });
  revalidatePath(`/meetings/${task.meetingId}`);
  revalidatePath("/work");
}

export async function deleteTaskAction(formData: FormData): Promise<void> {
  const manager = await requireWorkManager();
  const taskId = positiveId(formData.get("taskId"));
  const task = getTask(taskId);
  const meeting = task ? getMeeting(task.meetingId) : undefined;
  if (
    !task || task.status !== "pending" || !meeting
    || !canAccessMeeting(manager.role, manager.team, manager.id, meeting.accessRules)
    || !canManageTeam(manager.role, manager.team, task.assigneeTeam)
  ) return;
  deleteTask(task.id);
  revalidatePath(`/meetings/${task.meetingId}`);
  revalidatePath("/work");
}

export async function reviewTaskAction(formData: FormData): Promise<void> {
  const manager = await requireWorkManager();
  const taskId = positiveId(formData.get("taskId"));
  const decision = field(formData, "decision");
  const note = field(formData, "note");
  const task = getTask(taskId);
  if (
    !task
    || task.status !== "submitted"
    || !isReviewDecision(decision)
    || !canManageTeam(manager.role, manager.team, task.assigneeTeam)
    || !canAccessMeeting(manager.role, manager.team, manager.id, getMeeting(task.meetingId)?.accessRules ?? [])
  ) return;
  if (decision === "rejected" && !note) {
    redirect("/review?error=Add+a+review+note+before+requesting+changes.");
  }

  reviewTask(taskId, decision, note);
  revalidatePath("/review");
  revalidatePath("/work");
  revalidatePath("/meetings");
}
