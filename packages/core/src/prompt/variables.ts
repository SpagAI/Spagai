/**
 * Template variables use double curly braces: {{business_name}}, {{ lead_name }}.
 */

import type { VariableDef } from "./types";

export const VARIABLE_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

/** Variables the platform fills in automatically at call time. */
export const SYSTEM_VARIABLES: VariableDef[] = [
  { name: "address", label: "How to address the person (e.g. Mr Okafor)", scope: "system", required: false },
  { name: "suffix", label: "Sir or Ma (empty when gender is unknown)", scope: "system", required: false, allowEmpty: true },
  { name: "greeting", label: "Good morning / afternoon / evening", scope: "system", required: false },
  { name: "goodbye", label: "Goodbye line for the time and day", scope: "system", required: false },
  { name: "time_of_day", label: "morning, afternoon or evening", scope: "system", required: false },
  { name: "current_date", label: "Today's date (YYYY-MM-DD, WAT)", scope: "system", required: false },
  { name: "current_time", label: "Current time (HH:MM, WAT)", scope: "system", required: false },
  { name: "current_day", label: "Day of the week", scope: "system", required: false },
];

export function findVariables(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(VARIABLE_RE)) names.add(match[1]!);
  return [...names];
}

/**
 * Replace {{name}} with values. Unknown or empty variables are left as-is
 * (so a preview still shows where they go), except names in `emptyAllowed`,
 * which are replaced by nothing and the spacing around them is tidied.
 */
export function renderVariables(
  text: string,
  values: Record<string, string | undefined>,
  emptyAllowed: ReadonlySet<string> = new Set(),
): string {
  let removed = false;
  const out = text.replace(VARIABLE_RE, (whole, name: string) => {
    const v = values[name];
    if (v === "" && emptyAllowed.has(name)) {
      removed = true;
      return "";
    }
    return v === undefined || v === "" ? whole : v;
  });
  // "Is now a good time, ?" → "Is now a good time?"
  return removed ? out.replace(/[ \t]*,[ \t]*([.?!])/g, "$1").replace(/[ \t]+([,.?!])/g, "$1").replace(/[ \t]{2,}/g, " ") : out;
}
