import Link from "next/link";
import { ArrowUpRight, FileText, Search } from "lucide-react";
import { NewMeetingDialog } from "@/components/new-meeting-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { dashboardCounts, listMeetings, listUsers } from "@/lib/db";
import { canReview, meetingAudienceLabel, teamLabel } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q = "" } = await searchParams;
  const meetings = listMeetings(user, q);
  const counts = dashboardCounts(user);
  const users = user.role === "manager" ? listUsers() : [];

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium uppercase text-subtle">Workspace</p>
          <h1 className="mt-1 text-[24px] font-semibold leading-8">Meetings</h1>
          <p className="mt-1 text-[13px] text-default">Audio, documents, transcripts, and decisions in one record.</p>
        </div>
        {user.role !== "team_member" ? <NewMeetingDialog role={user.role} team={user.team} users={users} /> : null}
      </header>

      <section aria-label="Overview" className="grid overflow-hidden rounded-lg border sm:grid-cols-3">
        {[
          ["Meetings", counts.meetings],
          ["My open work", counts.myOpenTasks],
          ["Awaiting review", canReview(user.role) ? counts.reviewQueue : "—"],
        ].map(([label, value], index) => (
          <div key={label} className={`px-4 py-3 ${index ? "border-t sm:border-l sm:border-t-0" : ""}`}>
            <p className="text-[12px] text-subtle">{label}</p>
            <p className="mt-1 text-[18px] font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-[16px] font-semibold">All records</h2>
          <form className="relative w-full max-w-[280px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <Input name="q" defaultValue={q} placeholder="Search meetings" className="pl-8" />
          </form>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          {meetings.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>Meeting</TableHead><TableHead className="hidden sm:table-cell">Date</TableHead><TableHead className="hidden md:table-cell">Contents</TableHead><TableHead className="w-12"><span className="sr-only">Open</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {meetings.map((meeting) => (
                  <TableRow key={meeting.id}>
                    <TableCell>
                      <Link href={`/meetings/${meeting.id}`} className="font-medium hover:underline">{meeting.title}</Link>
                      <p className="mt-0.5 text-[12px] text-subtle sm:hidden">{formatDateTime(meeting.heldAt)}</p>
                    </TableCell>
                    <TableCell className="hidden text-default sm:table-cell">{formatDateTime(meeting.heldAt)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-wrap gap-1.5">
                        {meeting.accessRules.map((rule) => <Badge key={rule.team} variant="secondary">{teamLabel(rule.team)} · {meetingAudienceLabel(rule.audience, rule.audienceUserName ?? null)}</Badge>)}
                        <Badge variant="secondary">{meeting.fileCount} files</Badge>
                        <Badge variant="secondary">{meeting.taskCount} tasks</Badge>
                      </div>
                    </TableCell>
                    <TableCell><Link href={`/meetings/${meeting.id}`} aria-label={`Open ${meeting.title}`}><ArrowUpRight className="size-4 text-subtle" /></Link></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="grid min-h-52 place-items-center p-8 text-center">
              <div><FileText className="mx-auto size-5 text-subtle" /><p className="mt-3 font-medium">No meeting records</p><p className="mt-1 text-[12px] text-subtle">{q ? "Try a different search." : user.role === "team_member" ? `No ${teamLabel(user.team)} meeting has been added yet.` : "Create the first meeting to begin."}</p></div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
