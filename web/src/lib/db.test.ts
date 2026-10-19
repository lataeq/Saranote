import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let dataDirectory: string;
let db: typeof import("./db");

beforeAll(async () => {
  dataDirectory = await mkdtemp(path.join(tmpdir(), "saranote-db-test-"));
  vi.stubEnv("SARANOTE_DATA_DIR", dataDirectory);
  vi.resetModules();
  db = await import("./db");
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await rm(dataDirectory, { recursive: true, force: true });
});

describe("stored files", () => {
  it("deletes only the requested file record", () => {
    const managerId = db.createUser({
      name: "Manager",
      email: "manager@example.com",
      passwordHash: "test",
      role: "manager",
      team: null,
    });
    const meetingId = db.createMeeting({
      title: "Deletion test",
      heldAt: new Date().toISOString(),
      accessRules: [{ team: "web_development", audience: "all_team", audienceUserId: null }],
      createdBy: managerId,
    });
    const firstId = db.addFile({
      meetingId,
      taskId: null,
      originalName: "first.pdf",
      storedName: "first.pdf",
      mimeType: "application/pdf",
      kind: "document",
      size: 10,
      uploadedBy: managerId,
    });
    const secondId = db.addFile({
      meetingId,
      taskId: null,
      originalName: "second.pdf",
      storedName: "second.pdf",
      mimeType: "application/pdf",
      kind: "document",
      size: 20,
      uploadedBy: managerId,
    });

    expect(db.deleteStoredFile(firstId)).toBe(true);
    expect(db.getStoredFile(firstId)).toBeUndefined();
    expect(db.getStoredFile(secondId)?.originalName).toBe("second.pdf");
    expect(db.deleteStoredFile(firstId)).toBe(false);
  });
});

describe("meeting summary email delivery", () => {
  it("remembers the last successfully emailed meeting version", () => {
    const managerId = db.createUser({
      name: "Summary Manager",
      email: "summary-manager@example.com",
      passwordHash: "test",
      role: "manager",
      team: null,
    });
    const meetingId = db.createMeeting({
      title: "Summary delivery test",
      heldAt: new Date().toISOString(),
      accessRules: [{ team: "web_development", audience: "all_team", audienceUserId: null }],
      createdBy: managerId,
    });

    expect(db.meetingSummaryEmailWasSent(meetingId, "version-1")).toBe(false);
    db.markMeetingSummaryEmailSent(meetingId, "version-1", ["Member (member@example.com)"]);
    expect(db.meetingSummaryEmailWasSent(meetingId, "version-1")).toBe(true);
    expect(db.meetingSummaryEmailWasSent(meetingId, "version-2")).toBe(false);
    expect(db.getMeeting(meetingId)?.summaryEmailRecipients).toEqual(["Member (member@example.com)"]);
    expect(db.getMeeting(meetingId)?.summaryEmailSentAt).not.toBe("");
  });
});

