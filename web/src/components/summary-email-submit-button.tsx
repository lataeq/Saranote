"use client";

import { LoaderCircle, Mail } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SummaryEmailSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="sm" disabled={pending} aria-busy={pending} className="bg-emerald-600 text-white hover:bg-emerald-700">
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Mail className="size-4" />}
      <span aria-live="polite">{pending ? "Sending summary…" : "Email participants"}</span>
    </Button>
  );
}
