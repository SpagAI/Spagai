/**
 * Lead import (M4): read a CSV file into clean lead records.
 *
 * - Phone numbers must be Nigerian mobiles (see ../phone). Stored as E.164.
 * - Every lead needs a lead source. Consent is read from a "consent" column.
 * - Columns that look like sensitive data (BVN, NIN, card, PIN, OTP, password)
 *   are refused: their values are never read into the result.
 * - Any other column becomes a per-call value ("amount_due" → {{amount_due}}).
 */

import { parseNigerianPhone } from "../phone";

export interface LeadInput {
  firstName: string;
  lastName: string;
  title: string;
  gender: "male" | "female" | "";
  phone: string;
  email: string;
  source: string;
  consent: boolean;
  /** Extra columns, used as per-call variables. */
  extra: Record<string, string>;
}

export interface LeadRowError {
  /** 1-based row number in the file, counting the header as row 1. */
  row: number;
  reason: string;
}

export interface LeadImportResult {
  leads: LeadInput[];
  errors: LeadRowError[];
  /** Header names refused because they look like sensitive data. */
  blockedColumns: string[];
  /** Rows dropped because the same phone number appeared earlier in the file. */
  duplicates: number;
}

export const MAX_IMPORT_ROWS = 5000;
const MAX_EXTRA_COLUMNS = 20;
const MAX_VALUE_LENGTH = 300;

/** Small RFC 4180 CSV reader: quoted fields, "" escapes, commas and new lines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** "First Name" → "first_name". */
export function normaliseHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

const SENSITIVE_HEADER = /(^|_)(bvn|nin|card|card_number|pan|cvv|cvc|pin|otp|password|passcode|account_password|security_code)(_|$)/;

export function isSensitiveHeader(header: string): boolean {
  return SENSITIVE_HEADER.test(normaliseHeader(header));
}

const ALIASES: Record<keyof Omit<LeadInput, "extra" | "consent">, string[]> = {
  firstName: ["first_name", "firstname", "first", "given_name", "lead_name", "name", "full_name"],
  lastName: ["last_name", "lastname", "surname", "family_name"],
  title: ["title", "salutation"],
  gender: ["gender", "sex"],
  phone: ["phone", "phone_number", "mobile", "mobile_number", "number", "telephone", "msisdn"],
  email: ["email", "email_address", "e_mail"],
  source: ["source", "lead_source", "where_from", "origin"],
};
const CONSENT_ALIASES = ["consent", "has_consent", "consented", "opt_in", "optin", "permission"];

function readGender(value: string): LeadInput["gender"] {
  const v = value.trim().toLowerCase();
  if (["m", "male", "man"].includes(v)) return "male";
  if (["f", "female", "woman"].includes(v)) return "female";
  return "";
}

function readConsent(value: string): boolean {
  return ["yes", "y", "true", "1", "consented", "opt in", "opt-in", "agreed"].includes(value.trim().toLowerCase());
}

/**
 * Read a CSV of leads. `defaultSource` is used when the file has no source column
 * (the person importing must say where the leads came from).
 */
export function parseLeadCsv(text: string, options: { defaultSource?: string; defaultConsent?: boolean } = {}): LeadImportResult {
  const rows = parseCsv(text);
  const result: LeadImportResult = { leads: [], errors: [], blockedColumns: [], duplicates: 0 };
  if (rows.length === 0) {
    result.errors.push({ row: 1, reason: "The file is empty." });
    return result;
  }

  const headers = rows[0]!.map(normaliseHeader);
  const index: Partial<Record<keyof LeadInput | "consent", number>> = {};
  const used = new Set<number>();
  for (const [field, aliases] of Object.entries(ALIASES) as [keyof typeof ALIASES, string[]][]) {
    const i = headers.findIndex((h, n) => !used.has(n) && aliases.includes(h));
    if (i >= 0) {
      index[field] = i;
      used.add(i);
    }
  }
  const consentIdx = headers.findIndex((h) => CONSENT_ALIASES.includes(h));
  if (consentIdx >= 0) used.add(consentIdx);

  const extraCols: number[] = [];
  headers.forEach((h, i) => {
    if (used.has(i) || !h) return;
    if (isSensitiveHeader(h)) result.blockedColumns.push(rows[0]![i]!.trim());
    else if (extraCols.length < MAX_EXTRA_COLUMNS) extraCols.push(i);
  });

  if (index.phone === undefined) {
    result.errors.push({ row: 1, reason: "No phone column found. Name a column \"phone\"." });
    return result;
  }
  if (index.firstName === undefined) {
    result.errors.push({ row: 1, reason: "No first name column found. Name a column \"first_name\"." });
    return result;
  }

  const seen = new Set<string>();
  const body = rows.slice(1, MAX_IMPORT_ROWS + 1);
  if (rows.length - 1 > MAX_IMPORT_ROWS) {
    result.errors.push({ row: MAX_IMPORT_ROWS + 2, reason: `Only the first ${MAX_IMPORT_ROWS} rows were read.` });
  }

  body.forEach((cells, n) => {
    const rowNo = n + 2;
    const get = (i: number | undefined) => (i === undefined ? "" : (cells[i] ?? "").trim().slice(0, MAX_VALUE_LENGTH));
    const phone = parseNigerianPhone(get(index.phone));
    if (!phone.valid) {
      result.errors.push({ row: rowNo, reason: phone.reason ?? "Invalid phone number." });
      return;
    }
    let firstName = get(index.firstName);
    let lastName = get(index.lastName);
    // A single "name" column holding "Chinedu Okafor" is split into first and last name.
    if (index.lastName === undefined && ["name", "full_name"].includes(headers[index.firstName!]!)) {
      const [first = "", ...rest] = firstName.split(/\s+/);
      firstName = first;
      lastName = rest.join(" ");
    }
    if (!firstName) {
      result.errors.push({ row: rowNo, reason: "First name is empty." });
      return;
    }
    const source = get(index.source) || options.defaultSource?.trim() || "";
    if (!source) {
      result.errors.push({ row: rowNo, reason: "Lead source is empty. Add a source column or choose a source for the whole file." });
      return;
    }
    if (seen.has(phone.e164!)) {
      result.duplicates++;
      return;
    }
    seen.add(phone.e164!);

    const extra: Record<string, string> = {};
    for (const i of extraCols) {
      const v = get(i);
      if (v) extra[headers[i]!] = v;
    }
    result.leads.push({
      firstName,
      lastName,
      title: get(index.title),
      gender: readGender(get(index.gender)),
      phone: phone.e164!,
      email: get(index.email),
      source,
      consent: consentIdx >= 0 ? readConsent(get(consentIdx)) : Boolean(options.defaultConsent),
      extra,
    });
  });
  return result;
}
