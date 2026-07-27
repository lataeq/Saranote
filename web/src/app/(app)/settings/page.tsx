import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireWorkManager } from "@/lib/auth";
import { deleteSetting, getSetting, setSetting } from "@/lib/db";

async function updateProcessingKey(formData: FormData) {
  "use server";
  const user = await requireWorkManager();
  const provider = String(formData.get("provider") ?? "");
  if (provider !== "typhoon" && provider !== "gemini") redirect("/settings?error=Choose+a+valid+AI+provider.");
  const keyName = `${provider}_api_key`;
  if (formData.get("intent") === "remove") {
    deleteSetting(keyName);
    redirect(`/settings?removed=${provider}`);
  }
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  if (apiKey.length < 10) redirect(`/settings?error=Enter+a+valid+${provider === "typhoon" ? "Typhoon" : "Gemini"}+API+key.`);
  setSetting(keyName, apiKey, user.id);
  redirect(`/settings?saved=${provider}`);
}

async function updatePilotMailbox(formData: FormData) {
  "use server";
  const user = await requireWorkManager();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect("/settings?error=Enter+a+valid+pilot+mailbox.");
  setSetting("pilot_email_sink", email, user.id);
  redirect("/settings?saved=mailbox");
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; removed?: string; error?: string }> }) {
  await requireWorkManager();
  const typhoonConfigured = Boolean(getSetting("typhoon_api_key"));
  const geminiConfigured = Boolean(getSetting("gemini_api_key"));
  const pilotMailbox = getSetting("pilot_email_sink") ?? "";
  const { saved, removed, error } = await searchParams;

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <p className="text-[12px] font-medium uppercase text-subtle">Workspace</p>
        <h1 className="mt-1 text-[24px] font-semibold leading-8">Settings</h1>
        <p className="mt-1 text-[13px] text-default">Configure server-side meeting processing.</p>
      </header>

      {saved ? <Alert><AlertDescription>{saved === "mailbox" ? "Pilot mailbox updated." : `${saved === "gemini" ? "Gemini" : "Typhoon"} API key updated.`}</AlertDescription></Alert> : null}
      {removed ? <Alert><AlertDescription>{removed === "gemini" ? "Gemini" : "Typhoon"} API key removed.</AlertDescription></Alert> : null}
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}

      <section className="space-y-4 border-t pt-5">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-subtle" />
          <div><h2 className="text-[16px] font-semibold">Typhoon ASR</h2><p className="text-[12px] text-subtle">Status: {typhoonConfigured ? "Configured" : "Not configured"}</p></div>
        </div>
        <form action={updateProcessingKey} className="space-y-3">
          <input type="hidden" name="provider" value="typhoon" />
          <div className="space-y-1.5">
            <Label htmlFor="typhoon-api-key">API key</Label>
            <Input id="typhoon-api-key" name="apiKey" type="password" autoComplete="off" placeholder={typhoonConfigured ? "Enter a new key to replace the current one" : "Enter Typhoon API key"} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" name="intent" value="save">Save key</Button>
            {typhoonConfigured ? <Button type="submit" name="intent" value="remove" variant="outline" formNoValidate>Remove key</Button> : null}
          </div>
        </form>
      </section>

      <section className="space-y-4 border-t pt-5">
        <div>
          <h2 className="text-[16px] font-semibold">Controlled pilot mailbox</h2>
          <p className="text-[12px] text-subtle">All pilot email notifications are routed here instead of employee addresses.</p>
        </div>
        <form action={updatePilotMailbox} className="flex flex-wrap gap-2">
          <Input name="email" type="email" defaultValue={pilotMailbox} placeholder="pilot@example.com" required className="min-w-64 flex-1" aria-label="Controlled pilot mailbox" />
          <Button type="submit">Save mailbox</Button>
        </form>
      </section>

      <section className="space-y-4 border-t pt-5">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-subtle" />
          <div><h2 className="text-[16px] font-semibold">Gemini refinement</h2><p className="text-[12px] text-subtle">Status: {geminiConfigured ? "Configured" : "Not configured"}</p></div>
        </div>
        <form action={updateProcessingKey} className="space-y-3">
          <input type="hidden" name="provider" value="gemini" />
          <div className="space-y-1.5">
            <Label htmlFor="gemini-api-key">API key</Label>
            <Input id="gemini-api-key" name="apiKey" type="password" autoComplete="off" placeholder={geminiConfigured ? "Enter a new key to replace the current one" : "Enter Gemini API key"} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" name="intent" value="save">Save key</Button>
            {geminiConfigured ? <Button type="submit" name="intent" value="remove" variant="outline" formNoValidate>Remove key</Button> : null}
          </div>
        </form>
      </section>
    </div>
  );
}
