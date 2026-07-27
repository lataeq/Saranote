import { unlink } from "node:fs/promises";
import path from "node:path";
import { AppShell } from "@/components/app-shell";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { applyRetentionPolicy, uploadsDirectory } from "@/lib/db";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!user.privacyAcknowledgedAt) redirect("/privacy");
  const expired = applyRetentionPolicy();
  await Promise.all(expired.storedNames.map((storedName) => unlink(path.join(uploadsDirectory, storedName)).catch(() => undefined)));
  return <AppShell user={user}>{children}</AppShell>;
}
