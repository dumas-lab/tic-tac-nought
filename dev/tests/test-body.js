(function () {
  const results = [];

  function test(name, fn) {
    try {
      const detail = fn();
      results.push({ name, pass: true, detail: detail == null ? "" : String(detail) });
    } catch (err) {
      results.push({ name, pass: false, detail: err && err.message ? err.message : String(err) });
    } finally {
      // Keep timers from a completed test out of the next one.
      try {
        cancelAI();
        cancelNext();
        awaitingNext = false;
      } catch (err) {
        /* state not ready */
      }
    }
  }

  function ok(cond, message) {
    if (!cond) throw new Error(message || "assertion failed");
  }

  function eq(actual, expected, message) {
    if (actual !== expected) {
      throw new Error((message ? message + ": " : "") + "expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual));
    }
  }

  function contains(text, needle, message) {
    if (String(text).indexOf(needle) === -1) {
      throw new Error((message ? message + ": " : "") + "expected " + JSON.stringify(text) + " to contain " + JSON.stringify(needle));
    }
  }

  function stop() {
    cancelAI();
    cancelNext();
  }

  function startStory(difficulty) {
    stop();
    storyDifficulty = difficulty || "easy";
    beginRun("story");
    showScreen("game");
    stop();
    render();
  }

  function startEndless() {
    stop();
    beginRun("endless");
    showScreen("game");
    stop();
    render();
  }

  function startVS() {
    stop();
    scores = { X: 0, O: 0, draws: 0 };
    beginRun("two");
    showScreen("game");
    stop();
    render();
  }

  function startSin(id, round, targetMode) {
    const target = targetMode || "story";
    stop();
    if (target === "story") {
      storyDifficulty = "easy";
      beginRun("story");
    } else {
      beginRun("endless");
    }
    sinOrder = [SIN_BY_ID[id]];
    currentSin = SIN_BY_ID[id];
    storySinIndex = 0;
    endlessSinIndex = 0;
    endlessCycle = 0;
    storyDefeated = [];
    sinRound = (round || 1) - 1;
    run.boardSize = 3;
    startBoardForRun();
    showScreen("game");
    stop();
    render();
  }

  function clearSin() {
    currentSin = null;
    sinOrder = [];
    sinRound = 0;
    storySinIndex = 0;
    endlessSinIndex = -1;
    endlessCycle = 0;
    storyDefeated = [];
    noughtDamage = 0;
    noughtDamageTarget = 0;
    noughtConfessions = [];
    noughtScars = [];
    noughtScarIndex = 0;
    currentScar = null;
    resetSinRoundState();
  }

  function setBoard(marks) {
    stop();
    syncBoard();
    board = marks.slice();
    cellSource = marks.map((v) => (v === "X" ? "normal" : ""));
    moves = [];
    marks.forEach((v, i) => { if (v) moves.push({ i, player: v }); });
    blockedLines = new Set();
    winLine = [];
    gameOver = false;
    result = null;
    turn = "X";
    run.score = 0;
    run.over = false;
    run.victory = false;
    roundGain = 0;
    awaitingNext = false;
    pendingGrowth = false;
    aterArmed = null;
    aterState = null;
    eatenCells = new Set();
    wantedCells = new Set();
    lateCells = new Set();
    stripCells = new Set();
    wrathCells = new Set();
    wrathTriggered = false;
    firstScoreDone = false;
    gluttonyAte = false;
    sinFirstMove = null;
    sinMoveCount = 0;
    aterPlaced = [];
    aterTurnGain = 0;
    clearPreview();
    render();
  }

  function endRound(outcome) {
    stop();
    gameOver = true;
    result = outcome;
    endEndlessRound();
    stop();
  }

  function x(i) {
    play(i);
    stop();
  }

  function o(i) {
    play(i);
    stop();
  }

  function grant(id) {
    return grantPowerup(POWER_BY_ID[id]);
  }

  function totalCopies() {
    return POWERUPS.reduce((sum, power) => {
      const p = powerState(power.id);
      return sum + (p ? (p.copies || 1) : 0);
    }, 0);
  }

  function cardFor(id) {
    return document.querySelector('.slot-card[data-power="' + id + '"]');
  }

  function activePips() {
    return [...boostPipsEl.children].filter((pip) => pip.classList.contains("on")).length;
  }

  /* ---------- boot + menu ---------- */

  test("boot lands on the menu with the 0.3 book", () => {
    eq(screen, "menu");
    eq(menuScreen.hidden, false);
    eq(gameScreen.hidden, true);
    eq(optionsScreen.hidden, true);
    eq(document.title, "Tic Tac Nought");
    eq(document.querySelectorAll("#bookList .guide-card").length, 9);
    eq(document.querySelectorAll("#bookSins .guide-card").length, 7);
    eq(document.querySelectorAll("#bookSins .sin-rounds li").length, 21);
    const labels = [...document.querySelectorAll(".menu-buttons .menu-btn strong")]
      .map((el) => el.textContent.trim());
    eq(labels.join("|"), "Endless|Story|VS|Wishlist");
    eq(devToolsBtn.style.display, "inline-block");
  });

  test("menu starts Story, Endless, and VS", () => {
    storyProgress = { easy: 0, medium: 0, hard: 0, easyBeaten: false, mediumBeaten: false, hardBeaten: false };
    document.querySelector('[data-start="story"]').click();
    eq(document.getElementById("difficultyModal").hidden, false);
    eq(document.getElementById("diffEasyStatus").textContent, "New");
    document.querySelector('[data-difficulty="easy"]').click();
    eq(screen, "game");
    eq(mode, "story");
    eq(storyDifficulty, "easy");
    eq(sinOrder.length, 3);
    eq(run.boardSize, 3);
    eq(runHud.hidden, false);
    eq(scoreboardEl.hidden, true);
    eq(document.getElementById("scoreCaption").textContent, "Damage");
    eq(powersPanelLeft.hidden, false);
    eq(powersPanelRight.hidden, false);
    contains(statusEl.textContent, currentSin.name);
    contains(statusEl.textContent, "Your turn");

    toMenu();
    eq(screen, "menu");
    document.querySelector('[data-start="endless"]').click();
    eq(mode, "endless");
    eq(sinOrder.length, 7);
    eq(endlessSinIndex, 0);

    toMenu();
    document.querySelector('[data-start="two"]').click();
    eq(mode, "two");
    eq(scoreboardEl.hidden, false);
    eq(runHud.hidden, false);
    eq(document.getElementById("scoreCaption").textContent, "Score");
    eq(currentSin, null);
    eq(statusEl.textContent, "Player X's turn");
  });

  test("Story difficulty picks 3, 5, or 7 sins", () => {
    for (const [diff, count] of [["easy", 3], ["medium", 5], ["hard", 7]]) {
      startStory(diff);
      eq(storyDifficulty, diff);
      eq(run.storyDifficulty, diff);
      eq(sinOrder.length, count, diff);
      eq(currentSin.id, sinOrder[0].id, diff);
    }
  });

  test("Story chapters are three rounds and grow the board after round three", () => {
    startStory("easy");
    sinOrder = [SIN_BY_ID.pride, SIN_BY_ID.greed, SIN_BY_ID.sloth];
    currentSin = sinOrder[0];
    storySinIndex = 0;
    storyDefeated = [];
    sinRound = 0;
    startBoardForRun();

    endRound("draw");
    eq(run.completed, 1);
    eq(sinRound, 1);
    eq(currentSin.id, "pride");
    eq(awaitingNext, true);
    eq(pendingGrowth, false);
    contains(statusEl.textContent, "Held · Next: Pride");
    nextBoard();
    eq(sinRound, 1);

    endRound("draw");
    eq(sinRound, 2);
    nextBoard();
    endRound("draw");
    eq(run.completed, 3);
    eq(sinRound, 0);
    eq(storySinIndex, 1);
    eq(currentSin.id, "greed");
    eq(storyDefeated.join(","), "pride");
    eq(pendingGrowth, true);
    contains(statusEl.textContent, "Held · Next: Greed");
    contains(statusEl.textContent, "Board grows to 4×4");

    nextBoard();
    eq(run.boardSize, 4);
    eq(board.length, 16);
    eq(awaitingNext, false);
  });

  test("Story status distinguishes Won, Held, and Game Over", () => {
    startSin("pride", 1);
    endRound("X");
    contains(statusEl.textContent, "Won · Next: Pride");
    eq(run.completed, 1);

    startSin("pride", 1);
    endRound("draw");
    contains(statusEl.textContent, "Held · Next: Pride");

    startSin("pride", 1);
    endRound("O");
    eq(run.over, true);
    contains(statusEl.textContent, "Game Over");
    eq(resetBtn.textContent, "Go again");
  });

  test("Story Nought has 200 damage and every scar", () => {
    startStory("hard");
    devSetStoryChapter(sinOrder.length);
    eq(isNoughtRound(), true);
    eq(noughtDamageTarget, 200);
    eq(noughtScars.length, 21);
    ok(currentScar !== null, "a scar is speaking");
    contains(statusEl.textContent, "Nought · Damage 0 / 200");
    contains(statusEl.textContent, "Scar: ");
    contains(statusEl.textContent, "(R1)");
    eq(gameModeLabel.textContent, "Story · Nought");
    eq(storyProgress.hard, 7);
  });

  test("Nought speaks its first line when the Story round begins", () => {
    startStory("hard");
    storySinIndex = sinOrder.length;
    storyDefeated = sinOrder.map((sin) => sin.id);
    enterNoughtRound();
    startBoardForRun();
    eq(isNoughtRound(), true);
    contains(toastEl.textContent, "You wanted X and O. I kept O.");
    ok(toastEl.classList.contains("show"), "toast is visible");
  });

  test("Nought speaks its first line when the Endless fragment begins", () => {
    startEndless();
    endlessSinIndex = sinOrder.length;
    storyDefeated = sinOrder.map((sin) => sin.id);
    enterEndlessNought();
    startBoardForRun();
    eq(isNoughtRound(), true);
    contains(toastEl.textContent, "You wanted X and O. I kept O.");
  });

  test("Nought status shows the scar line and the confession", () => {
    startStory("hard");
    devSetStoryChapter(sinOrder.length);
    const scar = activeSin();
    ok(scar, "a scar is speaking");
    contains(statusEl.textContent, '"' + scar.taunt + '"');
    const confession = noughtTaunt();
    ok(confession, "a confession is available");
    contains(statusEl.textContent, '"' + confession + '"');
    if (confession !== scar.taunt) {
      contains(statusEl.textContent, 'Nought: "' + confession + '"');
    }
  });

  test("Nought victory ends Story and marks the difficulty beaten", () => {
    startStory("easy");
    devSetStoryChapter(sinOrder.length);
    addNoughtDamage(50);
    eq(noughtDamage, 50);
    eq(run.over, false);
    addNoughtDamage(150);
    eq(noughtDamage, 200);
    eq(run.over, true);
    eq(run.victory, true);
    eq(statusEl.textContent, "Victory · Nought defeated");
    eq(resetBtn.textContent, "Return to menu");
    eq(storyProgress.easyBeaten, true);
    eq(storyProgress.easy, 3);
  });

  test("a full Nought board clears the outer ring and continues", () => {
    startStory("easy");
    devSetStoryChapter(sinOrder.length);
    noughtDamageTarget = 9999;
    noughtDamage = 0;
    noughtScars = [{ sinId: "pride", round: 1 }];
    noughtScarIndex = 0;
    currentScar = null;
    setBoard(Array(9).fill("X"));
    board[4] = "";
    cellSource[4] = "";
    moves = [];

    playEndless(4);
    stop();

    eq(board.filter(Boolean).length, 1);
    eq(board[4], "X");
    eq(moves.length, 1);
    eq(moves[0].i, 4);
    eq(blockedLines.size, 0);
    eq(noughtScarIndex, 1);
    eq(currentScar.sinId, "pride");
    ok(noughtDamage > 0, "the placement still wounded Nought");
  });

  test("Nought scars cycle 1st, 2nd, then 3rd rounds at round-1 strength", () => {
    const order = buildNoughtScars(["pride", "greed"]);
    eq(order.map((s) => s.sinId + ":" + s.round).join(","), "pride:1,greed:1,pride:2,greed:2,pride:3,greed:3");

    startStory("easy");
    devSetStoryChapter(3);
    noughtScars = [{ sinId: "pride", round: 2 }, { sinId: "gluttony", round: 3 }];
    noughtScarIndex = 0;
    currentScar = null;
    startBoardForRun();
    render();
    eq(activeSinRound(), 1);
    eq(board[4], "O");
    eq(currentScar.sinId, "pride");
    eq(currentScar.round, 2);
    contains(statusEl.textContent, "Scar: Pride (R2)");

    advanceNoughtScar();
    render();
    eq(currentScar.sinId, "gluttony");
    eq(currentScar.round, 3);
    eq(activeSinRound(), 1);
    ok(eatenCells.size >= 1, "Gluttony's round-1 bite is active");
    contains(statusEl.textContent, "Scar: Gluttony (R3)");
  });

  /* ---------- endless ---------- */

  test("Endless starts with all seven sins", () => {
    startEndless();
    eq(mode, "endless");
    eq(sinOrder.length, 7);
    eq(currentSin.id, sinOrder[0].id);
    eq(endlessSinIndex, 0);
    eq(endlessCycle, 0);
    eq(run.boardSize, 3);
    eq(runHud.hidden, false);
    eq(scoreboardEl.hidden, true);
    eq(document.getElementById("scoreCaption").textContent, "Damage");
    contains(gameModeLabel.textContent, "Endless · ");
    contains(statusEl.textContent, "Your turn");
  });

  test("growth schedule is 3, then every 6 completed rounds", () => {
    eq(growthDue(0), false);
    eq(growthDue(1), false);
    eq(growthDue(2), false);
    eq(growthDue(3), true);
    eq(growthDue(4), false);
    eq(growthDue(8), false);
    eq(growthDue(9), true);
    eq(growthDue(14), false);
    eq(growthDue(15), true);
    eq(growthDue(20), false);
    eq(growthDue(21), true);
  });

  test("21 Endless rounds reach the Nought fragment", () => {
    startEndless();
    for (let i = 0; i < 20; i++) {
      endRound("draw");
      nextBoard();
    }
    endRound("draw");

    eq(run.completed, 21);
    eq(run.round, 22);
    eq(run.boardSize, 6);
    eq(endlessSinIndex, 7);
    eq(currentSin, null);
    eq(isNoughtRound(), true);
    eq(noughtDamageTarget, 100);
    eq(noughtScars.length, 21);
    eq(noughtConfessions.length, 7);
    contains(statusEl.textContent, "Nought · Damage 0 / 100");
    eq(gameModeLabel.textContent, "Endless · Nought");
  });

  test("breaking an Endless Nought starts a larger cycle", () => {
    startEndless();
    sinOrder = SINS.slice();
    endlessSinIndex = sinOrder.length;
    storyDefeated = sinOrder.map((sin) => sin.id);
    currentSin = null;
    endlessCycle = 0;
    noughtDamage = 0;
    noughtDamageTarget = 100;
    noughtScars = buildNoughtScars(storyDefeated);
    noughtScarIndex = 0;
    currentScar = null;
    run.boardSize = 3;
    startBoardForRun();
    eq(isNoughtRound(), true);

    addNoughtDamage(100);
    eq(endlessCycle, 1);
    eq(run.boardSize, 4);
    eq(run.over, false);
    eq(noughtDamageTarget, 0);
    eq(isNoughtRound(), false);
    eq(endlessSinIndex, 0);
    ok(currentSin !== null, "new cycle has a sin");
    eq(storyDefeated.length, 0);
    eq(noughtScars.length, 0);
    eq(run.round, 2);
    eq(run.completed, 1);
    contains(statusEl.textContent, "Won · Next: ");
  });

  test("Endless Nought targets scale with the cycle", () => {
    startEndless();
    endlessCycle = 2;
    enterEndlessNought();
    eq(noughtDamageTarget, 200);
    endlessCycle = 3;
    enterEndlessNought();
    eq(noughtDamageTarget, 250);
  });

  test("an Endless loss ends the run and auto-logs the ledger", () => {
    startEndless();
    leaderboard = [];
    saveLeaderboard();
    playerName = "Tester";
    run.id = "ledger-run";
    run.score = 500;
    run.level = 4;
    run.round = 4;
    run.completed = 3;
    run.boardSize = 4;
    endRound("O");

    eq(run.over, true);
    eq(run.saved, true);
    eq(leaderboard.length, 1);
    eq(leaderboard[0].name, "Tester");
    eq(leaderboard[0].score, 500);
    eq(leaderboard[0].level, 4);
    eq(leaderboard[0].boardSize, 4);
    contains(saveHint.textContent, "Run over");

    leaderboard = [];
    saveLeaderboard();
  });

  test("loot arrives every three completed rounds", () => {
    startEndless();
    eq(totalCopies(), 0);
    for (let i = 0; i < 3; i++) {
      endRound("draw");
      nextBoard();
    }
    eq(totalCopies(), 1);
    for (let i = 0; i < 3; i++) {
      endRound("draw");
      nextBoard();
    }
    eq(totalCopies(), 2);
  });

  test("a win refreshes the 100x boost and draws spend it", () => {
    startEndless();
    run.buffRounds = 0;
    endRound("X");
    eq(run.buffRounds, 5);
    nextBoard();
    endRound("draw");
    eq(run.buffRounds, 4);
    nextBoard();
    endRound("draw");
    eq(run.buffRounds, 3);
  });

  test("score runs are 10/20/30 and the HUD formats the total", () => {
    startEndless();
    clearSin();
    setBoard(["X", "X", "X", "", "", "", "", "", ""]);
    eq(runScore(board, "X"), 10);
    eq(sizeMultiplier(), 1);
    eq(activeMultiplier(), 1);
    run.buffRounds = 2;
    eq(activeMultiplier(), 100);
    run.buffRounds = 0;

    run.score = 0;
    roundGain = 0;
    addScore(1234);
    eq(run.score, 1234);
    eq(roundGain, 1234);

    run.level = 3;
    run.xp = 12;
    run.round = 4;
    run.buffRounds = 2;
    render();
    eq(runScoreEl.textContent, "1,234");
    eq(xpLevelEl.textContent, "Lv 3");
    eq(xpNextEl.textContent, "12/30");
    eq(activePips(), 2);
    eq(runRoundEl.textContent, "4");
    eq(runBoardEl.textContent, "3×3");
    eq(statusEl.textContent, "Your turn");
    eq(document.getElementById("scoreCaption").textContent, "Damage");
    eq(scoreboardEl.hidden, true);
  });

  test("XP is 10 per level and levels carry the remainder", () => {
    startEndless();
    addXp(9);
    eq(run.level, 1);
    eq(run.xp, 9);
    addXp(1);
    eq(run.level, 2);
    eq(run.xp, 0);
    addXp(20);
    eq(run.level, 3);
    eq(run.xp, 0);
  });

  /* ---------- VS ---------- */

  test("VS is two-player with both HUDs visible", () => {
    startVS();
    eq(mode, "two");
    eq(isComputer(), false);
    eq(boardSize(), 3);
    eq(run.boardSize, 3);
    eq(runHud.hidden, false);
    eq(scoreboardEl.hidden, false);
    eq(document.getElementById("scoreCaption").textContent, "Score");
    eq(labelX.textContent, "X");
    eq(labelDraws.textContent, "Draws");
    eq(labelO.textContent, "O");
    eq(currentSin, null);
    eq(isNoughtRound(), false);
    eq(statusEl.textContent, "Player X's turn");
    eq(powersPanelLeft.hidden, false);
    eq(powersPanelRight.hidden, false);
  });

  test("VS tracks an X win and advances the round", () => {
    startVS();
    for (const i of [0, 3, 1, 4, 2]) x(i);
    eq(scores.X, 1);
    eq(scores.O, 0);
    eq(run.round, 2);
    eq(run.completed, 1);
    eq(run.buffRounds, 5);
    eq(run.score, 10);
    eq(awaitingNext, true);
    eq(statusEl.textContent, "Player X wins!");
    eq(scoreX.textContent, "1");
    eq(run.over, false);
  });

  test("VS tracks an O win", () => {
    startVS();
    for (const i of [0, 3, 1, 4, 8, 5]) x(i);
    eq(scores.O, 1);
    eq(scores.X, 0);
    eq(run.round, 2);
    eq(statusEl.textContent, "Player O wins!");
    eq(scoreO.textContent, "1");
  });

  test("VS tracks a draw", () => {
    startVS();
    for (const i of [0, 1, 2, 4, 3, 5, 7, 6, 8]) x(i);
    eq(scores.draws, 1);
    eq(scores.X, 0);
    eq(scores.O, 0);
    eq(run.round, 2);
    eq(statusEl.textContent, "It's a draw!");
    eq(scoreDraws.textContent, "1");
  });

  test("VS reset clears the scoreboard and grafts", () => {
    startVS();
    scores = { X: 2, O: 1, draws: 3 };
    grant("cross");
    play(0);
    stop();
    resetAll();
    eq(mode, "two");
    eq(scores.X, 0);
    eq(scores.O, 0);
    eq(scores.draws, 0);
    eq(run.round, 1);
    eq(run.completed, 0);
    eq(powerState("cross"), null);
    eq(board.every((cell) => !cell), true);
    eq(scoreX.textContent, "0");
    eq(scoreO.textContent, "0");
    eq(scoreDraws.textContent, "0");
  });

  test("VS keeps Observation and Chaos active", () => {
    startVS();
    grant("observation");
    eq(observationActive(), true);
    eq(powerState("observation").remaining, 3);
    grant("chaos");
    eq(chaosActive(), true);
    eq(powerState("chaos").remaining, 2);

    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
      turn = "O";
      gameOver = false;
      run.over = false;
      play(8);
      stop();
    } finally {
      Math.random = originalRandom;
    }
    eq(board[0], "O");
    eq(board[8], "");
  });

  /* ---------- grafts ---------- */

  test("rarity pools are the 0.3 pools", () => {
    const ids = (rarity) => POWERUPS
      .filter((p) => p.rarity === rarity)
      .map((p) => p.id)
      .sort()
      .join(",");
    eq(ids("common"), "binary,cut,observation");
    eq(ids("uncommon"), "erasure,recount,swap");
    eq(ids("rare"), "chaos,cross,recuperate");
  });

  test("arming does not start a cooldown; a completed Cut does", () => {
    startEndless();
    clearSin();
    setBoard(Array(9).fill(""));
    grant("cut");
    const p = powerState("cut");
    eq(p.cooldown, 0);
    eq(p.copies, 1);
    armAter("cut");
    eq(aterArmed, "cut");
    eq(p.cooldown, 0);
    applyAterAt(0);
    stop();
    eq(p.cooldown, 0, "first Cut still open");
    eq(aterArmed, "cut");
    eq(board[0], "X");
    applyAterAt(3);
    stop();
    eq(p.cooldown, 3);
    eq(aterArmed, null);
    eq(board[3], "X");
  });

  test("Cross is a flat 5-round cooldown at every tier", () => {
    startEndless();
    clearSin();
    run.boardSize = 5;
    setBoard(Array(25).fill(""));
    grant("cross");
    const p = powerState("cross");
    armAter("cross", 2);
    eq(aterArmed, "cross");
    eq(aterState.tier, 2);
    applyAterAt(12);
    stop();
    const expected = [12, 7, 17, 11, 13, 2, 22, 10, 14];
    for (const idx of expected) eq(board[idx], "X", "cell " + idx);
    eq(p.cooldown, 5);
    eq(p.copies, 1, "tiers spend cooldown, not copies");
    eq(aterArmed, null);
  });

  test("Cross tier fit follows the board size", () => {
    startEndless();
    clearSin();
    const table = [[3, 1], [4, 1], [5, 2], [6, 2], [7, 3], [8, 3], [9, 4]];
    for (const [size, expected] of table) {
      run.boardSize = size;
      eq(maxCrossTier(), expected, "size " + size);
    }
  });

  test("Cross refuses a tier that does not fit", () => {
    startEndless();
    clearSin();
    run.boardSize = 3;
    setBoard(Array(9).fill(""));
    grant("cross");
    armAter("cross", 2);
    eq(aterArmed, null);
    eq(aterState, null);
    armAter("cross", 1);
    eq(aterArmed, "cross");
    eq(aterState.tier, 1);
  });

  test("graft-completed lines are suppressed but still score", () => {
    startEndless();
    clearSin();
    setBoard(["O", "X", "X", "", "", "", "", "", ""]);
    grant("swap");
    armAter("swap");
    applyAterAt(0);
    stop();
    eq(board[0], "X");
    eq(blockedLines.size, 1);
    eq(gameOver, false);
    eq(turn, "O");
    ok(run.score > 0, "swap scored");
    eq(powerState("swap").cooldown, 3);
  });

  test("a duplicate Ater refreshes cooldown and adds a copy", () => {
    startEndless();
    clearSin();
    setBoard(Array(9).fill(""));
    grant("cut");
    const p = powerState("cut");
    p.cooldown = 2;
    p.copies = 1;
    grant("cut");
    eq(p.cooldown, 0);
    eq(p.copies, 2);
    eq(powerState("cut"), p);
  });

  test("Recuperate cuts other cooldowns and skips itself", () => {
    startEndless();
    clearSin();
    setBoard(Array(9).fill(""));
    ["cross", "cut", "swap", "erasure", "recuperate"].forEach(grant);
    powerState("cross").cooldown = 5;
    powerState("cut").cooldown = 2;
    powerState("swap").cooldown = 0;
    powerState("erasure").cooldown = 1;
    powerState("recuperate").cooldown = 0;
    const beforeTurn = turn;
    useRecuperate();
    eq(powerState("cross").cooldown, 4);
    eq(powerState("cut").cooldown, 1);
    eq(powerState("swap").cooldown, 0);
    eq(powerState("erasure").cooldown, 0);
    eq(powerState("recuperate").cooldown, 3);
    eq(turn, beforeTurn);
    eq(aterArmed, null);
  });

  test("Recuperate restores dormant cancerous grafts", () => {
    startEndless();
    clearSin();
    setBoard(Array(9).fill(""));
    grant("observation");
    grant("recuperate");
    const obs = powerState("observation");
    obs.active = false;
    obs.remaining = 0;
    const copies = obs.copies;
    useRecuperate();
    eq(obs.active, true);
    eq(obs.remaining, 3);
    eq(obs.copies, copies);
  });

  test("the collection splits Aters and Plussers and shows empty state", () => {
    startEndless();
    clearSin();
    setBoard(Array(9).fill(""));
    render();
    eq(document.querySelectorAll(".slot-card").length, 0);
    eq(powerEmpty.hidden, false);
    contains(powerEmpty.textContent, "No grafts yet");

    grant("cross");
    grant("cut");
    grant("observation");
    grant("binary");
    render();
    eq(document.querySelectorAll(".slot-card").length, 4);
    eq(document.querySelectorAll("#powerGridRight .slot-card").length, 2);
    eq(document.querySelectorAll("#powerGridLeft .slot-card").length, 2);
    eq(cardFor("cross").querySelectorAll(".tier-btn").length, 4);
    ok(cardFor("cross").querySelector("button.slot-icon"), "Ater is clickable");
    ok(cardFor("observation").querySelector("div.slot-icon"), "Plusser is display-only");
    eq(cardFor("cut").querySelector(".copy-badge").textContent, "×1");
    eq(cardFor("observation").querySelector(".copy-badge"), null);
    eq(powerEmpty.hidden, true);
    contains(powerMeta.textContent, "next graft at round 3");
  });

  test("tooltips show cooldown, copies, and Cross guidance", () => {
    startEndless();
    clearSin();
    setBoard(Array(9).fill(""));
    grant("cut");
    grant("cross");
    powerState("cut").cooldown = 2;
    powerState("cut").copies = 3;
    fillPowerTip(POWER_BY_ID.cut);
    contains(powerTip.textContent, "Cooling");
    contains(powerTip.textContent, "2 rounds left");
    contains(powerTip.textContent, "3 copies");
    fillPowerTip(POWER_BY_ID.cross);
    contains(powerTip.textContent, "Pick a plus tier below to arm it.");
  });

  test("Cross is armed from a tier button, not its icon", () => {
    startEndless();
    clearSin();
    setBoard(Array(9).fill(""));
    grant("cross");
    render();
    const card = cardFor("cross");
    card.querySelector(".slot-icon").click();
    eq(aterArmed, null);
    card.querySelector('button.tier-btn[data-tier="1"]').click();
    eq(aterArmed, "cross");
    eq(aterState.tier, 1);
  });

  /* ---------- dev tools ---------- */

  test("dev tools list every graft and the current Story chapters", () => {
    startStory("hard");
    openDevTools();
    eq(document.getElementById("devToolsModal").hidden, false);
    eq(document.querySelectorAll("#devGraftSelect option").length, 9);
    eq(document.querySelectorAll("#devRoundSelect option").length, 8);
    eq(document.getElementById("devRoundEndless").style.display, "none");
    eq(document.getElementById("devRoundStory").style.display, "block");
    eq(document.getElementById("devRoundInput").value, "1");
    eq(document.getElementById("devRoundSelect").value, "0");
    document.getElementById("devCloseX").click();
    eq(document.getElementById("devToolsModal").hidden, true);
  });

  test("dev Story chapter selector jumps to a sin or Nought", () => {
    startStory("hard");
    const order = sinOrder.map((sin) => sin.id);
    devSetStoryChapter(2);
    eq(storySinIndex, 2);
    eq(currentSin.id, order[2]);
    eq(storyDefeated.join(","), order.slice(0, 2).join(","));
    eq(sinRound, 0);
    eq(awaitingNext, false);

    devSetStoryChapter(sinOrder.length);
    eq(isNoughtRound(), true);
    eq(noughtDamageTarget, 200);
    eq(noughtScars.length, 21);
  });

  test("dev Endless round selector sets round, board, and clears transitions", () => {
    startEndless();
    devSetEndlessRound(10);
    eq(run.round, 10);
    eq(run.completed, 9);
    eq(run.boardSize, 5);
    eq(board.length, 25);
    eq(awaitingNext, false);
    contains(powerMeta.textContent, "Round 10");

    devSetEndlessRound(1);
    eq(run.round, 1);
    eq(run.completed, 0);
    eq(run.boardSize, 3);
    eq(board.length, 9);
  });

  test("dev skip completes the round and then advances", () => {
    startEndless();
    devSkipRound();
    eq(run.completed, 1);
    eq(result, "draw");
    eq(awaitingNext, true);
    contains(statusEl.textContent, "Draw · Next: ");

    devSkipRound();
    eq(awaitingNext, false);
    eq(run.round, 2);
  });

  test("dev graft add and remove update the run and collection", () => {
    startEndless();
    clearSin();
    setBoard(Array(9).fill(""));
    openDevTools();
    const select = document.getElementById("devGraftSelect");
    select.value = "cross";
    document.getElementById("devGraftAdd").click();
    eq(!!powerState("cross"), true);
    ok(cardFor("cross"), "Cross card rendered");
    document.getElementById("devGraftRemove").click();
    eq(powerState("cross"), null);
    eq(cardFor("cross"), null);
  });

  test("clearing the ledger uses the in-game confirm modal", () => {
    leaderboard = [{ id: "lb1", name: "A", score: 10, round: 1, boardSize: 3, level: 1, date: "" }];
    saveLeaderboard();
    renderLeaderboard();
    let nativeCalls = 0;
    const originalConfirm = window.confirm;
    window.confirm = () => { nativeCalls += 1; return true; };
    try {
      clearLeaderboardBtn.click();
      eq(document.getElementById("confirmModal").hidden, false);
      eq(document.getElementById("confirmTitle").textContent, "Clear the ledger?");
      eq(nativeCalls, 0);
      document.getElementById("confirmNo").click();
      eq(document.getElementById("confirmModal").hidden, true);
      eq(leaderboard.length, 1);

      clearLeaderboardBtn.click();
      document.getElementById("confirmYes").click();
      eq(document.getElementById("confirmModal").hidden, true);
      eq(leaderboard.length, 0);
      eq(JSON.parse(localStorage.getItem(LEADERBOARD_KEY)).length, 0);
    } finally {
      window.confirm = originalConfirm;
    }
    leaderboard = [];
    saveLeaderboard();
    renderLeaderboard();
  });

  test("full reset asks first and can be cancelled", () => {
    startEndless();
    openDevTools();
    document.getElementById("devReset").click();
    eq(document.getElementById("confirmModal").hidden, false);
    eq(document.getElementById("confirmTitle").textContent, "Full reset?");
    document.getElementById("confirmNo").click();
    eq(document.getElementById("confirmModal").hidden, true);
  });

  test("the dev log toggle shows and hides recorded entries", () => {
    startEndless();
    devLogPush("TEST LOG ENTRY");
    openDevTools();
    const toggle = document.getElementById("devToggleLog");
    const panel = document.getElementById("devLogPanel");
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
    eq(panel.style.display, "block");
    contains(panel.textContent, "TEST LOG ENTRY");
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
    eq(panel.style.display, "none");
  });

  test("the Options dev-tools toggle persists and hides the button", () => {
    openOptions();
    eq(screen, "options");
    const toggle = document.getElementById("devToolsToggle");
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
    eq(devToolsBtn.style.display, "none");
    eq(localStorage.getItem("ttn-devtools-v1"), "0");
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
    eq(devToolsBtn.style.display, "inline-block");
    eq(localStorage.getItem("ttn-devtools-v1"), "1");
    optionsBackBtn.click();
    eq(screen, "game");
  });

  test("the Options gear does not trap Back on Options", () => {
    startEndless();
    openOptions();
    eq(screen, "options");
    document.getElementById("optionsTopBtn").click();
    eq(screen, "options");
    optionsBackBtn.click();
    eq(screen, "game");
  });

  /* ---------- persistence ---------- */

  test("saving stores the 0.3 run, snapshot, and Story difficulty", () => {
    startStory("hard");
    setBoard(["X", "", "", "", "O", "", "", "", ""]);
    run.score = 99;
    run.xp = 7;
    run.level = 2;
    grant("cut");
    powerState("cut").cooldown = 2;
    powerState("cut").copies = 3;
    saveState();

    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    eq(data.mode, "story");
    eq(data.screen, "game");
    eq(data.run.storyDifficulty, "hard");
    eq(data.run.level, 2);
    eq(data.run.powers.cut.cooldown, 2);
    eq(data.run.powers.cut.copies, 3);
    eq(data.run.sinOrder.length, 7);
    eq(data.endless.board[0], "X");
    eq(data.endless.storyDifficulty, "hard");

    mode = "endless";
    screen = "menu";
    run = createRun();
    sinOrder = [];
    storyDifficulty = null;
    loadState();
    eq(mode, "story");
    eq(screen, "game");
    eq(run.score, 99);
    eq(run.level, 2);
    eq(storyDifficulty, "hard");
    eq(sinOrder.length, 7);
    ok(run.snapshot, "snapshot loaded");
    eq(run.snapshot.board[0], "X");
    eq(run.snapshot.storyDifficulty, "hard");

    applySnapshot(run.snapshot);
    stop();
    eq(board[0], "X");
    eq(board[4], "O");
    eq(storyDifficulty, "hard");
  });

  test("snapshots round-trip board, sin, scars, and difficulty", () => {
    startStory("hard");
    setBoard(["X", "", "", "", "O", "", "", "", ""]);
    sinRound = 1;
    noughtDamage = 0;
    awaitingNext = false;
    pendingGrowth = false;
    const snapshot = captureSnapshot();
    const ids = snapshot.sinOrder.join(",");
    const sinId = snapshot.currentSin.id;

    board = Array(9).fill("");
    currentSin = null;
    sinOrder = [];
    storyDifficulty = "easy";
    applySnapshot(snapshot);
    stop();
    eq(board[0], "X");
    eq(board[4], "O");
    eq(sinOrder.map((sin) => sin.id).join(","), ids);
    eq(currentSin.id, sinId);
    eq(storyDifficulty, "hard");
    eq(sinRound, 1);
    eq(run.snapshotMode, "story");
  });

  test("Story continue only resumes the same difficulty", () => {
    startStory("hard");
    setBoard(["X", "", "", "", "", "", "", "", ""]);
    run.score = 42;
    saveState();
    toMenu();

    storyDifficulty = "hard";
    startMode("story");
    eq(document.getElementById("continueModal").hidden, false);
    document.getElementById("continueYes").click();
    eq(document.getElementById("continueModal").hidden, true);
    eq(screen, "game");
    eq(board[0], "X");
    eq(storyDifficulty, "hard");

    toMenu();
    storyDifficulty = "easy";
    startMode("story");
    eq(document.getElementById("continueModal").hidden, true);
    eq(mode, "story");
    eq(storyDifficulty, "easy");
    eq(sinOrder.length, 3);
  });

  test("legacy charge saves migrate to owned Aters with copies", () => {
    const out = normalizePowers({
      cross: { charges: 2, dormant: 1 },
      cut: { charges: 1, dormant: 0 },
      observation: { active: true, remaining: 3 }
    });
    eq(out.cross.cooldown, 0);
    eq(out.cross.copies, 3);
    eq(out.cut.copies, 1);
    eq(out.observation.copies, 1);
  });

  /* ---------- presentation + sound ---------- */

  test("eruption infects the board and round 3 adds a second conduit", () => {
    startSin("pride", 1);
    eq(erupted, true);
    eq(eruptedSession, true);
    ok(boardEl.classList.contains("infected"));
    ok(boardEl.classList.contains("sin-pride"));
    sinRound = 2;
    renderBoard();
    ok(boardEl.classList.contains("conduit-2"));
  });

  test("the browser can decode the shipped OGG Vorbis clips", () => {
    const probe = document.createElement("audio");
    const support = probe.canPlayType('audio/ogg; codecs="vorbis"');
    ok(support === "probably" || support === "maybe", "OGG support: " + support);
    for (const band of SOUND_BANDS) {
      for (const id of DEFAULT_SOUND_BANDS[band]) {
        ok(SOUND_BY_ID[id].file.endsWith(".ogg"), id + " points at an OGG");
      }
    }
  });

  test("sound manifest has both CC0 libraries and valid defaults", () => {
    eq(SOUND_MANIFEST.length, 113);
    eq(SOUND_MANIFEST.filter((c) => c.pack === "Kenney").length, 100);
    eq(SOUND_MANIFEST.filter((c) => c.pack === "WobbleBoxx").length, 13);
    for (const band of SOUND_BANDS) {
      for (const id of DEFAULT_SOUND_BANDS[band]) {
        ok(SOUND_BY_ID[id], band + " default " + id);
      }
    }
    eq(DEFAULT_SOUND_BANDS.top[0], "wobbleboxx/Rise03");
  });

  test("sound selection, volume, and mute persist", () => {
    const savedBands = cloneSoundBands(soundSettings.bands);
    const savedVolume = soundSettings.volume;
    const savedMuted = soundSettings.muted;
    soundSettings.bands = cloneSoundBands(DEFAULT_SOUND_BANDS);
    openOptions();

    const select = soundBandsEl.querySelector('select[data-band="low"]');
    select.value = "wobbleboxx/Coin01";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    eq(soundSettings.bands.low[0], "wobbleboxx/Coin01");
    eq(JSON.parse(localStorage.getItem("ttn-sound-v1")).bands.low[0], "wobbleboxx/Coin01");

    volumeInput.value = "30";
    volumeInput.dispatchEvent(new Event("input", { bubbles: true }));
    eq(soundSettings.volume, 30);
    eq(JSON.parse(localStorage.getItem("ttn-sound-v1")).volume, 30);

    muteInput.checked = true;
    muteInput.dispatchEvent(new Event("change", { bubbles: true }));
    eq(soundSettings.muted, true);
    eq(JSON.parse(localStorage.getItem("ttn-sound-v1")).muted, true);

    soundSettings.bands = savedBands;
    soundSettings.volume = savedVolume;
    soundSettings.muted = savedMuted;
    saveSoundSettings();
    showScreen("game");
  });

  /* ---------- results ---------- */

  window.__testResults = results;
  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  const wrap = document.createElement("div");
  wrap.id = "testResults";
  wrap.style.cssText = "position:fixed;inset:0;z-index:100000;overflow:auto;background:#0f0c0b;color:#f3ece8;font:13px/1.5 ui-monospace,monospace;padding:22px 26px;";
  const head = document.createElement("h1");
  head.style.cssText = "margin:0 0 10px;font-size:18px;color:" + (failed ? "#ff6b5b" : "#7bd88f");
  head.textContent = passed + "/" + results.length + " passed" + (failed ? " · " + failed + " failed" : "");
  wrap.appendChild(head);
  results.forEach((r) => {
    const row = document.createElement("div");
    row.style.cssText = "padding:4px 0;border-bottom:1px solid #2a2320;color:" + (r.pass ? "#cfe9d3" : "#ff9b8d");
    row.textContent = (r.pass ? "PASS  " : "FAIL  ") + r.name + (r.detail ? "  —  " + r.detail : "");
    wrap.appendChild(row);
  });
  if (window.__errors && window.__errors.length) {
    const err = document.createElement("pre");
    err.style.cssText = "margin-top:14px;color:#ff9b8d;white-space:pre-wrap;";
    err.textContent = "Runtime errors:\n" + window.__errors.join("\n");
    wrap.appendChild(err);
  }
  document.body.appendChild(wrap);
})();
