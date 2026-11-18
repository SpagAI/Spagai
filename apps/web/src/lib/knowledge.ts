/**
 * Knowledge base helpers: split text into searchable pieces, turn web pages into plain text, and
 * build the search used during calls. Pure (no network), so it can be tested.
 */

/** Limits that keep the knowledge base fast and the AI's prompt small. */
export const KNOWLEDGE_LIMITS = {
  /** Characters kept from one item (text, file or website). */
  itemChars: 200_000,
  /** Characters across all of one agent's knowledge. */
  agentChars: 1_000_000,
  /** Below this, the whole knowledge base is given to the agent; above it, only matching pieces. */
  wholeChars: 6_000,
  /** Pieces given to the agent per reply when searching. */
  piecesPerReply: 4,
  /** Pages read from a website when "several pages" is chosen. */
  sitePages: 10,
};

/** Tidy whitespace and drop empty lines. */
export function normaliseText(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/[ \t\f\v]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Split text into pieces of about `size` characters, breaking at paragraphs, then sentences,
 * with a little overlap so a fact cut in two is still found.
 */
export function chunkText(text: string, size = 900, overlap = 120): string[] {
  const clean = normaliseText(text);
  if (!clean) return [];
  if (clean.length <= size) return [clean];
  const sentences = clean.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    // A very long "sentence" (a table row, a list) is cut by length.
    const parts = sentence.length > size ? sentence.match(new RegExp(`.{1,${size}}(\\s|$)`, "g")) ?? [sentence] : [sentence];
    for (const part of parts) {
      if (current && current.length + part.length + 1 > size) {
        chunks.push(current.trim());
        current = current.slice(Math.max(0, current.length - overlap)).replace(/^\S*\s/, "");
      }
      current += (current ? " " : "") + part.trim();
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", naira: "₦" };

/** A web page's readable text: no scripts, styles, menus or footers; headings and paragraphs kept. */
export function htmlToText(html: string): { title: string; text: string } {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
  let body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  body = body
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe|nav|footer|header|form)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|tr|h[1-6]|table|ul|ol|blockquote)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    });
  return { title: decodeTitle(title), text: normaliseText(body) };
}

const decodeTitle = (t: string) => t.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"');

/** Links on a page to other pages of the same site (no files, no anchors), up to `max`. */
export function sameSiteLinks(html: string, pageUrl: string, max = 20): string[] {
  const base = new URL(pageUrl);
  const out = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(m[1]!, base);
      if (u.host !== base.host || !/^https?:$/.test(u.protocol)) continue;
      if (/\.(pdf|jpe?g|png|gif|svg|webp|zip|mp[34]|docx?|xlsx?|pptx?|css|js)$/i.test(u.pathname)) continue;
      u.hash = "";
      u.search = "";
      const s = u.toString().replace(/\/$/, "");
      if (s !== pageUrl.replace(/\/$/, "")) out.add(s);
    } catch { /* not a URL */ }
    if (out.size >= max) break;
  }
  return [...out];
}

/** Common words that would match everything. */
const STOP = new Set("a an and are as at be but by can do does for from get got have how i if in is it its me my no not of on or our so that the their them then there they this to us was we what when where which who why will with you your yes okay ok please hello hi thanks thank sir ma".split(" "));

/** Words worth searching for in what the caller said (for an OR full-text search). */
export function searchWords(text: string, max = 12): string[] {
  const words = text.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));
  return [...new Set(words)].slice(0, max);
}

/** The words as a Postgres tsquery: "price | clean | teeth" (only letters and digits, so it is always valid). */
export function toTsQuery(words: string[]): string {
  return words.map((w) => w.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean).join(" | ");
}

/** The knowledge the agent is given for one reply, as a prompt section. */
export function knowledgeSection(pieces: { source: string; text: string }[], whole: boolean): string {
  if (!pieces.length) return "";
  const intro = whole
    ? "## Knowledge base\nFacts about the business. Use them to answer questions. If something is not covered here or in your instructions, say you will check and have someone get back to them."
    : "## From the knowledge base\nThe parts of the knowledge base that match what the caller just said. Use them to answer. If the answer is not here or in your instructions, say you will check and have someone get back to them.";
  return `${intro}\n\n${pieces.map((p) => `[${p.source}]\n${p.text}`).join("\n\n")}`;
}
