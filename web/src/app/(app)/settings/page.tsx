import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireWorkManager } from "@/lib/auth";
import { deleteSetting, getSetting, setSetting } from "@/lib/db";

async function updateTyphoonKey(formData: FormData) {
  "use server";
  const user = await requireWorkManager();
  if (formData.get("intent") === "remove") {
    deleteSetting("typhoon_api_key");
    redirect("/settings?removed=1");
  }
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  if (apiKey.length < 10) redirect("/settings?error=Enter+a+valid+Typhoon+API+key.");
  setSetting("typhoon_api_key", apiKey, user.id);
  redirect("/settings?saved=1");
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; removed?: string; error?: string }> }) {
  await requireWorkManager();
  const configured = Boolean(getSetting("typhoon_api_key"));
  const { saved, removed, error } = await searchParams;

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <p className="text-[12px] font-medium uppercase text-subtle">Workspace</p>
        <h1 className="mt-1 text-[24px] font-semibold leading-8">Settings</h1>
        <p className="mt-1 text-[13px] text-default">Configure server-side meeting processing.</p>
      </header>

      {saved ? <Alert><AlertDescription>Typhoon API key updated.</AlertDescription></Alert> : null}
      {removed ? <Alert><AlertDescription>Typhoon API key removed.</AlertDescription></Alert> : null}
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}

      <section className="space-y-4 border-t pt-5">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-subtle" />
          <div><h2 className="text-[16px] font-semibold">Typhoon ASR</h2><p className="text-[12px] text-subtle">Status: {configured ? "Configured" : "Not configured"}</p></div>
        </div>
        <form action={updateTyphoonKey} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="typhoon-api-key">API key</Label>
            <Input id="typhoon-api-key" name="apiKey" type="password" autoComplete="off" placeholder={configured ? "Enter a new key to replace the current one" : "Enter Typhoon API key"} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" name="intent" value="save">Save key</Button>
            {configured ? <Button type="submit" name="intent" value="remove" variant="outline" formNoValidate>Remove key</Button> : null}
          </div>
        </form>
      </section>
    </div>
  );
}
