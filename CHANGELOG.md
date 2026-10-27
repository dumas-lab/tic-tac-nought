# Tic Tac Nought — Changelog

## 0.3.3 "The Carved Body" — Visual engine (current build)

Everything in 0.3.1 remains unless this section changes it. 0.3.3 replaces the
DOM presentation with a full-window canvas engine. Rules, scoring, saves, the
save format, and online behavior are unchanged.

### Visual engine
- The interface is drawn by PixiJS 8.22.0 on one full-screen WebGL2 canvas.
  `canvas.js` is bundled by esbuild from `src/canvas/`.
- The hidden DOM remains the model and the accessible/focus layer. Canvas
  controls invoke the existing DOM actions, so the canvas is a presentation
  layer, not a second game implementation.
- If WebGL or the canvas bundle fails to start, the game removes the canvas and
  keeps the functional DOM interface. `?canvas=off` (or `?dom=1`) forces that
  mode for testing and troubleshooting.
- Canvas rendering is capped at 2× device pixel ratio and resizes with the
  window. The board stays top-down/2.5D for touch accuracy; depth comes from
  bevels, shadows, layered props, and lighting.

### Theme and art direction
- A deluxe carved-wood tic-tac-toe set: dark walnut, carved panels, gilt trim,
  parchment text, rust X, steel O, and bile-green infection.
- Nought is an oversized carved O idol that has erupted with biomechanical
  growth. The old human bust and eye icon are gone. The menu has a calm carved
  state and a distinct erupted state as the run progresses.
- The seven sins appear as carved reliefs with random idle motion. There are no
  new magic concepts; the infection only hints at what Nought is becoming.
- X and O remain letters. No religious iconography.
- **Typography:** Cinzel for display headings and Source Sans 3 for body text,
  self-hosted from `assets/fonts/` under the SIL Open Font License. Fonts ship
  in the build; the game makes no third-party font requests.

### Screens and layout
- Menu, Story difficulty, game HUD, board, graft trays, Book of Decay, Options,
  continue, confirm, choice, wishlist, dev tools, and every online surface use
  the new style. Online surfaces include the account bar, global board, sign-in
  and registration modal, and account modal.
- The menu is laid out relative to the carved box: side panels, center content,
  online bar, and idol. Desktop and mobile have separate compositions.
- On desktop, carved graft trays flank the board and the idol sits fully visible
  in the right gap. On mobile, a tall tray with empty slot cutouts sits above
  the board and the idol peeks over the board's top-right corner.
- Options keeps export/import, volume, mute, score sounds, and dev tools in the
  carved/parchment language.
- Online rows, guest badges, claim controls, and save-sync actions keep their
  0.3.1 behavior and now render in the same visual language as local play.

### Motion and accessibility
- Motion is medium: piece placement, infection growth, embers, light drift, and
  random idle animations for the sins. `prefers-reduced-motion: reduce` turns
  the idle and ambient animation off while keeping essential feedback.
- Text entry still uses the hidden DOM inputs. Canvas fields draw the caret and
  selection from the focused DOM element, so typing, paste, and autofill work.
- Buttons and modals keep their DOM labels and actions behind the canvas.

### Builds
- `npm run build:web` builds the local-only web app. `build:web:test` and
  `build:web:live` build against the separate online projects and add only that
  Supabase origin to the CSP `connect-src`.
- Every web build now runs `build:engine` first, then copies `canvas.js` and the
  icon set into `dist/web`. `build:engine:dev` writes an inline source map.
- The CSP still allows only same-origin assets. PixiJS is loaded through
  `pixi.js/unsafe-eval`; no `unsafe-eval` permission is added to the page.
- Desktop builds still use `build:web` and therefore stay local-only.
- Release artifacts, app IDs, executable names, checksums, and the manual update
  path are unchanged from 0.3.1.

### Unchanged from 0.3.1
- Modes, rules, scoring, grafts, Story chapters, Endless progression, the
  dead-line rule, and the eruption rules are unchanged.
- Save keys, the save format, legacy migration, and export/import are unchanged;
  existing 0.3.1 saves load without conversion.
- Accounts, guests, the global board, submission rules, save sync, conflicts,
  moderation, and the 30-second visible-only poll are unchanged.
- Desktop remains local-only with no online UI.

### Known limits in 0.3.3
- The new art needs WebGL2. Without it the game falls back to the plain DOM
  layout, which is fully playable but does not show the carved-wood visuals.
- Software-rendered WebGL (for example headless Chromium with SwiftShader) is
  much slower than a normal GPU and is not representative of player performance.
- The seven sin reliefs and ambient effects are decorative. Reduced motion
  removes their idle animation.
- The online UI is now visually complete for this pre-alpha, but accounts,
  moderation, and sync remain pre-alpha services.

