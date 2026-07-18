import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { hasUsers } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!hasUsers()) redirect("/setup");
  redirect((await currentUser()) ? "/meetings" : "/login");
}
