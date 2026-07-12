import Link from "next/link";
import { Calendar, Download } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { TaskSubmissionForm } from "@/components/task-submission-form";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { listUserTasks } from "@/lib/db";
import { canSubmitTask } from "@/lib/domain";
import { formatDate } from "@/lib/format";

export default async function WorkPage() {
  const user = await requireUser();
  const tasks = listUserTasks(user);
  return (
    <div className="space-y-7">
      <header><p className="text-[12px] font-medium uppercase text-subtle">Assignments</p><h1 className="mt-1 text-[24px] font-semibold">My work</h1><p className="mt-1 text-default">Submit deliverables and follow manager decisions.</p></header>
      {tasks.length ? <div className="space-y-3">{tasks.map((task) => <article key={task.id} className="rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><Link href={`/meetings/${task.meetingId}`} className="text-[12px] text-subtle hover:text-strong hover:underline">{task.meetingTitle}</Link><h2 className="mt-1 text-[16px] font-semibold">{task.title}</h2>{task.description ? <p className="mt-1 max-w-2xl text-default">{task.description}</p> : null}</div><StatusBadge status={task.status} /></div>{task.dueAt ? <p className="mt-3 flex items-center gap-1 text-[12px] text-subtle"><Calendar className="size-3.5" /> Due {formatDate(task.dueAt)}</p> : null}{task.reviewNote ? <div className="mt-3 rounded-md bg-[#f5f5f5] p-3"><p className="text-[12px] font-medium">Manager note</p><p className="mt-1 text-default">{task.reviewNote}</p></div> : null}{task.submissionFileId ? <Button asChild variant="ghost" size="sm" className="mt-2"><a href={`/api/files/${task.submissionFileId}`}><Download className="size-4" /> {task.submissionFileName}</a></Button> : null}{canSubmitTask(user.id, task.assigneeId, task.status) ? <TaskSubmissionForm taskId={task.id} defaultText={task.submissionText} /> : null}</article>)}</div> : <div className="grid min-h-60 place-items-center rounded-lg border border-dashed p-8 text-center"><div><p className="font-medium">No assigned work</p><p className="mt-1 text-[12px] text-subtle">Tasks assigned to you will appear here.</p></div></div>}
    </div>
  );
}
