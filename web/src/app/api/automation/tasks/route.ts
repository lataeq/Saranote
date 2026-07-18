import { timingSafeEqual } from "node:crypto";
import { listUsers, listUserTasks } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.SARANOTE_N8N_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Automation API is not configured." }, { status: 503 });

  const expected = Buffer.from(secret);
  const provided = Buffer.from(request.headers.get("x-saranote-secret") ?? "");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const appBaseUrl = process.env.SARANOTE_APP_BASE_URL?.replace(/\/+$/, "") ?? new URL(request.url).origin;
  const tasks = listUsers()
    .filter((user) => user.role !== "manager")
    .flatMap((assignee) => listUserTasks(assignee)
      .filter((task) => task.dueAt && (task.status === "pending" || task.status === "rejected"))
      .map((task) => ({
        task: {
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          dueAt: task.dueAt,
          url: `${appBaseUrl}/work`,
        },
        meeting: { id: task.meetingId, title: task.meetingTitle, url: `${appBaseUrl}/meetings/${task.meetingId}` },
        assignee: { id: assignee.id, name: assignee.name, email: assignee.email, role: assignee.role, team: assignee.team },
      })));

  return Response.json({ generatedAt: new Date().toISOString(), tasks });
}
