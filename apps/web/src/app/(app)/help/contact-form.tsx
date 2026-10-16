"use client";

import { CircleCheck } from "lucide-react";
import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { contactSupport, type TicketState } from "./actions";

export function ContactForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<TicketState, FormData>(contactSupport, { status: "idle" });
  if (state.status === "ok") {
    return (
      <div role="status" className="flex gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
        <CircleCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="font-medium">Request received. Your ticket number is {state.ticket}.</p>
          <p className="text-muted-foreground">We usually reply within 4 working hours, to {email}.</p>
        </div>
      </div>
    );
  }
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="topic">Topic</Label>
        <Select id="topic" name="topic" defaultValue="calls">
          <option value="calls">Calls and campaigns</option>
          <option value="agents">Agents and voices</option>
          <option value="numbers">Phone numbers</option>
          <option value="billing">Billing and credit</option>
          <option value="account">Account and access</option>
          <option value="other">Something else</option>
        </Select>
      </div>
      <div className="space-y-1.5"><Label htmlFor="subject">Subject</Label><Input id="subject" name="subject" required minLength={3} maxLength={120} placeholder="e.g. Calls to Ghana are not connecting" /></div>
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="message">How can we help?</Label><Textarea id="message" name="message" rows={5} required minLength={10} maxLength={4000} placeholder="Tell us what happened, and include a call or campaign link if you have one." /></div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send to support"}</Button>
        <FormMessage state={state.status === "error" ? state : { status: "idle" }} />
      </div>
    </form>
  );
}
