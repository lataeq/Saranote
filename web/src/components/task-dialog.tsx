"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { createTaskAction, deleteTaskAction, updateTaskAction } from "@/app/actions/meetings";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Task, User } from "@/lib/db";
import { roleLabel } from "@/lib/domain";

export function TaskDialog({ meetingId, users, task }: { meetingId: number; users: User[]; task?: Task }) {
  const [open, setOpen] = useState(false);

  async function save(formData: FormData) {
    await (task ? updateTaskAction(formData) : createTaskAction(formData));
    setOpen(false);
  }

  async function remove(formData: FormData) {
    await deleteTaskAction(formData);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{task ? <Button size="icon-sm" variant="ghost" aria-label={`Edit ${task.title}`} title="Edit assignment"><Pencil className="size-4" /></Button> : <Button size="sm"><Plus className="size-4" /> Assign work</Button>}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{task ? "Edit assignment" : "Assign work"}</DialogTitle><DialogDescription>{task ? "Correct or reassign pending work." : "Create an accountable task linked to this meeting."}</DialogDescription></DialogHeader>
        <form action={save} className="space-y-4">
          <input type="hidden" name="meetingId" value={meetingId} />
          {task ? <input type="hidden" name="taskId" value={task.id} /> : null}
          <div className="space-y-1.5"><Label htmlFor={`task-title-${task?.id ?? "new"}`}>Task</Label><Input id={`task-title-${task?.id ?? "new"}`} name="title" defaultValue={task?.title} required autoFocus /></div>
          <div className="space-y-1.5"><Label htmlFor={`task-description-${task?.id ?? "new"}`}>Details</Label><Textarea id={`task-description-${task?.id ?? "new"}`} name="description" defaultValue={task?.description} rows={3} /></div>
          <div className="space-y-1.5"><Label htmlFor={`task-owner-${task?.id ?? "new"}`}>Assignee</Label><Select name="assigneeId" defaultValue={task ? String(task.assigneeId) : undefined} required><SelectTrigger id={`task-owner-${task?.id ?? "new"}`} className="w-full"><SelectValue placeholder="Select team member" /></SelectTrigger><SelectContent>{users.map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.name} · {roleLabel(user.role)}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label htmlFor={`task-due-${task?.id ?? "new"}`}>Due date</Label><Input id={`task-due-${task?.id ?? "new"}`} name="dueAt" type="date" defaultValue={task?.dueAt?.slice(0, 10)} /></div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">{task ? "Save changes" : "Create assignment"}</Button>
            {task ? <Button type="submit" variant="destructive" formAction={remove} onClick={(event) => { if (!window.confirm("Delete this pending assignment?")) event.preventDefault(); }}>Delete</Button> : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
