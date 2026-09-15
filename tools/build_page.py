#!/usr/bin/env python3
"""Build getting-started.html from getting-started.txt.

Edit the .txt, never the .html — the .html is overwritten on every build.

    python3 tools/build_page.py            build once
    python3 tools/build_page.py --watch    rebuild every time the .txt is saved

The format is explained at the top of getting-started.txt. The design lives in
tools/page_template.html and is not touched by editing the text.
"""
import html
import os
import re
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "getting-started.txt")
OUT = os.path.join(ROOT, "getting-started.html")
TEMPLATE = os.path.join(ROOT, "tools", "page_template.html")

HEADER_KEYS = ("TITLE", "EYEBROW", "SUBTITLE", "TAKES", "YOU NEED")
ITEM_KEYS = ("WHERE", "TYPE", "THEY TYPE", "NOTE", "WARNING", "PLACE", "PROMPT", "CODE")


def inline(text):
    """**bold** and `code`, with everything else escaped.

    Code spans are set aside first, so bold may wrap around a command
    (**Type the number next to `abstract.txt`.**) and a `**` inside a command
    is left alone.

    An odd number of `**` means the editor split a long bold line in two:
    auto-close an orphaned opening marker, drop an orphaned trailing one,
    so the page never shows a literal `**` again (ETHICS note, 2026-09-15).
    """
    if text.count("**") % 2 == 1:
        stripped = text.rstrip()
        if stripped.endswith("**") and "**" not in stripped[:-2]:
            text = stripped[:-2]  # dangling closer from a split line
        else:
            text = stripped + "**"  # opener with no closer: bold to end of line
    codes = []

    def stash(m):
        codes.append("<code>" + html.escape(m.group(1), quote=False) + "</code>")
        return "\x00%d\x00" % (len(codes) - 1)

    t = re.sub(r"`([^`]*)`", stash, text)
    t = html.escape(t, quote=False)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    # a bare web address becomes a link; trailing punctuation stays outside it
    t = re.sub(r"(https?://[^\s<\x00]*[^\s<\x00.,;:!?)])",
               r'<a href="\1">\1</a>', t)
    return re.sub(r"\x00(\d+)\x00", lambda m: codes[int(m.group(1))], t)


def commands(text, label):
    """`t` then `3` then `b`  ->  grey command boxes joined by small words."""
    out, first = [], True
    for seg in re.split(r"(`[^`]*`)", text):
        if len(seg) >= 2 and seg.startswith("`") and seg.endswith("`"):
            tag = "<b>%s</b> " % label if first else ""
            out.append('<span class="type">%s%s</span>'
                       % (tag, html.escape(seg[1:-1], quote=False)))
            first = False
        elif seg.strip():
            out.append('<span class="then">%s</span>' % inline(seg.strip()))
    return '<div class="seq">' + "".join(out) + "</div>"


def code_block(text, pad):
    """A command to paste, shown in full, with a Copy button."""
    return ('%s<div class="code"><pre>%s</pre>'
            '<button class="copy" type="button">Copy</button></div>'
            % (pad, html.escape(text, quote=False)))


def parse(lines):
    meta, blocks, problems, cur = {}, [], [], None
    for n, raw in enumerate(lines, 1):
        s = raw.strip()
        if not s or s.startswith("//"):
            continue
        m = re.match(r"^===\s*(BOX|STEP|FOOTER)\b\s*:?\s*(.*)$", s, re.I)
        if m:
            cur = {"kind": m.group(1).upper(), "title": m.group(2).strip(), "items": []}
            blocks.append(cur)
            continue
        key = re.match(r"^([A-Z][A-Z ]*[A-Z])\s*:\s*(.*)$", s)
        if cur is None:
            if key and key.group(1) in HEADER_KEYS:
                meta[key.group(1)] = key.group(2).strip()
            else:
                problems.append("line %d: text before the first === section is ignored" % n)
            continue
        if key and key.group(1) in ITEM_KEYS:
            cur["items"].append((key.group(1), key.group(2).strip()))
        elif s.upper() == "END PLACES":
            cur["items"].append(("END PLACES", ""))
        else:
            cur["items"].append(("P", s))
    return meta, blocks, problems


