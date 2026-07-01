"use client";

import { ActionableAlertsPanel } from "@/components/actionable-alerts-panel";
import type { ActionableAlertData } from "@/components/actionable-alert";
import { handleAlertAction, ignoreAlert } from "@/app/(app)/alerts-actions";

type ActionableAlertsWrapperProps = {
  alerts: ActionableAlertData[];
};

export function ActionableAlertsWrapper({ alerts }: ActionableAlertsWrapperProps) {
  async function onAction(alertId: string, action: string, referenceId: string) {
    return handleAlertAction(alertId, action, referenceId);
  }

  async function onIgnore(alertId: string, reason: string) {
    return ignoreAlert(alertId, reason);
  }

  return (
    <ActionableAlertsPanel
      alerts={alerts}
      onAction={onAction}
      onIgnore={onIgnore}
    />
  );
}
