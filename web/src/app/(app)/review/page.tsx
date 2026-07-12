import Link from "next/link";
import { Download, UserRound } from "lucide-react";
import { reviewTaskAction } from "@/app/actions/meetings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireWorkManager } from "@/lib/auth";
import { listTasksForReview } from "@/lib/db";
import { teamLabel } from "@/lib/domain";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireWorkManager();
  const tasks = listTasksForReview(user);
  const { error } = await searchParams;
  return (
    <div className="space-y-7">
      <header><p className="text-[12px] font-medium uppercase text-subtle">Manager queue</p><h1 className="mt-1 text-[24px] font-semibold">Review</h1><p className="mt-1 text-default">Approve completed work or return it with a clear note.</p></header>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {tasks.length ? <div className="space-y-3">{tasks.map((task) => <article key={task.id} className="rounded-lg border p-4"><Link href={`/meetings/${task.meetingId}`} className="text-[12px] text-subtle hover:underline">{task.meetingTitle}</Link><div className="mt-1 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-[16px] font-semibold">{task.title}</h2><p className="mt-1 flex items-center gap-1 text-[12px] text-subtle"><UserRound className="size-3.5" /> {task.assigneeName} · {teamLabel(task.assigneeTeam)}</p></div></div><div className="mt-4 rounded-md bg-[#f5f5f5] p-3"><p className="text-[12px] font-medium">Submission</p><p className="mt-1 whitespace-pre-wrap text-default">{task.submissionText || "File attachment only"}</p>{task.submissionFileId ? <Button asChild variant="ghost" size="sm" className="mt-2 -ml-2"><a href={`/api/files/${task.submissionFileId}`}><Download className="size-4" /> {task.submissionFileName}</a></Button> : null}</div><form action={reviewTaskAction} className="mt-4 space-y-3"><input type="hidden" name="taskId" value={task.id} /><div className="space-y-1.5"><Label htmlFor={`review-${task.id}`}>Review note</Label><Textarea id={`review-${task.id}`} name="note" rows={2} placeholder="Required when requesting changes" /></div><div className="flex gap-2"><Button name="decision" value="approved" type="submit">Approve</Button><Button name="decision" value="rejected" type="submit" variant="outline">Request changes</Button></div></form></article>)}</div> : <div className="grid min-h-60 place-items-center rounded-lg border border-dashed p-8 text-center"><div><p className="font-medium">Review queue is clear</p><p className="mt-1 text-[12px] text-subtle">Employee submissions awaiting a decision will appear here.</p></div></div>}
    </div>
  );
}