def render_box(b):
    h = ['  <div class="callout">', "    <h2>%s</h2>" % inline(b["title"])]
    in_places = in_place = after = False
    for key, val in b["items"]:
        if key == "PLACE":
            if not in_places:
                h.append('    <div class="places">')
                in_places = True
            if in_place:
                h.append("      </div>")
            h.append('      <div class="place">')
            h.append("        <h3>%s</h3>" % inline(val))
            in_place = True
        elif key == "PROMPT":
            h.append('        <span class="prompt">%s</span>' % html.escape(val, quote=False))
        elif key == "END PLACES":
            if in_place:
                h.append("      </div>")
            if in_places:
                h.append("    </div>")
            in_places = in_place = False
            after = True
        elif key in ("P", "NOTE", "WARNING", "CODE"):
            pad = "        " if in_place else "    "
            if key == "CODE":
                h.append(code_block(val, pad))
            else:
                cls = {"NOTE": "watch", "WARNING": "warn"}.get(key, "")
                if after:
                    cls = (cls + " after-places").strip()
                attr = ' class="%s"' % cls if cls else ""
                h.append("%s<p%s>%s</p>" % (pad, attr, inline(val)))
            after = False
    if in_place:
        h.append("      </div>")
    if in_places:
        h.append("    </div>")
    h.append("  </div>")
    return "\n".join(h)


def render_step(b, first):
    h = ['    <div class="step%s">' % (" first" if first else ""),
         "      <h2>%s</h2>" % inline(b["title"])]
    for key, val in b["items"]:
        if key == "WHERE":
            h.append('      <span class="where">%s</span>' % inline(val))
        elif key == "TYPE":
            h.append("      " + commands(val, "type"))
        elif key == "THEY TYPE":
            h.append("      " + commands(val, "they type"))
        elif key == "NOTE":
            h.append('      <p class="watch">%s</p>' % inline(val))
        elif key == "WARNING":
            h.append('      <p class="warn">%s</p>' % inline(val))
        elif key == "CODE":
            h.append(code_block(val, "      "))
        elif key == "P":
            h.append("      <p>%s</p>" % inline(val))
    h.append("    </div>")
    return "\n".join(h)


def render(meta, blocks):
    title = meta.get("TITLE", "Untitled")
    out = ['  <header class="masthead">',
           '    <p class="eyebrow">%s</p>' % inline(meta.get("EYEBROW", "")),
           "    <h1>%s</h1>" % inline(title),
           '    <p class="standfirst">%s</p>' % inline(meta.get("SUBTITLE", "")),
           '    <div class="meta">']
    if meta.get("TAKES"):
        out.append("      <span><b>Takes</b> %s</span>" % inline(meta["TAKES"]))
    if meta.get("YOU NEED"):
        out.append("      <span><b>You need</b> %s</span>" % inline(meta["YOU NEED"]))
    out += ["    </div>", "  </header>", ""]

    in_steps, step_no = False, 0
    for b in blocks:
        if b["kind"] == "STEP":
            if not in_steps:
                out.append('  <div class="steps">')
                in_steps = True
            out.append(render_step(b, step_no == 0))
            step_no += 1
            continue
        if in_steps:
            out.append("  </div>")
            in_steps = False
        if b["kind"] == "BOX":
            out.append(render_box(b))
        elif b["kind"] == "FOOTER":
            for key, val in b["items"]:
                out.append('  <p class="close">%s</p>' % inline(val))
        out.append("")
    if in_steps:
        out.append("  </div>")
    return title, "\n".join(out), step_no


def build():
    with open(SRC, encoding="utf-8") as f:
        meta, blocks, problems = parse(f.readlines())
    title, content, steps = render(meta, blocks)
    with open(TEMPLATE, encoding="utf-8") as f:
        page = f.read()
    page = (page.replace("{{TITLE}}", html.escape(title, quote=False))
                .replace("{{DESCRIPTION}}", html.escape(meta.get("SUBTITLE", ""), quote=True))
                .replace("{{CONTENT}}", content))
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(page)
    for p in problems:
        print("  ⚠ " + p)
    print("  ✓ %s rebuilt at %s  (%d steps)"
          % (os.path.basename(OUT), time.strftime("%H:%M:%S"), steps))


def watch():
    print("  Watching %s" % os.path.basename(SRC))
    print("  Save the text file and the page rebuilds. Refresh Safari with Cmd+R.")
    print("  Press Ctrl+C here to stop.\n")
    last = None
    while True:
        try:
            m = os.path.getmtime(SRC)
            if m != last:
                last = m
                build()
        except FileNotFoundError:
            pass
        except Exception as e:
            # a typo in the text must never kill the watcher
            print("  ✗ could not build: %s" % e)
        time.sleep(1)


if __name__ == "__main__":
    if "--watch" in sys.argv:
        try:
            watch()
        except KeyboardInterrupt:
            print("\n  Stopped.")
    else:
        build()
