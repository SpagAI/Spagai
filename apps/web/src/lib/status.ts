/** Badge colours for campaign and call statuses. */
export const CAMPAIGN_STATUS_VARIANT = { DRAFT: "secondary", RUNNING: "default", PAUSED: "warning", COMPLETED: "outline" } as const;
export const CALL_STATUS_VARIANT = { BLOCKED: "destructive", NO_ANSWER: "warning", COMPLETED: "secondary", FAILED: "destructive" } as const;
