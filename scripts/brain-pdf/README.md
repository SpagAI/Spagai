# Spag AI Brain: PDF builder

The Spag AI Brain lives as a living document (Claude Docs). This folder turns that document into the
designed PDF edition: dark Spag cover, contents with page numbers, every chapter on a new page with its
"In one minute" and "Do this next" boxes, coloured status labels, bookmarks and a back cover.

The latest PDF is kept at `brain/The-Spag-AI-Brain.pdf`.

## Make a new edition

1. Export the living doc as Markdown (Claude: the Docs `export` tool, format `markdown`; or the doc's
   name → Export → Markdown).
2. For each drawing in the doc, save a screenshot PNG named after its caption into a folder
   (the roadmap drawing, captioned "Roadmap · ...", becomes `roadmap.png`). Missing ones are skipped.
3. Run:

   ```bash
   python3 scripts/brain-pdf/build.py doc.md brain/The-Spag-AI-Brain.pdf --widgets widgets/ --rev <doc revision> --date <YYYY-MM-DD>
   ```

Needs Python with `markdown` and `pypdf`, and Node with Playwright (Chromium). The Inter font gives the
intended look.

## How the doc maps to the book

- Every `## ` heading is a chapter. `## Chapter N: Title`, `## Introduction: ...` and `## Appendix: ...`
  get their labels and big numerals; a new chapter added in the doc appears automatically.
- `## How to use this living book` becomes the "Progress and change log" page (the edit instructions are left out).
- `**In one minute**` + a bullet list and `**Do this next**` + a task list become the two boxes at a chapter's top.
- Ticked tasks show as done. Table cells reading Done, In progress, Not started, Proposed, Confirmed,
  Changed, Changed course or Dropped become coloured labels.
- The "Tech Behind Voice AI" picture comes from `brain/assets/`.
