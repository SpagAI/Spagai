/** The (dummy) catalogue of numbers for sale. Shared by the search form and the buy action. */

export type NumberType = "local" | "mobile" | "toll_free";

export interface NumberCountry {
  code: string;
  name: string;
  dial: string;
  areas: { code: string; name: string; type: NumberType }[];
  /** Monthly price in naira by type */
  price: Partial<Record<NumberType, number>>;
}

export const NUMBER_COUNTRIES: NumberCountry[] = [
  {
    code: "NG", name: "Nigeria", dial: "+234", price: { local: 2500, mobile: 3500, toll_free: 12000 },
    areas: [
      { code: "01", name: "Lagos", type: "local" }, { code: "09", name: "Abuja", type: "local" }, { code: "084", name: "Port Harcourt", type: "local" },
      { code: "02", name: "Ibadan", type: "local" }, { code: "062", name: "Kaduna", type: "local" }, { code: "064", name: "Kano", type: "local" },
      { code: "0901", name: "Mobile (0901)", type: "mobile" }, { code: "0816", name: "Mobile (0816)", type: "mobile" }, { code: "0703", name: "Mobile (0703)", type: "mobile" },
      { code: "0800", name: "Toll-free (0800)", type: "toll_free" },
    ],
  },
  {
    code: "GH", name: "Ghana", dial: "+233", price: { local: 3800, mobile: 4200 },
    areas: [{ code: "030", name: "Accra", type: "local" }, { code: "032", name: "Kumasi", type: "local" }, { code: "024", name: "Mobile (024)", type: "mobile" }],
  },
  {
    code: "KE", name: "Kenya", dial: "+254", price: { local: 4000, mobile: 4500 },
    areas: [{ code: "020", name: "Nairobi", type: "local" }, { code: "041", name: "Mombasa", type: "local" }, { code: "07", name: "Mobile (07)", type: "mobile" }],
  },
  {
    code: "ZA", name: "South Africa", dial: "+27", price: { local: 5200, toll_free: 15000 },
    areas: [{ code: "011", name: "Johannesburg", type: "local" }, { code: "021", name: "Cape Town", type: "local" }, { code: "0800", name: "Toll-free (0800)", type: "toll_free" }],
  },
  {
    code: "GB", name: "United Kingdom", dial: "+44", price: { local: 9800, mobile: 11000, toll_free: 16500 },
    areas: [
      { code: "020", name: "London", type: "local" }, { code: "0161", name: "Manchester", type: "local" }, { code: "0121", name: "Birmingham", type: "local" },
      { code: "07", name: "Mobile (07)", type: "mobile" }, { code: "0800", name: "Freephone (0800)", type: "toll_free" },
    ],
  },
  {
    code: "US", name: "United States", dial: "+1", price: { local: 8200, toll_free: 14000 },
    areas: [
      { code: "212", name: "New York (212)", type: "local" }, { code: "713", name: "Houston (713)", type: "local" }, { code: "404", name: "Atlanta (404)", type: "local" },
      { code: "301", name: "Maryland (301)", type: "local" }, { code: "888", name: "Toll-free (888)", type: "toll_free" },
    ],
  },
  {
    code: "CA", name: "Canada", dial: "+1", price: { local: 8200, toll_free: 14000 },
    areas: [{ code: "416", name: "Toronto (416)", type: "local" }, { code: "403", name: "Calgary (403)", type: "local" }, { code: "800", name: "Toll-free (800)", type: "toll_free" }],
  },
  {
    code: "AE", name: "United Arab Emirates", dial: "+971", price: { local: 12500 },
    areas: [{ code: "04", name: "Dubai", type: "local" }, { code: "02", name: "Abu Dhabi", type: "local" }],
  },
];

export const TYPE_LABELS: Record<NumberType, string> = { local: "Local", mobile: "Mobile", toll_free: "Toll-free" };

/** Digits after the dial code, without the trunk "0". */
function national(area: string, rest: string) {
  return area.replace(/^0/, "") + rest;
}

/** "+2349012345678" → "+234 901 234 5678"; "+442071234567" → "+44 20 7123 4567" */
export function formatNumber(e164: string): string {
  const c = NUMBER_COUNTRIES.filter((x) => e164.startsWith(x.dial)).sort((a, b) => b.dial.length - a.dial.length)[0];
  if (!c) return e164;
  const n = e164.slice(c.dial.length);
  if (c.dial === "+1") return `+1 (${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
  const head = n.length > 9 ? 3 : 2;
  return `${c.dial} ${n.slice(0, head)} ${n.slice(head, n.length - 4)} ${n.slice(-4)}`.replace(/\s+/g, " ");
}

/** A small, repeatable list of "available" numbers for a country and area code. */
export function availableNumbers(countryCode: string, areaCode: string, seed = 0): { number: string; type: NumberType; monthlyNaira: number }[] {
  const c = NUMBER_COUNTRIES.find((x) => x.code === countryCode);
  const area = c?.areas.find((a) => a.code === areaCode);
  if (!c || !area) return [];
  let h = 2166136261 ^ seed;
  for (const ch of `${countryCode}${areaCode}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const next = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
  // National significant number length (without the area code).
  const nsn = c.dial === "+1" ? 10 : c.code === "NG" ? 10 : c.code === "GB" ? 10 : 9;
  const restLen = Math.max(4, nsn - national(area.code, "").length);
  return Array.from({ length: 6 }, () => {
    const rest = Array.from({ length: restLen }, (_, i) => (i === 0 ? 2 + Math.floor(next() * 7) : Math.floor(next() * 10))).join("");
    return { number: `${c.dial}${national(area.code, rest)}`, type: area.type, monthlyNaira: c.price[area.type] ?? 0 };
  });
}
