"""Build the branded Spag AI Brain PDF from the living doc's Markdown export.

Usage:
  python3 build.py <doc-export.md> <out.pdf> [--widgets DIR] [--rev N] [--date YYYY-MM-DD]

- <doc-export.md>: the living doc exported as Markdown (Claude Docs export).
- --widgets DIR: PNG screenshots of the doc's drawings, named after the drawing's
  caption (e.g. "Roadmap · 5 phases" -> roadmap.png). Missing ones are skipped.
- Needs Python `markdown` + `pypdf`, and Node with Playwright (renders with Chromium).

Every "## " heading in the doc becomes a chapter. "## Chapter N: Title", "## Introduction: ...",
"## Appendix: ..." get their labels; the "How to use this living book" section becomes the
"Progress and change log" page. A chapter's "**In one minute**" and "**Do this next**" lists
become the two summary boxes at its top.
"""
import argparse, base64, datetime, html, json, math, os, pathlib, re, subprocess, tempfile
import markdown
from pypdf import PdfReader, PdfWriter

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parent.parent
BRAND = "#5b2bc4"
IMAGES = {"Tech Behind Voice AI": REPO / "brain/assets/tech-behind-voice-ai.webp"}
DESC = {  # one-line contents descriptions; chapters not listed fall back to their first sentence
    "Introduction": "The goal, the five things to remember, and where we are today.",
    "How voice AI works": "The full loop from \"Hello?\" to the agent's reply, step by step, and why speed matters.",
    "The stack": "Every layer of a voice agent, the options at each, and what we rent or own.",
    "The local voices strategy": "What local voices means, the five stages, our moat, and the road from Nigeria across Africa.",
    "Training playbook": "Step by step: recording and training a voice; training speech recognition.",
    "Datasets bank": "Open Nigerian, Swahili and other African speech data, and whether we may use it commercially.",
    "Learning path": "What to read, watch and build, in order, for founders, engineers and ML.",
    "Team and hiring": "Who we need, in what order, where to find them and how to test them.",
    "Compute and costs": "GPUs, hosting, training and serving costs, and per-minute margins.",
    "Legal, consent and ethics": "Voice actor contracts, the NDPA, NCC, and deepfake safeguards.",
    "Roadmap": "Five phases and four gates from today's prototype to our own voices.",
    "Brainstorm log": "Decisions, open questions, ideas and experiment notes.",
    "Glossary": "Plain meanings for ASR, TTS, VAD, WER, MOS, fine-tuning and more.",
}
STATUS = {"Done": "good", "Confirmed": "good", "In progress": "warn", "Proposed": "warn",
          "Not started": "quiet", "Changed course": "alt", "Changed": "alt", "Dropped": "bad"}


