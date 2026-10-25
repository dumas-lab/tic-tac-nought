"""Build visual-state pages for screenshots.

Views: game, cooling, armed, tip, over, vs, story, nought, options, menu.
Open dev/tests/.build/visual.html?view=game.
"""
from common import assemble, write

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

SETUP = r'''
window.addEventListener("load", function () {
  try {
    var view = new URLSearchParams(location.search).get("view") || "game";
    if (view === "menu") return;

    if (view === "options") {
      openOptions();
      return;
    }

    function paintBoard() {
      board[0] = "X"; board[1] = "X"; board[7] = "X";
      cellSource[0] = "normal"; cellSource[1] = "normal"; cellSource[7] = "ater";
      board[6] = "O"; board[13] = "O"; board[8] = "X"; board[9] = "O";
      board[14] = "X"; board[20] = "X";
      moves = [
        { i: 0, player: "X" }, { i: 6, player: "O" },
        { i: 1, player: "X" }, { i: 13, player: "O" },
        { i: 7, player: "X", label: "Swap" }, { i: 8, player: "X" }
      ];
      turn = "X";
      roundGain = 320;
    }

    if (view === "vs") {
      beginRun("two");
      showScreen("game");
      cancelAI();
      cancelNext();
      run.boardSize = 4;
      startBoardForRun();
      cancelAI();
      cancelNext();
      board[0] = "X"; board[5] = "O"; board[10] = "X"; board[15] = "O";
      moves = [{ i: 0, player: "X" }, { i: 5, player: "O" }, { i: 10, player: "X" }, { i: 15, player: "O" }];
      turn = "X";
      scores = { X: 2, O: 1, draws: 1 };
      render();
      return;
    }

    if (view === "story" || view === "nought") {
      storyDifficulty = "hard";
      beginRun("story");
      showScreen("game");
      cancelAI();
      cancelNext();
      if (view === "nought") {
        devSetStoryChapter(sinOrder.length);
        noughtDamage = 80;
      }
      paintBoard();
      render();
      return;
    }

    beginRun("endless");
    showScreen("game");
    cancelAI();
    cancelNext();
    run.boardSize = 6;
    run.score = 12340;
    run.round = 8;
    run.completed = 7;
    run.level = 6;
    run.xp = 24;
    run.buffRounds = 3;
    run.powers = {
      cross: { cooldown: 0, copies: 2 },
      cut: { cooldown: 2, copies: 1 },
      swap: { cooldown: 0, copies: 3 },
      erasure: { cooldown: 0, copies: 1 },
      recuperate: { cooldown: 0, copies: 1 },
      observation: { active: true, remaining: 2, copies: 1 },
      binary: { stacks: 2, copies: 2 },
      chaos: { active: false, remaining: 0, copies: 1 },
      recount: { charges: 1, dormant: 0, copies: 1 }
    };
    startBoardForRun();
    cancelAI();
    cancelNext();
    paintBoard();
    if (view === "cooling") {
      run.powers.cross.cooldown = 7;
      run.powers.cut.cooldown = 2;
      run.powers.swap.cooldown = 1;
      run.powers.erasure.cooldown = 3;
      run.powers.recuperate.cooldown = 1;
    }
    if (view === "armed") {
      aterArmed = "cross";
      aterState = { tier: 2 };
    }
    if (view === "over") {
      run.over = true;
      run.score = 42130;
      gameOver = true;
      result = "O";
    }
    render();
    if (view === "tip") {
      var card = document.querySelector('.slot-card[data-power="cross"]');
      tipPinned = "cross";
      showPowerTip(card);
    }
  } catch (err) {
    var d = document.createElement("pre");
    d.style.cssText = "position:fixed;inset:0;z-index:999999;background:#160b0b;color:#ff8b7d;font:12px/1.5 monospace;padding:18px;overflow:auto;white-space:pre-wrap;";
    d.textContent = "SETUP ERROR\n" + (err && err.stack ? err.stack : String(err));
    document.body.appendChild(d);
  }
});
'''

out = write("visual.html", assemble(SETUP, PRELUDE))
print(out)
