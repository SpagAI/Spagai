/**
 * Realistic dummy data for the platform screens (dashboard analytics, map, numbers, knowledge bank,
 * integrations, API keys). Deterministic: the same workspace always gets the same data.
 * Each step only runs when that kind of data is missing, so the seed can be run again safely.
 */
import { agentReadiness, getPreset, presetToAgentConfig } from "@spagai/core";
import type { PrismaClient } from "@prisma/client";
import { enrichTranscripts } from "./seed-conversations";
import { displayPrefix, encryptApiKey, generateApiKey, hashApiKey } from "../src/server/api-key-crypto";

export interface City {
  city: string; region: string; country: string; countryCode: string; continent: string;
  lat: number; lng: number; dial: string;
}

export const CITIES: City[] = [
  // Africa
  { city: "Lagos Island", region: "Lagos", country: "Nigeria", countryCode: "NG", continent: "Africa", lat: 6.4541, lng: 3.3947, dial: "+234" },
  { city: "Ikeja", region: "Lagos", country: "Nigeria", countryCode: "NG", continent: "Africa", lat: 6.6018, lng: 3.3515, dial: "+234" },
  { city: "Lekki", region: "Lagos", country: "Nigeria", countryCode: "NG", continent: "Africa", lat: 6.4698, lng: 3.5852, dial: "+234" },
  { city: "Abuja", region: "Federal Capital Territory", country: "Nigeria", countryCode: "NG", continent: "Africa", lat: 9.0765, lng: 7.3986, dial: "+234" },
  { city: "Port Harcourt", region: "Rivers", country: "Nigeria", countryCode: "NG", continent: "Africa", lat: 4.8156, lng: 7.0498, dial: "+234" },
  { city: "Ibadan", region: "Oyo", country: "Nigeria", countryCode: "NG", continent: "Africa", lat: 7.3775, lng: 3.947, dial: "+234" },
  { city: "Kano", region: "Kano", country: "Nigeria", countryCode: "NG", continent: "Africa", lat: 12.0022, lng: 8.592, dial: "+234" },
  { city: "Enugu", region: "Enugu", country: "Nigeria", countryCode: "NG", continent: "Africa", lat: 6.4584, lng: 7.5464, dial: "+234" },
  { city: "Benin City", region: "Edo", country: "Nigeria", countryCode: "NG", continent: "Africa", lat: 6.335, lng: 5.6037, dial: "+234" },
  { city: "Kaduna", region: "Kaduna", country: "Nigeria", countryCode: "NG", continent: "Africa", lat: 10.5105, lng: 7.4165, dial: "+234" },
  { city: "Abeokuta", region: "Ogun", country: "Nigeria", countryCode: "NG", continent: "Africa", lat: 7.1475, lng: 3.3619, dial: "+234" },
  { city: "Uyo", region: "Akwa Ibom", country: "Nigeria", countryCode: "NG", continent: "Africa", lat: 5.0377, lng: 7.9128, dial: "+234" },
  { city: "Owerri", region: "Imo", country: "Nigeria", countryCode: "NG", continent: "Africa", lat: 5.484, lng: 7.0351, dial: "+234" },
  { city: "Warri", region: "Delta", country: "Nigeria", countryCode: "NG", continent: "Africa", lat: 5.5544, lng: 5.7932, dial: "+234" },
  { city: "Accra", region: "Greater Accra", country: "Ghana", countryCode: "GH", continent: "Africa", lat: 5.6037, lng: -0.187, dial: "+233" },
  { city: "Kumasi", region: "Ashanti", country: "Ghana", countryCode: "GH", continent: "Africa", lat: 6.6885, lng: -1.6244, dial: "+233" },
  { city: "Nairobi", region: "Nairobi County", country: "Kenya", countryCode: "KE", continent: "Africa", lat: -1.2921, lng: 36.8219, dial: "+254" },
  { city: "Mombasa", region: "Mombasa County", country: "Kenya", countryCode: "KE", continent: "Africa", lat: -4.0435, lng: 39.6682, dial: "+254" },
  { city: "Johannesburg", region: "Gauteng", country: "South Africa", countryCode: "ZA", continent: "Africa", lat: -26.2041, lng: 28.0473, dial: "+27" },
  { city: "Cape Town", region: "Western Cape", country: "South Africa", countryCode: "ZA", continent: "Africa", lat: -33.9249, lng: 18.4241, dial: "+27" },
  { city: "Cairo", region: "Cairo Governorate", country: "Egypt", countryCode: "EG", continent: "Africa", lat: 30.0444, lng: 31.2357, dial: "+20" },
  { city: "Abidjan", region: "Abidjan", country: "Côte d'Ivoire", countryCode: "CI", continent: "Africa", lat: 5.36, lng: -4.0083, dial: "+225" },
  // Europe
  { city: "London", region: "England", country: "United Kingdom", countryCode: "GB", continent: "Europe", lat: 51.5074, lng: -0.1278, dial: "+44" },
  { city: "Manchester", region: "England", country: "United Kingdom", countryCode: "GB", continent: "Europe", lat: 53.4808, lng: -2.2426, dial: "+44" },
  { city: "Birmingham", region: "England", country: "United Kingdom", countryCode: "GB", continent: "Europe", lat: 52.4862, lng: -1.8904, dial: "+44" },
  { city: "Glasgow", region: "Scotland", country: "United Kingdom", countryCode: "GB", continent: "Europe", lat: 55.8642, lng: -4.2518, dial: "+44" },
  { city: "Dublin", region: "Leinster", country: "Ireland", countryCode: "IE", continent: "Europe", lat: 53.3498, lng: -6.2603, dial: "+353" },
  { city: "Berlin", region: "Berlin", country: "Germany", countryCode: "DE", continent: "Europe", lat: 52.52, lng: 13.405, dial: "+49" },
  { city: "Paris", region: "Île-de-France", country: "France", countryCode: "FR", continent: "Europe", lat: 48.8566, lng: 2.3522, dial: "+33" },
  // North America
  { city: "Houston", region: "Texas", country: "United States", countryCode: "US", continent: "North America", lat: 29.7604, lng: -95.3698, dial: "+1" },
  { city: "Dallas", region: "Texas", country: "United States", countryCode: "US", continent: "North America", lat: 32.7767, lng: -96.797, dial: "+1" },
  { city: "Atlanta", region: "Georgia", country: "United States", countryCode: "US", continent: "North America", lat: 33.749, lng: -84.388, dial: "+1" },
  { city: "New York", region: "New York", country: "United States", countryCode: "US", continent: "North America", lat: 40.7128, lng: -74.006, dial: "+1" },
  { city: "Baltimore", region: "Maryland", country: "United States", countryCode: "US", continent: "North America", lat: 39.2904, lng: -76.6122, dial: "+1" },
  { city: "Toronto", region: "Ontario", country: "Canada", countryCode: "CA", continent: "North America", lat: 43.6532, lng: -79.3832, dial: "+1" },
  { city: "Calgary", region: "Alberta", country: "Canada", countryCode: "CA", continent: "North America", lat: 51.0447, lng: -114.0719, dial: "+1" },
  // Asia
  { city: "Dubai", region: "Dubai", country: "United Arab Emirates", countryCode: "AE", continent: "Asia", lat: 25.2048, lng: 55.2708, dial: "+971" },
  { city: "Mumbai", region: "Maharashtra", country: "India", countryCode: "IN", continent: "Asia", lat: 19.076, lng: 72.8777, dial: "+91" },
  // South America and Oceania
  { city: "São Paulo", region: "São Paulo", country: "Brazil", countryCode: "BR", continent: "South America", lat: -23.5505, lng: -46.6333, dial: "+55" },
  { city: "Sydney", region: "New South Wales", country: "Australia", countryCode: "AU", continent: "Oceania", lat: -33.8688, lng: 151.2093, dial: "+61" },
];

