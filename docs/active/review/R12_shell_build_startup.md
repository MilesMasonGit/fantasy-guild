# R12: Shell, build, startup

Read 2026-11-07 on `main` b22900a1 (reviewer, Fable 5.1; the bundle baseline in
`docs/active/review/baseline/bundle.txt`, the Vite and Tauri configuration, the boot sequence,
the Rust shell, and a read-only count of the shipped art; no build was run; two Sonnet
verifiers). Area per the concept doc: `src-tauri`, the Vite config, the bundle, first paint; the
questions are bundle size, startup work, and Tauri settings that cost idle CPU.

## Summary for the owner

**What this area does for the player.** How long the game takes to show its title screen, how big
the download and the installer are, and what the desktop app does when it is minimised.

**How healthy it is: good, with one habit worth changing and one gap worth measuring.** The shell
is small and quiet: 52 lines of Rust, no timers, the saves module, and one well-judged bridge
that tells the page when the window is minimised (WebView2 never does). The build is one script
of 2.1 MB (663 KB compressed) with no code splitting, which is fine for a desktop app loading from
disk and a little slow for the browser build's first paint. Startup is orderly (settings, saves,
engine, art, then React). The habit: the boot preloads all 756 sprites, 33 MB of them decoded, and
keeps every one referenced for the life of the page. The gap: the desktop app's minimised cost has
never been measured, and by construction it keeps everything the frame clocks do not own.

**The three findings that matter most.**
1. **The boot preloads and pins every sprite in the game** (CR4-096): 756 images, 33 MB decoded,
   held in an array forever so "decoded bitmaps stay warm"; the first screen waits on 256 of them
   or a four-second timeout.
2. **No code splitting** (CR4-097): the Encyclopedia, the Atlas, the ground painters, the CMS
   content and the legacy sprite-name table all parse before the title screen can show.
3. **A minimised desktop app keeps the visible page's idle costs** (CR4-098): WebView2 never
   hides the page; the minimise bridge pauses the frame clocks and nothing else, so R4's pollers,
   CSS animations and per-tick redraws run on at full rate behind a minimised window; unmeasured.

**Counts.** 5 findings: 1 `memory` (measured), 2 `perf` (reasoned, P3), 1 `bug` (P3), 1 `docs`;
0 `owner-decision`. Verified: see each finding's `Verified by`.

**Measure first.** `performance.mark` at boot steps (none exist) and the time to the slot screen
on the owner's PC; the desktop app's task time minimised for ten minutes (the soak's `--hidden`
phase does not apply: it minimises headless Chrome, which does hide the page).

---

## Findings