## 0.3.1 "The Body" — Online (previous build)

Everything in 0.3 remains unless this section changes it. 0.3.1 adds optional
online accounts, guest score submission, the global Endless damage board, and
account-only save sync to the web/PWA build. The Linux and Windows desktop
builds stay local-only.

### Builds and environments
- `npm run build:web` builds the local-only web app. The online account bar,
  global board, and account/sync rows are hidden, and the CSP has no Supabase
  origin.
- `npm run build:web:test` builds against the separate test project.
- `npm run build:web:live` builds against the live project. The Pages workflow
  uses this variant.
- The build writes `dist/web/online-config.js` with the project URL, the public
  publishable key, and the game version. It adds that Supabase origin to the
  CSP `connect-src` and copies the legal pages.
- The publishable key is public by design. Secret/service keys never enter the
  client or the web build. Legacy `anon` and `service_role` JWT keys are
  disabled on both projects.
- The live Pages deployment is manual. Test and live data stay separate; a test
  score never appears on the live board.
- Desktop 0.3.1 is built with `build:web` and therefore has no online UI. Its
  local ledger, export/import, and offline play are unchanged.

### Accounts
- Accounts use a **handle and password, with no email address**. The client
  signs in through a synthetic internal address,
  `<handle-lowercase>@ttn.invalid`, which is never shown and never receives
  mail. Email confirmations are disabled.
- Handles are 3–20 characters from `A-Z`, `a-z`, `0–9`, `_`, and `-`. They are
  unique without regard to case. Reserved names and the `Guest-` prefix are
  blocked.
- Passwords are 8–128 characters.
- Registration, sign-in, sign-out, the account panel, and account deletion are
  in-game. Signing out keeps the local save and ledger on the device.
- Account deletion requires typing `DELETE` in the account panel. It removes
  the account, its global best score, its submissions, and its cloud save. The
  local save stays on the device.
- There is no self-service password reset because there is no email address.
  The maintainer resets passwords with the admin CLI. There is no email-based
  account recovery.

### Guests
- A guest can submit an Endless score without creating an account. The first
  submission creates a Supabase anonymous identity; simply opening the game or
  finishing a run does not.
- Guest names are generated by the database as `Guest-` plus six uppercase
  hexadecimal characters, for example `Guest-4EF688`. The global board marks
  them with a **GUEST** badge.
- A guest identity keeps one best Endless score and can appear on the global
  board. Guests cannot sync saves: save writes are rejected by the RPC, RLS,
  and a database trigger.
- Guests can delete their identity from the account panel. That removes the
  guest, its score, and its submissions. Signing out of a guest keeps the score
  on the board but gives up the ability to claim it later.
- **Claiming a guest score:** from the run panel or account panel, the guest
  creates a permanent handle and password. The server transfers the guest's
  best score to the new account when it is better, deletes the anonymous user,
  and signs the client in. The client then offers to upload the local save.
  If the claim fails after the account is created, the new account is removed
  so the guest can retry.
- Guest progress and saves stay local unless the guest claims the score and
  chooses to upload the save after creating an account.

### Global board
- The global board ranks the **best Endless damage per identity**. Accounts and
  guests share one board, one row per identity.
- It shows the top 50 by score, then earliest `achieved_at` as the tie-break.
  A signed-in player outside the top 50 sees their own rank appended under
  **Your rank**.
- Rows show handle, GUEST badge, score, level, round, and board size. The
  player's own row is highlighted.
- The client polls every 30 seconds **while the tab is visible**, and also
  refreshes when the tab becomes visible, when the menu opens, after a
  submission, after sign-in, and on **Refresh**.
- The server exposes a leaderboard version. If the version has not changed, the
  client keeps the current rows and avoids a re-render.
- The last board is cached locally and shown if the network is unavailable,
  with an offline notice.
- Banned, hidden, and flagged scores are excluded from the public board until
  an admin clears them. The board never exposes passwords, email addresses,
  device IDs, or save contents.

### Score submission
- Only Endless runs with damage above zero are submitted, and only when the run
  is lost. Story, VS, and in-progress runs are not submitted.
- The in-game run panel offers **Submit as guest**, **Create account**, and
  **Dismiss** when no identity is signed in. After submission it reports the
  global best, rank, guest status, or a moderation hold.
- Submissions are persisted in a local queue (`ttn-submit-queue-v1`) and retried
  after reconnects and every 15 seconds while the tab is visible. Each run has
  an idempotent `run_id` (8–64 characters from `A-Z`, `a-z`, `0–9`, `_`, `-`),
  so retries do not create duplicate rows.
- Offline guest submissions are queued with guest intent. The guest identity is
  created when the connection returns.