/** Simple seeded random numbers (mulberry32), so the dummy data never changes between runs. */
export function rng(seedText: string) {
  let a = 0; for (const ch of seedText) a = (Math.imul(a ^ ch.charCodeAt(0), 2654435761) >>> 0);
  const next = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = <T,>(items: T[], weights?: number[]) => {
    if (!weights) return items[Math.floor(next() * items.length)]!;
    const total = weights.reduce((s, w) => s + w, 0); let r = next() * total;
    for (let i = 0; i < items.length; i++) { r -= weights[i]!; if (r <= 0) return items[i]!; }
    return items[items.length - 1]!;
  };
  return { next, pick, int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)) };
}

const FIRST = ["Chinedu", "Amaka", "Tunde", "Ngozi", "Ibrahim", "Funmi", "Emeka", "Zainab", "Segun", "Blessing", "Kelechi", "Aisha", "Femi", "Chioma", "Yusuf", "Bukola", "Obinna", "Hauwa", "Dapo", "Nneka", "Kwame", "Ama", "Wanjiru", "Thabo", "Grace", "David", "Sarah", "Michael", "Fatima", "Joseph", "Esther", "Daniel", "Ruth", "Samuel", "Peace", "Victor", "Joy", "Godwin", "Patience", "Ifeoma"];
const LAST = ["Okafor", "Eze", "Bakare", "Adeyemi", "Musa", "Oladipo", "Nwosu", "Bello", "Afolabi", "Okon", "Okeke", "Abubakar", "Ogunleye", "Obi", "Danjuma", "Ajayi", "Uche", "Mensah", "Boateng", "Kamau", "Ndlovu", "Johnson", "Williams", "Adebayo", "Ibekwe", "Lawal", "Oyelaran", "Chukwu", "Garba", "Osei"];

