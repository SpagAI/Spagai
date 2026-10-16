/** The integrations we offer (demo: connecting only records the connection). */

export interface IntegrationInfo {
  id: string;
  name: string;
  category: "Automation" | "Calendar" | "CRM" | "Messaging" | "Developer";
  description: string;
  /** What we ask for when connecting. Empty = a one-click sign-in. */
  field?: { label: string; placeholder: string; type: "url" | "text" };
  /** Shown as the connected account after a one-click sign-in */
  demoAccount?: string;
  /** Monogram tile colours */
  tile: string;
}

export const INTEGRATIONS: IntegrationInfo[] = [
  { id: "make", name: "Make.com", category: "Automation", description: "Start scenarios when a call ends, a meeting is booked or a lead opts out.", field: { label: "Make webhook URL", placeholder: "https://hook.eu1.make.com/…", type: "url" }, tile: "bg-violet-600 text-white" },
  { id: "zapier", name: "Zapier", category: "Automation", description: "Connect Spag AI to 6,000+ apps with Zaps. No code needed.", demoAccount: "Zapier account", tile: "bg-orange-500 text-white" },
  { id: "n8n", name: "n8n", category: "Automation", description: "Send call results to your own n8n workflows, cloud or self-hosted.", field: { label: "n8n webhook URL", placeholder: "https://your-n8n.example.com/webhook/…", type: "url" }, tile: "bg-rose-500 text-white" },
  { id: "google_calendar", name: "Google Calendar", category: "Calendar", description: "Agents check your free times and add booked meetings to your calendar.", demoAccount: "Google account", tile: "bg-blue-500 text-white" },
  { id: "cal_com", name: "Cal.com", category: "Calendar", description: "Book meetings straight into your Cal.com event types.", field: { label: "Your Cal.com link", placeholder: "cal.com/your-business", type: "text" }, tile: "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900" },
  { id: "hubspot", name: "HubSpot", category: "CRM", description: "Sync leads, log every call and update deal stages automatically.", demoAccount: "HubSpot portal", tile: "bg-orange-600 text-white" },
  { id: "slack", name: "Slack", category: "Messaging", description: "Get a message in a channel when a meeting is booked or a call needs attention.", field: { label: "Channel", placeholder: "#sales-alerts", type: "text" }, tile: "bg-purple-700 text-white" },
  { id: "webhook", name: "Webhooks", category: "Developer", description: "We send a signed POST request to your server for every call event.", field: { label: "Endpoint URL", placeholder: "https://api.yourbusiness.com/spag-events", type: "url" }, tile: "bg-emerald-700 text-white" },
];

export const WEBHOOK_EVENTS = ["call.completed", "call.booked", "call.failed", "lead.opted_out", "campaign.finished"];
