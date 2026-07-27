"use server";

import { redirect } from "next/navigation";
import { endSession, requireManager, requireUser, startSession } from "@/lib/auth";
import { acknowledgePilotPrivacy, createUser, findUserCredentials, getUser, hasUsers, updateUserAccess } from "@/lib/db";
import { isSpecialtyTeam, isUserRole } from "@/lib/domain";
import { hashPassword, verifyPassword } from "@/lib/password";

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function authError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function setupManagerAction(formData: FormData): Promise<void> {
  if (hasUsers()) redirect("/login");
  const name = field(formData, "name");
  const email = field(formData, "email");
  const password = field(formData, "password");

  if (name.length < 2) authError("/setup", "Enter your full name.");
  if (!validEmail(email)) authError("/setup", "Enter a valid email address.");
  if (password.length < 10) authError("/setup", "Password must be at least 10 characters.");

  const userId = createUser({ name, email, passwordHash: hashPassword(password), role: "manager", team: null });
  await startSession(userId);
  redirect("/privacy");
}

export async function loginAction(formData: FormData): Promise<void> {
  const email = field(formData, "email");
  const password = field(formData, "password");
  const role = field(formData, "role");
  const team = field(formData, "team");
  const user = findUserCredentials(email);

  const accessMatches = user
    && isUserRole(role)
    && user.role === role
    && (role === "manager" || isSpecialtyTeam(team) && user.team === team);
  if (!user || !verifyPassword(password, user.passwordHash) || !accessMatches) {
    authError("/login", "Email, password, role, or specialty is incorrect.");
  }

  await startSession(user.id);
  redirect(user.privacyAcknowledgedAt ? "/meetings" : "/privacy");
}

export async function acknowledgePilotPrivacyAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (field(formData, "agree") !== "yes") authError("/privacy", "You must acknowledge the pilot privacy notice to continue.");
  acknowledgePilotPrivacy(user.id);
  redirect("/meetings");
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}

export async function createTeamMemberAction(formData: FormData): Promise<void> {
  await requireManager();
  const name = field(formData, "name");
  const email = field(formData, "email");
  const password = field(formData, "password");
  const spokenName = field(formData, "spokenName");
  const rawRole = field(formData, "role");
  const rawTeam = field(formData, "team");
  const role = isUserRole(rawRole) ? rawRole : "team_member";
  const team = isSpecialtyTeam(rawTeam) ? rawTeam : null;

  if (name.length < 2 || !validEmail(email) || password.length < 10 || (role !== "manager" && !team)) {
    authError("/team", "Name, valid email, 10-character password, role, and specialty are required.");
  }

  if (findUserCredentials(email)) authError("/team", "That email is already in use.");
  createUser({ name, email, passwordHash: hashPassword(password), role, team, spokenName });
  redirect("/team?created=1");
}

export async function updateTeamMemberAction(formData: FormData): Promise<void> {
  const manager = await requireManager();
  const userId = Number(formData.get("userId"));
  const rawRole = field(formData, "role");
  const rawTeam = field(formData, "team");
  const spokenName = field(formData, "spokenName");
  const member = Number.isInteger(userId) ? getUser(userId) : undefined;
  if (!member || !isUserRole(rawRole)) return;
  const team = isSpecialtyTeam(rawTeam) ? rawTeam : null;
  if (rawRole !== "manager" && !team) authError("/team", "Select a specialty for team leaders and members.");
  if (member.id === manager.id && rawRole !== "manager") authError("/team", "You cannot remove your own manager access.");
  updateUserAccess(member.id, rawRole, team, spokenName);
  redirect("/team?updated=1");
}
