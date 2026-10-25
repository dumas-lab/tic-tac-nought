"""Build the responsive layout check page.

Open dev/tests/.build/layout.html?view=game|menu|options at several widths.
The page reports PASS/FAIL and the individual bounds it checked.

Firefox's interactive window cannot shrink below 500px wide, so
layout-frame.html?view=game&w=320&h=780 embeds the same page in a narrow
iframe and posts its result to the parent for automation.
"""
from common import HERE, assemble, write

PRELUDE = '''<script>
localStorage.clear();
window.__errors = [];
window.addEventListener("error", function (event) {
  window.__errors.push(String(event.message || "error") + " @" + String(event.filename || "") + ":" + String(event.lineno || ""));
});
window.addEventListener("unhandledrejection", function (event) {
  window.__errors.push("promise: " + (event.reason && event.reason.message ? event.reason.message : event.reason));
});
window.confirm = function () { return true; };
</script>
'''

body = (HERE / "layout-body.js").read_text()
out = write("layout.html", assemble(body, PRELUDE))
print(out)

WRAPPER = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Layout frame harness</title>
<style>
  html, body { margin: 0; padding: 0; background: #14100f; }
  iframe { display: block; border: 0; }
  #layoutFrameResults {
    position: fixed; left: 8px; top: 8px; z-index: 999999;
    max-width: min(92vw, 520px); padding: 10px 12px; border-radius: 10px;
    background: #0f0c0b; border: 1px solid #7bd88f; color: #f3ece8;
    font: 11px/1.5 ui-monospace, monospace; white-space: pre-wrap;
  }
</style>
</head>
<body>
<pre id="layoutFrameResults">LAYOUT WAITING</pre>
<script>
(function () {
  var out = document.getElementById("layoutFrameResults");
  window.addEventListener("message", function (event) {
    if (event.data && event.data.type === "layout-results") {
      out.textContent = event.data.text;
    }
  });
  window.addEventListener("load", function () {
    var params = new URLSearchParams(location.search);
    var view = params.get("view") || "game";
    var width = parseInt(params.get("w") || "320", 10);
    var height = parseInt(params.get("h") || "780", 10);
    var frame = document.createElement("iframe");
    frame.style.width = width + "px";
    frame.style.height = height + "px";
    frame.src = "layout.html?view=" + encodeURIComponent(view) + "&embed=1";
    document.body.appendChild(frame);
    setTimeout(function () {
      if (out.textContent === "LAYOUT WAITING") {
        out.textContent = "LAYOUT FAIL · no result from " + width + "×" + height + " frame";
      }
    }, 6000);
  });
})();
</script>
</body>
</html>
'''
out = write("layout-frame.html", WRAPPER)
print(out)
