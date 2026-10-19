import { redirect } from "next/navigation";
import { acknowledgePrivacyAction } from "@/app/actions/auth";
import { AuthPanel } from "@/components/auth-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.privacyAcknowledgedAt) redirect("/meetings");
  const { error } = await searchParams;

  return (
    <AuthPanel
      eyebrow="Workspace privacy"
      title="Privacy acknowledgment"
      description="Read this once before using Saranote."
    >
      {error ? <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <ul className="mb-5 list-disc space-y-2 pl-5 text-[13px] leading-5 text-default">
        <li>Only registered workspace members may participate.</li>
        <li>Meetings may be recorded, transcribed by Typhoon, and refined by Gemini.</li>
        <li>Raw audio, transcripts, summaries, and meeting documents are retained for 30 days unless extended once.</li>
        <li>The organizer must inform everyone before each recording starts.</li>
      </ul>
      <form action={acknowledgePrivacyAction} className="space-y-4">
        <label className="flex items-start gap-2 text-[13px] leading-5">
          <input className="mt-1 size-4" type="checkbox" name="agree" value="yes" required />
          <span>I understand this privacy notice and the meeting-data retention policy.</span>
        </label>
        <Button className="w-full" type="submit">Acknowledge and continue</Button>
      </form>
    </AuthPanel>
  );
}