describe("meeting output review", () => {
  it("keeps generated assignments hidden until the organizer publishes them", () => {
    const managerId = db.createUser({
      name: "Review Manager",
      email: "review-manager@example.com",
      passwordHash: "test",
      role: "manager",
      team: null,
    });
    const memberId = db.createUser({
      name: "Review Member",
      email: "review-member@example.com",
      passwordHash: "test",
      role: "team_member",
      team: "web_development",
      spokenName: "สมาชิก",
    });
    const meetingId = db.createMeeting({
      title: "Meeting review",
      heldAt: new Date().toISOString(),
      accessRules: [{ team: "web_development", audience: "all_team", audienceUserId: null }],
      createdBy: managerId,
    });

    db.finishMeetingProcessing(
      meetingId,
      "[00:00] สมาชิกจะส่งรายงาน",
      [{
        task: "ส่งรายงาน",
        owner: "สมาชิก",
        deadline: null,
        evidence: { timestamp: "00:00", text: "สมาชิกจะส่งรายงาน" },
      }],
      { overview: "", decisions: [], risks: [], important_points: [], follow_ups: [] },
      managerId,
      "[00:00] สมาชิกจะสงรายงาน",
      [{
        timestamp: "00:00",
        before: "สมาชิกจะสงรายงาน",
        after: "สมาชิกจะส่งรายงาน",
        risk: "approval_required",
      }],
    );

    const member = db.getUser(memberId)!;
    expect(db.getMeeting(meetingId)?.reviewStatus).toBe("draft");
    expect(db.getMeeting(meetingId)?.rawTranscript).toContain("สงรายงาน");
    expect(db.getMeeting(meetingId)?.corrections).toHaveLength(1);
    expect(db.listMeetingTasks(meetingId, true)).toHaveLength(1);
    expect(db.listUserTasks(member)).toEqual([]);

    expect(db.publishMeetingOutput(meetingId, managerId, "summary")).toBe(true);
    expect(db.getMeeting(meetingId)?.reviewStatus).toBe("draft");
    expect(db.listUserTasks(member)).toEqual([]);
    expect(db.publishMeetingOutput(meetingId, managerId, "assignments")).toBe(true);
    expect(db.listUserTasks(member)).toHaveLength(1);
    expect(db.getMeeting(meetingId)?.reviewStatus).toBe("draft");
    expect(db.publishMeetingOutput(meetingId, managerId, "transcript")).toBe(true);
    expect(db.getMeeting(meetingId)?.reviewStatus).toBe("published");
    expect(db.listUserTasks(member)).toHaveLength(1);
  });

  it("lets only the organizer delegate review to an invited account", () => {
    const managerId = db.createUser({
      name: "Delegation Manager",
      email: "delegation-manager@example.com",
      passwordHash: "test",
      role: "manager",
      team: null,
    });
    const invitedId = db.createUser({
      name: "Invited Reviewer",
      email: "invited-reviewer@example.com",
      passwordHash: "test",
      role: "team_member",
      team: "sales",
    });
    const uninvitedId = db.createUser({
      name: "Uninvited Reviewer",
      email: "uninvited-reviewer@example.com",
      passwordHash: "test",
      role: "team_member",
      team: "ai_engineering",
    });
    const meetingId = db.createMeeting({
      title: "Delegation test",
      heldAt: new Date().toISOString(),
      accessRules: [{ team: "sales", audience: "all_team", audienceUserId: null }],
      createdBy: managerId,
    });

    expect(db.delegateMeetingReview(meetingId, managerId, uninvitedId)).toBe(false);
    expect(db.delegateMeetingReview(meetingId, uninvitedId, invitedId)).toBe(false);
    expect(db.delegateMeetingReview(meetingId, managerId, invitedId)).toBe(true);
    expect(db.getMeeting(meetingId)?.reviewerId).toBe(invitedId);
    expect(db.delegateMeetingReview(meetingId, managerId, managerId)).toBe(true);
    expect(db.getMeeting(meetingId)?.reviewerId).toBe(managerId);
  });
});

describe("meeting processing claim", () => {
  it("prevents two transcription jobs from processing the same meeting", () => {
    const managerId = db.createUser({
      name: "Processing Manager",
      email: "processing-manager@example.com",
      passwordHash: "test",
      role: "manager",
      team: null,
    });
    const meetingId = db.createMeeting({
      title: "Processing claim",
      heldAt: new Date().toISOString(),
      accessRules: [{ team: "ai_engineering", audience: "all_team", audienceUserId: null }],
      createdBy: managerId,
    });

    expect(db.startMeetingProcessing(meetingId)).toBe(true);
    expect(db.startMeetingProcessing(meetingId)).toBe(false);
  });
});

describe("privacy acknowledgment", () => {
  it("records a user's one-time acknowledgment", () => {
    const userId = db.createUser({
      name: "Privacy Member",
      email: "privacy-member@example.com",
      passwordHash: "test",
      role: "team_member",
      team: "business_analysis",
    });

    expect(db.getUser(userId)?.privacyAcknowledgedAt).toBe("");
    expect(db.acknowledgePrivacy(userId)).toBe(true);
    expect(db.getUser(userId)?.privacyAcknowledgedAt).not.toBe("");
    expect(db.acknowledgePrivacy(userId)).toBe(false);
  });
});

describe("recording consent confirmation", () => {
  it("records confirmation only from the meeting organizer", () => {
    const organizerId = db.createUser({
      name: "Consent Organizer",
      email: "consent-organizer@example.com",
      passwordHash: "test",
      role: "team_leader",
      team: "sales",
    });
    const memberId = db.createUser({
      name: "Consent Member",
      email: "consent-member@example.com",
      passwordHash: "test",
      role: "team_member",
      team: "sales",
    });
    const meetingId = db.createMeeting({
      title: "Consent test",
      heldAt: new Date().toISOString(),
      accessRules: [{ team: "sales", audience: "all_team", audienceUserId: null }],
      createdBy: organizerId,
    });

    expect(db.confirmMeetingRecording(meetingId, memberId)).toBe(false);
    expect(db.confirmMeetingRecording(meetingId, organizerId)).toBe(true);
  });
});

