# Tic Tac Nought — Changelog

## 0.3 "The Body" (current build)

### Distribution and packaging
- Public name: **Tic Tac Nought**. In-game Nought, the entity, is unchanged.
- Web/PWA at `https://dumas-lab.github.io/tic-tac-nought/`, installable and
  offline after the first visit.
- Unsigned Electron builds: Linux AppImage and `.deb`, Windows portable `.exe`
  and NSIS `-setup.exe`. No macOS build.
- Stable `app://tic-tac-nought` origin in Electron so localStorage survives
  restarts and app updates.
- GitHub Actions builds Linux and Windows artifacts on native runners and
  attaches them to a GitHub Release with a `SHA256SUMS` file.
- No code signing and no auto-update. Updates are manual.
- Save keys namespaced to `ttn-*`; first load copies legacy `ttt-*` keys.
- Options can export and import a JSON save (run, damage ledger, sound
  settings) with an in-game confirmation before replacing anything.

### Lore & theme
- Title: **Pre-alpha 0.3 — The Body**.
- Computer mode replaced by **Story mode**; score = damage dealt.
- The seven sins are **previous victims of Nought** manifesting as the worst of humanity (not a religion).
- **Nought** is the final boss and the voice. First line: *"You wanted X and O. I kept O."*
- **Plussers → cancerous grafts (+)**, **Aters → technological grafts (@)**. Both were attached to Nought.
- X and O stay letters. Eruption adds membrane (bio) + plate lip (tech); X soft edge, O hard edge. No religious iconography.
- Guide and patch notes fully reskinned to biomechanical terms.

### Modes
- **Endless**: damage with no end. All seven sins in random order, then a beatable Nought fragment, then repeat on a larger board.
- **Story**: finite body. Easy = 3 sins, Medium = 5, Hard = 7, then Nought. Difficulty picker on Story click.
- **VS**: two-player. Grafts and progression stay; score stays score.

### Core mechanics
- Board starts 3×3 (3 rounds), then +1 size every 6 rounds. Loss ends run.
- Score live from the first move: X runs of 3+ score 10/20/30… × multiplier. Win refreshes 100× boost 5 rounds; draw consumes one.
- Every 3 completed rounds grants a random graft (power-up).
- Level/XP is a separate chase; unlocks nothing yet.

### Dead-line rule (Story only)
- X lines (normal or graft) are dead lines: deal damage, play continues.
- Only O closing a line ends the run. Full board = held (draw → next round).
- Final Nought round: every point of damage wounds Nought. Full board clears non-center squares and continues.

### Grafts (power-ups)
Nine grafts, two families:

**Cancerous grafts (+)** — passive:
- Observation — 3 rounds: hover an empty cell to preview the computer's likely reply.
- Binary — permanent: +1 score per adjacent X on placement. Stacks.
- Chaos — 2 rounds: O placement randomised; win while active → dormant.
- Recount — restores all dormant cancerous grafts once, then goes dormant.

