# Tic Tac Nought

**Pre-alpha 0.3 — The Body** — a tic-tac-toe roguelite about the thing that kept O.

Play in the browser: **https://dumas-lab.github.io/tic-tac-nought/**

Desktop builds are unsigned pre-alpha releases for Linux and Windows. There is
no macOS build. The web version installs as a PWA and works offline after the
first visit.

## Play

- **Browser / PWA** — open the GitHub Pages link above. In a Chromium-based
  browser you can install it from the address bar or the browser menu.
- **Linux** — download the AppImage or `.deb` from
  [Releases](https://github.com/dumas-lab/tic-tac-nought/releases).
  The AppImage needs `chmod +x`; the `.deb` installs with your package manager.
- **Windows** — download the portable `.exe` (no install) or the NSIS
  `-setup.exe` from Releases.

The builds are not code-signed. Windows SmartScreen and some Linux desktops
will warn about an unknown publisher; that is expected for this pre-alpha.
Check the published `SHA256SUMS` file if you want to verify a download.

Updates are manual: download a newer release and replace the old copy. Saves
live in the app's local storage and survive replacing the program files.

## Modes

The game opens on a menu:

- **Story** — a finite body. Pick Easy (3 sins), Medium (5), or Hard (7), fight through each sin's three rounds, then face **Nought** itself.
- **Endless** — all seven sins in random order, then a beatable Nought fragment, then repeat on a larger board.
- **VS** — two-player tic-tac-toe. Grafts and progression stay in; the run HUD is labelled **Score** and the X/O/draw scoreboard is visible.
- **Options** — volume, mute, dev-tools toggle, save export/import, and the layered score-sound picker.

Leaving a run with **Menu** does not end it. Reloading the page returns to the menu; starting the same mode again offers to continue an in-progress Story or Endless run.

## Core rules

- The board starts 3×3 and grows by one row and column after every six completed rounds (the first growth lands after round 3).
- Score is live from the first move. Runs of 3+ X score 10/20/30… times the board multiplier.
- A win refreshes a 100× boost for 5 rounds; each draw consumes one.
- Every 3 completed rounds grants a random graft.
- Level/XP is a separate chase and unlocks nothing yet.

### Dead lines (Story)

- X lines, normal or graft-made, are dead lines: they deal damage and play continues.
- Only O closing a line ends the run.
- A full board is **held** and the next round begins.
- In the Nought round every point of damage wounds Nought. A full board clears every non-center square and the fight continues.
- O closing a line during the Nought round still ends the run.

## The seven sins

Each sin is a three-round chapter. Sins are shuffled per run; the count depends on difficulty. When a sin dies, its line is banked for the Nought round and a graft drops.

| Sin | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| **Pride** | O starts in the center | O extends its longest line when yours is longer | O places a second O when it has fewer marks |
| **Greed** | An empty strip appears after your 3rd move | A strip arrives with an O in it | After your 1st move, a row and column each get an O |
| **Lust** | O mirrors your first move | Every move marks its mirror as wanted | Taking a wanted square next to X turns that X into O |
| **Envy** | Your first scoring placement deals no damage | All damage is halved | A used tech graft is copied in O |
| **Gluttony** | One empty square is eaten at the start | O eats the end of your longest line once | O eats the end of your longest line every turn |
| **Wrath** | Your first damage slams an O into a random square | Every scoring placement drops an O in that row | Completing a line turns it into O — instant loss |
| **Sloth** | Your first mark does not block for one O turn | Your first two marks are late | Every mark is late for one O turn |

### Nought round (scars)

- Defeated sins become scars. They speak one at a time, cycling all round-1 scars, then round-2, then round-3.
- While a scar is active, its sin's cheat is on the board and its taunt is in the status line, alongside Nought's damage-based confession.
- The Nought fragment has a damage target: 200 in Story, `100 + 50 × cycle` in Endless.
- Salvage (one sin ability carried into the Nought round) is on hold and documented in the Wishlist.

## Grafts

Nine grafts, two families.

**Cancerous grafts (+)** — passive:

- **Observation** — 3 rounds: preview Nought's likely reply by hovering an empty cell.
- **Binary** — permanent: +1 score per adjacent X on placement. Stacks.
- **Chaos** — 2 rounds: Nought's placement is randomised; winning while active puts it to sleep.
- **Recount** — restores all dormant cancerous grafts once, then goes dormant.
- **Recuperate** — restores all dormant cancerous grafts, cuts other tech-graft cooldowns by 1, then cools for 3 rounds.

**Technological grafts (@)** — active (arm, then place):

- **Cross** — choose a plus tier (3×3 / 5×5 / 7×7 / 9×9). Cools 5 rounds flat. A line it completes is suppressed; points still count.
- **Cut** — place two X in one turn; the second cannot share a row with the first. Cools 3 rounds.
- **Swap** — turn one O into X. Cools 3 rounds.
- **Erasure** — clear a row of O and place an X; each O cleared gives 100 points. Cools 3 rounds.

Grafts are owned once. Duplicate drops refresh the cooldown and add a copy. Graft-completed lines are dead lines and cannot win.

## Eruption

The board erupts the first time a sin cheats. Once per visit:

- Gaps widen and the dull-olive membrane shows.
- A plate lip with fasteners grows along one edge.
- A conduit runs along one side; round-3 sins grow a second conduit.
- X keeps a soft tissue edge; O keeps hard plating.
- Reduced-motion mode skips the draw animation.

## UI

- Menu: basic and erupted forms, damage ledger, Story difficulty picker.
- In-game: cancerous grafts on the left, board and run HUD in the center, technological grafts on the right.
- Run HUD: **Damage** in Story/Endless, **Score** in VS, plus XP, round, board size, and boost pips.
- Status line: current sin, Nought damage, scar taunt and confession, Won/Draw/Held/Game Over.
- **Book of Decay**: graft list plus the seven sins and their three-round escalation.
- **Dev tools**: skip round, full reset, round/chapter selector, graft add/remove, log toggle, dev log.
- **Wishlist**: dev notes saved to localStorage and downloadable.
- **Damage ledger**: auto-logs Endless runs on loss and shows Story progress.

## Persistence and save transfer

State is saved to localStorage under `ttn-state-v2`. Story and Endless capture a
board snapshot so a run can resume. The boot always lands on the menu; the run is
preserved behind it.

Storage keys are namespaced to the game:

| Key | Contents |
| --- | --- |
| `ttn-state-v2` | Run, mode, screen, name, progress, snapshot |
| `ttn-leaderboard-v1` | Damage ledger |
| `ttn-sound-v1` | Volume, mute, sound bands |
| `ttn-devtools-v1` | Dev-tools toggle |
| `ttn-wishlist-v1` | Wishlist text |

Builds migrated from the old test name automatically copy `ttt-*` keys to the
matching `ttn-*` keys on first load. Existing `ttn-*` values always win.

**Options → Export save** downloads a JSON file with the run, ledger, and sound
settings. **Import save** validates the file, asks for confirmation in an
in-game modal, then replaces the current save and reloads. The same file works
across the web/PWA and desktop builds.

## Layout

```
index.html                  game, styles, and logic
assets/sounds/manifest.js   sound library for the picker
assets/sounds/kenney/       100 CC0 interface clips
assets/sounds/wobbleboxx/   13 CC0 level-up/coin clips
assets/sounds/CREDITS.txt   licenses and default layering
web/manifest.json           PWA manifest
web/pwa.js                  service-worker registration
web/sw.template.js          service-worker template
web/icons/                  generated PWA and Electron icons
electron/main.cjs           hardened Electron wrapper (`app://` origin)
scripts/build-web.mjs       copies the game into dist/web + CSP + sw.js
scripts/test-electron.mjs   Electron smoke and restart-persistence test
scripts/test-pwa.mjs        PWA, offline, export/import, migration test
electron-builder.yml        AppImage, .deb, portable exe, NSIS config
dev/tests/                  local test harness (never ships)
```

`dist/` is generated and ignored by git.

## Sound

All audio is CC0 / public domain, by Kenney and WobbleBoxx. No generated audio.
The default layering is:

| Points | Layers |
| --- | --- |
| 1–9 | Tick 001 |
| 10–99 | + Pluck 001 |
| 100–999 | + Confirmation 001 |
| 1,000+ | + Rise 03 |

Every band and slot in **Options** can use any clip from either library, or None.

## Build

Requirements: Node 22.12 or newer, plus the usual Electron build tools on the
host OS. The project pins Electron 45, electron-builder 26, and Playwright 1.64.

```bash
npm install
npm run build:web        # dist/web, CSP, service worker
npm start                # build and launch Electron
npm run test:pwa         # headless Chromium PWA/offline/export/import test
npm run test:electron    # Electron smoke test
```

Linux packages (AppImage and `.deb`) build on Linux:

```bash
npm run dist:linux
```

Windows portable and NSIS installers build on Windows:

```bash
npm run dist:win
```

Both write to `dist/desktop/`. `npm run checksums` writes `SHA256SUMS` for the
files in that folder. Release builds are produced by GitHub Actions on native
Ubuntu and Windows runners; no cross-compiling is involved.

On Arch-based hosts, install `libxcrypt-compat` if the `.deb` step reports a
missing `libcrypt.so.1`. GitHub's Ubuntu runners already have it.

## Dev tests

```bash
cd dev/tests
./run.sh
```

This rebuilds the logic, boot, layout, and visual pages and captures screenshots
into `dev/tests/.build/`. See `dev/tests/README.md` for what each suite covers.

## License

No license has been added yet. The source is public for play, testing, and
review; all rights are reserved by the author.
