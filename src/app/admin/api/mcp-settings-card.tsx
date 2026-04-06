"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";

import MCPIcon from "@/components/mcp-icon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { env } from "@/env";
import { Label } from "@/components/ui/label";
import {
  ReadonlyInput
} from "@/app/admin/api/readonly-input";

export function MCPSettingsCard() {
  const enabled = useQuery(api.mcp.getMCPEnabled);
  const setMCPEnabled = useMutation(api.mcp.setMCPEnabled);
  const isMcpEnabled = enabled ?? false;
  const isMcpLoading = enabled === undefined;


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MCPIcon className="size-6" />
          MCP Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex w-full min-w-0 items-center justify-between gap-4">
          <Badge variant={isMcpEnabled ? "success" : "destructive"}>
            {isMcpLoading ? "Loading" : isMcpEnabled ? "Enabled" : "Disabled"}
          </Badge>
          <Switch
            checked={isMcpEnabled}
            disabled={isMcpLoading}
            onCheckedChange={(checked) => setMCPEnabled({ enabled: checked })}
          />
        </div>

        <div className="flex flex-row gap-2 w-full">
          <div className="flex flex-col gap-2 w-1/2">
            <Label htmlFor="mcp-url-input">MCP URL</Label>
            <ReadonlyInput value={env.NEXT_PUBLIC_CONVEX_SITE_URL + "/mcp"} />
          </div>
          <div className="flex flex-col gap-2 w-1/2">
            <Label htmlFor="mcp-url-input">Headers</Label>  
            <ReadonlyInput value="Authorization: Bearer <api-token>" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
