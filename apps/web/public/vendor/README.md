# Browser-only libraries (served as static files)

Loaded at runtime in the browser by `src/app/(app)/knowledge/extract.ts`, so they never become part of
the server bundle on Cloudflare (which has a 3 MB limit on the free plan).

- `pdf.min.mjs`, `pdf.worker.min.mjs`: pdfjs-dist 4.10.38 (Apache-2.0), reads text from PDF files.
- `mammoth.browser.min.js`: mammoth 1.9.0 (BSD-2-Clause), reads text from Word (.docx) files.

To update: install the new versions temporarily, copy the same files from `node_modules`, then remove them again.
