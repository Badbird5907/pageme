"use client";

import * as React from "react";
import { DataTable } from "@/components/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";
import { usePaginatedQuery } from "convex/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";


const columns: ColumnDef<Doc<"pageHistory">>[] = [
  {
    header: "Message",
    accessorKey: "message",
  },
  {
    header: "Status",
    accessorKey: "status",
    cell: ({ row }) => {
      return <Badge variant={row.original.status === "succeeded" ? "success" : row.original.status === "failed" ? "destructive" : "outline"}>{row.original.status}</Badge>;
    }
  },
  {
    header: "Started At",
    accessorKey: "startedAt",
    cell: ({ row }) => {
      return <span>{row.original.startedAt ? new Date(row.original.startedAt).toLocaleString() : "-"}</span>;
    },  
  },
  {
    header: "Finished At",
    accessorKey: "createdAt",
    cell: ({ row }) => {
      return <span>{row.original.createdAt ? new Date(row.original.createdAt).toLocaleString() : "-"}</span>;
    },  
  },
];

export default function PageHistoryPage() {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const { results, status, loadMore } = usePaginatedQuery(
    api.pager.listMyPageHistory,
    {},
    { initialNumItems: pageSize },
  );

  React.useEffect(() => {
    // Keep one page of lookahead data loaded for smoother paging.
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
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-4 py-10 sm:py-16">
      <Card>
        <CardHeader>
          <CardTitle>Page History</CardTitle>
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
