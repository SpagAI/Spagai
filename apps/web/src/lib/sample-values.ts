/**
 * Believable dummy values for testing an agent before real data exists, picked from the
 * variable's name (and label). Pure, so it can be tested.
 */

const FIRST = ["Amaka", "Tunde", "Ngozi", "Emeka", "Funmi", "Bola", "Ifeoma", "Yusuf"];
const LAST = ["Okafor", "Adeyemi", "Bello", "Eze", "Balogun", "Nwosu", "Ibrahim", "Adebayo"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** A small stable number from the name, so the same variable always gets the same example. */
function pick(name: string, n: number): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % n;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function sampleValueFor(name: string, label = "", now = new Date()): string {
  const n = name.toLowerCase();
  const text = `${n} ${label.toLowerCase()}`;
  const has = (...words: string[]) => words.some((w) => text.includes(w));
  const inDays = (k: number) => new Date(now.getTime() + k * 86_400_000);

  if (has("email")) return `${FIRST[pick(n, FIRST.length)]!.toLowerCase()}@example.com`;
  if (has("phone", "mobile", "whatsapp", "number") && !has("account", "order", "ref", "id", "plate")) return "08031234567";
  if (has("first_name", "firstname", "first name")) return FIRST[pick(n, FIRST.length)]!;
  if (has("last_name", "lastname", "surname", "last name")) return LAST[pick(n, LAST.length)]!;
  if (has("doctor")) return `Dr ${LAST[pick(n, LAST.length)]}`;
  if (has("name")) return `${FIRST[pick(n, FIRST.length)]} ${LAST[pick(n + "x", LAST.length)]}`;
  if (has("year")) return String(now.getFullYear());
  if (has("month")) return MONTHS[now.getMonth()]!;
  if (/(^|_)day$|weekday/.test(n)) return DAYS[inDays(2).getDay()]!;
  if (has("timezone", "time_zone")) return "WAT (Lagos)";
  if (has("date", "due", "deadline", "dob", "birthday")) return iso(inDays(has("birth", "dob") ? -30 * 365 : 3));
  if (has("time", "hour")) return "10:00";
  if (n === "now") return `${iso(now)} 10:00`;
  if (has("amount", "price", "fee", "balance", "cost", "salary", "budget", "payment", "total", "naira", "loan")) return "₦50,000";
  if (has("percent", "rate", "interest")) return "5%";
  if (has("count", "quantity", "qty", "seats", "people", "guests", "size")) return "2";
  if (has("address", "location", "street")) return "12 Admiralty Way, Lekki Phase 1, Lagos";
  if (has("branch", "city", "area", "office")) return "Lekki, Lagos";
  if (has("state")) return "Lagos";
  if (has("company", "business", "employer", "organisation", "organization")) return "Bright Ventures Ltd";
  if (has("product", "plan", "package", "service", "item")) return "Premium plan";
  if (has("order", "ref", "reference", "invoice", "ticket", "account", "booking", "_id", "code")) return `AB${1000 + pick(n, 9000)}`;
  if (has("reason", "purpose", "complaint", "issue", "symptom")) return "a routine check-up";
  if (has("status")) return "pending";
  if (has("gender")) return "female";
  if (has("title")) return "Mrs";
  if (has("source", "channel")) return "website form";
  if (has("note", "detail", "remember", "comment", "summary", "message", "preference")) return "prefers a call in the morning";
  if (has("url", "link", "website")) return "https://example.com";
  return "example";
}

/** Fill only the empty ones; values the person typed are kept. */
export function fillSampleValues(vars: { name: string; label?: string }[], current: Record<string, string>, now = new Date()): Record<string, string> {
  const out = { ...current };
  for (const v of vars) if (!(out[v.name] ?? "").trim()) out[v.name] = sampleValueFor(v.name, v.label, now);
  return out;
}
