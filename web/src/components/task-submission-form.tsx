"use client";

import { useRef, useState } from "react";
import { Send, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function TaskSubmissionForm({ taskId, defaultText }: { taskId: number; defaultText: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/tasks/${taskId}/submit`, { method: "POST", body: new FormData(event.currentTarget) });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Submission failed.");
      setMessage("Work submitted for manager review.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 border-t pt-4">
      <div className="space-y-1.5"><Label htmlFor={`submission-${taskId}`}>Submission note</Label><Textarea id={`submission-${taskId}`} name="text" rows={3} defaultValue={defaultText} placeholder="Describe the completed work or include a link." /></div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="size-4" /> Attach file</Button>
        <input ref={fileInputRef} className="sr-only" type="file" name="file" onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)} />
        {fileName ? <span className="max-w-56 truncate text-[12px] text-subtle">{fileName}</span> : null}
        <Button type="submit" disabled={busy}><Send className="size-4" /> {busy ? "Submitting…" : "Submit work"}</Button>
      </div>
      {message ? <Alert><AlertDescription>{message}</AlertDescription></Alert> : null}
    </form>
  );
}
