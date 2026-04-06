"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";

import MCPIcon from "@/components/mcp-icon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

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
      <CardContent>
        <div className="flex items-center gap-2">
          <Badge variant={isMcpEnabled ? "success" : "destructive"}>
            {isMcpLoading ? "Loading" : isMcpEnabled ? "Enabled" : "Disabled"}
          </Badge>
          <Switch
            checked={isMcpEnabled}
            disabled={isMcpLoading}
            onCheckedChange={(checked) => setMCPEnabled({ enabled: checked })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
