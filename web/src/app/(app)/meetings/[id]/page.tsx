import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Download, File, FileAudio, UserRound } from "lucide-react";
import { updateTranscriptAction } from "@/app/actions/meetings";
import { MeetingCapture } from "@/components/meeting-capture";
import { StatusBadge } from "@/components/status-badge";
import { TaskDialog } from "@/components/task-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth";
import { getMeeting, listMeetingFiles, listMeetingTasks, listUsers } from "@/lib/db";
import { canAccessMeeting, canManageTeam, isMeetingParticipant, meetingAudienceLabel, teamLabel } from "@/lib/domain";
import { formatBytes, formatDate, formatDateTime } from "@/lib/format";

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const meetingId = Number((await params).id);
  if (!Number.isInteger(meetingId) || meetingId < 1) notFound();
  const meeting = getMeeting(meetingId);
  if (!meeting || !canAccessMeeting(user.role, user.team, user.id, meeting.accessRules)) notFound();

  const [files, tasks, users] = [
    listMeetingFiles(meetingId),
    listMeetingTasks(meetingId),
    listUsers().filter((member) => isMeetingParticipant(
      member.role,
      member.team,
      member.id,
      meeting.accessRules,
    ) && (user.role === "manager" || member.team === user.team)),
  ];
  const canManage = user.role === "manager" || user.role === "team_leader";
  const audioFiles = files.filter((file) => file.kind === "audio");
  const documents = files.filter((file) => file.kind === "document");

  return (
    <div className="space-y-6">
      <header>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3"><Link href="/meetings"><ArrowLeft className="size-4" /> Meetings</Link></Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="secondary" className="font-normal capitalize">{meeting.status}</Badge>{meeting.accessRules.map((rule) => <Badge key={rule.team} variant="secondary" className="font-normal">{teamLabel(rule.team)} · {meetingAudienceLabel(rule.audience, rule.audienceUserName ?? null)}</Badge>)}<span className="text-[12px] text-subtle">Created by {meeting.createdByName}</span></div>
            <h1 className="max-w-3xl text-[24px] font-semibold leading-8">{meeting.title}</h1>
            <div className="mt-2 flex items-center gap-1.5 text-[13px] text-default"><Calendar className="size-4" /> {formatDateTime(meeting.heldAt)}</div>
          </div>
          {user.role !== "team_member" ? <MeetingCapture meetingId={meeting.id} /> : null}
        </div>
      </header>

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start overflow-x-auto rounded-md bg-[#f5f5f5]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="files">Files ({files.length})</TabsTrigger>
          <TabsTrigger value="actions">Assignments ({tasks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5 space-y-6">
          <section className="grid gap-4 rounded-lg border p-4 sm:grid-cols-3">
            <div><p className="text-[12px] text-subtle">Meeting date</p><p className="mt-1 font-medium">{formatDate(meeting.heldAt)}</p></div>
            <div><p className="text-[12px] text-subtle">Stored files</p><p className="mt-1 font-medium">{files.length}</p></div>
            <div><p className="text-[12px] text-subtle">Assignments</p><p className="mt-1 font-medium">{tasks.length}</p></div>
          </section>
          <section>
            <h2 className="mb-3 text-[16px] font-semibold">Recordings</h2>
            {audioFiles.length ? <div className="space-y-2">{audioFiles.map((file) => <div key={file.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"><FileAudio className="size-4 text-subtle" /><div className="min-w-0 flex-1"><p className="truncate font-medium">{file.originalName}</p><p className="text-[12px] text-subtle">{formatBytes(file.size)} · {file.uploadedByName}</p></div><audio controls preload="metadata" className="h-8 w-full max-w-[340px]" src={`/api/files/${file.id}`} /></div>)}</div> : <div className="rounded-lg border border-dashed p-6 text-center text-[12px] text-subtle">No audio has been recorded or uploaded.</div>}
          </section>
        </TabsContent>

        <TabsContent value="transcript" className="mt-5">
          <div className="mb-3"><h2 className="text-[16px] font-semibold">Meeting transcript</h2><p className="mt-1 text-[12px] text-subtle">Audio recordings and uploads are transcribed automatically; leaders can correct the result.</p></div>
          {meeting.processingStatus === "failed" ? <Alert variant="destructive" className="mb-3"><AlertDescription>{meeting.processingError}</AlertDescription></Alert> : null}
          {canManage ? (
            <form action={updateTranscriptAction} className="space-y-3">
              <input type="hidden" name="meetingId" value={meeting.id} />
              <Textarea name="transcript" defaultValue={meeting.transcript} rows={18} placeholder="Paste or import the meeting transcript here…" className="leading-6" />
              <Button type="submit">Save transcript</Button>
            </form>
          ) : meeting.transcript ? <div className="whitespace-pre-wrap rounded-lg border p-4 leading-6">{meeting.transcript}</div> : <div className="rounded-lg border border-dashed p-6 text-center text-[12px] text-subtle">No transcript is available yet.</div>}
        </TabsContent>

        <TabsContent value="files" className="mt-5">
          <div className="mb-3"><h2 className="text-[16px] font-semibold">Meeting documents</h2><p className="mt-1 text-[12px] text-subtle">PDF, PowerPoint, Word, and text files imported for this meeting.</p></div>
          {documents.length ? <div className="overflow-hidden rounded-lg border">{documents.map((file, index) => <div key={file.id} className={`flex items-center gap-3 p-3 ${index ? "border-t" : ""}`}><File className="size-4 text-subtle" /><div className="min-w-0 flex-1"><p className="truncate font-medium">{file.originalName}</p><p className="text-[12px] text-subtle">{formatBytes(file.size)} · {file.uploadedByName}</p></div><Button asChild variant="ghost" size="icon-sm"><a href={`/api/files/${file.id}`} aria-label={`Download ${file.originalName}`}><Download className="size-4" /></a></Button></div>)}</div> : <div className="rounded-lg border border-dashed p-6 text-center text-[12px] text-subtle">No documents imported.</div>}
        </TabsContent>

        <TabsContent value="actions" className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-[16px] font-semibold">Assignments</h2><p className="mt-1 text-[12px] text-subtle">Track accountable work from this meeting.</p></div>{canManage ? <TaskDialog meetingId={meeting.id} users={users} /> : null}</div>
          {meeting.extractedActions.length ? <section className="mb-5"><h3 className="mb-2 text-[13px] font-medium">Detected from transcript</h3><div className="divide-y rounded-lg border">{meeting.extractedActions.map((action, index) => <article key={`${action.owner}-${action.task}-${index}`} className="p-3"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{action.task}</p><Badge variant="secondary">{action.owner}</Badge>{action.deadline ? <Badge variant="secondary">Due {action.deadline}</Badge> : null}</div><p className="mt-1 text-[12px] text-subtle">{action.evidence.timestamp} · {action.evidence.text}</p></article>)}</div><p className="mt-2 text-[12px] text-subtle">Review detected owners before creating employee assignments.</p></section> : null}
          {tasks.length ? <div className="space-y-2">{tasks.map((task) => <article key={task.id} className="rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-[14px] font-medium">{task.title}</h3>{task.description ? <p className="mt-1 max-w-2xl text-default">{task.description}</p> : null}</div><div className="flex items-center gap-1"><StatusBadge status={task.status} />{task.status === "pending" && canManageTeam(user.role, user.team, task.assigneeTeam) ? <TaskDialog meetingId={meeting.id} users={users} task={task} /> : null}</div></div><div className="mt-3 flex flex-wrap gap-4 text-[12px] text-subtle"><span className="flex items-center gap-1"><UserRound className="size-3.5" /> {task.assigneeName} · {teamLabel(task.assigneeTeam)}</span>{task.dueAt ? <span className="flex items-center gap-1"><Calendar className="size-3.5" /> Due {formatDate(task.dueAt)}</span> : null}</div>{task.submissionText ? <div className="mt-3 border-t pt-3"><p className="text-[12px] font-medium">Latest submission</p><p className="mt-1 whitespace-pre-wrap text-default">{task.submissionText}</p></div> : null}</article>)}</div> : <div className="rounded-lg border border-dashed p-6 text-center text-[12px] text-subtle">No assignments created for this meeting.</div>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
