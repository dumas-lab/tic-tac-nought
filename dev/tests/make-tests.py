"""Build the logic + interaction test page.

Usage:
    python3 make-tests.py
Then open dev/tests/.build/tests.html in a browser, or run ./run.sh.
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

body = (HERE / "test-body.js").read_text()
out = write("tests.html", assemble(body, PRELUDE))
print(out)
