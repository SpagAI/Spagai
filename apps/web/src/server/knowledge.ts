import "server-only";
import { webhookUrlProblem } from "@/lib/custom-tools";
import { chunkText, htmlToText, KNOWLEDGE_LIMITS, knowledgeSection, sameSiteLinks, searchWords, toTsQuery } from "@/lib/knowledge";
import { db } from "./db";

/**
 * The knowledge base on the server: store content as searchable pieces, read websites (public
 * addresses only, from our server), and find the pieces that match what a caller says.
 */

export class KnowledgeError extends Error {}

/** Characters this agent already has stored. */
export async function agentKnowledgeChars(agentId: string): Promise<number> {
  const r = await db.knowledgeItem.aggregate({ where: { agentId }, _sum: { contentChars: true } });
  return r._sum.contentChars ?? 0;
}

/** Store an item's text as pieces (replacing any earlier pieces) and mark it ready. */
export async function storeContent(item: { id: string; organisationId: string; agentId: string }, rawText: string, extra: { pages?: number } = {}) {
  const text = rawText.slice(0, KNOWLEDGE_LIMITS.itemChars);
  const pieces = chunkText(text);
  if (!pieces.length) throw new KnowledgeError("No readable text was found.");
  const used = (await agentKnowledgeChars(item.agentId)) - ((await db.knowledgeItem.findUnique({ where: { id: item.id }, select: { contentChars: true } }))?.contentChars ?? 0);
  if (used + text.length > KNOWLEDGE_LIMITS.agentChars) throw new KnowledgeError(`This agent's knowledge base is full (${KNOWLEDGE_LIMITS.agentChars.toLocaleString("en")} characters). Remove something first.`);
  await db.$transaction([
    db.knowledgeChunk.deleteMany({ where: { itemId: item.id } }),
    db.knowledgeChunk.createMany({ data: pieces.map((t, position) => ({ itemId: item.id, organisationId: item.organisationId, agentId: item.agentId, position, text: t })) }),
    db.knowledgeItem.update({ where: { id: item.id }, data: { status: "READY", chunks: pieces.length, contentChars: text.length, error: null, ...(extra.pages !== undefined && { pages: extra.pages }) } }),
  ]);
  return { pieces: pieces.length, chars: text.length };
}

async function fetchPage(url: string): Promise<{ html: string; finalUrl: string } | null> {
  if (webhookUrlProblem(url.replace(/^http:/, "https:"))) return null;
  try {
    const res = await fetch(url, { headers: { "user-agent": "SpagAI-Knowledge/1.0 (+https://spagai.com)", accept: "text/html,application/xhtml+xml" }, redirect: "follow", signal: AbortSignal.timeout(8000) });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return null;
    // Redirects may only end on public addresses too.
    if (webhookUrlProblem(res.url.replace(/^http:/, "https:"))) return null;
    const html = (await res.text()).slice(0, 2_000_000);
    return { html, finalUrl: res.url };
  } catch {
    return null;
  }
}

/** Read one page, or the page plus up to 9 more pages of the same site. */
export async function readWebsite(url: string, wholeSite: boolean): Promise<{ title: string; text: string; pages: number }> {
  const first = await fetchPage(url);
  if (!first) throw new KnowledgeError("That website could not be read. Check the address, and that the page is public.");
  const { title, text } = htmlToText(first.html);
  const parts = [`# ${title || first.finalUrl}\n${text}`];
  let pages = 1;
  if (wholeSite) {
    const links = sameSiteLinks(first.html, first.finalUrl, 30).slice(0, KNOWLEDGE_LIMITS.sitePages - 1);
    const results = await Promise.all(links.map((l) => fetchPage(l)));
    for (const r of results) {
      if (!r) continue;
      const page = htmlToText(r.html);
      if (page.text.length < 80) continue;
      parts.push(`# ${page.title || r.finalUrl}\n${page.text}`);
      pages++;
    }
  }
  const all = parts.join("\n\n");
  if (all.replace(/\s/g, "").length < 40) throw new KnowledgeError("That page has almost no readable text (it may be built only with pictures or scripts).");
  return { title, text: all, pages };
}

/**
 * The knowledge section for one reply: a small knowledge base is given whole; a bigger one gives
 * the pieces that best match what was just said (Postgres full-text search).
 */
export async function knowledgeForReply(agentId: string, recentText: string): Promise<string> {
  const total = await agentKnowledgeChars(agentId);
  if (!total) return "";
  if (total <= KNOWLEDGE_LIMITS.wholeChars) {
    const pieces = await db.knowledgeChunk.findMany({ where: { agentId }, orderBy: [{ itemId: "asc" }, { position: "asc" }], include: { item: { select: { name: true } } } });
    // Pieces overlap a little; for a small knowledge base, give each item's text once.
    const byItem = new Map<string, { source: string; text: string }>();
    for (const p of pieces) {
      const cur = byItem.get(p.itemId);
      byItem.set(p.itemId, { source: p.item.name, text: cur ? `${cur.text}\n${p.text}` : p.text });
    }
    return knowledgeSection([...byItem.values()], true);
  }
  const query = toTsQuery(searchWords(recentText));
  if (!query) return "";
  const rows = await db.$queryRaw<{ text: string; name: string }[]>`
    SELECT c."text", i."name"
    FROM "KnowledgeChunk" c JOIN "KnowledgeItem" i ON i."id" = c."itemId"
    WHERE c."agentId" = ${agentId} AND to_tsvector('english', c."text") @@ to_tsquery('english', ${query})
    ORDER BY ts_rank(to_tsvector('english', c."text"), to_tsquery('english', ${query})) DESC
    LIMIT ${KNOWLEDGE_LIMITS.piecesPerReply}::int`;
  return knowledgeSection(rows.map((r) => ({ source: r.name, text: r.text })), false);
}
