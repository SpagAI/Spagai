"use client";

/**
 * Read a file's text in the browser, so the server only receives text (smaller and safer). The PDF
 * and Word readers are static files in /public/vendor (see its README), loaded only when a file of
 * that kind is chosen, so they never enter the server bundle on Cloudflare.
 */

interface PdfJs {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: { data: Uint8Array }): { promise: Promise<{ numPages: number; getPage(n: number): Promise<{ getTextContent(): Promise<{ items: { str?: string; hasEOL?: boolean }[] }> }> }> };
}
interface Mammoth { extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }> }

let pdfjsPromise: Promise<PdfJs> | null = null;
function loadPdfJs(): Promise<PdfJs> {
  // The address is built at runtime from the page's location, so no bundler tries to pack the file;
  // the browser fetches it when needed.
  const url = new URL("/vendor/pdf.min.mjs", window.location.origin).href;
  pdfjsPromise ??= (import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url) as Promise<PdfJs>).then((m) => {
    m.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
    return m;
  });
  return pdfjsPromise;
}

let mammothPromise: Promise<Mammoth> | null = null;
function loadMammoth(): Promise<Mammoth> {
  mammothPromise ??= new Promise((resolve, reject) => {
    const w = window as unknown as { mammoth?: Mammoth };
    if (w.mammoth) return resolve(w.mammoth);
    const script = document.createElement("script");
    script.src = "/vendor/mammoth.browser.min.js";
    script.onload = () => (w.mammoth ? resolve(w.mammoth) : reject(new Error("Word reader did not load.")));
    script.onerror = () => reject(new Error("Word reader did not load."));
    document.head.appendChild(script);
  });
  return mammothPromise;
}

export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (/\.(txt|md|markdown|csv)$/.test(name)) return file.text();
  if (name.endsWith(".pdf")) {
    const pdfjs = await loadPdfJs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, 300); i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      let line = "";
      const lines: string[] = [];
      for (const item of content.items) {
        line += item.str ?? "";
        if (item.hasEOL) {
          lines.push(line);
          line = "";
        }
      }
      if (line) lines.push(line);
      pages.push(lines.join("\n"));
    }
    return pages.join("\n\n");
  }
  if (name.endsWith(".docx")) {
    const mammoth = await loadMammoth();
    return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
  }
  throw new Error("Use PDF, Word (.docx), text, Markdown or CSV files.");
}
