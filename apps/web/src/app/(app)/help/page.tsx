import { BookOpen, Mail, MessageCircle, Phone, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrg } from "@/server/auth/session";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Help centre" };

const FAQ: [string, string][] = [
  ["How do I create my first agent?", "Go to Agents, choose New agent and pick a ready-made template. Fill in your business details, choose a voice, then press Mark as ready."],
  ["Why was a call blocked?", "Every call is checked first: calling hours (8am to 9pm Lagos time), consent, the lead source, the do-not-call list and the number of attempts. Open the call in Calls to see the exact reason."],
  ["How is a call charged?", "Answered calls are charged per started minute from your prepaid wallet. Unanswered and blocked calls are free. See Billing for your balance and history."],
  ["Can I use my own phone numbers?", "Yes. Under Phone Numbers you can buy a number, or connect your own carrier with a SIP trunk."],
  ["How do I give my agent knowledge about my business?", "Use the Knowledge Base: upload documents or add your website, and link them to an agent."],
  ["How do I add someone to my team?", "Open the Workspace menu at the top of the side panel and send an invite, or go to Settings, Members."],
];

const RELEASES: [string, string, string][] = [
  ["October 2026", "Phone numbers, SIP trunks and the Knowledge Base", "Buy numbers, bring your own carrier, and give agents your documents and website."],
  ["October 2026", "Workspaces, themes and a new dashboard", "Switch between workspaces, choose Light, Dark or Dark gray, and see calls on a world map."],
  ["September 2026", "Prepaid wallet in naira", "Top up and pay per minute, with a clear history of every charge."],
];

export default async function HelpPage() {
  const ctx = await requireOrg();
  return (
    <div className="max-w-4xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Help centre</h1>
        <p className="text-sm text-muted-foreground">Answers to common questions, and a quick way to reach our team.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [BookOpen, "Guides", "Step-by-step help for every page"],
          [MessageCircle, "Live chat", "Weekdays, 8am to 8pm WAT"],
          [Phone, "Phone support", "+234 201 900 3412 (Business plan)"],
        ].map(([Icon, title, text]) => {
          const I = Icon as typeof BookOpen;
          return (
            <Card key={title as string}>
              <CardContent className="flex items-start gap-3 pt-6">
                <I className="mt-0.5 size-5 text-primary" />
                <div><p className="text-sm font-medium">{title as string}</p><p className="text-xs text-muted-foreground">{text as string}</p></div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle>Frequently asked questions</CardTitle></CardHeader>
        <CardContent className="divide-y">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-3">
              <summary className="cursor-pointer list-none text-sm font-medium marker:hidden">
                <span className="mr-2 inline-block text-muted-foreground transition-transform group-open:rotate-90">›</span>{q}
              </summary>
              <p className="mt-2 pl-4 text-sm text-muted-foreground">{a}</p>
            </details>
          ))}
        </CardContent>
      </Card>

      <Card id="contact" className="scroll-mt-24">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="size-5 text-primary" /> Contact support</CardTitle>
          <CardDescription>Send us a message and we will get back to you by email.</CardDescription>
        </CardHeader>
        <CardContent><ContactForm email={ctx.user.email} /></CardContent>
      </Card>

      <Card id="whats-new" className="scroll-mt-24">
        <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="size-5 text-primary" /> What&apos;s new</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {RELEASES.map(([when, title, text]) => (
            <div key={title} className="flex gap-3">
              <Badge variant="outline" className="h-fit shrink-0">{when}</Badge>
              <div><p className="text-sm font-medium">{title}</p><p className="text-sm text-muted-foreground">{text}</p></div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
