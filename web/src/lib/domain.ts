export const USER_ROLES = ["manager", "team_leader", "team_member"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SPECIALTY_TEAMS = ["web_development", "business_analysis", "ai_engineering", "sales"] as const;
export type SpecialtyTeam = (typeof SPECIALTY_TEAMS)[number];

export const MEETING_AUDIENCES = ["all_team", "team_leaders", "team_members", "specific_user"] as const;
export type MeetingAudience = (typeof MEETING_AUDIENCES)[number];

export type MeetingAccessRule = {
  team: SpecialtyTeam;
  audience: MeetingAudience;
  audienceUserId: number | null;
  audienceUserName?: string | null;
};

export const TASK_STATUSES = ["pending", "submitted", "approved", "rejected"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const REVIEW_DECISIONS = ["approved", "rejected"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

export function isSpecialtyTeam(value: string): value is SpecialtyTeam {
  return SPECIALTY_TEAMS.includes(value as SpecialtyTeam);
}

export function isMeetingAudience(value: string): value is MeetingAudience {
  return MEETING_AUDIENCES.includes(value as MeetingAudience);
}

export function resolveSpokenOwner<T extends { name: string; spokenName: string }>(owner: string, users: T[]): T | undefined {
  const normalized = owner.toLowerCase().replace(/\s+/g, "");
  const matches = users.filter((user) => [user.name, ...user.spokenName.split(/[,;\n]/)].some((name) => name.trim().toLowerCase().replace(/\s+/g, "") === normalized));
  return matches.length === 1 ? matches[0] : undefined;
}

export function isMeetingParticipant(
  role: UserRole,
  userTeam: SpecialtyTeam | null,
  userId: number,
  rules: MeetingAccessRule[],
): boolean {
  if (!userTeam) return false;
  return rules.some((rule) => {
    if (userTeam !== rule.team) return false;
    if (rule.audience === "all_team") return role !== "manager";
    if (rule.audience === "team_leaders") return role === "team_leader";
    if (rule.audience === "team_members") return role === "team_member";
    return userId === rule.audienceUserId;
  });
}

export function canAccessMeeting(
  role: UserRole,
  userTeam: SpecialtyTeam | null,
  userId: number,
  rules: MeetingAccessRule[],
): boolean {
  return role === "manager" || isMeetingParticipant(role, userTeam, userId, rules);
}

export function canAccessTeam(role: UserRole, userTeam: SpecialtyTeam | null, targetTeam: SpecialtyTeam | null): boolean {
  return role === "manager" || (!!userTeam && userTeam === targetTeam);
}

export function canManageTeam(role: UserRole, userTeam: SpecialtyTeam | null, targetTeam: SpecialtyTeam | null): boolean {
  return role === "manager" || (role === "team_leader" && !!userTeam && userTeam === targetTeam);
}

export function canReview(role: UserRole): boolean {
  return role === "manager" || role === "team_leader";
}

export function canSubmitTask(userId: number, assigneeId: number, status: TaskStatus): boolean {
  return userId === assigneeId && (status === "pending" || status === "rejected");
}

export function isReviewDecision(value: string): value is ReviewDecision {
  return REVIEW_DECISIONS.includes(value as ReviewDecision);
}

export function roleLabel(role: UserRole): string {
  return { manager: "Manager", team_leader: "Team leader", team_member: "Team member" }[role];
}

export function teamLabel(team: SpecialtyTeam | null): string {
  if (!team) return "Unassigned";
  return {
    web_development: "Web Development",
    business_analysis: "Business Analysis",
    ai_engineering: "AI Engineering",
    sales: "Sales",
  }[team];
}

export function meetingAudienceLabel(audience: MeetingAudience, audienceUserName: string | null): string {
  return {
    all_team: "Everyone in team",
    team_leaders: "Team leaders only",
    team_members: "Team members only",
    specific_user: audienceUserName ?? "Specific person",
  }[audience];
}

export function taskStatusLabel(status: TaskStatus): string {
  return {
    pending: "Pending",
    submitted: "In review",
    approved: "Approved",
    rejected: "Changes requested",
  }[status];
}
