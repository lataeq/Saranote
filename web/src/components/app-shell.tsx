"use client";

import { useState } from "react";
import { AudioLines, LogOut, Menu } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SideNav } from "@/components/side-nav";
import { initials } from "@/lib/format";
import type { User } from "@/lib/db";
import { roleLabel, teamLabel } from "@/lib/domain";

function Brand() {
  return (
    <div className="flex h-14 items-center gap-2 border-b px-4 text-[14px] font-semibold">
      <span className="grid size-7 place-items-center rounded-md bg-[#292929] text-white">
        <AudioLines className="size-4" aria-hidden="true" />
      </span>
      Saranote
    </div>
  );
}

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-white md:grid md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="fixed inset-y-0 left-0 hidden w-[220px] border-r bg-[#fcfcfc] md:flex md:flex-col">
        <Brand />
        <div className="flex-1 p-3">
          <SideNav role={user.role} />
        </div>
        <div className="border-t p-3">
          <div className="mb-2 flex items-center gap-2 px-1">
            <Avatar className="size-7 rounded-md">
              <AvatarFallback className="rounded-md bg-[#f2f2f2] text-[12px]">{initials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{user.name}</p>
              <p className="truncate text-[12px] text-subtle">{roleLabel(user.role)} · {teamLabel(user.team)}</p>
            </div>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" className="w-full justify-start text-default">
              <LogOut className="size-4" /> Sign out
            </Button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 md:col-start-2">
        <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-white/95 px-4 backdrop-blur md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation"><Menu className="size-4" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[260px] p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <Brand />
              <div className="p-3"><SideNav role={user.role} onNavigate={() => setOpen(false)} /></div>
            </SheetContent>
          </Sheet>
          <span className="ml-2 text-[14px] font-semibold">Saranote</span>
        </header>
        <main className="mx-auto w-full max-w-[1180px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
