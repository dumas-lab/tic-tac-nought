"""Build persisted-state boot checks for 0.3.

Boot always lands on the menu. A saved run is preserved behind it and resumes
when the same mode is started again.
"""
import json

from common import assemble, write

SIN_IDS = ["pride", "greed", "lust", "envy", "gluttony", "wrath", "sloth"]

SNAPSHOT = {
    "board": ["X", "", "", "", "O", "", "", "", ""],
    "cellSource": ["normal", "", "", "", "", "", "", "", ""],
    "turn": "X",
    "gameOver": False,
    "result": None,
    "winLine": [],
    "moves": [{"i": 0, "player": "X", "label": ""}, {"i": 4, "player": "O", "label": ""}],
    "blockedLines": [],
    "awaitingNext": False,
    "pendingGrowth": False,
    "aterArmed": None,
    "aterState": None,
    "roundGain": 10,
    "erupted": False,
    "currentSin": {"id": "pride", "name": "Pride"},
    "sinRound": 0,
    "noughtDamage": 0,
    "noughtDamageTarget": 0,
    "sinOrder": SIN_IDS,
    "storySinIndex": 0,
    "storyDefeated": [],
    "endlessSinIndex": 0,
    "endlessCycle": 0,
    "noughtScars": [],
    "noughtScarIndex": 0,
    "currentScar": None,
    "noughtConfessions": [],
    "noughtSalvage": None,
    "eatenCells": [],
    "wantedCells": [],
    "lateCells": [],
    "stripCells": [],
    "wrathCells": [],
    "wrathTriggered": False,
    "firstScoreDone": False,
    "gluttonyAte": False,
    "sinFirstMove": None,
    "sinMoveCount": 0,
    "aterPlaced": [],
    "aterTurnGain": 0,
    "sinCheatNoticed": False,
    "storyProgress": {"easy": 0, "medium": 0, "hard": 0, "easyBeaten": False, "mediumBeaten": False, "hardBeaten": False},
    "victory": False,
    "storyDifficulty": "easy",
    "snapshotMode": "endless",
}

RUN = {
    "id": "boot-run",
    "score": 120,
    "round": 3,
    "completed": 2,
    "boardSize": 3,
    "buffRounds": 4,
    "powers": {"cut": {"cooldown": 1, "copies": 2}},
    "over": False,
    "saved": False,
    "savedName": "",
    "snapshotMode": "endless",
    "xp": 4,
    "level": 1,
    "bestPulsed": False,
    "victory": False,
    "storyDifficulty": "easy",
    "storySinIndex": 0,
    "storyDefeated": [],
    "sinRound": 0,
    "sinOrder": SIN_IDS,
    "endlessSinIndex": 0,
    "endlessCycle": 0,
    "erupted": False,
    "eruptedSession": False,
    "noughtConfessions": [],
    "noughtDamage": 0,
    "noughtDamageTarget": 0,
    "noughtSalvage": None,
    "noughtScars": [],
    "noughtScarIndex": 0,
    "currentScar": None,
    "storyProgress": {"easy": 0, "medium": 0, "hard": 0, "easyBeaten": False, "mediumBeaten": False, "hardBeaten": False},
}

BASE_STATE = {
    "scores": {"X": 0, "O": 0, "draws": 0},
    "mode": "endless",
    "screen": "game",
    "playerName": "",
    "rarityWeights": {"common": 60, "uncommon": 30, "rare": 10},
    "run": RUN,
    "endless": SNAPSHOT,
}


def state_for(case):
    state = json.loads(json.dumps(BASE_STATE))
    if case == "menu":
        state["screen"] = "menu"
    elif case == "options":
        state["screen"] = "options"
    elif case == "over":
        state["run"]["over"] = True
        state["run"]["score"] = 42130
        state["run"]["saved"] = True
        state["endless"]["gameOver"] = True
        state["endless"]["result"] = "O"
    elif case == "story":
        state["mode"] = "story"
        state["run"]["snapshotMode"] = "story"
        state["run"]["storyDifficulty"] = "hard"
        state["run"]["storySinIndex"] = 2
        state["run"]["sinRound"] = 1
        state["endless"]["snapshotMode"] = "story"
        state["endless"]["storyDifficulty"] = "hard"
        state["endless"]["storySinIndex"] = 2
        state["endless"]["sinRound"] = 1
    return state


