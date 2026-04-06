"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ColumnDef, DataTable } from "@/components/ui/data-table";

type APITokenListItem = {
  createdAt: number;
  expiresAt?: number;
  lastUsedAt?: number;
  name: string;
  token: string;
};

export function APITokensTable() {
  const deleteToken = useMutation(api.apitokens.deleteAPIToken);
  const tokens = useQuery(api.apitokens.listAPITokens);
  const [deleteTarget, setDeleteTarget] = useState<APITokenListItem | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteToken({ token: deleteTarget.token });
      toast.success(`Deleted API token "${deleteTarget.name}".`);
      setDeleteTarget(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not delete API token.";
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: ColumnDef<APITokenListItem>[] = [
    {
      header: "Name",
      accessorKey: "name",
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
      header: "Expires At",
      accessorKey: "expiresAt",
      cell: ({ row }) => {
        return (
          <span>
            {row.original.expiresAt
              ? new Date(row.original.expiresAt).toLocaleString()
              : "-"}
          </span>
        );
      },
    },
    {
      header: "Last Used At",
      accessorKey: "lastUsedAt",
      cell: ({ row }) => {
        return (
          <span>{row.original.lastUsedAt ? new Date(row.original.lastUsedAt).toLocaleString() : "-"}</span>
        );
      },
    },
    {
      header: "Actions",
      accessorKey: "actions",
      cell: ({ row }) => {
        return (
          <Button
            variant="destructive"
            onClick={() => setDeleteTarget(row.original)}
          >
            Delete
          </Button>
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={tokens ?? []}
        loading={tokens === undefined}
      />
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDeleteTarget(null);
            setIsDeleting(false);
          }
        }}
      >
        <DialogContent showCloseButton={!isDeleting}>
          <DialogHeader>
            <DialogTitle>Delete API token?</DialogTitle>
            <DialogDescription>
              This revokes access immediately for{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>
              . This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end">
            <DialogClose render={<Button variant="outline" />} disabled={isDeleting}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={() => void handleConfirmDelete()}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
