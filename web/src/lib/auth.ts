import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, deleteSession, findSessionUser, type User } from "@/lib/db";

const COOKIE_NAME = "saranote_session";
const SESSION_DAYS = 14;

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function startSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  createSession(tokenHash(token), userId, expires.toISOString());
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function endSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) deleteSession(tokenHash(token));
  cookieStore.delete(COOKIE_NAME);
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return token ? findSessionUser(tokenHash(token)) ?? null : null;
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireManager(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "manager") redirect("/meetings");
  return user;
}

export async function requireWorkManager(): Promise<User> {
  const user = await requireUser();
  if (user.role === "team_member") redirect("/meetings");
  return user;
}
