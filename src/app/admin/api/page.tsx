"use client";

import { APITokensTable } from "@/app/admin/api/api-tokens-table";
import { CreateAPITokenDialog } from "@/app/admin/api/create-api-token-dialog";
import { MCPSettingsCard } from "@/app/admin/api/mcp-settings-card";

export default function MCPPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">API</h1>
        <CreateAPITokenDialog />
      </div>
      <div className="flex flex-col gap-4">
        <APITokensTable />
      </div>
      <MCPSettingsCard />
    </div>
  );
}
