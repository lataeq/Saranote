import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Calendar, CheckCircle2, Download, File, FileAudio, ListChecks, ListTree, Mail, UserRound } from "lucide-react";
import { delegateMeetingReviewAction, extendMeetingRetentionAction, publishMeetingReviewAction, sendMeetingSummaryEmailAction, updateTranscriptAction } from "@/app/actions/meetings";
import { DeleteFileButton } from "@/components/delete-file-button";
import { MeetingCapture } from "@/components/meeting-capture";
import { SummaryEmailSubmitButton } from "@/components/summary-email-submit-button";
import { StatusBadge } from "@/components/status-badge";
import { TaskDialog } from "@/components/task-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth";
import { getMeeting, listMeetingFiles, listMeetingTasks, listUsers } from "@/lib/db";
import { canAccessMeeting, canManageTeam, meetingAudienceLabel, meetingParticipants, teamLabel } from "@/lib/domain";
import { formatBytes, formatDate, formatDateTime } from "@/lib/format";

export default async function MeetingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ summarySent?: string; summaryError?: string; tab?: string }>;
}) {
  const user = await requireUser();
  const { summarySent, summaryError, tab } = await searchParams;
  const meetingId = Number((await params).id);
  if (!Number.isInteger(meetingId) || meetingId < 1) notFound();
  const meeting = getMeeting(meetingId);
  if (!meeting || !canAccessMeeting(user.role, user.team, user.id, meeting.accessRules)) notFound();

  const allUsers = listUsers();
  const participants = meetingParticipants(allUsers, meeting.accessRules);
  const reviewerOptions = [
    ...allUsers.filter((candidate) => candidate.id === meeting.createdById),
    ...participants.filter((candidate) => candidate.id !== meeting.createdById),
  ];
  const canSeeDraft = user.id === meeting.createdById || user.id === meeting.reviewerId;
  const isDraft = meeting.reviewStatus === "draft";
  const isReviewer = isDraft && user.id === meeting.reviewerId;
  const [files, tasks, users] = [
    listMeetingFiles(meetingId),
    listMeetingTasks(meetingId, isDraft && canSeeDraft),
    participants.filter((member) => isReviewer || user.role === "manager" || member.team === user.team),
  ];
  const canManage = user.role === "manager" || user.role === "team_leader";
  const canEditTranscript = isReviewer && !meeting.transcriptPublishedAt;
  const canEditAssignments = isReviewer && !meeting.assignmentsPublishedAt;
  const transcriptVisible = canSeeDraft || Boolean(meeting.transcriptPublishedAt);
  const summaryVisible = canSeeDraft || Boolean(meeting.summaryPublishedAt);
  const assignmentsVisible = canSeeDraft || Boolean(meeting.assignmentsPublishedAt);
  const audioFiles = files.filter((file) => file.kind === "audio");
  const documents = files.filter((file) => file.kind === "document");
  const summarySections = [
    { label: "มติที่ประชุม", icon: CheckCircle2, items: summaryVisible ? meeting.summary.decisions : [] },
    { label: "ความเสี่ยงและปัญหา", icon: AlertTriangle, items: summaryVisible ? meeting.summary.risks : [] },
    { label: "ประเด็นสำคัญ", icon: ListTree, items: summaryVisible ? meeting.summary.important_points : [] },
    { label: "งานที่ต้องติดตาม", icon: ListChecks, items: summaryVisible ? meeting.summary.follow_ups : [] },
  ];
  const hasSummary = summaryVisible && (Boolean(meeting.summary.overview) || summarySections.some((section) => section.items.length));
  const emailRecipients = users.map((member) => `${member.name} (${member.email})`).join(", ");
  const retentionDays = Math.max(0, meeting.retentionDaysRemaining);
  const canControlRetention = user.role === "manager" || user.id === meeting.createdById;

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
          {user.id === meeting.createdById ? <MeetingCapture meetingId={meeting.id} processingStatus={meeting.processingStatus} canRetry={meeting.processingStatus === "failed" && audioFiles.length > 0} /> : null}
        </div>
      </header>

      {summarySent ? <Alert className={summarySent === "duplicate" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-emerald-300 bg-emerald-50 text-emerald-950"}>{summarySent === "duplicate" ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}<AlertDescription className={summarySent === "duplicate" ? "text-amber-900" : "text-emerald-900"}>{summarySent === "duplicate" ? "Already sent — this meeting summary and recipient list have not changed." : `Sent successfully to ${emailRecipients}.`}</AlertDescription></Alert> : null}
      {summaryError ? <Alert variant="destructive"><AlertDescription>{summaryError}</AlertDescription></Alert> : null}
      {meeting.retentionDeletedAt && canControlRetention ? (
        <Alert><AlertDescription>Meeting audio, transcript, summary, and documents were deleted after the retention period. Published assignments remain available.</AlertDescription></Alert>
      ) : null}
      {!meeting.retentionDeletedAt && canControlRetention && retentionDays <= 7 ? (
        <Alert className="border-amber-300 bg-amber-50 text-amber-950">
          <AlertTriangle className="size-4" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3 text-amber-900">
            <span>Meeting artifacts will be deleted in {retentionDays} day{retentionDays === 1 ? "" : "s"} ({formatDate(meeting.retentionExpiresAt)}).</span>
            {!meeting.retentionExtendedAt ? <form action={extendMeetingRetentionAction}><input type="hidden" name="meetingId" value={meeting.id} /><Button type="submit" size="sm" variant="outline">Extend 30 days once</Button></form> : null}
          </AlertDescription>
        </Alert>
      ) : null}
      {isDraft && canSeeDraft ? (
        <Alert className="border-amber-300 bg-amber-50 text-amber-950">
          <AlertTriangle className="size-4" />
          <AlertDescription className="space-y-3 text-amber-900">
            <p>Review required before participants can see generated outputs. Reviewer: {meeting.reviewerName}.</p>
            <div className="flex flex-wrap gap-2">
              {user.id === meeting.createdById ? (
                <form action={delegateMeetingReviewAction} className="flex flex-wrap gap-2">
                  <input type="hidden" name="meetingId" value={meeting.id} />
                  <select name="reviewerId" defaultValue={meeting.reviewerId} className="h-9 rounded-md border bg-white px-3 text-[13px]" aria-label="Meeting reviewer">
                    {reviewerOptions.map((participant) => <option key={participant.id} value={participant.id}>{participant.name}</option>)}
                  </select>
                  <Button type="submit" variant="outline" size="sm">Delegate review</Button>
                </form>
              ) : null}
              {isReviewer && meeting.transcript ? (
                <>
                  {!meeting.transcriptPublishedAt ? <Button asChild size="sm" variant="outline"><Link href={`/meetings/${meeting.id}?tab=transcript`}>Review or correct transcript</Link></Button> : null}
                  {!meeting.transcriptPublishedAt ? <form action={publishMeetingReviewAction}><input type="hidden" name="meetingId" value={meeting.id} /><input type="hidden" name="output" value="transcript" /><Button type="submit" size="sm">Approve transcript</Button></form> : null}
                  {!meeting.summaryPublishedAt ? <form action={publishMeetingReviewAction}><input type="hidden" name="meetingId" value={meeting.id} /><input type="hidden" name="output" value="summary" /><Button type="submit" size="sm">Approve summary</Button></form> : null}
                  {!meeting.assignmentsPublishedAt ? <form action={publishMeetingReviewAction}><input type="hidden" name="meetingId" value={meeting.id} /><input type="hidden" name="output" value="assignments" /><Button type="submit" size="sm">Approve assignments</Button></form> : null}
                  <form action={publishMeetingReviewAction}><input type="hidden" name="meetingId" value={meeting.id} /><Button type="submit" size="sm" variant="outline">Approve all outputs</Button></form>
                </>
              ) : null}
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
      {isDraft && !canSeeDraft ? <Alert><AlertDescription>The transcript, summary, and assignments are awaiting organizer review.</AlertDescription></Alert> : null}

      <Tabs defaultValue={tab === "transcript" ? "transcript" : "overview"}>
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
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[16px] font-semibold">สรุปการประชุม</h2>
              {meeting.transcriptPublishedAt && meeting.summaryPublishedAt && meeting.transcript && user.role === "manager" ? <form action={sendMeetingSummaryEmailAction}><input type="hidden" name="meetingId" value={meeting.id} /><SummaryEmailSubmitButton /></form> : null}
            </div>
            {meeting.summaryEmailSentAt ? <div className="mb-3 flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-950"><Mail className="mt-0.5 size-4 shrink-0" /><div><p className="text-[13px] font-medium">Last emailed {formatDateTime(meeting.summaryEmailSentAt)}</p><p className="mt-0.5 text-[12px] text-emerald-800">To: {meeting.summaryEmailRecipients.join(", ")}</p></div></div> : null}
            {summaryVisible && meeting.summary.overview ? <div className="mb-4 rounded-lg border bg-[#fafafa] p-4"><h3 className="text-[13px] font-medium">ภาพรวมการประชุมโดย AI</h3><p className="mt-2 whitespace-pre-wrap leading-6 text-default">{meeting.summary.overview}</p></div> : null}
            {summaryVisible && hasSummary ? <p className="mb-3 text-[12px] text-subtle">{meeting.refinementError ? "Gemini was unavailable. The sections below are fallback extracts from transcript keywords and action items." : "Gemini generated the overview, decisions, risks, and important points. Follow-up work comes from transcript action-item detection. Review all output against the transcript before approval."}</p> : null}
            {hasSummary ? <div className="grid border-y sm:grid-cols-2">{summarySections.map((section, index) => { const Icon = section.icon; return <div key={section.label} className={`p-4 ${index > 1 ? "border-t" : ""} ${index % 2 ? "sm:border-l" : ""} ${index === 1 ? "border-t sm:border-t-0" : ""}`}><div className="mb-2 flex items-center gap-2"><Icon className="size-4 text-subtle" /><h3 className="text-[13px] font-medium">{section.label}</h3></div>{section.items.length ? <ul className="space-y-2 text-default">{section.items.map((item) => <li key={item} className="leading-5">{item}</li>)}</ul> : <p className="text-[12px] text-subtle">None detected.</p>}</div>; })}</div> : <div className="border-y py-6 text-center text-[12px] text-subtle">{summaryVisible ? "Process meeting audio to generate the AI summary." : "Summary hidden until its review is approved."}</div>}
          </section>
          <section>
            <h2 className="mb-3 text-[16px] font-semibold">Recordings</h2>
            {audioFiles.length ? <div className="space-y-2">{audioFiles.map((file) => <div key={file.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"><FileAudio className="size-4 text-subtle" /><div className="min-w-0 flex-1"><p className="truncate font-medium">{file.originalName}</p><p className="text-[12px] text-subtle">{formatBytes(file.size)} · {file.uploadedByName}</p></div><audio controls preload="metadata" className="h-8 w-full max-w-[340px]" src={`/api/files/${file.id}`} />{canManage ? <DeleteFileButton fileId={file.id} fileName={file.originalName} /> : null}</div>)}</div> : <div className="rounded-lg border border-dashed p-6 text-center text-[12px] text-subtle">No audio has been recorded or uploaded.</div>}
          </section>
        </TabsContent>

        <TabsContent value="transcript" className="mt-5">
          <div className="mb-3"><h2 className="text-[16px] font-semibold">Meeting transcript</h2><p className="mt-1 text-[12px] text-subtle">Audio recordings and uploads are transcribed automatically; leaders can correct the result.</p></div>
          {meeting.processingStatus === "failed" && !meeting.transcript ? <Alert variant="destructive" className="mb-3"><AlertDescription>{meeting.processingError}</AlertDescription></Alert> : null}
          {meeting.refinementError ? <Alert className="mb-3 border-amber-300 bg-amber-50 text-amber-950"><AlertTriangle className="size-4" /><AlertDescription className="text-amber-900">Gemini refinement was unavailable. The original transcription is preserved below for manual correction and approval.</AlertDescription></Alert> : null}
          {canSeeDraft && meeting.corrections.length ? (
            <section className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
              <h3 className="font-medium text-amber-950">Gemini changes · approval required</h3>
              <p className="mt-1 text-[12px] text-amber-800">Compare each suggestion with the recording. Publishing accepts the reviewed transcript.</p>
              <div className="mt-3 divide-y divide-amber-200">
                {meeting.corrections.map((correction, index) => (
                  <article key={`${correction.timestamp}-${index}`} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-[12px] font-medium text-amber-900">{correction.timestamp || "Transcript segment"}</p>
                    <p className="mt-1 text-red-800"><span className="text-[12px] font-medium">Before:</span> <s>{correction.before}</s></p>
                    <p className="mt-1 text-emerald-900"><span className="text-[12px] font-medium">Suggested:</span> {correction.after}</p>
                  </article>
                ))}
              </div>
              <details className="mt-3 text-[12px] text-amber-900">
                <summary className="cursor-pointer font-medium">View preserved pre-Gemini transcript</summary>
                <pre className="mt-2 whitespace-pre-wrap font-sans leading-5">{meeting.rawTranscript}</pre>
              </details>
            </section>
          ) : null}
          {canEditTranscript ? (
            <form action={updateTranscriptAction} className="space-y-3">
              <input type="hidden" name="meetingId" value={meeting.id} />
              <Textarea name="transcript" defaultValue={meeting.transcript} rows={18} placeholder="Paste or import the meeting transcript here…" className="leading-6" />
              <Button type="submit">Save corrected transcript</Button>
            </form>
          ) : transcriptVisible && meeting.transcript ? <div className="whitespace-pre-wrap rounded-lg border p-4 leading-6">{meeting.transcript}</div> : <div className="rounded-lg border border-dashed p-6 text-center text-[12px] text-subtle">{transcriptVisible ? "No transcript is available yet." : "Transcript hidden until its review is published."}</div>}
        </TabsContent>

        <TabsContent value="files" className="mt-5">
          <div className="mb-3"><h2 className="text-[16px] font-semibold">Meeting documents</h2><p className="mt-1 text-[12px] text-subtle">PDF, PowerPoint, Word, and text files imported for this meeting.</p></div>
          {documents.length ? <div className="overflow-hidden rounded-lg border">{documents.map((file, index) => <div key={file.id} className={`flex items-center gap-3 p-3 ${index ? "border-t" : ""}`}><File className="size-4 text-subtle" /><div className="min-w-0 flex-1"><p className="truncate font-medium">{file.originalName}</p><p className="text-[12px] text-subtle">{formatBytes(file.size)} · {file.uploadedByName}</p></div><Button asChild variant="ghost" size="icon-sm"><a href={`/api/files/${file.id}`} aria-label={`Download ${file.originalName}`}><Download className="size-4" /></a></Button>{canManage ? <DeleteFileButton fileId={file.id} fileName={file.originalName} /> : null}</div>)}</div> : <div className="rounded-lg border border-dashed p-6 text-center text-[12px] text-subtle">No documents imported.</div>}
        </TabsContent>

        <TabsContent value="actions" className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-[16px] font-semibold">Assignments</h2><p className="mt-1 text-[12px] text-subtle">Track accountable work from this meeting.</p></div>{canEditAssignments || (meeting.assignmentsPublishedAt && canManage) ? <TaskDialog meetingId={meeting.id} users={users} /> : null}</div>
          {assignmentsVisible && meeting.extractedActions.length ? <section className="mb-5"><h3 className="mb-2 text-[13px] font-medium">Detected from transcript</h3><div className="divide-y rounded-lg border">{meeting.extractedActions.map((action, index) => <article key={`${action.owner}-${action.task}-${index}`} className="p-3"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{action.task}</p><Badge variant="secondary">{action.owner}</Badge>{action.deadline ? <Badge variant="secondary">Due {action.deadline}</Badge> : null}</div><p className="mt-1 text-[12px] text-subtle">{action.evidence.timestamp} · {action.evidence.text}</p></article>)}</div><p className="mt-2 text-[12px] text-subtle">Review detected owners before publishing employee assignments.</p></section> : null}
          {tasks.length ? <div className="space-y-2">{tasks.map((task) => <article key={task.id} className="rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-[14px] font-medium">{task.title}</h3>{task.description ? <p className="mt-1 max-w-2xl text-default">{task.description}</p> : null}</div><div className="flex items-center gap-1"><StatusBadge status={task.status} />{task.status === "pending" && (canEditAssignments || (meeting.assignmentsPublishedAt && canManageTeam(user.role, user.team, task.assigneeTeam))) ? <TaskDialog meetingId={meeting.id} users={users} task={task} /> : null}</div></div><div className="mt-3 flex flex-wrap gap-4 text-[12px] text-subtle"><span className="flex items-center gap-1"><UserRound className="size-3.5" /> {task.assigneeName} · {teamLabel(task.assigneeTeam)}</span>{task.dueAt ? <span className="flex items-center gap-1"><Calendar className="size-3.5" /> Due {formatDate(task.dueAt)}</span> : null}</div>{task.submissionText ? <div className="mt-3 border-t pt-3"><p className="text-[12px] font-medium">Latest submission</p><p className="mt-1 whitespace-pre-wrap text-default">{task.submissionText}</p></div> : null}</article>)}</div> : <div className="rounded-lg border border-dashed p-6 text-center text-[12px] text-subtle">{assignmentsVisible ? "No assignments created for this meeting." : "Assignments hidden until their review is published."}</div>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
