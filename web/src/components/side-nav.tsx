"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, FileAudio, ListTodo, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/domain";

const links: ReadonlyArray<{
  href: string;
  label: string;
  icon: typeof FileAudio;
  roles: readonly UserRole[];
}> = [
  { href: "/meetings", label: "Meetings", icon: FileAudio, roles: ["manager", "team_leader", "team_member"] },
  { href: "/work", label: "My work", icon: ListTodo, roles: ["manager", "team_leader", "team_member"] },
  { href: "/review", label: "Review", icon: ClipboardCheck, roles: ["manager", "team_leader"] },
  { href: "/team", label: "Team", icon: Users, roles: ["manager", "team_leader", "team_member"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["manager", "team_leader"] },
];

export function SideNav({ role, onNavigate }: { role: UserRole; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Workspace" className="space-y-1">
      {links.filter((item) => item.roles.includes(role)).map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex h-9 items-center gap-2 rounded-md px-2.5 text-[13px] text-default transition-colors hover:bg-[#f5f5f5] hover:text-strong",
              active && "bg-[#f5f5f5] font-medium text-strong",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