CHECKS = {
    "resume": r'''
      eq(screen, "menu");
      eq(menuScreen.hidden, false);
      eq(gameScreen.hidden, true);
      ok(menuRunNote.textContent.indexOf("Run in progress") !== -1, "run note");
      eq(run.score, 120);
      eq(run.snapshot.board[0], "X");
      eq(run.snapshot.board[4], "O");
      startMode("endless");
      cancelAI();
      cancelNext();
      eq(screen, "game");
      eq(board[0], "X");
      eq(board[4], "O");
      eq(turn, "X");
      eq(run.score, 120);
      eq(boardEl.children.length, 9);
      eq(powerState("cut").cooldown, 1);
      eq(powerState("cut").copies, 2);
      eq(activePips, 4);
    ''',
    "menu": r'''
      eq(screen, "menu");
      eq(menuScreen.hidden, false);
      eq(gameScreen.hidden, true);
      eq(run.score, 120);
      ok(menuRunNote.textContent.indexOf("Run in progress") !== -1, "run note");
      eq(run.snapshot.board[0], "X");
    ''',
    "options": r'''
      eq(screen, "menu");
      eq(menuScreen.hidden, false);
      eq(optionsScreen.hidden, true);
      eq(gameScreen.hidden, true);
      ok(menuRunNote.textContent.indexOf("Run in progress") !== -1, "run note");
    ''',
    "story": r'''
      eq(screen, "menu");
      eq(menuScreen.hidden, false);
      eq(mode, "story");
      eq(storyDifficulty, "hard");
      eq(run.snapshotMode, "story");
      eq(run.snapshot.storyDifficulty, "hard");
      ok(menuRunNote.textContent.indexOf("Run in progress") !== -1, "run note");
      startMode("story");
      eq(continueModal.hidden, false);
      continueYes.click();
      eq(continueModal.hidden, true);
      eq(screen, "game");
      eq(mode, "story");
      eq(storyDifficulty, "hard");
      eq(board[0], "X");
      eq(sinOrder.length, 7);
    ''',
    "over": r'''
      eq(screen, "menu");
      eq(menuScreen.hidden, false);
      eq(run.over, true);
      ok(menuRunNote.textContent.indexOf("Last run") !== -1, "last-run note");
      ok(menuRunNote.textContent.indexOf("42,130") !== -1, "score formatted");
      eq(run.saved, true);
    ''',
}

CHECK_TEMPLATE = r'''
<script>
(function () {
  var results = [];
  function ok(cond, msg) { if (!cond) throw new Error(msg || "assertion failed"); }
  function eq(a, b, msg) {
    if (a !== b) throw new Error((msg ? msg + ": " : "") + "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a));
  }
  try {
    var activePips = [...document.getElementById("boostChip").querySelectorAll(".pip")]
      .filter(function (p) { return p.classList.contains("on"); }).length;
    %s
    results.push("PASS boot case: %s");
  } catch (err) {
    results.push("FAIL boot case: %s — " + (err && err.message ? err.message : err));
  }
  if (window.__errors && window.__errors.length) {
    results.push("RUNTIME ERRORS: " + window.__errors.join(" | "));
  }
  var d = document.createElement("pre");
  d.id = "bootResults";
  d.style.cssText = "position:fixed;inset:0;z-index:999999;background:#0f0c0b;color:#cfe9d3;font:15px/1.6 monospace;padding:24px;white-space:pre-wrap;";
  d.textContent = results.join("\n");
  document.body.appendChild(d);
})();
</script>
'''


def build(case):
    state = state_for(case)
    pre = '''<script>
localStorage.clear();
localStorage.setItem("ttn-state-v2", %s);
window.__errors = [];
window.addEventListener("error", function (event) {
  window.__errors.push(String(event.message || "error") + " @" + String(event.filename || "") + ":" + String(event.lineno || ""));
});
window.confirm = function () { return true; };
</script>
''' % json.dumps(json.dumps(state))
    html = assemble("", pre)
    html = html.replace("</body>", (CHECK_TEMPLATE % (CHECKS[case], case, case)) + "</body>", 1)
    return write("boot-%s.html" % case, html)


if __name__ == "__main__":
    for name in CHECKS:
        print(build(name))
