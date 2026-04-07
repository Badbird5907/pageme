"use client";

import { ColumnDef } from "@tanstack/react-table";
import { api } from "convex/_generated/api";
import { Doc } from "convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { AddUserDialog } from "@/app/admin/users/add";
import { DeleteUserDialog } from "@/app/admin/users/delete";
import { EditUserDialog } from "@/app/admin/users/edit";
import { Ban, Shield } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PIN_REVEAL_DELAY_MS = 2500;

function PinRevealCell({ pin }: { pin: string }) {
  const [revealed, setRevealed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => () => clearTimer(), []);

  return (
    <span
      className={revealed ? undefined : "[-webkit-text-security:disc]"}
      onPointerEnter={() => {
        clearTimer();
        setRevealed(false);
        timerRef.current = setTimeout(() => {
          setRevealed(true);
          timerRef.current = null;
        }, PIN_REVEAL_DELAY_MS);
      }}
      onPointerLeave={() => {
        clearTimer();
        setRevealed(false);
      }}
      title="Keep pointer here for a few seconds to reveal"
    >
      {pin}
    </span>
  );
}

export default function AdminUsersPage() {
  const users = useQuery(api.admin.listUsers); // we're just loading all users here in memory
  const toggleMute = useMutation(api.admin.toggleMute);

  const [filter, setFilter] = useState("");
  const [sortType, setSortType] = useState<"lastLoginAt" | "activeUntil" | "createdAt">("lastLoginAt");

  const columns: ColumnDef<Doc<"users">>[] = [
    {
      header: "Username",
      accessorKey: "username",
      cell: ({ row }) => {
        return (
          <span className="flex items-center gap-2">
            {row.original.username}
            {row.original.isAdmin ? <Shield className="size-4" /> : null}
            {row.original.muted ? <Ban className="size-4" /> : null}
          </span>
        );
      },
    },
    {
      header: "Pin",
      accessorKey: "pin",
      meta: {
        headerClassName: "w-18",
        cellClassName: "w-18",
      },
      cell: ({ row }) => {
        return <PinRevealCell pin={row.original.pin} />;
      },
    },
    {
      header: "Last Login At",
      accessorKey: "lastLoginAt",
      cell: ({ row }) => {
        return (
          <span>{row.original.lastLoginAt ? new Date(row.original.lastLoginAt).toLocaleString() : "-"}</span>
        );
      },
    },
    {
      header: "Active Until",
      accessorKey: "activeUntil",
      cell: ({ row }) => {
        return (
          <span>
            {row.original.activeUntil
              ? new Date(row.original.activeUntil).toDateString()
              : "-"}
          </span>
        );
      },
    },
    {
      header: "Created At",
      accessorKey: "createdAt",
      cell: ({ row }) => {
        return (
          <span>
            {row.original.createdAt
              ? new Date(row.original.createdAt).toLocaleString()
              : "-"}
          </span>
        );
      },
    },
    {
      header: "Actions",
      accessorKey: "actions",
      cell: ({ row }) => {
        return (
          <div className="flex flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => toggleMute({ userId: row.original._id })}
            >
              {row.original.muted ? "Unmute" : "Mute"}
            </Button>
            <EditUserDialog user={row.original} />
            <DeleteUserDialog userId={row.original._id} />
          </div>
        );
      },
    },
  ];

  const filteredUsers = users?.filter((user) => user.username.toLowerCase().includes(filter.toLowerCase())) ?? [];
  const orderedUsers = filteredUsers.sort((a, b) => {
    if (sortType === "lastLoginAt") {
      return (b.lastLoginAt ?? 0) - (a.lastLoginAt ?? 0);
    }
    if (sortType === "activeUntil") {
      return (b.activeUntil ?? 0) - (a.activeUntil ?? 0);
    }
    if (sortType === "createdAt") {
      return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    }
    return 0;
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manage Users</h1>
        <AddUserDialog />
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-row gap-2">
          <Input
            placeholder="Filter users"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <Select
            value={sortType}
            onValueChange={(value) => setSortType(value as "lastLoginAt" | "activeUntil" | "createdAt")}
            items={{
              lastLoginAt: "Last Login At",
              activeUntil: "Active Until",
              createdAt: "Created At",
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lastLoginAt">Last Login At</SelectItem>
              <SelectItem value="activeUntil">Active Until</SelectItem>
              <SelectItem value="createdAt">Created At</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DataTable columns={columns} data={orderedUsers} />
      </div>
    </div>
  );
}