describe("retention", () => {
  it("purges expired meeting artifacts without deleting published assignments", () => {
    const managerId = db.createUser({
      name: "Retention Manager",
      email: "retention-manager@example.com",
      passwordHash: "test",
      role: "manager",
      team: null,
    });
    const memberId = db.createUser({
      name: "Retention Member",
      email: "retention-member@example.com",
      passwordHash: "test",
      role: "team_member",
      team: "web_development",
      spokenName: "ผู้รับผิดชอบ",
    });
    const meetingId = db.createMeeting({
      title: "Retention test",
      heldAt: new Date().toISOString(),
      accessRules: [{ team: "web_development", audience: "all_team", audienceUserId: null }],
      createdBy: managerId,
    });
    const fileId = db.addFile({
      meetingId,
      taskId: null,
      originalName: "retention.wav",
      storedName: "retention.wav",
      mimeType: "audio/wav",
      kind: "audio",
      size: 10,
      uploadedBy: managerId,
    });
    db.finishMeetingProcessing(
      meetingId,
      "ผู้รับผิดชอบต้องส่งรายงาน",
      [{
        task: "ส่งรายงาน",
        owner: "ผู้รับผิดชอบ",
        deadline: null,
        evidence: { timestamp: "00:00", text: "ผู้รับผิดชอบต้องส่งรายงาน" },
      }],
      { overview: "ที่ประชุมตกลงให้เก็บข้อมูล", decisions: ["เก็บข้อมูล"], risks: [], important_points: [], follow_ups: [] },
      managerId,
    );
    db.publishMeetingReview(meetingId, managerId);

    const result = db.applyRetentionPolicy(new Date(Date.now() + 31 * 86_400_000).toISOString());

    expect(result.storedNames).toContain("retention.wav");
    expect(db.getStoredFile(fileId)).toBeUndefined();
    expect(db.getMeeting(meetingId)?.transcript).toBe("");
    expect(db.getMeeting(meetingId)?.retentionDeletedAt).not.toBe("");
    expect(db.listUserTasks(db.getUser(memberId)!)).toHaveLength(1);

    const task = db.listUserTasks(db.getUser(memberId)!)[0];
    db.reviewTask(task.id, "approved", "");
    db.applyRetentionPolicy(new Date(Date.now() + 31 * 86_400_000).toISOString());
    expect(db.getTask(task.id)).toBeUndefined();
  });

  it("allows one recorded 30-day extension", () => {
    const managerId = db.createUser({
      name: "Extension Manager",
      email: "extension-manager@example.com",
      passwordHash: "test",
      role: "manager",
      team: null,
    });
    const meetingId = db.createMeeting({
      title: "Extension test",
      heldAt: new Date().toISOString(),
      accessRules: [{ team: "sales", audience: "all_team", audienceUserId: null }],
      createdBy: managerId,
    });

    expect(db.extendMeetingRetention(meetingId, managerId)).toBe(true);
    expect(db.extendMeetingRetention(meetingId, managerId)).toBe(false);
    db.applyRetentionPolicy(new Date(Date.now() + 31 * 86_400_000).toISOString());
    expect(db.getMeeting(meetingId)?.retentionDeletedAt).toBe("");
    db.applyRetentionPolicy(new Date(Date.now() + 61 * 86_400_000).toISOString());
    expect(db.getMeeting(meetingId)?.retentionDeletedAt).not.toBe("");
  });

  it("claims day-23, day-29, and deletion notices once", () => {
    const managerId = db.createUser({
      name: "Notice Manager",
      email: "notice-manager@example.com",
      passwordHash: "test",
      role: "manager",
      team: null,
    });
    const meetingId = db.createMeeting({
      title: "Notice test",
      heldAt: new Date().toISOString(),
      accessRules: [{ team: "sales", audience: "all_team", audienceUserId: null }],
      createdBy: managerId,
    });

    expect(db.listRetentionNotices(new Date(Date.now() + 23 * 86_400_000).toISOString()))
      .toContainEqual(expect.objectContaining({ meetingId, stage: "day_23" }));
    expect(db.markRetentionNoticeSent(meetingId, "day_23")).toBe(true);
    expect(db.listRetentionNotices(new Date(Date.now() + 24 * 86_400_000).toISOString()))
      .not.toContainEqual(expect.objectContaining({ meetingId, stage: "day_23" }));

    expect(db.listRetentionNotices(new Date(Date.now() + 29 * 86_400_000).toISOString()))
      .toContainEqual(expect.objectContaining({ meetingId, stage: "day_29" }));
    db.applyRetentionPolicy(new Date(Date.now() + 31 * 86_400_000).toISOString());
    expect(db.listRetentionNotices(new Date(Date.now() + 31 * 86_400_000).toISOString()))
      .toContainEqual(expect.objectContaining({ meetingId, stage: "deleted" }));
  });
});
