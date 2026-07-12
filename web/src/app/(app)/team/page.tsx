import { updateTeamMemberAction } from "@/app/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TeamMemberDialog } from "@/components/team-member-dialog";
import { requireUser } from "@/lib/auth";
import { listUsers } from "@/lib/db";
import { roleLabel, teamLabel } from "@/lib/domain";
import { formatDate, initials } from "@/lib/format";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; updated?: string; error?: string }>;
}) {
  const user = await requireUser();
  const users = user.role === "manager" ? listUsers() : user.team ? listUsers(user.team) : [user];
  const { created, updated, error } = await searchParams;

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium uppercase text-subtle">Access</p>
          <h1 className="mt-1 text-[24px] font-semibold">Team</h1>
          <p className="mt-1 text-default">
            {user.role === "manager" ? "Assign roles and specialty access." : `${teamLabel(user.team)} members only.`}
          </p>
        </div>
        {user.role === "manager" ? <TeamMemberDialog /> : null}
      </header>

      {created ? <Alert><AlertDescription>Team member created and ready to sign in.</AlertDescription></Alert> : null}
      {updated ? <Alert><AlertDescription>Role and specialty updated.</AlertDescription></Alert> : null}
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden md:table-cell">Specialty</TableHead>
              <TableHead className="hidden lg:table-cell">Added</TableHead>
              {user.role === "manager" ? <TableHead className="w-[320px]">Access</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-8 rounded-md">
                      <AvatarFallback className="rounded-md bg-[#f5f5f5] text-[12px]">{initials(member.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-[12px] text-subtle">{member.email}</p>
                      {member.spokenName ? <p className="text-[12px] text-subtle">Spoken names: {member.spokenName}</p> : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell><Badge variant="secondary" className="font-normal">{roleLabel(member.role)}</Badge></TableCell>
                <TableCell className="hidden text-default md:table-cell">{teamLabel(member.team)}</TableCell>
                <TableCell className="hidden text-default lg:table-cell">{formatDate(member.createdAt)}</TableCell>
                {user.role === "manager" ? (
                  <TableCell>
                    <form action={updateTeamMemberAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="userId" value={member.id} />
                      <select name="role" defaultValue={member.role} aria-label={`Role for ${member.name}`} className="h-8 min-w-28 rounded-md border bg-white px-2 text-[12px]">
                        <option value="manager">Manager</option>
                        <option value="team_leader">Team leader</option>
                        <option value="team_member">Team member</option>
                      </select>
                      <select name="team" defaultValue={member.team ?? "web_development"} aria-label={`Specialty for ${member.name}`} className="h-8 min-w-32 rounded-md border bg-white px-2 text-[12px]">
                        <option value="web_development">Web Development</option>
                        <option value="business_analysis">Business Analysis</option>
                        <option value="ai_engineering">AI Engineering</option>
                        <option value="sales">Sales</option>
                      </select>
                      <input name="spokenName" defaultValue={member.spokenName} aria-label={`Spoken names for ${member.name}`} placeholder="Spoken names" className="h-8 min-w-32 rounded-md border bg-white px-2 text-[12px]" />
                      <Button type="submit" size="sm" variant="outline">Save</Button>
                    </form>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
