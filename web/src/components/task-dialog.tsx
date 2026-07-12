"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { createTaskAction } from "@/app/actions/meetings";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { User } from "@/lib/db";
import { roleLabel } from "@/lib/domain";

export function TaskDialog({ meetingId, users }: { meetingId: number; users: User[] }) {
  const [open, setOpen] = useState(false);

  async function create(formData: FormData) {
    await createTaskAction(formData);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="size-4" /> Assign work</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign work</DialogTitle><DialogDescription>Create an accountable task linked to this meeting.</DialogDescription></DialogHeader>
        <form action={create} className="space-y-4">
          <input type="hidden" name="meetingId" value={meetingId} />
          <div className="space-y-1.5"><Label htmlFor="task-title">Task</Label><Input id="task-title" name="title" required autoFocus /></div>
          <div className="space-y-1.5"><Label htmlFor="task-description">Details</Label><Textarea id="task-description" name="description" rows={3} /></div>
          <div className="space-y-1.5"><Label htmlFor="task-owner">Assignee</Label><Select name="assigneeId" required><SelectTrigger id="task-owner" className="w-full"><SelectValue placeholder="Select team member" /></SelectTrigger><SelectContent>{users.map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.name} · {roleLabel(user.role)}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label htmlFor="task-due">Due date</Label><Input id="task-due" name="dueAt" type="date" /></div>
          <Button type="submit" className="w-full">Create assignment</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
