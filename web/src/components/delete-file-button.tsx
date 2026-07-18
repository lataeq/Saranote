"use client";

import { Trash2 } from "lucide-react";
import { deleteMeetingFileAction } from "@/app/actions/meetings";
import { Button } from "@/components/ui/button";

export function DeleteFileButton({ fileId, fileName }: { fileId: number; fileName: string }) {
  return (
    <form
      action={deleteMeetingFileAction}
      onSubmit={(event) => {
        if (!window.confirm(`Remove ${fileName}? This cannot be undone.`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="fileId" value={fileId} />
      <Button type="submit" variant="ghost" size="icon-sm" aria-label={`Remove ${fileName}`}>
        <Trash2 className="size-4" />
      </Button>
    </form>
  );
}
