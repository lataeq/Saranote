import { describe, expect, it } from "vitest";
import { searchWorkspaceEntries, type WorkspaceSearchEntry } from "./workspace-search";

const entries: WorkspaceSearchEntry[] = [
  { source: "transcript", meetingId: 1, meetingTitle: "Budget", location: "transcript-03", text: "ย้ายงบประมาณไปสนับสนุนงานอบรมทีมงาน" },
  { source: "assignment", meetingId: 2, meetingTitle: "Website", location: "Nuttasit P", text: "เขียนยูนิเทสหน้าล็อกอิน Assigned to Nuttasit P", searchText: "มอบหมายงานให้นัทสิทธิ์พี" },
];

describe("workspace search", () => {
  it("finds Thai question evidence and rejects unrelated text", () => {
    expect(searchWorkspaceEntries("ย้ายงบประมาณไปสนับสนุนอะไร", entries)[0].meetingId).toBe(1);
    expect(searchWorkspaceEntries("แผนการตลาดเดือนหน้า", entries)).toEqual([]);
  });

  it("searches assignment owners", () => {
    expect(searchWorkspaceEntries("Nuttasit P", entries)[0].source).toBe("assignment");
    expect(searchWorkspaceEntries("นัทสิทธิ์พีต้องทำอะไร", entries)[0].source).toBe("assignment");
  });
});
