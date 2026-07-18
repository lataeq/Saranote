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
