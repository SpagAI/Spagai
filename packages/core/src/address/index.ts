/**
 * Respectful addressing for Nigerian callers.
 *
 * Rules (from the founder's brief):
 * - Default title is "Mr" for men and "Miss" for women.
 * - A title of "Sir" or "Ma" counts as NO title (they are suffixes, not titles).
 * - Mode A = title + name ("Mr Okafor"). Mode B = first name only ("Chinedu").
 * - The suffix is "Sir" or "Ma".
 * - "Sir"/"Ma" must never be in the same sentence as a title or the person's name.
 *   Good: "Mr Okafor, thank you for your time." ... "Is now a good time, Sir?"
 *   Bad:  "Thank you, Mr Okafor Sir."
 */

export type Gender = "male" | "female" | "unknown";
export type AddressMode = "A" | "B";
export type AddressSuffix = "Sir" | "Ma" | "";

export interface AddressInput {
  title?: string | null;
  gender?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  /** A = title + name, B = first name only. Defaults to A. */
  mode?: AddressMode;
}

export interface AddressResult {
  /** What the agent calls the person, e.g. "Mr Okafor" or "Chinedu". May be "" if we know nothing. */
  address: string;
  /** "Sir", "Ma", or "" when gender is unknown. Use it in a separate sentence from `address`. */
  suffix: AddressSuffix;
  /** The cleaned title actually used ("" when none). */
  title: string;
  /** True when we applied the Mr/Miss default because no usable title was given. */
  usedDefaultTitle: boolean;
  gender: Gender;
}

/** Canonical spelling for titles we recognise. Keys are lower case, without dots. */
const TITLE_CANONICAL: Record<string, string> = {
  mr: "Mr", mister: "Mr",
  mrs: "Mrs", missus: "Mrs",
  miss: "Miss",
  ms: "Ms",
  dr: "Dr", doctor: "Dr",
  engr: "Engr", engineer: "Engr",
  barr: "Barr", barrister: "Barr",
  prof: "Prof", professor: "Prof",
  chief: "Chief",
  alhaji: "Alhaji",
  alhaja: "Alhaja",
  hajia: "Hajia",
  pastor: "Pastor",
  rev: "Rev", reverend: "Rev",
  hon: "Hon", honourable: "Hon", honorable: "Hon",
  arc: "Arc", architect: "Arc",
  pharm: "Pharm",
};

/** Words that are suffixes / honorifics, not titles. Treated as "no title". */
const NOT_A_TITLE = new Set(["sir", "ma", "madam", "maam", "ma'am", "mam"]);

/** Titles that tell us the gender when the gender field is blank. */
const TITLE_GENDER: Record<string, Gender> = {
  Mr: "male", Alhaji: "male",
  Mrs: "female", Miss: "female", Ms: "female", Alhaja: "female", Hajia: "female",
};

export function normaliseGender(value: string | null | undefined): Gender {
  const v = (value ?? "").trim().toLowerCase();
  if (["m", "male", "man", "boy"].includes(v)) return "male";
  if (["f", "female", "woman", "girl"].includes(v)) return "female";
  return "unknown";
}

/** Returns the canonical title, or "" when the value is blank, unknown, or Sir/Ma. */
export function normaliseTitle(value: string | null | undefined): string {
  const key = (value ?? "").trim().toLowerCase().replace(/\./g, "");
  if (!key || NOT_A_TITLE.has(key)) return "";
  return TITLE_CANONICAL[key] ?? "";
}

function cleanName(value: string | null | undefined): string {
  const v = (value ?? "").trim().replace(/\s+/g, " ");
  if (!v) return "";
  // Respect names the user already capitalised (e.g. "McDonald", "DeLuca").
  if (v !== v.toLowerCase() && v !== v.toUpperCase()) return v;
  return v
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

export function buildAddress(input: AddressInput): AddressResult {
  const mode = input.mode ?? "A";
  const firstName = cleanName(input.firstName);
  const lastName = cleanName(input.lastName);
  let title = normaliseTitle(input.title);
  let gender = normaliseGender(input.gender);

  if (gender === "unknown" && title && TITLE_GENDER[title]) {
    gender = TITLE_GENDER[title]!;
  }

  let usedDefaultTitle = false;
  if (!title) {
    if (gender === "male") { title = "Mr"; usedDefaultTitle = true; }
    else if (gender === "female") { title = "Miss"; usedDefaultTitle = true; }
  }

  const suffix: AddressSuffix = gender === "male" ? "Sir" : gender === "female" ? "Ma" : "";

  let address: string;
  let titleUsed = "";
  if (mode === "B") {
    if (firstName) address = firstName;
    else if (title && lastName) { address = `${title} ${lastName}`; titleUsed = title; }
    else address = lastName;
  } else {
    const name = lastName || firstName;
    if (title && name) { address = `${title} ${name}`; titleUsed = title; }
    else address = name;
  }

  return {
    address,
    suffix,
    title: titleUsed,
    usedDefaultTitle: usedDefaultTitle && titleUsed !== "",
    gender,
  };
}

// ---------------------------------------------------------------------------
// Rule checker: Sir/Ma never in the same sentence as a title or a name.
// ---------------------------------------------------------------------------

export interface AddressRuleViolation {
  sentence: string;
  reason: string;
}

const ALL_TITLE_WORDS = [
  ...new Set(Object.values(TITLE_CANONICAL)),
  "Mister", "Doctor", "Engineer", "Barrister", "Professor",
];

/** Splits text into sentences on . ! ? (keeps it simple on purpose). */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const SUFFIX_RE = /(^|[^\p{L}])(sir|ma|madam|ma'am)(?=$|[^\p{L}])/iu;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Checks text (e.g. a scripted line) for "Sir"/"Ma" sharing a sentence with a title or name.
 * Pass the person's names to also catch "Chinedu, Sir". Template placeholders such as
 * {{lead_name}} or {{title}} are treated as names.
 */
export function checkAddressRule(
  text: string,
  names: { firstName?: string; lastName?: string } = {},
): AddressRuleViolation[] {
  const nameWords = [names.firstName, names.lastName]
    .map((n) => (n ?? "").trim())
    .filter(Boolean);

  const titleRe = new RegExp(`(^|[^\\p{L}])(${ALL_TITLE_WORDS.map(escapeRe).join("|")})\\.?(?=\\s+\\p{Lu}|\\s*\\{\\{)`, "u");
  const nameRe = nameWords.length
    ? new RegExp(`(^|[^\\p{L}])(${nameWords.map(escapeRe).join("|")})(?=$|[^\\p{L}])`, "u")
    : null;
  const placeholderRe = /\{\{\s*(title|lead_name|first_name|last_name|address|full_name|name)\s*\}\}/i;

  const violations: AddressRuleViolation[] = [];
  for (const sentence of splitSentences(text)) {
    if (!SUFFIX_RE.test(sentence) && !/\{\{\s*suffix\s*\}\}/i.test(sentence)) continue;
    if (titleRe.test(sentence)) {
      violations.push({ sentence, reason: "Sir/Ma is used in the same sentence as a title." });
    } else if (nameRe?.test(sentence)) {
      violations.push({ sentence, reason: "Sir/Ma is used in the same sentence as the person's name." });
    } else if (placeholderRe.test(sentence)) {
      violations.push({ sentence, reason: "Sir/Ma is used in the same sentence as a name placeholder." });
    }
  }
  return violations;
}
