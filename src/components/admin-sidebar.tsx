"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldIcon, UsersIcon } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import MCPIcon from "@/components/mcp-icon";

const adminNavItems = [
  {
    href: "/admin/users",
    label: "Users",
    icon: UsersIcon,
  },
  {
    href: "/admin/api",
    label: "MCP / API",
    icon: MCPIcon,
  }
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar
      collapsible="none"
      className="top-14 h-[calc(100svh-3.5rem)] border-r border-sidebar-border"
    >
      <SidebarContent>
        <SidebarGroup className="gap-4 px-3 py-6">
          <div className="px-2">
            <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-sidebar-foreground">
              <ShieldIcon className="size-4" />
              <span>Pager Admin</span>
            </div>
          </div>

          <SidebarGroupContent>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarMenu aria-label="Admin navigation" className="gap-2">
              {adminNavItems.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href;

                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      render={<Link href={href} />}
                      isActive={isActive}
                      tooltip={label}
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
