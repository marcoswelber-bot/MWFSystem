"use client";

import * as React from "react";
import { ActionableAlert } from "@/components/actionable-alert";
import type { ActionableAlertData } from "@/components/actionable-alert";

type ActionableAlertsPanelProps = {
  alerts: ActionableAlertData[];
  onAction: (alertId: string, action: string, referenceId: string) => Promise<{ ok: boolean; message: string }>;
  onIgnore?: (alertId: string, reason: string) => Promise<void>;
};

export function ActionableAlertsPanel({ alerts, onAction, onIgnore }: ActionableAlertsPanelProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Pendencias ({alerts.length})
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {alerts.map((alert) => (
          <ActionableAlert
            key={alert.id}
            alert={alert}
            onAction={onAction}
            onIgnore={onIgnore}
          />
        ))}
      </div>
    </div>
  );
}
