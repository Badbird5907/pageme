"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { HistoryIcon, LayoutDashboardIcon, LogOutIcon, ShieldIcon } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Skeleton } from "./ui/skeleton";

function initialsFromUsername(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]!.slice(0, 1) + parts[1]!.slice(0, 1)).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

export function Navbar() {
  const router = useRouter();
  const { isLoading, isAuthenticated, username, isAdmin, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push("/");
    router.refresh();
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b border-border/80 bg-background/80 backdrop-blur-md"
      )}
    >
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-foreground hover:opacity-90"
        >
          Pager
        </Link>

        <nav className="flex items-center gap-2" aria-label="Account">
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : isAuthenticated && username ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm outline-none",
                  "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
                )}
              >
                <Avatar size="sm" className="size-7">
                  <AvatarFallback className="text-xs font-medium">
                    {initialsFromUsername(username)}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-40 truncate font-medium">
                  {username}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <span className="truncate text-foreground">
                        Welcome,{" "}
                        <span className="font-bold">{username}</span>
                    </span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => router.push("/history")}
                  >
                    <HistoryIcon />
                    Page history
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                {isAdmin && (
                  <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => router.push("/admin")}
                  >
                    <ShieldIcon />
                    Admin
                  </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  className="cursor-pointer hover:bg-destructive/10"
                  onClick={() => void handleLogout()}
                >
                  <LogOutIcon />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              href="/login"
              className={buttonVariants({ variant: "default" })}
            >
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