### CR4-096  The boot preloads all 756 sprites and pins them for the life of the page
- **Tag**: memory
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: measured
- **Where**: `src/systems/core/AssetPreloader.js:3-6,17-27` ("warms the browser cache with all game art at boot"; `retained.push(img)` for every image, never cleared: "Loaded Image objects are kept referenced so decoded bitmaps stay warm"), `:45-67` (the critical subset gates boot, the rest is fire-and-forget at once: `Promise.all(rest.map(loadImage))`, 500 requests in flight on the slot screen), `:12,15` (`CRITICAL_RE`: `playmat|tokens|heroes|icon`; `GATE_TIMEOUT_MS = 4000`), `src/main.jsx:46,97` (React mounts after `artReady`); the counts (a read-only walk of `public/assets` with the scrap folders excluded, as `vite.config.js:35-54` ships it): 756 PNGs, 4.17 MB on disk, 32.8 MB decoded (width × height × 4 from the PNG headers), of which the critical subset is 256 files, 0.93 MB on disk and 10.9 MB decoded; `vite.config.js:46-54,89-95` (`asset-manifest.json`, the same list, emitted at build); the soak's renderer private memory 117 → 178 MB with a 19 MB JS heap (`baseline/soak.txt:19-52`, column `rend MB`)
- **What**: At boot the game fetches every sprite it owns and holds a reference to each `Image` so the browser cannot forget it. The comment's reason ("decoded bitmaps stay warm") is not what the reference buys: Chrome keeps an image's decoded pixels in a discardable cache whether or not the element is referenced, and discards them under pressure either way; what the reference pins is the `Image` object and its encoded bytes (4 MB) plus whatever the cache chooses to keep (up to 33 MB). The gate itself is sound (a 4-second cap, the first screens' art first), but 256 decodes before the title screen is a measurable share of the time a player waits, and 500 more requests fire the moment it shows. On the desktop app the files come from disk and this is cheap; in the browser build it is 756 requests on every cold load. The renderer's 165 MB private memory for a 2 MB page, and its slow growth (R11's CR4-093), are where the cost would show.
- **Evidence**: As cited; the decoded-size estimate is from the PNG headers, not a measurement in the browser.
- **Fix sketch**: Gate on the title screen's own art (the UI icons, the playmat, the first hero portraits: the slot screen draws no Tokens), load the rest lazily (sprites are referenced by `<img src>` and canvases that fetch on demand; a `rel=prefetch` list or a background warm after the slot is chosen keeps the "no pop-in" promise without 500 parallel requests), and drop `retained` (or cap it to the critical set). Must not change: no visible sprite pop-in on the first mat (the eye-check: a new game's first mat and the Shop's rows); the sprite-fx manifest gate (`fxReady`). **Hypothesis to test**: `performance.mark('fg-boot:art-ready')` before and after, on the owner's PC and in the browser build over a throttled network.
- **Verified by**: Sonnet verifier, 2026-11-07: confirmed, with units made decimal (32.8 MB decoded in all, 10.9 MB critical, 0.93 MB critical on disk) and the build-emit cite moved to :89-95. `retained` never cleared, 500 loads fired at once, the gate and the timeout, the mount waiting at `main.jsx:97`: all as stated; the 756 files match `IMAGE_RE`.
- **State**: ticket T-355 (triaged 2026-11-07)

### CR4-097  One 2.1 MB script, no code splitting: every screen, painter and content table parses before the title screen
- **Tag**: perf
- **Priority / Effort / Risk**: P3 / M / low
- **Confidence**: reasoned
- **Where**: `docs/active/review/baseline/bundle.txt:3-8` (`index-*.js` 2,128,288 bytes, gzip 663,452; `index-*.css` 133,524; the worker 6,395; "One script, no code splitting"; `dist/` 35.5 MB in 8,841 files, the rest art), `vite.config.js:117-133` (no `build.rollupOptions.output.manualChunks`, no `lazy` boundaries; the only split is the worker, `WorldMap.jsx:100`), `src/main.jsx:116` (the perf harness, the one dynamic import that splits a chunk; `GameState.js:47-48,54` and `PerfDevSection.jsx:26` also use `import()`, of modules the bundle already holds); what the one script holds: the content JSON inlined at build (`data/*.json`: tokens 145 KB, hallStars 101 KB, tokenRecipes 88 KB, items 62 KB, effects 52 KB, world 15 KB: about 464 KB before minification, `DatabaseManager.js:4-31`), `src/config/registries/legacySpriteNames.js` (747 lines, a generated rename table read for every sprite path, R8), `sprite-manifest.js` (767 lines), the ground and water painters (`TerrainGrass.js`, `WaterShapes.js` 1,868 lines, R0's CR4-003), the Encyclopedia (2,513 lines) and the Atlas screens (3,104 lines, `ARCHITECTURE.md:78`), none of which the title screen needs; `index.html:13-14` (two font preloads; no script preload hint beyond the module tag)
- **What**: The browser parses and compiles two megabytes of JavaScript before the first frame of the title screen, including the two screens the player opens later, the painters that draw a mat the player has not yet loaded, and half a megabyte of content as JSON-in-JS. On the desktop app the file comes off disk and the parse is the cost (on the order of a few hundred milliseconds on the owner's machine, more on a slower one); in the browser build it is also the download. Nothing is measured: there is no boot timing mark anywhere (`grep -rn "performance.mark" src` finds nothing; the Atlas preview uses `performance.measure`, `mapPreview.js:264`), so the question "how long until the slot screen" has no number.
- **Evidence**: As cited; the size is measured, the time is not.
- **Fix sketch**: First `performance.mark`s at `main.jsx`'s steps (`DOMContentLoaded`, settings, engine init, art ready, React mounted, splash gone) printed by the perf harness and read by `bench:draw`; then `manualChunks` for the vendor set (`react`, `react-dom`, `framer-motion`, `@dnd-kit/*`, `@headlessui/react`, `lucide-react`) so they cache across versions, and `React.lazy` for `EncyclopediaScreen` and `WorldScreen` (both mount behind a click); consider loading `data/*.json` as JSON assets rather than inlined modules if the parse mark says it matters. Must not change: the perf build's harness import; the worker's split; the bench calibration (a chunk change moves nothing the benches measure, but `bench:draw`'s page load does). **Hypothesis to test**: the `fg-boot:*` marks before and after, cold, on the owner's PC.
- **Verified by**: Sonnet verifier, 2026-11-07: partly; corrected. The bundle sizes, the absence of `manualChunks` and `React.lazy`, the worker split, the font preloads and the line counts confirmed; the content JSON sums to 464 KB; `performance.mark` has no use in `src` at all (the Atlas preview is a `performance.measure`), and three other `import()` sites exist without splitting a chunk: both stated.
- **State**: ticket T-355 (triaged 2026-11-07)

### CR4-098  A minimised desktop app keeps the visible page's idle costs, and nothing has measured them
- **Tag**: perf
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: reasoned
- **Where**: `src-tauri/src/lib.rs:31-48` (the bridge: "WebView2 is never told its window is minimised: the page stays visible and keeps drawing at full rate", so a `Resized` event reads `is_minimized()` and dispatches `fg-window-minimised` to the page), `src/ui/drawingPause.js:16-31` (`setDrawingPaused(document.hidden || minimised)`: pauses the frame clocks only; "Only drawing pauses: the game's tick is a timer of its own"), `src/ui/components/board/frameClock.js` (what the pause stops: `onFrame`, `onStep`, `onDue` subscribers) against what it does not stop: R4's CR4-050 (fifteen `setInterval` pollers), CR4-051 (CSS animations, which run while the document is visible), CR4-046 (`el.animate` effects, which finish normally here, so no pile-up), the per-tick React commits (`PERFORMANCE.md:827-872`), the ambient life's steps if they are under the frame clock (they are, `AmbientLife.jsx:19-27`); the measurement that exists: `baseline/soak.txt:72-76` (headless Chrome minimised: `document.hidden` true, 0 fps, 8 ms/s task) does not apply, because WebView2 keeps `document.hidden` false; `docs/reference/TICKETS.md:51` (T-333: "the desktop app is probably unaffected … unverified")
- **What**: The shell does the one thing it can: it tells the page when the window is minimised. The page uses that to stop its own frame clocks, and nothing else, because the browser build's `document.hidden` stops the rest for free and the desktop build never gets it. So a minimised desktop game keeps running CSS animations (a station's gear colour steps every 0.8 s forever), the fifteen timers, the per-tick React work and the style recalculations the soak measured at 122 a second visible (R11's CR4-094), while the compositor paints to a window nobody sees. How much of the 124 ms/s survives minimised is unknown; the frame-clock work is a part, probably not the half. The player's experience is a laptop fan that does not slow when the game is put away.
- **Evidence**: As cited; reasoned from what the pause covers, no measurement.
- **Fix sketch**: Measure first: the perf build in the desktop app, minimised ten minutes, with the Perf HUD's task-time counter (or `performance.measureUserAgentSpecificMemory` and the long-task observer the harness has) logged to the console. Then, under `fg-window-minimised`, have the drawing pause also set `document.body.dataset.paused` so a CSS rule stops the infinite animations (`animation-play-state: paused`), pause the pollers (CR4-050's fix gives them one place to pause), and skip the per-tick store reads' React commits (the stores already compare before `setState`; a paused flag in `useGameState` would drop the commit while minimised and read once on restore). Must not change: the engine's ticks and saves while minimised; what the page looks like on restore (the first frame after restore redraws everything that changed).
- **Verified by**: Sonnet verifier, 2026-11-07: confirmed: the WebView2 bridge (`lib.rs:31-49`), the pause covering the frame clocks only (`drawingPause.js:12-13,18`), the ambient life on `frameClock.onDue`, R4's CR4-046/050/051 as cited, the soak's hidden and visible rows, T-333's "unverified". Not re-derived: R4's count of fifteen pollers (the verifier's own grep finds 19 `setInterval(` sites outside tests and `ui/dev`, R4 having classified the rest).
- **State**: ticket T-344 (triaged 2026-11-07)

### CR4-099  The desktop app ships with no Content-Security-Policy
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src-tauri/tauri.conf.json:28-30` (`"security": { "csp": null }`), `:14` (`"withGlobalTauri": true`: `window.__TAURI__.core.invoke` on the page, which `SaveFiles.js:39-43` relies on), `src-tauri/src/lib.rs:22-30` (the seven commands the page may invoke: read, write and delete a save file, open the saves folder, the close handshake), `index.html:1-30` (no `<meta http-equiv="Content-Security-Policy">` either; fonts self-hosted, no third-party script)
- **What**: Tauri's default is a strict policy and its documentation asks every app to set one; `null` turns it off, so the page may load and run script from anywhere. The game loads nothing remote (self-hosted fonts, no analytics, no CDN), so today there is no script to block; the risk is the save file. The desktop build invites the player to copy and edit saves (`SaveFiles.js:2-4`), and a save's strings (a guild name, a hero's name, a Region's flavour name) are rendered on screen; React escapes them, so no injection is open today, and a policy is the second lock for the day a string reaches `innerHTML` or an `<a href>`. With the policy off, such a slip would hand a crafted save file the seven `invoke` commands, which can write and delete the player's other saves. Low likelihood, small fix.
- **Evidence**: As cited; `grep -rn "innerHTML\|dangerouslySetInnerHTML" src/ui`: none today (the reviewer checked `src/ui` only).
- **Fix sketch**: A policy that matches what the page does: `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; worker-src 'self' blob:; connect-src 'self' ipc: http://ipc.localhost` (Tauri 2's IPC origins), checked in the dev build and the `tauri:build` once; `'unsafe-inline'` for styles because the game writes inline `style` attributes everywhere (R4). Must not change: the saves' `invoke` path; the world-picture worker (`worker-src blob:`); the perf harness in perf builds.
- **Verified by**: Sonnet verifier, 2026-11-07: confirmed: `csp: null` (:28-30), `withGlobalTauri: true` (:14), the seven commands (`lib.rs:22-30`), the save-file wording (`SaveFiles.js:2-4`), no CSP meta in `index.html`, no `innerHTML`/`dangerouslySetInnerHTML` under `src/ui`. The proposed policy string was not checked against Tauri 2's IPC origins.
- **State**: ticket T-367 (triaged 2026-11-07)

### CR4-100  Docs: the startup description is right, two comments are history, and the shell's version is at 0.8.0 with the rest
- **Tag**: docs
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `docs/reference/ARCHITECTURE.md:38-47` (the boot order and "mounted once after art preload (`src/main.jsx:97-108`)": the mount is at `:97-110` today; otherwise exact), `src/main.jsx:2` ("Optimized via Auditor Persona"), `:50-53` (a four-line note that a function was deleted on 2026-08-24 under CR2-103: change history, against `CLAUDE.md`'s comment rule), `:101` ("CR3-203"), `vite.config.js:7-8,17-27` (CR3-350, CR2-145 and a paragraph of history on the version constant), `src/systems/core/AssetPreloader.js:17` ("so decoded bitmaps stay warm": not what the reference does, CR4-096); checked and right: the five version files agree at 0.8.0 (`package.json`, `package-lock.json`, `src-tauri/tauri.conf.json:5`, `src-tauri/Cargo.toml:3`, `Cargo.lock` via `bundle.txt:1` "fantasy-guild@0.8.0"), `index.html:10-11` (self-hosted fonts, the note against Google Fonts); not right: `index.html:9` (the page's `<meta name="description">` still says "defending against invasions", the retired concept the installer's description was cleaned of, `Cargo.toml:4-7`), `Cargo.toml:5-7` (the installer's description fixed after CR2-187), `lib.rs:13-19` (the log plugin in debug builds only: no idle cost in release)
- **What**: The shell and build are described accurately where they are described; the comments that carry ticket numbers and dates are the drift from the project's own rule, and the page's description still advertises invasions.
- **Evidence**: As cited.
- **Fix sketch**: Strip the four history comments; fix the preloader's reason; a `[profile.release]` with `lto = true`, `codegen-units = 1`, `strip = true` in `Cargo.toml` is the usual Tauri trim and would shrink the installer, if the owner cares (not a defect). Must not change: nothing in code.
- **Verified by**: Sonnet verifier, 2026-11-07: partly; corrected. The five versions agree at 0.8.0 (all five files read), the four history comments, the preloader's reason, §1's boot order, the debug-only log plugin and the missing release profile confirmed; the verifier found one more drift, `index.html:9`'s description, now listed.
- **State**: ticket T-382 (triaged 2026-11-07)

---

## Notes (no `path:line` of their own, or another area's)

- **Startup work, in order** (`src/main.jsx:27-127`): `DOMContentLoaded` → art manifest fetch and 256 critical image loads start → settings from `localStorage`, `SaveManager.init`, the desktop saves read → `EngineBootstrap.init` (fourteen subsystem inits, the tick handlers registered, the content audit over 146 Tokens, 151 items, 117 recipes, 92 effects, reporting only) → the drawing pause → wait for art, the sprite-fx manifest and the saves → React mounts → the perf harness (dev and perf) → the splash fades. Nothing here is heavy by inspection except the art gate (CR4-096) and the script parse (CR4-097); nothing is timed.
- **Idle CPU in the shell: none.** `lib.rs` registers no timer, no tray, no updater; the only recurring work is the `Resized` handler's `is_minimized()` read on each resize event. `tauri-plugin-log` is debug-only. `withGlobalTauri` and `csp: null` are the two settings worth a second look (CR4-099).
- **The build**: `vite build` 44.5 s (`bundle.txt:1`); the sprite-fx generation runs before each build and on dev-server start (`scripts/spriteFx.mjs`, incremental by hash); the asset manifest is emitted at build and served by a middleware in dev; the scrap folders are removed from `dist/` after the bundle. The dev server's watch excludes the nested worktrees (`vite.config.js:103-113`), the fix for a 2 GB watcher.
- **`dist/` is 35.5 MB in 8,841 files**, almost all art copied as is; the 756 sprites the preloader lists are a tenth of those files (the rest: backgrounds, audio, fonts, the sprite-fx pictures under `_gen/`, the hero animation strips). What the installer bundles and whether the scrap and `_gen` folders are in it was not checked (no build run).