def uri(path, mime=None):
    path = pathlib.Path(path)
    mime = mime or {".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".svg": "image/svg+xml"}[path.suffix]
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def inline(md):
    out = markdown.markdown(md.strip())
    return re.sub(r"^<p>(.*)</p>$", r"\1", out, flags=re.S)


# ---------------------------------------------------------------- parsing the doc

def split_sections(md):
    parts = re.split(r"(?m)^## (.+)$", md)
    sections = []
    for i in range(1, len(parts), 2):
        sections.append((parts[i].strip(), parts[i + 1]))
    return sections


def classify(heading):
    m = re.match(r"Chapter (\d+)\s*[:\-–—]\s*(.+)", heading)
    if m:
        return f"Chapter {int(m.group(1))}", m.group(2).strip(), f"{int(m.group(1)):02d}"
    m = re.match(r"(Introduction|Appendix)\s*[:\-–—]\s*(.+)", heading)
    if m:
        title = m.group(2).strip()
        if m.group(1) == "Introduction":
            return "Introduction", title[:1].upper() + title[1:], "00"
        return "Appendix", title, "A"
    if heading.lower().startswith("how to use this living book"):
        return "Status", "Progress and change log", "✓"
    return "", heading, "·"


def extract_summary(body):
    m = re.search(r"\*\*In one minute\*\*\s*\n\n((?:[-*] .*\n?)+)\s*\*\*Do this next\*\*\s*\n\n((?:[-*] \[[ xX]\] .*\n?)+)", body)
    if not m:
        return None, body
    mins = [l[2:] for l in m.group(1).strip().splitlines()]
    todos = [(l[3] in "xX", l[6:]) for l in m.group(2).strip().splitlines()]
    box = ('<section class="summary"><div class="col"><h4>In one minute</h4><ul>'
           + "".join(f"<li>{inline(s)}</li>" for s in mins)
           + '</ul></div><div class="col do"><h4>Do this next</h4><ul>'
           + "".join(f'<li><span class="box{" on" if done else ""}"></span>{inline(s)}</li>' for done, s in todos)
           + "</ul></div></section>")
    return box, body[:m.start()] + body[m.end():]


def figure(kind, text, widgets):
    if kind == "image":
        for key, path in IMAGES.items():
            if key.lower() in text.lower() and path.exists():
                return f'\n\n<figure><img src="{uri(path)}" alt="{html.escape(text)}"></figure>\n\n'
        return ""
    slug = re.sub(r"[^a-z0-9]+", "-", text.split("·")[0].strip().lower()).strip("-")
    png = widgets / f"{slug}.png" if widgets else None
    if png and png.exists():
        return f'\n\n<figure class="widget"><img src="{uri(png)}" alt="{html.escape(text)}"></figure>\n\n'
    return ""


def body_md(body, widgets, status_page):
    body = re.sub(r"&#91;(image|embedded content): (.*?)\\\]", lambda m: figure(m.group(1), m.group(2), widgets), body)
    if status_page:  # the PDF is read, not edited: keep the tracker and log, drop the how-to-edit text
        body = body[body.find("### "):] if "### " in body else body
        body = "\n\n".join(p for p in body.split("\n\n") if "dropdown" not in p and "comment" not in p.lower())
    body = re.sub(r"(?m)^(\s*)[-*] \[ \] ", r'\1- <span class="box"></span>', body)
    body = re.sub(r"(?m)^(\s*)[-*] \[[xX]\] ", r'\1- <span class="box on"></span>', body)
    return body


def to_html(md):
    out = markdown.markdown(md, extensions=["tables", "fenced_code", "sane_lists"], tab_length=4)
    out = out.replace("<table>", '<div class="tbl"><table>').replace("</table>", "</table></div>")
    for word, kind in STATUS.items():
        out = out.replace(f"<td>{word}</td>", f'<td><span class="pill {kind}">{word}</span></td>')
    return out


# ---------------------------------------------------------------- pages

def wave_svg(width=760, height=170, bars=96):
    out, bw = [], width / bars
    for i in range(bars):
        x = i / (bars - 1)
        env = 0.18 + 0.82 * math.exp(-((x - 0.5) ** 2) / 0.07)
        h = max(6, min(height, height * env * (0.45 + 0.55 * abs(math.sin(i * 0.61) * 0.6 + math.sin(i * 0.23 + 1.3) * 0.4))))
        out.append(f'<rect x="{i*bw + bw*0.22:.1f}" y="{(height-h)/2:.1f}" width="{bw*0.56:.1f}" height="{h:.1f}" rx="{bw*0.28:.1f}" fill="url(#g)"/>')
    return (f'<svg viewBox="0 0 {width} {height}" width="100%" xmlns="http://www.w3.org/2000/svg"><defs>'
            '<linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#3b1d8f"/><stop offset=".5" stop-color="#a78bfa"/>'
            '<stop offset="1" stop-color="#3b1d8f"/></linearGradient></defs>' + "".join(out) + "</svg>")


def pages_html(chapters, date_words, rev):
    logo_w = uri(REPO / "brand/spag-logo-white-transparent.png")
    cover_css = """@page { size: A4; margin: 0; } html, body { margin: 0; height: 100%; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Inter, sans-serif; background: #0d0a16; color: #fff; }
.page { width: 210mm; height: 297mm; position: relative; overflow: hidden; background: radial-gradient(120% 70% at 85% 0%, #2a1466 0%, #0d0a16 60%); }"""
    rev_words = f" · doc revision {rev}" if rev else ""
    cover = f"""<!doctype html><html><head><meta charset="utf-8"><style>{cover_css}
.top {{ position: absolute; top: 22mm; left: 22mm; right: 22mm; display: flex; align-items: center; justify-content: space-between; }}
.brand {{ display: flex; align-items: center; gap: 12px; font-family: 'Inter Display', Inter; font-weight: 700; font-size: 20pt; }}
.brand img {{ width: 44px; height: 44px; }}
.tag {{ font-size: 8.5pt; letter-spacing: .14em; text-transform: uppercase; color: #c9b8ff; border: 1px solid #4a2fa0; padding: 6px 10px; border-radius: 20px; }}
.mid {{ position: absolute; top: 78mm; left: 22mm; right: 22mm; }}
.kicker {{ font-size: 10pt; letter-spacing: .18em; text-transform: uppercase; color: #a78bfa; font-weight: 600; }}
h1 {{ font-family: 'Inter Display', Inter; font-size: 54pt; line-height: 1.02; margin: 10px 0 18px; font-weight: 800; letter-spacing: -.02em; }}
.sub {{ font-size: 13.5pt; line-height: 1.5; color: #d9d2ee; max-width: 150mm; }}
.wave {{ position: absolute; left: 0; right: 0; top: 178mm; padding: 0 12mm; }}
.big {{ position: absolute; right: -40mm; bottom: -30mm; width: 150mm; opacity: .07; }}
.bottom {{ position: absolute; left: 22mm; right: 22mm; bottom: 22mm; display: flex; justify-content: space-between; align-items: flex-end; font-size: 9.5pt; color: #b3a9cc; line-height: 1.6; }}
.bottom b {{ color: #fff; font-weight: 600; }}
</style></head><body><div class="page"><img class="big" src="{logo_w}" alt="">
<div class="top"><div class="brand"><img src="{logo_w}" alt="">Spag AI</div><div class="tag">Internal · Confidential</div></div>
<div class="mid"><div class="kicker">Internal playbook &amp; working roadmap</div><h1>The Spag AI<br>Brain</h1>
<div class="sub">How voice AI works, and how we build our own locally trained African voices, starting in Nigeria: strategy, training, data, learning, hiring, costs and the road ahead.</div></div>
<div class="wave">{wave_svg()}</div>
<div class="bottom"><div><b>Updated {date_words}</b>{rev_words}<br>A snapshot of the living document.</div>
<div style="text-align:right">For the Spag AI team only.<br>Please do not share outside the company.</div></div></div></body></html>"""
    back = f"""<!doctype html><html><head><meta charset="utf-8"><style>{cover_css}
.c {{ position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }}
.c img {{ width: 90px; height: 90px; margin-bottom: 18px; }} .n {{ font-family: 'Inter Display', Inter; font-size: 26pt; font-weight: 700; }}
.t {{ margin-top: 8px; font-size: 11pt; color: #c9b8ff; }}
.f {{ position: absolute; bottom: 22mm; left: 0; right: 0; text-align: center; font-size: 9pt; color: #8f86a8; line-height: 1.6; }}
</style></head><body><div class="page"><div class="c"><img src="{logo_w}" alt=""><div class="n">Spag AI</div>
<div class="t">Voice agents made for Nigeria and Africa</div></div>
<div class="f">The Spag AI Brain · updated {date_words}<br>To change the book, comment in the living document and ask for a new PDF.</div></div></body></html>"""
    return cover, back


BOOK_CSS_EXTRA = f"""
@page {{ size: A4; margin: 18mm 17mm 20mm 17mm; }}
section.chapter {{ break-before: page; position: relative; }}
.mark {{ position: absolute; top: 0; left: 0; font-size: 3pt; color: #fff; }}
.chap-head {{ position: relative; border-bottom: 3px solid {BRAND}; padding: 0 0 12px; margin-bottom: 16px; }}
.chap-head .kicker {{ color: {BRAND}; }}
.chap-head h1 {{ margin-right: 90px; }}
.chap-num {{ position: absolute; right: 0; bottom: 6px; font-family: 'Inter Display', Inter; font-size: 60pt; line-height: 1; font-weight: 800; color: #e9e2fb; }}
main h4 {{ font-size: 10.8pt; margin: 14px 0 5px; color: #3a2a7a; }}
.box.on {{ background: #1e6b41; border-color: #1e6b41; position: relative; }}
.box.on::after {{ content: ""; position: absolute; left: 2.6px; top: 0px; width: 3px; height: 6px; border: solid #fff; border-width: 0 1.5px 1.5px 0; transform: rotate(45deg); }}
main li:has(> .box.on) {{ color: #6b6779; }}
.pill {{ display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 8.3pt; font-weight: 600; white-space: nowrap; }}
.pill.good {{ background: #e3f4ea; color: #1e6b41; }} .pill.warn {{ background: #fff1d6; color: #8a5a00; }}
.pill.quiet {{ background: #efedf4; color: #5b566b; }} .pill.alt {{ background: #ede6fd; color: {BRAND}; }} .pill.bad {{ background: #fde4e4; color: #a12a2a; }}
figure.widget img {{ border: none; }}
.snap {{ font-size: 9.3pt; color: #5b566b; background: #f6f3fd; border-radius: 8px; padding: 10px 14px; margin: 0 0 14px; }}
.toc h1 {{ margin: 0 0 4px; }} .toc .lead {{ color: #5b566b; margin: 0 0 10px; }}
.toc ol {{ list-style: none; padding: 0; margin: 0; }}
.toc li {{ display: flex; gap: 14px; align-items: baseline; padding: 4px 0; border-bottom: 1px solid #ece8f6; margin: 0; }}
.toc .n {{ flex: 0 0 34px; font-family: 'Inter Display', Inter; font-weight: 800; font-size: 13pt; color: {BRAND}; }}
.toc .t {{ flex: 1; }} .toc .t b {{ display: block; font-size: 10.5pt; color: #14121c; }}
.toc .t span {{ font-size: 8.5pt; line-height: 1.3; color: #5b566b; }}
.toc .p {{ flex: 0 0 30px; text-align: right; font-weight: 600; color: #14121c; }}
.toc a {{ color: inherit; }}
.toc .note {{ margin-top: 10px; font-size: 9.3pt; color: #5b566b; background: #f6f3fd; border-radius: 8px; padding: 10px 14px; }}
"""


def describe(title, md):
    for key, words in DESC.items():
        if title.lower().startswith(key.lower()):
            return words
    first = next((p for p in md.split("\n\n") if p.strip() and not p.lstrip().startswith(("#", "|", "-", "*", "<", "&"))), "")
    first = re.sub(r"[*_`]", "", first.strip()).split(". ")[0]
    return first[:120] + ("…" if len(first) > 120 else "")


def build(src, out, widgets=None, rev=None, date=None):
    md = pathlib.Path(src).read_text()
    widgets = pathlib.Path(widgets) if widgets else None
    day = datetime.date.fromisoformat(date) if date else datetime.date.today()
    date_words = f"{day.day} {day:%B %Y}"
    chapters = []
    for i, (heading, body) in enumerate(split_sections(md)):
        label, title, num = classify(heading)
        status_page = label == "Status"
        box, rest = extract_summary(body)
        chapters.append(dict(id=f"ch-{i}", label=label, title=title, num=num, box=box or "",
                             html=to_html(body_md(rest, widgets, status_page)),
                             desc=describe("Introduction" if label == "Introduction" else title, rest), status=status_page))

    css = (HERE / "style.css").read_text() + BOOK_CSS_EXTRA
    logo_b = uri(REPO / "brand/spag-logo-black-transparent.png")

    def body_html(pages):
        rows = "".join(
            f'<li><span class="n">{html.escape(c["num"])}</span><span class="t"><a href="#{c["id"]}"><b>{html.escape(c["title"])}</b></a>'
            f'<span>{html.escape(c["desc"])}</span></span><span class="p">{pages.get(c["id"], "")}</span></li>' for c in chapters)
        toc = (f'<section class="toc"><div class="kicker" style="color:{BRAND}">The Spag AI Brain</div><h1>Contents</h1>'
               '<p class="lead">Our internal playbook and working roadmap for voice AI and locally trained African voices, starting in Nigeria.</p>'
               f'<ol>{rows}</ol><div class="note"><b>How to read this book.</b> Every chapter opens with two boxes: '
               '<b>In one minute</b> (the key points) and <b>Do this next</b> (actions; ticked ones are done). Read only the boxes for the '
               f'whole plan in ten minutes, then go deeper where you need to. This PDF is a snapshot of the living document, made {date_words}.</div></section>')
        secs = []
        for c in chapters:
            snap = (f'<p class="snap">Snapshot of {date_words}. Statuses and the log change in the living document; '
                    'comment there and ask for a fresh PDF.</p>') if c["status"] else ""
            kicker = c["label"] or "The Spag AI Brain"
            secs.append(f'<section class="chapter" id="{c["id"]}"><div class="mark">zz{c["id"]}zz</div>'
                        f'<header class="chap-head"><div class="kicker">{html.escape(kicker)}</div><h1>{html.escape(c["title"])}</h1>'
                        f'<div class="chap-num">{html.escape(c["num"])}</div></header>{snap}{c["box"]}<main>{c["html"]}</main></section>')
        return f'<!doctype html><html><head><meta charset="utf-8"><title>The Spag AI Brain</title><style>{css}</style></head><body>{toc}{"".join(secs)}</body></html>'

    footer = ('<div style="width:100%;font-family:Inter,sans-serif;font-size:7.5pt;color:#8a8597;padding:0 17mm;'
              'display:flex;justify-content:space-between;align-items:center;">'
              f'<span style="display:flex;align-items:center;gap:6px;"><img src="{logo_b}" style="width:11px;height:11px;opacity:.7">'
              f'The Spag AI Brain · updated {date_words}</span><span><span class="pageNumber"></span></span></div>')

    tmp = pathlib.Path(tempfile.mkdtemp(prefix="brain-pdf-"))
    cover, back = pages_html(chapters, date_words, rev)
    (tmp / "cover.html").write_text(cover)
    (tmp / "back.html").write_text(back)

    def render(jobs):
        (tmp / "jobs.json").write_text(json.dumps(jobs))
        env = dict(os.environ, NODE_PATH=subprocess.check_output(["npm", "root", "-g"], text=True).strip())
        subprocess.run(["node", str(HERE / "render.cjs"), str(tmp / "jobs.json")], check=True, env=env)

    def find_pages(pdf):
        found = {}
        for n, p in enumerate(PdfReader(pdf).pages):
            for m in re.findall(r"zz(ch-\d+)zz", p.extract_text() or ""):
                found.setdefault(m, n + 1)
        return found

    body = lambda pages: {"html": str(tmp / "body.html"), "pdf": str(tmp / "body.pdf"), "footer": footer}
    (tmp / "body.html").write_text(body_html({}))
    render([body({})])
    pages = find_pages(tmp / "body.pdf")
    (tmp / "body.html").write_text(body_html(pages))
    render([body(pages), {"html": str(tmp / "cover.html"), "pdf": str(tmp / "cover.pdf")},
            {"html": str(tmp / "back.html"), "pdf": str(tmp / "back.pdf")}])
    assert find_pages(tmp / "body.pdf") == pages, "page numbers moved between passes"

    w = PdfWriter()
    for part in ("cover", "body", "back"):
        w.append(str(tmp / f"{part}.pdf"))
    w.add_outline_item("Cover", 0)
    w.add_outline_item("Contents", 1)
    for c in chapters:
        name = f'{c["label"]}: {c["title"]}' if c["label"].startswith("Chapter") else c["title"]
        w.add_outline_item(name, pages[c["id"]])
    w.add_metadata({"/Title": "The Spag AI Brain", "/Author": "Spag AI",
                    "/Subject": f"Internal playbook and working roadmap, updated {date_words}"})
    w.page_mode = "/UseOutlines"
    with open(out, "wb") as f:
        w.write(f)
    print(out, len(PdfReader(out).pages), "pages")


if __name__ == "__main__":
    a = argparse.ArgumentParser()
    a.add_argument("src"); a.add_argument("out")
    a.add_argument("--widgets"); a.add_argument("--rev"); a.add_argument("--date")
    o = a.parse_args()
    build(o.src, o.out, o.widgets, o.rev, o.date)
