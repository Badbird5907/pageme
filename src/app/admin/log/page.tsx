"use client";

import * as React from "react";
import { DataTable } from "@/components/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { usePaginatedQuery, useQuery } from "convex/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type PageHistoryRow = Doc<"pageHistory"> & {
  fromUserDoc?: Doc<"users"> | null;
};

const columns: ColumnDef<PageHistoryRow>[] = [
  {
    header: "Message",
    accessorKey: "message",
    cell: ({ row }) => (
      <span className="max-w-md truncate" title={row.original.message}>
        {row.original.message}
      </span>
    ),
  },
  {
    header: "Source",
    id: "source",
    cell: ({ row }) => {
      const { fromUser, fromUserDoc, fromApiTokenName } = row.original;
      if (fromApiTokenName) {
        return (
          <span className="text-muted-foreground">
            API: {fromApiTokenName}
          </span>
        );
      }
      if (fromUserDoc) {
        return (
          <span className="font-mono text-xs text-muted-foreground">
            {fromUserDoc.username}
          </span>
        );
      }
      if (fromUser) {
        return (
          <span className="font-mono text-xs text-muted-foreground">
            {fromUser as Id<"users">}
          </span>
        );
      }
      return <span className="text-muted-foreground">—</span>;
    },
  },
  {
    header: "Status",
    accessorKey: "status",
    cell: ({ row }) => {
      const s = row.original.status;
      return (
        <Badge
          variant={
            s === "succeeded"
              ? "success"
              : s === "failed"
                ? "destructive"
                : "outline"
          }
        >
          {s ?? "—"}
        </Badge>
      );
    },
  },
  {
    header: "Started At",
    accessorKey: "startedAt",
    cell: ({ row }) => (
      <span>
        {row.original.startedAt
          ? new Date(row.original.startedAt).toLocaleString()
          : "—"}
      </span>
    ),
  },
  {
    header: "Finished At",
    id: "finishedAt",
    cell: ({ row }) => {
      const t = row.original.finishedAt ?? row.original.createdAt;
      return <span>{t ? new Date(t).toLocaleString() : "—"}</span>;
    },
  },
  {
    header: "Error",
    accessorKey: "errorMessage",
    cell: ({ row }) => (
      <span
        className="max-w-xs truncate text-destructive"
        title={row.original.errorMessage ?? undefined}
      >
        {row.original.errorMessage ?? "—"}
      </span>
    ),
  },
];

export default function AdminLogPage() {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const { results: rawResults, status, loadMore } = usePaginatedQuery(
    api.admin.listPages,
    {},
    { initialNumItems: pageSize },
  );
  const users = useQuery(api.admin.listUsers);
  const results: PageHistoryRow[] = rawResults.map((result) => ({
    ...result,
    fromUserDoc:
      result.fromUser && users !== undefined
        ? users.find((user) => user._id === result.fromUser) ?? null
        : result.fromUser
          ? undefined
          : null,
  }));

  React.useEffect(() => {
    const needed = (page + 1) * pageSize;
    if (results.length < needed && status === "CanLoadMore") {
      loadMore(pageSize);
    }
  }, [page, pageSize, results.length, status, loadMore]);

  React.useEffect(() => {
    if (status !== "Exhausted") return;
    const maxPage = Math.max(1, Math.ceil(results.length / pageSize));
    if (page > maxPage) setPage(maxPage);
  }, [page, status, results.length, pageSize]);

  const loadedPages = Math.max(1, Math.ceil(results.length / pageSize));
  const totalPages = status === "Exhausted" ? loadedPages : undefined;
  const totalCount = results.length;
  const hasNextPage =
    results.length > page * pageSize || status === "CanLoadMore";

  const sliceStart = (page - 1) * pageSize;
  const pageRows = results.slice(sliceStart, sliceStart + pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Log</h1>
      </div>
      <Card>
        <CardHeader hidden>
          <CardTitle hidden>Log</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={pageRows}
            loading={status === "LoadingFirstPage"}
            pagination={{
              page,
              pageSize,
              totalCount,
              totalPages,
              hasNextPage,
              hasPreviousPage: page > 1,
              onPageChange: setPage,
              onPageSizeChange: (next) => {
                setPageSize(next);
                setPage(1);
              },
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