interface WorkspaceProfile {
  /** Brand name used inside agent scripts. */
  company: string;
  agents: { preset: string; voiceId: string; extra?: Record<string, string> }[];
  /** City weights by country code (missing = 0). */
  weights: Record<string, number>;
  leads: number;
  calls: number;
  numbers: { number: string; country: string; countryCode: string; areaCode: string; type: string; costNaira: number; label: string }[];
  released: { number: string; country: string; countryCode: string; areaCode: string; type: string; daysAgo: number }[];
  trunk: { name: string; host: string; username: string };
  knowledge: { kind: "FILE" | "WEBSITE"; name: string; url?: string; sizeKb?: number; mime?: string; pages?: number; agentIndex: number; daysAgo: number }[];
  integrations: { provider: string; detail: string; daysAgo: number }[];
  apiKeys: { name: string; daysAgo: number; lastUsedHoursAgo: number | null }[];
  wallet: boolean;
}

export const PROFILES: Record<string, WorkspaceProfile> = {
  demo: {
    company: "Spag Demo Finance",
    agents: [
      { preset: "fintech-support", voiceId: "mock-en-ng-male-1" },
      { preset: "repayment-reminders", voiceId: "mock-pcm-female-1" },
    ],
    weights: { NG: 70, GH: 6, KE: 3, ZA: 3, GB: 7, US: 5, CA: 2, IE: 1, AE: 2, EG: 0.5, CI: 0.5 },
    leads: 160, calls: 1240,
    numbers: [
      { number: "+2342019003412", country: "Nigeria", countryCode: "NG", areaCode: "01", type: "local", costNaira: 4500, label: "Lagos main line" },
      { number: "+2349123457821", country: "Nigeria", countryCode: "NG", areaCode: "0912", type: "mobile", costNaira: 3500, label: "Support line" },
      { number: "+2348003374211", country: "Nigeria", countryCode: "NG", areaCode: "0800", type: "toll_free", costNaira: 12000, label: "Toll-free hotline" },
      { number: "+442038079512", country: "United Kingdom", countryCode: "GB", areaCode: "020", type: "local", costNaira: 9800, label: "UK customers" },
    ],
    released: [
      { number: "+2349098812345", country: "Nigeria", countryCode: "NG", areaCode: "0909", type: "mobile", daysAgo: 21 },
      { number: "+2342017780021", country: "Nigeria", countryCode: "NG", areaCode: "01", type: "local", daysAgo: 48 },
    ],
    trunk: { name: "MTN Business SIP", host: "sip.mtnbusiness.example.ng", username: "spagdemo" },
    knowledge: [
      { kind: "FILE", name: "Business account FAQ.pdf", sizeKb: 842, mime: "application/pdf", agentIndex: 0, daysAgo: 12 },
      { kind: "FILE", name: "Pricing and fees 2026.xlsx", sizeKb: 96, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", agentIndex: 0, daysAgo: 9 },
      { kind: "WEBSITE", name: "spagdemofinance.example.ng", url: "https://spagdemofinance.example.ng", pages: 37, agentIndex: 0, daysAgo: 6 },
      { kind: "FILE", name: "Support escalation guide.docx", sizeKb: 214, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", agentIndex: 1, daysAgo: 5 },
      { kind: "WEBSITE", name: "help.spagdemofinance.example.ng", url: "https://help.spagdemofinance.example.ng", pages: 58, agentIndex: 1, daysAgo: 3 },
      { kind: "FILE", name: "Repayment policy.pdf", sizeKb: 388, mime: "application/pdf", agentIndex: 2, daysAgo: 2 },
    ],
    integrations: [
      { provider: "google_calendar", detail: "bookings@spagdemofinance.example.ng", daysAgo: 20 },
      { provider: "slack", detail: "#sales-calls", daysAgo: 14 },
      { provider: "make", detail: "3 scenarios", daysAgo: 30 },
    ],
    apiKeys: [
      { name: "Production CRM sync", daysAgo: 40, lastUsedHoursAgo: 2 },
      { name: "Analytics export", daysAgo: 18, lastUsedHoursAgo: 51 },
    ],
    wallet: false,
  },
  yakub: {
    company: "Yakub Homes & Health",
    agents: [
      { preset: "real-estate-lead-qualifier", voiceId: "mock-en-ng-female-1", extra: { property_name: "Yakub Court, Lekki Phase 1" } },
      { preset: "clinic-booking", voiceId: "mock-en-ng-female-1" },
      { preset: "delivery-confirmation", voiceId: "mock-ha-male-1" },
    ],
    weights: { NG: 38, GB: 18, US: 16, CA: 8, GH: 5, IE: 3, DE: 2, FR: 2, AE: 4, IN: 1, BR: 1, AU: 2 },
    leads: 130, calls: 860,
    numbers: [
      { number: "+2349012345678", country: "Nigeria", countryCode: "NG", areaCode: "0901", type: "mobile", costNaira: 3500, label: "Property enquiries" },
      { number: "+442071234567", country: "United Kingdom", countryCode: "GB", areaCode: "020", type: "local", costNaira: 9800, label: "Diaspora buyers (UK)" },
      { number: "+17135550142", country: "United States", countryCode: "US", areaCode: "713", type: "local", costNaira: 8200, label: "Diaspora buyers (Houston)" },
    ],
    released: [{ number: "+2348123450987", country: "Nigeria", countryCode: "NG", areaCode: "0812", type: "mobile", daysAgo: 33 }],
    trunk: { name: "Airtel SIP trunk", host: "sip.airtel.example.ng", username: "yakubhomes" },
    knowledge: [
      { kind: "FILE", name: "Yakub Court brochure.pdf", sizeKb: 5120, mime: "application/pdf", agentIndex: 0, daysAgo: 15 },
      { kind: "WEBSITE", name: "yakubhomes.example.ng", url: "https://yakubhomes.example.ng", pages: 24, agentIndex: 0, daysAgo: 10 },
      { kind: "FILE", name: "Clinic services and prices.pdf", sizeKb: 640, mime: "application/pdf", agentIndex: 1, daysAgo: 8 },
      { kind: "FILE", name: "Delivery zones.csv", sizeKb: 18, mime: "text/csv", agentIndex: 2, daysAgo: 4 },
    ],
    integrations: [
      { provider: "hubspot", detail: "yakub-homes (portal 48211)", daysAgo: 25 },
      { provider: "cal_com", detail: "cal.com/yakub-homes", daysAgo: 11 },
      { provider: "webhook", detail: "https://hooks.yakubhomes.example.ng/spag", daysAgo: 7 },
    ],
    apiKeys: [{ name: "Website lead form", daysAgo: 22, lastUsedHoursAgo: 6 }],
    wallet: true,
  },
};

const DAY = 86_400_000;
/** Lagos is UTC+1 all year. */
const lagosHourOf = (d: Date) => (d.getUTCHours() + 1) % 24;

export async function seedPlatform(db: PrismaClient, org: { id: string; ownerId: string }, key: keyof typeof PROFILES, secret: string) {
  const p = PROFILES[key]!;
  const r = rng(`spag:${key}`);
  const now = Date.now();

  // --- agents ---
  const existingAgents = await db.agent.findMany({ where: { organisationId: org.id }, orderBy: { createdAt: "asc" } });
  for (const a of p.agents) {
    if (existingAgents.some((e) => e.presetId === a.preset)) continue;
    const preset = getPreset(a.preset)!;
    const config = presetToAgentConfig(preset);
    config.variableValues = { ...config.variableValues, company_name: p.company, ...a.extra };
    config.voiceId = a.voiceId;
    const status = agentReadiness(config).ready ? "READY" : "DRAFT";
    existingAgents.push(await db.agent.create({ data: { organisationId: org.id, name: config.name, presetId: preset.id, config, status, createdById: org.ownerId } }));
  }
  const agents = existingAgents;

  // --- leads with locations ---
  const cities = CITIES.filter((c) => p.weights[c.countryCode]);
  // Nigerian cities share NG's weight; Lagos gets extra because it is the commercial centre.
  const cityWeights = cities.map((c) => (p.weights[c.countryCode]! / cities.filter((x) => x.countryCode === c.countryCode).length) * (c.region === "Lagos" ? 2.2 : 1));
  const located = await db.lead.count({ where: { organisationId: org.id, NOT: { city: "" } } });
  if (located < p.leads / 2) {
    // Give existing leads (all Nigerian) a Nigerian city first.
    const ng = cities.filter((c) => c.countryCode === "NG");
    for (const lead of await db.lead.findMany({ where: { organisationId: org.id, city: "" } })) {
      const c = lead.phone.startsWith("+234") && ng.length ? r.pick(ng) : r.pick(cities, cityWeights);
      await db.lead.update({ where: { id: lead.id }, data: { continent: c.continent, country: c.country, countryCode: c.countryCode, region: c.region, city: c.city, lat: c.lat, lng: c.lng } });
    }
    const rows = [];
    for (let i = 0; i < p.leads; i++) {
      const c = r.pick(cities, cityWeights), gender = r.next() < 0.5 ? "male" : "female";
      const digits = c.countryCode === "NG" ? `${r.pick(["70", "80", "81", "90", "91"])}${String(r.int(10000000, 99999999))}` : String(r.int(2000000000, 9899999999));
      rows.push({
        organisationId: org.id, firstName: r.pick(FIRST), lastName: r.pick(LAST), gender,
        title: r.next() < 0.12 ? r.pick(["Dr", "Engr", "Chief", "Barr", "Alhaji"]) : "",
        phone: `${c.dial}${digits}`, source: r.pick(["Website form", "Referral", "Lagos trade fair", "Instagram ad", "Partner list"]),
        consent: r.next() < 0.93, continent: c.continent, country: c.country, countryCode: c.countryCode,
        region: c.region, city: c.city, lat: c.lat + (r.next() - 0.5) * 0.08, lng: c.lng + (r.next() - 0.5) * 0.08,
        createdAt: new Date(now - r.int(31, 90) * DAY),
      });
    }
    await db.lead.createMany({ data: rows, skipDuplicates: true });
  }

  // --- calls over the last 30 days ---
  if ((await db.call.count({ where: { organisationId: org.id } })) < 200) {
    const leads = await db.lead.findMany({ where: { organisationId: org.id, NOT: { city: "" } }, select: { id: true, firstName: true } });
    const agentWeights = agents.map((_, i) => [5, 3, 2, 2][i] ?? 1);
    const hourWeights = Array.from({ length: 24 }, (_, h) => (h < 8 || h >= 21 ? 0 : [3, 6, 9, 10, 7, 5, 6, 8, 9, 7, 5, 4, 3][h - 8]!));
    const rate = 15_000;
    const calls = [];
    for (let i = 0; i < p.calls; i++) {
      // More calls recently (the business is growing) and fewer at weekends.
      let dayBack: number, d: Date;
      do { dayBack = Math.floor(Math.pow(r.next(), 1.35) * 30); d = new Date(now - dayBack * DAY); } while ([0, 6].includes(d.getUTCDay()) && r.next() < 0.55);
      const hour = r.pick([...Array(24).keys()], hourWeights);
      const at = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour - 1, r.int(0, 59), r.int(0, 59)));
      if (at.getTime() > now) at.setTime(at.getTime() - DAY);
      const roll = r.next();
      const status = roll < 0.64 ? "COMPLETED" : roll < 0.94 ? "NO_ANSWER" : roll < 0.97 ? "BLOCKED" : "FAILED";
      const lead = r.pick(leads), agentIdx = agents.indexOf(r.pick(agents, agentWeights)), agent = agents[agentIdx]!;
      let outcome: string | null = null, duration: number | null = null, transcript = null;
      if (status === "COMPLETED") {
        outcome = r.pick(["booked", "callback", "not_interested", "other", "opted_out", "wrong_number"], [18, 15, 25, 30, 5, 7]);
        duration = Math.round(Math.min(900, 25 + -Math.log(1 - r.next()) * (outcome === "booked" ? 160 : 85)));
        transcript = [
          { role: "agent", text: `Good ${lagosHourOf(at) < 12 ? "morning" : lagosHourOf(at) < 17 ? "afternoon" : "evening"}. This is ${agent.name}, an AI assistant calling from ${p.company}. Is this a good time to talk?` },
          { role: "caller", text: outcome === "callback" ? "I'm busy now, call me later." : outcome === "wrong_number" ? "You have the wrong number." : "Yes, go ahead." },
          { role: "agent", text: outcome === "booked" ? "Wonderful. You are booked for a short meeting. Is there anything else I can help you with?" : outcome === "opted_out" ? "I understand. I will make sure you are not called again." : "Thank you for your time. Have a great day." },
        ];
      } else if (status === "NO_ANSWER") outcome = "no_answer";
      calls.push({
        organisationId: org.id, leadId: lead.id, agentId: agent.id, status: status as "COMPLETED", outcome,
        durationSeconds: duration, costKobo: duration ? Math.ceil(duration / 60) * rate : null, transcript: transcript ?? undefined,
        provider: "mock", attemptedAt: at, createdAt: at,
        blockReasons: status === "BLOCKED" ? [{ code: "outside_calling_hours", message: "Outside calling hours.", permanent: false }] : status === "FAILED" ? [{ code: "missing_value", message: "Missing required values: amount_due.", permanent: true }] : undefined,
      });
    }
    await db.call.createMany({ data: calls });

    // Wallet history for a fresh workspace: top-ups whenever the balance runs low, one charge line per day.
    if (p.wallet && (await db.walletTransaction.count({ where: { organisationId: org.id } })) === 0) {
      const byDay = new Map<string, { at: Date; kobo: number; count: number }>();
      for (const c of calls) if (c.costKobo) { const k = c.attemptedAt.toISOString().slice(0, 10); const e = byDay.get(k) ?? { at: new Date(`${k}T20:30:00Z`), kobo: 0, count: 0 }; e.kobo += c.costKobo; e.count++; byDay.set(k, e); }
      let balance = 0; const tx = [];
      for (const [day, e] of [...byDay.entries()].sort()) {
        if (balance < e.kobo + 2_000_000) {
          const amount = 10_000_000; balance += amount;
          tx.push({ organisationId: org.id, type: "TOPUP" as const, status: "SUCCESS" as const, amountKobo: amount, balanceAfterKobo: balance, reference: `spag_seed_topup_${org.id}_${day}`, provider: "paystack", description: "Top-up of ₦100,000", createdById: org.ownerId, createdAt: new Date(e.at.getTime() - 10 * 3_600_000), completedAt: new Date(e.at.getTime() - 10 * 3_600_000) });
        }
        balance -= e.kobo;
        tx.push({ organisationId: org.id, type: "CALL_CHARGE" as const, status: "SUCCESS" as const, amountKobo: -e.kobo, balanceAfterKobo: balance, reference: `spag_seed_calls_${org.id}_${day}`, provider: "calls", description: `Calls on ${day} (${e.count} answered)`, createdAt: e.at, completedAt: e.at });
      }
      await db.walletTransaction.createMany({ data: tx });
      await db.organisation.update({ where: { id: org.id }, data: { balanceKobo: balance } });
    }
  }

  // --- a quieter month before that, so the dashboard can show the change ---
  if ((await db.call.count({ where: { organisationId: org.id, attemptedAt: { lt: new Date(now - 31 * DAY) } } })) < 50) {
    const older = rng(`spag:${key}:older`);
    const leads = await db.lead.findMany({ where: { organisationId: org.id, NOT: { city: "" } }, select: { id: true } });
    const rows = [];
    for (let i = 0; i < Math.round(p.calls * 0.78); i++) {
      const at = new Date(now - (31 + older.int(0, 29)) * DAY);
      at.setUTCHours(older.int(7, 19), older.int(0, 59), older.int(0, 59));
      const roll = older.next();
      const status = roll < 0.6 ? "COMPLETED" : roll < 0.95 ? "NO_ANSWER" : "BLOCKED";
      const outcome = status === "COMPLETED" ? older.pick(["booked", "callback", "not_interested", "other"], [15, 15, 30, 40]) : status === "NO_ANSWER" ? "no_answer" : null;
      const duration = status === "COMPLETED" ? Math.round(Math.min(900, 25 + -Math.log(1 - older.next()) * 95)) : null;
      rows.push({
        organisationId: org.id, leadId: older.pick(leads).id, agentId: older.pick(agents).id, status: status as "COMPLETED", outcome,
        durationSeconds: duration, costKobo: duration ? Math.ceil(duration / 60) * 15_000 : null, provider: "mock", attemptedAt: at, createdAt: at,
        blockReasons: status === "BLOCKED" ? [{ code: "outside_calling_hours", message: "Outside calling hours.", permanent: false }] : undefined,
      });
    }
    await db.call.createMany({ data: rows });
  }

  // --- phone numbers and SIP trunk ---
  if ((await db.phoneNumber.count({ where: { organisationId: org.id } })) === 0) {
    await db.phoneNumber.createMany({
      data: [
        ...p.numbers.map((n, i) => ({ organisationId: org.id, number: n.number, country: n.country, countryCode: n.countryCode, areaCode: n.areaCode, type: n.type, monthlyCostKobo: n.costNaira * 100, label: n.label, agentId: agents[i % agents.length]!.id, purchasedAt: new Date(now - (60 - i * 9) * DAY) })),
        ...p.released.map((n) => ({ organisationId: org.id, number: n.number, country: n.country, countryCode: n.countryCode, areaCode: n.areaCode, type: n.type, status: "RELEASED" as const, purchasedAt: new Date(now - (n.daysAgo + 70) * DAY), releasedAt: new Date(now - n.daysAgo * DAY) })),
      ],
    });
    await db.sipTrunk.create({ data: { organisationId: org.id, name: p.trunk.name, host: p.trunk.host, port: 5060, transport: "udp", username: p.trunk.username, hasPassword: true, createdAt: new Date(now - 26 * DAY) } });
  }

  // --- knowledge bank ---
  if ((await db.knowledgeItem.count({ where: { organisationId: org.id } })) === 0) {
    await db.knowledgeItem.createMany({
      data: p.knowledge.map((k) => ({
        organisationId: org.id, agentId: agents[Math.min(k.agentIndex, agents.length - 1)]!.id, kind: k.kind, name: k.name, url: k.url ?? "",
        sizeBytes: (k.sizeKb ?? 0) * 1024, mimeType: k.mime ?? "", pages: k.pages ?? 0,
        chunks: k.kind === "WEBSITE" ? (k.pages ?? 1) * 6 : Math.max(1, Math.round((k.sizeKb ?? 1) / 9)), status: "READY", createdById: org.ownerId, createdAt: new Date(now - k.daysAgo * DAY),
      })),
    });
  }

  // --- integrations ---
  if ((await db.integration.count({ where: { organisationId: org.id } })) === 0) {
    await db.integration.createMany({ data: p.integrations.map((i) => ({ organisationId: org.id, provider: i.provider, detail: i.detail, connectedAt: new Date(now - i.daysAgo * DAY) })) });
  }

  // --- API keys ---
  if ((await db.apiKey.count({ where: { organisationId: org.id } })) === 0) {
    for (const k of p.apiKeys) {
      const key = generateApiKey();
      await db.apiKey.create({ data: { organisationId: org.id, name: k.name, prefix: displayPrefix(key), keyHash: hashApiKey(key), keyEncrypted: encryptApiKey(key, secret), createdById: org.ownerId, createdAt: new Date(now - k.daysAgo * DAY), lastUsedAt: k.lastUsedHoursAgo === null ? null : new Date(now - k.lastUsedHoursAgo * 3_600_000) } });
    }
  }

  // --- full conversations for every answered call, so each has a recording to play back ---
  await enrichTranscripts(db, org.id, p.company);
}
