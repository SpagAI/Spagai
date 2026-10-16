/** Appearance: light ("Day", white) or dark ("Night", black). Remembered in a cookie for a year. */
export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = "spag_theme";

export const isTheme = (v: unknown): v is Theme => typeof v === "string" && (THEMES as readonly string[]).includes(v);

/** A saved choice, with the retired "dim" and "navy" themes treated as night. */
export const savedTheme = (v: unknown): Theme => (v === "dim" || v === "navy" ? "dark" : isTheme(v) ? v : "light");

/** The class put on <html> for each theme ("" for light). */
export const themeClass = (t: Theme) => (t === "light" ? "" : t);

/** Switch immediately in the browser and remember the choice. */
export function applyTheme(t: Theme) {
  const html = document.documentElement;
  html.classList.remove("dark", "dim", "navy");
  if (t !== "light") html.classList.add(t);
  html.dataset.theme = t;
  document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}
