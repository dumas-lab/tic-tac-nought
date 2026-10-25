"""Shared paths and page assembly for the Tic Tac Nought dev harness."""
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
BUILD = HERE / ".build"
BUILD.mkdir(parents=True, exist_ok=True)

APP = (ROOT / "index.html").read_text()


def assemble(body_js, prelude="", base="../../../"):
    """Return index.html with a prelude before the game and body_js after it.

    The generated page lives in dev/tests/.build, so a <base> keeps the
    relative assets/ paths resolving from the project root.
    """
    html = APP.replace("<head>", '<head>\n<base href="' + base + '">', 1)
    marker = '  <script src="assets/sounds/manifest.js"></script>'
    if marker not in html:
        raise SystemExit("Could not find the manifest script tag in index.html")
    html = html.replace(marker, prelude + marker, 1)
    html = html.replace("</body>", "<script>\n" + body_js + "\n</script>\n</body>", 1)
    return html


def write(name, html):
    out = BUILD / name
    out.write_text(html)
    return out
