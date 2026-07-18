import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { AuthPanel } from "@/components/auth-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { currentUser } from "@/lib/auth";
import { hasUsers } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!hasUsers()) redirect("/setup");
  if (await currentUser()) redirect("/meetings");
  const { error } = await searchParams;
  return (
    <AuthPanel eyebrow="Secure workspace" title="Sign in" description="Access meeting records and work assigned to your account.">
      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <form action={loginAction} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="login-role">Role</Label>
            <Select name="role" defaultValue="team_member">
              <SelectTrigger id="login-role" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="team_leader">Team leader</SelectItem>
                <SelectItem value="team_member">Team member</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="login-team">Specialty</Label>
            <Select name="team" defaultValue="web_development">
              <SelectTrigger id="login-team" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teams (manager)</SelectItem>
                <SelectItem value="web_development">Web Development</SelectItem>
                <SelectItem value="business_analysis">Business Analysis</SelectItem>
                <SelectItem value="ai_engineering">AI Engineering</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button className="w-full" type="submit">Sign in</Button>
      </form>
    </AuthPanel>
  );
}
