"use client";

import { UserPlus } from "lucide-react";
import { createTeamMemberAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function TeamMemberDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild><Button><UserPlus className="size-4" /> Add member</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
          <DialogDescription>Create credentials and set the member&apos;s workspace permissions.</DialogDescription>
        </DialogHeader>
        <form action={createTeamMemberAction} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="member-name">Full name</Label><Input id="member-name" name="name" required minLength={2} /></div>
          <div className="space-y-1.5"><Label htmlFor="member-spoken-name">Spoken names</Label><Input id="member-spoken-name" name="spokenName" placeholder="นัทสิทธิ์พี, เต้, Tae" /><p className="text-[12px] text-subtle">Separate names used in meetings with commas.</p></div>
          <div className="space-y-1.5"><Label htmlFor="member-email">Work email</Label><Input id="member-email" name="email" type="email" required /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="member-role">Role</Label><Select name="role" defaultValue="team_member"><SelectTrigger id="member-role" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manager">Manager</SelectItem><SelectItem value="team_leader">Team leader</SelectItem><SelectItem value="team_member">Team member</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label htmlFor="member-team">Specialty</Label><Select name="team" defaultValue="web_development"><SelectTrigger id="member-team" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="web_development">Web Development</SelectItem><SelectItem value="business_analysis">Business Analysis</SelectItem><SelectItem value="ai_engineering">AI Engineering</SelectItem><SelectItem value="sales">Sales</SelectItem></SelectContent></Select></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="member-password">Temporary password</Label><Input id="member-password" name="password" type="password" required minLength={10} /><p className="text-[12px] text-subtle">Share it securely; password reset is not in this local-first release.</p></div>
          <Button type="submit" className="w-full">Create account</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
