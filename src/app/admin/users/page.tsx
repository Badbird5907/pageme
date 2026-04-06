"use client";

import { ColumnDef } from "@tanstack/react-table";
import { api } from "convex/_generated/api";
import { Doc } from "convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { AddUserDialog } from "@/app/admin/users/add";
import { DeleteUserDialog } from "@/app/admin/users/delete";
import { EditUserDialog } from "@/app/admin/users/edit";

export default function AdminUsersPage() {
  const users = useQuery(api.admin.listUsers);
  const toggleMute = useMutation(api.admin.toggleMute);

  const columns: ColumnDef<Doc<"users">>[] = [
    {
      header: "Username",
      accessorKey: "username",
    },
    {
      header: "Is Admin",
      accessorKey: "isAdmin",
      cell: ({ row }) => {
        return (
          <Badge variant={row.original.isAdmin ? "success" : "destructive"}>
            {row.original.isAdmin ? "Yes" : "No"}
          </Badge>
        );
      },
    },
    {
      header: "Muted",
      accessorKey: "muted",
      cell: ({ row }) => {
        return (
          <Badge variant={!row.original.muted ? "success" : "destructive"}>
            {row.original.muted ? "Yes" : "No"}
          </Badge>
        );
      },
    },
    {
      header: "Pin",
      accessorKey: "pin",
      meta: { cellClassName: "group" },
      cell: ({ row }) => {
        return (
          <span className="[-webkit-text-security:disc] group-hover:[-webkit-text-security:none]">
            {row.original.pin}
          </span>
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
              ? new Date(row.original.activeUntil).toLocaleString()
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
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manage Users</h1>
        <AddUserDialog />
      </div>
      <div className="flex flex-col gap-4">
        <DataTable columns={columns} data={users ?? []} />
      </div>
    </div>
  );
}
