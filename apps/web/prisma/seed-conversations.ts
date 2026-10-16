/**
 * Dummy call conversations, long enough to fill the call's recorded length.
 * Speech is estimated at about 2.6 words a second plus a short pause per turn,
 * the same estimate the call player uses to place each line on the timeline.
 */
import type { PrismaClient } from "@prisma/client";

type Turn = { role: "agent" | "caller"; text: string };

const secondsFor = (text: string) => text.split(/\s+/).length / 2.6 + 0.7;

const MIDDLE: [string, string][] = [
  ["Let me quickly explain why I'm calling. We help people like you get started without stress, and it only takes a few minutes.", "Okay, I'm listening."],
  ["Can I confirm I'm speaking with the right person, and that this number is still the best way to reach you?", "Yes, this is my number. You can use it."],
  ["Many of our customers in Lagos and Abuja asked for flexible payment, so we now allow you to spread it over three months.", "Three months? That sounds better. What about interest?"],
  ["There is no extra interest if you pay within the three months. You only pay the amount you agreed.", "Okay, that is fair."],
  ["Which part of town are you in, so I can tell you about the nearest office?", "I'm around Ikeja, close to the airport road."],
  ["We have an office in Ikeja, on Allen Avenue. It is open from eight in the morning to six in the evening, Monday to Saturday.", "Allen Avenue, I know the place."],
  ["Do you have any questions so far? I'm happy to explain anything again.", "How long does the whole process take?"],
  ["Usually about one week from start to finish. If all your documents are ready, it can be faster.", "One week is okay for me."],
  ["Would you prefer we send the details by SMS or by email?", "SMS is better. I don't check my email often."],
  ["No problem. I'll send everything by SMS right after this call, including the address and our customer care line.", "Okay, thank you."],
  ["Just so you know, this call is with an AI assistant, and a member of our team can call you back if you prefer.", "It's fine. You're doing well."],
  ["Is there a time of day that works best if our team needs to reach you again?", "Afternoons are better, after two o'clock."],
  ["Noted. We won't call you before two in the afternoon.", "Thank you, I appreciate that."],
  ["We also have a WhatsApp line if you'd rather chat there. Shall I include it in the SMS?", "Yes, please add it."],
  ["Some people ask about refunds. If you change your mind within seven days, you get your money back in full.", "That's good to know."],
  ["Let me check one more thing on my side. Please bear with me for a moment.", "Okay, no problem."],
];

const CLOSINGS: Record<string, Turn[]> = {
  booked: [
    { role: "agent", text: "Would you like me to book a short meeting with our team? I have Thursday at ten in the morning or Friday at two in the afternoon." },
    { role: "caller", text: "Friday at two works for me." },
    { role: "agent", text: "Wonderful. You are booked for Friday at two in the afternoon. You'll get an SMS confirmation shortly." },
    { role: "caller", text: "Great, thank you very much." },
    { role: "agent", text: "Thank you for your time. Have a lovely day." },
  ],
  callback: [
    { role: "caller", text: "Actually, I'm about to enter a meeting. Can you call me back later?" },
    { role: "agent", text: "Of course. Would tomorrow afternoon be a good time?" },
    { role: "caller", text: "Yes, tomorrow afternoon is fine." },
    { role: "agent", text: "Perfect, we'll call you tomorrow afternoon. Thank you, and enjoy your meeting." },
  ],
  not_interested: [
    { role: "caller", text: "Thank you for explaining, but I'm not interested at the moment." },
    { role: "agent", text: "I understand completely. May we contact you again in a few months, in case things change?" },
    { role: "caller", text: "Maybe in a few months, yes." },
    { role: "agent", text: "Thank you for your time. Have a great day." },
  ],
  opted_out: [
    { role: "caller", text: "Please, I don't want these calls anymore. Remove my number." },
    { role: "agent", text: "I'm sorry for the trouble. I've removed your number, and you won't be called again. Have a good day." },
  ],
  wrong_number: [
    { role: "caller", text: "I think you have the wrong number. I don't know that person." },
    { role: "agent", text: "I'm so sorry about that. I'll update our records right away. Have a good day." },
  ],
  other: [
    { role: "caller", text: "Let me think about it and discuss with my family first." },
    { role: "agent", text: "That's very sensible. I'll send the details by SMS so you have everything in one place." },
    { role: "caller", text: "Okay, thank you." },
    { role: "agent", text: "Thank you for your time. Goodbye." },
  ],
};

/** A conversation for one answered call that roughly fills `durationSeconds`. */
export function buildConversation(next: () => number, p: { agentName: string; company: string; firstName: string; outcome: string; durationSeconds: number; hour: number }): Turn[] {
  const greeting = p.hour < 12 ? "Good morning" : p.hour < 17 ? "Good afternoon" : "Good evening";
  const turns: Turn[] = [
    { role: "agent", text: `${greeting}. This is ${p.agentName}, an AI assistant calling from ${p.company}. Am I speaking with ${p.firstName}?` },
    { role: "caller", text: p.outcome === "wrong_number" ? "Hello? Who is this?" : `Yes, this is ${p.firstName}. Good ${p.hour < 12 ? "morning" : p.hour < 17 ? "afternoon" : "evening"}.` },
  ];
  const closing = CLOSINGS[p.outcome] ?? CLOSINGS.other!;
  const total = (t: Turn[]) => t.reduce((s, x) => s + secondsFor(x.text), 0);
  const target = p.durationSeconds - total(closing);
  if (!["opted_out", "wrong_number"].includes(p.outcome)) {
    const pool = [...MIDDLE];
    // Shuffle once, then go round the pool for long calls.
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [pool[i], pool[j]] = [pool[j]!, pool[i]!]; }
    for (let i = 0; total(turns) < target && i < 60; i++) {
      const [agent, caller] = pool[i % pool.length]!;
      turns.push({ role: "agent", text: agent }, { role: "caller", text: caller });
    }
  }
  return [...turns, ...closing];
}

/** Give older seeded calls (three-line transcripts) a full conversation. Safe to run again. */
export async function enrichTranscripts(db: PrismaClient, organisationId: string, company: string) {
  const calls = await db.call.findMany({
    where: { organisationId, status: "COMPLETED", durationSeconds: { not: null } },
    select: { id: true, transcript: true, durationSeconds: true, outcome: true, attemptedAt: true, lead: { select: { firstName: true } }, agent: { select: { name: true } } },
  });
  const stale = calls.filter((c) => !Array.isArray(c.transcript) || c.transcript.length <= 3);
  let seed = 7;
  const next = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < stale.length; i += 200) {
    await db.$transaction(stale.slice(i, i + 200).map((c) => db.call.update({
      where: { id: c.id },
      data: {
        transcript: buildConversation(next, {
          agentName: c.agent?.name ?? "your assistant", company, firstName: c.lead.firstName || "there",
          outcome: c.outcome ?? "other", durationSeconds: c.durationSeconds ?? 60, hour: (c.attemptedAt.getUTCHours() + 1) % 24,
        }),
      },
    })));
  }
  return stale.length;
}
