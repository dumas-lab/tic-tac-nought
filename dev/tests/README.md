# Dev tests

Everything here is a local harness. It never ships with the game.

## Run everything

```bash
cd dev/tests
./run.sh
```

`run.sh` regenerates the pages and, if Firefox is installed, captures screenshots
into `dev/tests/.build/`.

You can also build the pages only:

```bash
python3 make-tests.py
python3 make-boot.py
python3 make-layout.py
python3 make-visual.py
```

Then open a page directly:

- `dev/tests/.build/tests.html` — logic and interaction suite
- `dev/tests/.build/boot-resume.html` — reload with a run waiting behind the menu
- `dev/tests/.build/boot-menu.html` — reload back to the menu
- `dev/tests/.build/boot-options.html` — reload back to the menu from Options
- `dev/tests/.build/boot-story.html` — reload a saved Story run and resume it
- `dev/tests/.build/boot-over.html` — reload a finished run
- `dev/tests/.build/layout.html?view=game|menu|options` — layout bounds
- `dev/tests/.build/layout-frame.html?view=game&w=320&h=780` — the same
  layout checks inside a narrow iframe (Firefox cannot shrink an interactive
  window below 500 px wide)
- `dev/tests/.build/visual.html?view=game|cooling|armed|tip|over|vs|story|nought|options|menu`

The generated pages use `<base href="../../../">`, so `assets/sounds/` resolves
from the project root even while the page sits in `.build/`.

## What is covered

**Logic (`test-body.js`)**

- Boot lands on the menu; the Book of Decay lists nine grafts and seven sins
- Menu starts Story (3/5/7 sins), Endless (seven sins), and VS
- Story chapters: three rounds per sin, growth after round three, Won/Held/Game Over
- Story Nought: 200 damage, every scar, victory and difficulty completion
- Nought full-board clear, scar order, and round-1 scar strength
- Endless growth at 3, 9, 15…, loot every three rounds, boost refresh and spend
- Endless Nought at 21 rounds, scaling targets, and the next cycle
- Score runs, live score, XP curve, run HUD, boost pips
- VS scoreboard, X/O/draw tracking, round advance, reset, Observation/Chaos
- Rarity pools, Ater arming, cooldowns, duplicates, Cross tiers
- Ater line suppression, Recuperate, Plusser restoration
- Collection slots, cooldown/copy badges, tooltips, empty state
- Dev tools: graft list, Story/Endless jump selectors, skip, reset, log
- In-game confirm modals instead of native `confirm()`
- Save/load, snapshots, Story difficulty resume, legacy charge migration
- Eruption visuals, OGG support, sound manifest, picker persistence

**Boot (`make-boot.py`)**

- Boot always lands on the menu; a saved run waits behind it
- The menu reports an in-progress or finished run
- Options opens on the menu, not the Options screen
- A saved Story run resumes only after choosing Story and Continue

**Layout (`layout-body.js`)**

- No horizontal overflow
- Three-column game layout on desktop: left grafts, center board, right grafts
- Single-column layout at 760 px and below, with the center column first
- Board, HUD, game top, graft cards, and Cross tiers stay inside their bounds
- Menu card, damage ledger, menu buttons, Options panel, and sound rows fit
- The 390 px and 320 px checks run in an iframe because Firefox's interactive
  window has a 500 px minimum width

## Adding sounds

The picker reads `assets/sounds/manifest.js`. To add a clip:

1. Drop the OGG in `assets/sounds/kenney/` or `assets/sounds/wobbleboxx/`.
2. Add an entry to `window.SOUND_MANIFEST` with `id`, `name`, `pack`, and `file`.
3. Keep the clip CC0 (or update `assets/sounds/CREDITS.txt` if the license differs).

The default layers live in `DEFAULT_SOUND_BANDS` inside `index.html`.
