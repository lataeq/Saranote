"use client";

import { useState } from "react";
import { CalendarPlus, Plus, Trash2 } from "lucide-react";
import { createMeetingAction } from "@/app/actions/meetings";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { User } from "@/lib/db";
import type { MeetingAudience, SpecialtyTeam, UserRole } from "@/lib/domain";

export function NewMeetingDialog({
  role,
  team,
  users = [],
}: {
  role: UserRole;
  team: SpecialtyTeam | null;
  users?: User[];
}) {
  const [rules, setRules] = useState<Array<{ id: number; team: SpecialtyTeam; audience: MeetingAudience; userId: string }>>([
    { id: 1, team: "web_development", audience: "all_team", userId: "" },
  ]);

  function updateRule(id: number, patch: Partial<(typeof rules)[number]>) {
    setRules((current) => current.map((rule) => rule.id === id ? { ...rule, ...patch } : rule));
  }

  return (
    <Dialog>
      <DialogTrigger asChild><Button><CalendarPlus className="size-4" /> New meeting</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create meeting</DialogTitle>
          <DialogDescription>Start a record for audio, documents, transcript, and assigned work.</DialogDescription>
        </DialogHeader>
        <form action={createMeetingAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="meeting-title">Title</Label>
            <Input id="meeting-title" name="title" placeholder="Weekly operations review" required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="held-at">Date and time</Label>
            <Input id="held-at" name="heldAt" type="datetime-local" min="2000-01-01T00:00" max="2100-12-31T23:59" required />
          </div>
          {role === "manager" ? (
            <>
              <div className="flex items-center justify-between">
                <Label>Invite teams</Label>
                {rules.length < 4 ? <Button type="button" size="sm" variant="ghost" onClick={() => setRules((current) => [...current, { id: Math.max(...current.map((rule) => rule.id)) + 1, team: (["web_development", "business_analysis", "ai_engineering", "sales"] as SpecialtyTeam[]).find((team) => !current.some((rule) => rule.team === team)) ?? "web_development", audience: "all_team", userId: "" }])}><Plus className="size-4" /> Add team</Button> : null}
              </div>
              <div className="space-y-3">
                {rules.map((rule, index) => {
                  const eligibleUsers = users.filter((user) => user.role !== "manager" && user.team === rule.team);
                  return (
                    <div key={rule.id} className="grid gap-3 border-t pt-3 sm:grid-cols-[1fr_1fr_auto]">
                      <div className="space-y-1.5">
                        <Label htmlFor={`meeting-team-${rule.id}`}>Specialty</Label>
                        <Select name="team" value={rule.team} onValueChange={(value) => updateRule(rule.id, { team: value as SpecialtyTeam, userId: "" })}>
                          <SelectTrigger id={`meeting-team-${rule.id}`} className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="web_development" disabled={rules.some((item) => item.id !== rule.id && item.team === "web_development")}>Web Development</SelectItem><SelectItem value="business_analysis" disabled={rules.some((item) => item.id !== rule.id && item.team === "business_analysis")}>Business Analysis</SelectItem><SelectItem value="ai_engineering" disabled={rules.some((item) => item.id !== rule.id && item.team === "ai_engineering")}>AI Engineering</SelectItem><SelectItem value="sales" disabled={rules.some((item) => item.id !== rule.id && item.team === "sales")}>Sales</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`meeting-audience-${rule.id}`}>Invite</Label>
                        <Select name="audience" value={rule.audience} onValueChange={(value) => updateRule(rule.id, { audience: value as MeetingAudience, userId: "" })}>
                          <SelectTrigger id={`meeting-audience-${rule.id}`} className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="all_team">Everyone in team</SelectItem><SelectItem value="team_leaders">Team leaders only</SelectItem><SelectItem value="team_members">Team members only</SelectItem><SelectItem value="specific_user">Specific person</SelectItem></SelectContent>
                        </Select>
                      </div>
                      {rules.length > 1 ? <Button type="button" variant="ghost" size="icon-sm" className="mt-6" aria-label={`Remove team ${index + 1}`} title="Remove team" onClick={() => setRules((current) => current.filter((item) => item.id !== rule.id))}><Trash2 className="size-4" /></Button> : <span />}
                      {rule.audience === "specific_user" ? (
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor={`meeting-person-${rule.id}`}>Person</Label>
                          <Select name="audienceUserId" value={rule.userId} onValueChange={(value) => updateRule(rule.id, { userId: value })} required>
                            <SelectTrigger id={`meeting-person-${rule.id}`} className="w-full"><SelectValue placeholder="Select person" /></SelectTrigger>
                            <SelectContent>{eligibleUsers.map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      ) : <input type="hidden" name="audienceUserId" value="" />}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <><input type="hidden" name="team" value={team ?? ""} /><input type="hidden" name="audience" value="all_team" /></>
          )}
          <Button type="submit" className="w-full">Create meeting</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