**Technological grafts (@)** — active (arm then place):
- Cross — arm, choose a plus tier (3×3/5×5/7×7/9×9). Cools 5 rounds (flat). Completed line suppressed; points count.
- Cut — arm, place two X in one turn (second can't share a row). Cools 3 rounds.
- Swap — arm, turn one O into X. Cools 3 rounds.
- Erasure — arm, clear a row of O and place X. 100 points per O cleared. Cools 3 rounds.
- Recuperate — restores all dormant cancerous grafts; cuts every other tech graft's cooling by 1; skips itself; cools 3 rounds.

Grafts: own-once, cooldown on use, duplicate drops refresh cooldown and add copy.

### Seven sins (Story chapters)
Each sin is one chapter of **3 rounds**, escalating (round 1 nuisance → round 2 teeth → round 3 baitable). Sins shuffled per run; count by difficulty. When a sin dies, one line banked for last round; loot drops.

| Sin | Taunt | Round 1 | Round 2 | Round 3 |
|---|---|---|---|---|
| Pride | "You never had the center. I lent it to you." | O starts in center | If your longest line > its, extends its own | Each turn, if you have more marks, places a second O |
| Greed | "I added a row. You stayed. That was the meal." | After 3rd move, one empty strip | Strip arrives with O in it | After 1st move, row + column, each with O |
| Lust | "That piece wanted to be mine. You moved it closer." | Mirrors first move | Every move marks mirror as wanted; must take wanted if empty | Taking wanted square next to X turns that X into O |
| Envy | "Your damage looked better on me." | First scoring placement deals no damage | All damage halved | If tech graft used, copies shape in O |
| Gluttony | "I ate the line. You made another. Sweet." | One empty square eaten at start | On first turn, eats end of longest line | Every turn eats end of longest line (damage stays) |
| Wrath | "You tried to finish. I put mouths in the finish." | First damage → O slams random empty square | Every scoring placement drops O in that row | Completing winning shape fills dead line with O |
| Sloth | "You were one move late. I am never late." | First X doesn't block until after its next move | First two marks late | Every mark late by one of its moves |

### Nought round (scars)
- Sins you killed speak one at a time at round-1 strength. While a sin speaks, its nuisance cheat is on the board and its banked line is the taunt. Nought also quotes a damage-based confession.
- Cycle: all 1st-round scars, then 2nd-round, then 3rd-round.
- Every point of damage in the round wounds Nought. Full board clears non-center squares and continues. O line kills.
- Salvage (on hold, documented in Wishlist): one sin ability you keep.

### Eruption
- Triggers on first sin cheat (not run start). Once per visit.
- Gaps widen; membrane shows (dull olive = cancer). One edge grows plate lip + fastener (tech). Conduit draws along one side, stops.
- X and O stay letters; coral and blue stay. X soft edge, O hard edge.
- Sin tell on open table. Round 3 adds second conduit.
- Reduced motion: crossfades, skips the draw. No eruption sound until a real clip.

### Endless
- Starts clean, erupts on first cheat. All 7 sins randomised, then Nought fragment (beatable), then repeat with board scaling.

### UI / layout
- Menu: two forms (basic/erupted). Damage ledger (leaderboard) on left side of menu. Difficulty picker on Story click.
- In-game: cancerous grafts (left) + board + damage/lvl (center) + technological grafts (right). Buttons pinned above grafts panels.
- Run HUD: score caption "Damage" (Story/Endless) or "Score" (VS), XP bar, round, board size, boost pips.
- Book of Decay: pop-up modal with graft list + sins list.
- Dev tools: pop-up with skip round, full reset, round selector, graft add/remove, log toggle, dev log.
- Wishlist: dev notes saved to localStorage, downloadable.
- Leaderboard: auto-log Endless runs on loss. Story progress (Beaten/—). Menu only.
- Status line: current sin, Nought damage, Won/Draw/Held/Game Over.

### Persistence
- Save state to localStorage (`ttn-state-v2`): run, mode, screen, playerName, rarityWeights, sin state, storyProgress, etc.
- Snapshot captured for Endless and Story (resume on return).
- Boot always lands on menu (run state preserved for resume).
- Leaderboard (`ttn-leaderboard-v1`): auto-log on loss.

### Dev tools
- Toggle in Options (slider) controls Dev tools button visibility.
- Dev tools modal: Skip round, Full reset (reload), round selector, graft add/remove, log toggle, dev log.
- SIN IS WORKING indicator + dev log panel (top-left).
- Wishlist with salvage explanation.

### Known issues / disparities / redundant code
1. Sin mechanics are simplified: Greed's strip, Lust's mirror, etc. are approximated, not exact per spec.
2. Nought round scars: only one scar's start effect applied (random), not sequential cycling of all defeated sins.
3. Salvage: on hold (documented in Wishlist only).
4. Redundant code: `sinRound` (unused), `CROSS_COOLDOWNS` (unused, Cross cooldown flat 5), `ensureErupted` (unused), `normalXWin` (unused in Story), `renderHistory` (no-op), `saveCurrentRun` (unused), `openLeaderboard` (still defined).
5. Fragile state: `sinOrder` not in snapshot; guards in `startBoardForRun`.
6. VS mode: newly added, lightly tested. Grafts work but scoring is X/O/draws (round wins).
7. No tests for new features: test harness is 0.2-era.
8. `triggerGreedStrip` adds random O cells instead of actual strips.
9. `eatLongestXEnd` sets eaten cells but doesn't update `moves`.
10. Scars only one applied, not sequential.

### Vocabulary (old → 0.3)
| Old | New |
|---|---|
| Plussers | cancerous grafts (+) |
| Aters | technological grafts (@) |
| Computer mode | Story mode |
| Collection | Grafts |
| A drop | a graft tore loose |
| Cooldown | cooling |
| Copies | ×N |
| Dormant | dormant |
| Armed | armed |
| Score (Story/Endless) | Damage |
| Score (VS) | Score |
| Win that doesn't count | dead line |
| Loss | O closes the line |
| Leaderboard | Damage ledger |
| Power-up guide | Book of Decay |

Power names unchanged (Cross, Cut, Swap, Erasure, Recuperate, Observation, Binary, Chaos, Recount). Observation stays Observation. Nought stays Nought.

### Files
- `index.html` — game, styles, and logic.
- `electron/main.cjs` — hardened Electron wrapper and `app://` protocol.
- `scripts/build-web.mjs` — web/PWA build, CSP, and service worker.
- `web/` — manifest, PWA registration, service-worker template, icons.
- `electron-builder.yml` — Linux and Windows packaging targets.
- `dev/tests/` — local test harness (logic, boot, layout, visual).
- `CHANGELOG.md` — this file, the behavior spec.
