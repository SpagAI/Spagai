import { describe, expect, it } from "vitest";
import { chunkText, htmlToText, knowledgeSection, normaliseText, sameSiteLinks, searchWords, toTsQuery } from "@/lib/knowledge";

describe("knowledge pieces", () => {
  it("keeps short text whole and splits long text at sentences", () => {
    expect(chunkText("Teeth cleaning costs ₦15,000.")).toEqual(["Teeth cleaning costs ₦15,000."]);
    const long = Array.from({ length: 40 }, (_, i) => `Service ${i} costs ₦${(i + 1) * 1000} and takes ${i + 10} minutes.`).join(" ");
    const pieces = chunkText(long, 300, 60);
    expect(pieces.length).toBeGreaterThan(5);
    expect(pieces.every((p) => p.length <= 360)).toBe(true);
    expect(pieces.join(" ")).toContain("Service 39 costs ₦40000");
  });

  it("tidies whitespace", () => {
    expect(normaliseText("  Hello   world \r\n\r\n\r\n Bye ")).toBe("Hello world\n\nBye");
  });
});

describe("web pages", () => {
  const html = `<html><head><title>Smile Dental &amp; Co</title><style>.x{}</style></head><body>
    <nav><a href="/about">About</a></nav>
    <h1>Our prices</h1><p>Cleaning: &#8358;15,000</p><ul><li>Open Mon&ndash;Fri</li><li>Lekki Phase 1</li></ul>
    <script>alert(1)</script><a href="/services">Services</a><a href="https://other.com/x">x</a><a href="/brochure.pdf">pdf</a>
    <footer>© 2026</footer></body></html>`;

  it("keeps the readable text only", () => {
    const { title, text } = htmlToText(html);
    expect(title).toBe("Smile Dental & Co");
    expect(text).toContain("Our prices");
    expect(text).toContain("Cleaning: ₦15,000");
    expect(text).toContain("• Open Mon–Fri");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("©");
  });

  it("finds links to other pages of the same site", () => {
    expect(sameSiteLinks(html, "https://smile.ng/")).toEqual(["https://smile.ng/about", "https://smile.ng/services"]);
  });
});

describe("searching during a call", () => {
  it("keeps the words that matter and makes a safe query", () => {
    const words = searchWords("Hello, how much is teeth cleaning, please? And are you open on Saturday?");
    expect(words).toEqual(["much", "teeth", "cleaning", "open", "saturday"]);
    expect(toTsQuery(["teeth", "o'clock", "₦15,000"])).toBe("teeth | oclock | 15000");
  });

  it("writes the knowledge section for the prompt", () => {
    expect(knowledgeSection([], true)).toBe("");
    const s = knowledgeSection([{ source: "Price list", text: "Cleaning: ₦15,000" }], false);
    expect(s).toContain("## From the knowledge base");
    expect(s).toContain("[Price list]\nCleaning: ₦15,000");
  });
});
