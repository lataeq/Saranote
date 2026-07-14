import Link from "next/link";
import { ArrowUpRight, FileText, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireUser } from "@/lib/auth";
import { listWorkspaceSearchEntries } from "@/lib/db";
import { searchWorkspaceEntries } from "@/lib/workspace-search";

const sourceLabel = {
  transcript: "Transcript",
  document: "Document",
  decision: "Decision",
  assignment: "Assignment",
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const query = (await searchParams).q?.trim() ?? "";
  const results = query ? searchWorkspaceEntries(query, listWorkspaceSearchEntries(user)) : [];
  const answer = results[0];
  const answerText = answer?.source === "assignment"
    ? results.filter((result) => result.source === "assignment" && result.meetingId === answer.meetingId).slice(0, 3).map((result) => result.text).join(" ")
    : answer?.text;

  return (
    <div className="space-y-7">
      <header>
        <p className="text-[12px] font-medium uppercase text-subtle">Workspace</p>
        <h1 className="mt-1 text-[24px] font-semibold leading-8">Search and ask</h1>
        <p className="mt-1 text-[13px] text-default">Find evidence across transcripts, documents, decisions, and assignments.</p>
      </header>

      <form className="flex max-w-3xl gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
          <Input name="q" defaultValue={query} placeholder="Ask about a meeting, decision, document, or owner" className="h-10 pl-9" aria-label="Workspace question" />
        </div>
        <Button type="submit" className="h-10">Search</Button>
      </form>

      {query ? (
        answer ? (
          <>
            <section className="border-y py-5" aria-labelledby="answer-heading">
              <p id="answer-heading" className="text-[12px] font-medium text-subtle">Grounded answer</p>
              <p className="mt-2 max-w-3xl text-[16px] leading-6">{answerText}</p>
              <Link href={`/meetings/${answer.meetingId}`} className="mt-3 inline-flex items-center gap-1 text-[12px] text-default hover:text-strong hover:underline">
                {answer.meetingTitle} · {answer.location}<ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            </section>

            <section>
              <h2 className="mb-3 text-[16px] font-semibold">Sources ({results.length})</h2>
              <div className="divide-y border-y">
                {results.map((result, index) => (
                  <article key={`${result.source}-${result.meetingId}-${result.location}-${index}`} className="py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{sourceLabel[result.source]}</Badge>
                      <span className="text-[12px] text-subtle">{result.location}</span>
                    </div>
                    <p className="mt-2 max-w-3xl leading-5 text-default">{result.text}</p>
                    <Link href={`/meetings/${result.meetingId}`} className="mt-2 inline-flex items-center gap-1 font-medium hover:underline">
                      {result.meetingTitle}<ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : (
          <div className="grid min-h-56 place-items-center border-y p-8 text-center">
            <div><FileText className="mx-auto size-5 text-subtle" /><p className="mt-3 font-medium">No supporting evidence found</p><p className="mt-1 text-[12px] text-subtle">Try a shorter phrase or a name used in the meeting.</p></div>
          </div>
        )
      ) : (
        <div className="grid min-h-56 place-items-center border-y p-8 text-center">
          <div><Search className="mx-auto size-5 text-subtle" /><p className="mt-3 font-medium">Search your workspace</p><p className="mt-1 text-[12px] text-subtle">Results only include meetings you can access.</p></div>
        </div>
      )}
    </div>
  );
}
