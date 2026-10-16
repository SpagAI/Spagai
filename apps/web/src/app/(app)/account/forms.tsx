"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword, deleteAccount, signOutOtherSessions, updateNotifications, updateProfile, type FormState } from "./actions";

const idle: FormState = { status: "idle" };

export function ProfileForm({ name, jobTitle, phone, email }: { name: string; jobTitle: string; phone: string; email: string }) {
  const [state, action, pending] = useActionState(updateProfile, idle);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor="name">Full name</Label><Input id="name" name="name" defaultValue={name} required maxLength={80} autoComplete="name" /></div>
      <div className="space-y-1.5"><Label htmlFor="jobTitle">Job title</Label><Input id="jobTitle" name="jobTitle" defaultValue={jobTitle} maxLength={80} placeholder="e.g. Head of Sales" autoComplete="organization-title" /></div>
      <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" value={email} disabled /><p className="text-xs text-muted-foreground">Your sign-in email. Contact support to change it.</p></div>
      <div className="space-y-1.5"><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" defaultValue={phone} maxLength={30} inputMode="tel" placeholder="0803 123 4567" autoComplete="tel" /></div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

const NOTIFICATIONS: [string, string, string][] = [
  ["campaignFinished", "Campaign finished", "When every lead in a campaign has been handled."],
  ["lowBalance", "Low credit", "When your wallet can cover fewer than 10 minutes of calls."],
  ["optOuts", "Opt-outs", "A daily list of people who asked not to be called."],
  ["weeklySummary", "Weekly summary", "Calls, bookings and spend, every Monday morning."],
  ["productNews", "Product news", "New features and improvements, about once a month."],
];

export function NotificationsForm({ prefs }: { prefs: Record<string, boolean> }) {
  const [state, action, pending] = useActionState(updateNotifications, idle);
  return (
    <form action={action} className="space-y-3">
      {NOTIFICATIONS.map(([key, label, help]) => (
        <label key={key} className="flex items-start gap-3 rounded-lg border p-3">
          <input type="checkbox" name={key} defaultChecked={prefs[key] ?? key !== "productNews"} className="mt-1 accent-[var(--primary)]" />
          <span><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-muted-foreground">{help}</span></span>
        </label>
      ))}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending}>{pending ? "Saving…" : "Save preferences"}</Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, idle);
  return (
    <form action={action} className="grid max-w-md gap-4">
      <div className="space-y-1.5"><Label htmlFor="current">Current password</Label><Input id="current" name="current" type="password" autoComplete="current-password" /></div>
      <div className="space-y-1.5"><Label htmlFor="next">New password</Label><Input id="next" name="next" type="password" autoComplete="new-password" /><p className="text-xs text-muted-foreground">At least 10 characters, with letters and a number.</p></div>
      <div className="space-y-1.5"><Label htmlFor="confirm">Confirm new password</Label><Input id="confirm" name="confirm" type="password" autoComplete="new-password" /></div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Updating…" : "Update password"}</Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function SignOutOthers() {
  const [state, action, pending] = useActionState(signOutOtherSessions, idle);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <Button type="submit" variant="outline" disabled={pending}>{pending ? "Signing out…" : "Sign out of all other devices"}</Button>
      <FormMessage state={state} />
    </form>
  );
}

export function DeleteAccount({ email, soloWorkspaces }: { email: string; soloWorkspaces: string[] }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, action, pending] = useActionState(deleteAccount, idle);
  if (!open) {
    return (
      <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
        <Trash2 /> Delete my account
      </Button>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <p className="text-sm font-medium">Are you sure? This cannot be undone.</p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>You will be signed out and removed from every workspace.</li>
        {soloWorkspaces.length > 0 && <li>These workspaces only have you, so they will be deleted with all their agents, leads, calls and numbers: <span className="font-medium text-foreground">{soloWorkspaces.join(", ")}</span>.</li>}
        {soloWorkspaces.length > 0 && <li>Any remaining credit in those workspaces is not refunded.</li>}
      </ul>
      <div className="space-y-1.5">
        <Label htmlFor="delete-confirm">Type <span className="font-semibold">{email}</span> to confirm</Label>
        <Input id="delete-confirm" name="confirm" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} className="max-w-sm bg-background" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="destructive" disabled={pending || typed.trim().toLowerCase() !== email.toLowerCase()}>
          {pending ? "Deleting…" : "Yes, delete my account"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => { setOpen(false); setTyped(""); }} disabled={pending}>Cancel</Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
