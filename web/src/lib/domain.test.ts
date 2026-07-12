import { describe, expect, it } from "vitest";
import { canAccessMeeting, canAccessTeam, canManageTeam, canReview, canSubmitTask, isMeetingParticipant, isReviewDecision, resolveSpokenOwner, taskStatusLabel } from "./domain";

describe("assignment permissions", () => {
  it("only lets managers review", () => {
    expect(canReview("manager")).toBe(true);
    expect(canReview("team_leader")).toBe(true);
    expect(canReview("team_member")).toBe(false);
  });

  it("isolates specialty teams", () => {
    expect(canAccessTeam("manager", null, "sales")).toBe(true);
    expect(canAccessTeam("team_member", "web_development", "web_development")).toBe(true);
    expect(canAccessTeam("team_member", "web_development", "business_analysis")).toBe(false);
    expect(canManageTeam("team_leader", "ai_engineering", "ai_engineering")).toBe(true);
    expect(canManageTeam("team_leader", "ai_engineering", "sales")).toBe(false);
  });

  it("enforces mixed meeting audiences", () => {
    const rules = [
      { team: "web_development", audience: "team_leaders", audienceUserId: null },
      { team: "business_analysis", audience: "all_team", audienceUserId: null },
      { team: "sales", audience: "specific_user", audienceUserId: 9 },
    ] as const;
    expect(canAccessMeeting("manager", null, 1, [...rules])).toBe(true);
    expect(isMeetingParticipant("team_leader", "web_development", 2, [...rules])).toBe(true);
    expect(isMeetingParticipant("team_member", "web_development", 3, [...rules])).toBe(false);
    expect(isMeetingParticipant("team_member", "business_analysis", 3, [...rules])).toBe(true);
    expect(isMeetingParticipant("team_member", "sales", 9, [...rules])).toBe(true);
    expect(isMeetingParticipant("team_member", "sales", 8, [...rules])).toBe(false);
  });

  it("only lets the assignee submit non-approved work", () => {
    expect(canSubmitTask(3, 3, "pending")).toBe(true);
    expect(canSubmitTask(3, 3, "rejected")).toBe(true);
    expect(canSubmitTask(2, 3, "pending")).toBe(false);
    expect(canSubmitTask(3, 3, "submitted")).toBe(false);
    expect(canSubmitTask(3, 3, "approved")).toBe(false);
  });

  it("accepts only final manager decisions", () => {
    expect(isReviewDecision("approved")).toBe(true);
    expect(isReviewDecision("rejected")).toBe(true);
    expect(isReviewDecision("pending")).toBe(false);
  });

  it("uses readable status labels", () => {
    expect(taskStatusLabel("submitted")).toBe("In review");
    expect(taskStatusLabel("rejected")).toBe("Changes requested");
  });

  it("resolves one exact spoken-name alias", () => {
    const users = [
      { name: "Nuttasit P", spokenName: "นัทสิทธิ์พี, เต้, Tae" },
      { name: "Nuttasit T", spokenName: "นัทสิทธิ์ที" },
    ];
    expect(resolveSpokenOwner("นัทสิทธิ์พี", users)?.name).toBe("Nuttasit P");
    expect(resolveSpokenOwner("เต้", users)?.name).toBe("Nuttasit P");
    expect(resolveSpokenOwner("tae", users)?.name).toBe("Nuttasit P");
    expect(resolveSpokenOwner("นัทสิทธิ์", users)).toBeUndefined();
  });
});
