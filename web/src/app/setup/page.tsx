import { redirect } from "next/navigation";
import { setupManagerAction } from "@/app/actions/auth";
import { AuthPanel } from "@/components/auth-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hasUsers } from "@/lib/db";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (hasUsers()) redirect("/login");
  const { error } = await searchParams;
  return (
    <AuthPanel
      eyebrow="Workspace setup"
      title="Create the first manager"
      description="This one-time account can add employees, create meetings, assign work, and review submissions."
    >
      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <form action={setupManagerAction} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" autoComplete="name" required minLength={2} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
          <p className="text-[12px] text-subtle">At least 10 characters</p>
        </div>
        <Button className="w-full" type="submit">Create workspace</Button>
      </form>
    </AuthPanel>
  );
}