- Server responses distinguish accepted, duplicate, improved, best, rank,
  flagged, handle, and guest status. A duplicate retry does not consume a rate
  limit.
- Server limits for pre-alpha:
  - one submission per identity per 30 seconds;
  - 10 submissions per day for a guest, 100 per day for an account;
  - registration and guest claim: 5 per hour per salted IP hash;
  - score 0–1,000,000,000; round 1–1000; board 3–50; level 1–1000;
  - a plausibility ceiling of `max(100000, round × 50000000)` rejects
    impossible runs.
- Scores above 10,000,000 damage, or above `round × 1,000,000`, are accepted
  but flagged and held out of the public board until an admin clears them.
  Hidden scores are also excluded.
- Banned accounts and guests cannot submit. The client is trusted for run data;
  the server caps, rate limits, and moderation are the pre-alpha guardrails.

### Save sync
- Save sync is **account-only**. Guests keep their progress locally.
- The payload is:
  ```json
  {
    "app": "tic-tac-nought",
    "schema": 1,
    "gameVersion": "0.3.1",
    "data": { "state": {}, "leaderboard": [], "sound": {} }
  }
  ```
  `data.state` is required. The payload limit is 256 KB. `leaderboard` and
  `sound` are optional.
- The server stores one save per account with a revision. Uploads pass the base
  revision; a stale base returns a conflict instead of overwriting.
- The client tracks `{ userId, revision, hash, updatedAt }` in `ttn-sync-v1`,
  with a SHA-256 hash of a stable stringified payload. The ownership check
  prevents a save from another account being silently pushed over this
  account's cloud save.
- Local changes sync after a 3-second debounce. The client also retries every
  15 seconds while visible, on reconnect, after sign-in, and on **Sync now**.
- If the cloud is empty and this device has a save, the client asks before
  uploading. If the account already has a cloud save and this device belongs to
  a different account, it asks **Use cloud save** or **Upload this device**.
- If both the cloud and this device changed, the **Save conflict** modal offers
  **Use cloud save**, **Upload this device**, and **Not now**. **Not now**
  pauses sync until **Sync now**; the game never silently replaces a run.
- Loading a cloud save writes the run state, ledger, and sound settings, then
  reloads the page. In-game cloud updates are deferred to the menu with a
  notice.
- Signing out, switching accounts, or deleting an account does not delete the
  local save. Account deletion removes only the cloud copy.
- The existing **Options → Export save / Import save** flow remains local and
  works across the web/PWA and desktop builds.

### Security and operations
- Client data access goes through database RPCs. Tables have RLS enabled and
  direct table access is revoked from `anon` and `authenticated`.
- Three Edge Functions handle account creation and deletion:
  `register`, `claim-guest`, and `delete-account`. The service key stays on the
  server. Requests are POST-only, limited to 8 KB, and CORS-allowed only for
  the GitHub Pages origin and local development on port 8080.
- Functions read the new `SUPABASE_PUBLISHABLE_KEYS` and
  `SUPABASE_SECRET_KEYS` dictionaries (`default` entry) with legacy fallbacks.
  Secret keys are sent on the `apikey` header only, not as a bearer token.
- The CSP uses script hashes, allows only same-origin assets, and adds the
  Supabase origin to `connect-src` for online builds. There are no analytics,
  ads, or tracking cookies.
- **Privacy** and **Terms** pages ship with the web build:
  `privacy.html` and `terms.html`.
- The admin CLI (`scripts/admin.mjs`) defaults to the test project and supports
  `stats`, `health`, `list`, `reset-password`, `rename`, `ban`, `unban`,
  `hide-score`, `unhide-score`, `flag-score`, `unflag-score`, `delete-account`,
  and `prune-guests`. Pass `--live` to target live.
- A daily **Keep backend awake** workflow calls the `health` RPC on both
  configured projects. It keeps free-tier projects active and fails if a
  configured backend is unreachable.
- The test project is `ttn-test`; live is `ttn-live`. Both are hosted in
  `eu-central-1`. There is no local Supabase stack.
- CI runs the database/RLS/RPC suite, the Edge Function suite, and the browser
  online suite against the test project on `main` and on manual dispatch.
  Integration runs are serialized so they do not race each other.

### Known limits in 0.3.1
- Pre-alpha moderation is best-effort. Flagged or hidden scores need an admin
  review before they appear.
- Free-tier projects can pause after a period of inactivity. Local play still
  works; the daily health ping is the mitigation.
- No email means no self-service password reset or account recovery.
- Save sync resolves whole saves; it does not merge two devices' runs.
- Desktop 0.3.1 has no online features.
- Browser storage can be cleared by the browser or the user. Export saves for
  anything important.
- The online UI was functional for 0.3.1. The carved-wood visual rework
  shipped in 0.3.3.

## 0.3 "The Body" (older build)

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
