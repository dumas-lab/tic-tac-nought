window.addEventListener("load", function () {
  const view = new URLSearchParams(location.search).get("view") || "game";
  const results = [];

  function check(name, cond) {
    results.push([name, !!cond]);
  }

  function fits(inner, outer, tol) {
    const t = tol == null ? 0.5 : tol;
    return inner.left >= outer.left - t && inner.right <= outer.right + t;
  }

  function inside(inner, outer, tol) {
    const t = tol == null ? 0.5 : tol;
    return inner.left >= outer.left - t && inner.right <= outer.right + t &&
      inner.top >= outer.top - t && inner.bottom <= outer.bottom + t;
  }

  try {
    localStorage.clear();

    if (view === "game") {
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
      render();
    } else if (view === "options") {
      openOptions();
    } else {
      toMenu();
    }

    const vw = window.innerWidth;
    check("no horizontal overflow", document.documentElement.scrollWidth <= vw + 1);

    if (view === "game") {
      const layout = document.querySelector(".game-layout").getBoundingClientRect();
      const center = document.querySelector(".game-center").getBoundingClientRect();
      const left = document.querySelector(".game-side-left").getBoundingClientRect();
      const right = document.querySelector(".game-side-right").getBoundingClientRect();
      const boardRect = boardEl.getBoundingClientRect();
      const hud = document.querySelector(".run-hud").getBoundingClientRect();
      const top = document.querySelector(".game-top").getBoundingClientRect();

      check("game layout fits the viewport", fits(layout, { left: 0, right: vw }));
      check("board fits the viewport", boardRect.width <= Math.min(vw * 0.9, 420) + 1);
      check("board is square", Math.abs(boardRect.width - boardRect.height) <= 2);
      check("board fits the center column", fits(boardRect, center));
      check("hud fits the center column", fits(hud, center));
      check("game top fits the center column", fits(top, center));
      check("left side fits the viewport", fits(left, { left: 0, right: vw }));
      check("right side fits the viewport", fits(right, { left: 0, right: vw }));

      const optionsBtn = document.getElementById("optionsTopBtn").getBoundingClientRect();
      const devBtn = document.getElementById("devToolsBtn").getBoundingClientRect();
      const indicator = document.getElementById("sinWorkingIndicator");
      indicator.style.display = "inline";
      const indicatorRect = indicator.getBoundingClientRect();
      check("top-left buttons do not overlap", optionsBtn.right <= devBtn.left + 0.5);
      check("sin indicator clears the dev button", devBtn.right <= indicatorRect.left + 0.5);
      check("sin indicator fits the viewport", indicatorRect.right <= vw + 1);
      indicator.style.display = "none";

      if (vw > 760) {
        check("left collection sits beside the board", left.right <= center.left + 0.5);
        check("right collection sits beside the board", right.left >= center.right - 0.5);
      } else {
        check("center column comes first", center.top <= left.top + 0.5);
        check("left collection sits below the board", left.top >= center.bottom - 0.5);
        check("right collection sits below the left collection", right.top >= left.bottom - 0.5);
      }

      const cells = [...boardEl.querySelectorAll("button.cell")];
      check("all board cells fit the board", cells.every((cell) => inside(cell.getBoundingClientRect(), boardRect, 1)));

      const cards = [...document.querySelectorAll(".slot-card")];
      check("nine graft cards render", cards.length === 9);
      check("graft cards fit their panels", cards.every((card) => {
        const panel = card.closest(".powers").getBoundingClientRect();
        return fits(card.getBoundingClientRect(), panel);
      }));
      check("cross tier buttons fit their card", [...document.querySelectorAll(".tier-btn")].every((btn) => {
        const card = btn.closest(".slot-card").getBoundingClientRect();
        return fits(btn.getBoundingClientRect(), card);
      }));
      check("cross shows four tiers", document.querySelectorAll(".tier-btn").length === 4);
    }

    if (view === "menu") {
      const screen = document.getElementById("menuScreen").getBoundingClientRect();
      const card = document.querySelector(".menu-card").getBoundingClientRect();
      const ledger = document.getElementById("leaderboardPanel").getBoundingClientRect();
      check("menu screen fits the viewport", fits(screen, { left: 0, right: vw }));
      check("menu card fits", card.left >= 0 && card.right <= vw + 1);
      check("damage ledger fits", ledger.left >= 0 && ledger.right <= vw + 1);
      check("menu buttons render", document.querySelectorAll(".menu-buttons .menu-btn").length === 4);
      check("menu buttons fit the card", [...document.querySelectorAll(".menu-buttons .menu-btn")].every((btn) => {
        return fits(btn.getBoundingClientRect(), card);
      }));
    }

    if (view === "options") {
      const panel = document.querySelector(".options-panel").getBoundingClientRect();
      check("options panel fits", panel.left >= 0 && panel.right <= vw + 1);
      const rows = [...document.querySelectorAll(".band-slot")];
      check("four sound rows render", rows.length === 4);
      check("sound rows fit the panel", rows.every((row) => fits(row.getBoundingClientRect(), panel)));
      check("sound selects have usable width", [...document.querySelectorAll(".band-slot select")]
        .every((s) => s.getBoundingClientRect().width > 60));
    }
  } catch (err) {
    results.push(["SETUP ERROR: " + (err && err.message ? err.message : err), false]);
  }

  const failed = results.filter((r) => !r[1]);
  const panel = document.createElement("div");
  panel.id = "layoutResults";
  panel.style.cssText = "position:fixed;left:8px;top:8px;z-index:999999;max-width:min(92vw,520px);padding:10px 12px;border-radius:10px;background:#0f0c0b;border:1px solid " + (failed.length ? "#ff6b5b" : "#7bd88f") + ";color:#f3ece8;font:11px/1.5 ui-monospace,monospace;white-space:pre-wrap;";
  panel.textContent = (failed.length ? "LAYOUT FAIL" : "LAYOUT PASS") +
    " · " + (results.length - failed.length) + "/" + results.length +
    " at " + window.innerWidth + "×" + window.innerHeight + "\n" +
    results.map((r) => (r[1] ? "✓ " : "✗ ") + r[0]).join("\n");
  document.body.appendChild(panel);

  // Firefox's interactive window has a 500px minimum width. The harness can
  // load this page in a narrow iframe and read the result from the parent.
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "layout-results", text: panel.textContent }, "*");
  }
});
