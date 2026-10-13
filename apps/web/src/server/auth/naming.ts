/** Pure helpers for naming things at sign-up. */

export const FREE_MAIL = new Set(["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "live.com", "ymail.com"]);

/** "ada@spagfinance.ng" -> "Spagfinance", "ada@gmail.com" -> "Ada's organisation". */
export function defaultOrganisationName(email: string): string {
  const [local = "My", domain = ""] = email.split("@");
  if (domain && !FREE_MAIL.has(domain)) {
    const name = domain.split(".")[0] ?? domain;
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  const first = local.split(/[._-]/)[0] ?? local;
  return `${first.charAt(0).toUpperCase()}${first.slice(1)}'s organisation`;
}
