# R11: Memory and idle

Read 2026-11-07 on `main` b22900a1 (reviewer, Fable 5.1; the soak baseline of 2026-11-07 10:34
in `docs/active/review/baseline/soak.txt` and `bench/soak-baseline.json`, its two heap snapshots
(in the director's worktree `.claude/worktrees/p23b/bench/results/`), diffed by class and by
closure name with a read-only script; no bench was run; two Sonnet verifiers). Area per the concept
doc: `bench:soak` results and heap snapshots; the questions are growth per hour, detached nodes,
listener growth, hidden-window cost.

## Summary for the owner

**What this area does for the player.** Whether the game can be left running: open for hours,
minimised, in a background tab. Memory that grows slowly becomes a game that stutters after an
afternoon; a page that keeps working while hidden is a laptop fan that never stops.

**How healthy it is: good, with two measured leads already in the ticket list.** Over thirty
minutes visible at the Token cap the page held its DOM, its listeners and its event-bus
subscriptions exactly steady, and its JavaScript heap grew about 52 KB a minute (1.3 MB over the
run; T-335). Hidden, the engine kept ticking at full rate while the page's own work fell to 6 %,
which is the design; but DOM nodes and listeners climbed about 300 and 136 a minute until the
window came back (T-333). R4 found the mechanism for the second by reading (one-shot effects
that remove themselves only when a frame finishes). What this area adds is where the first lead
can and cannot be followed with today's tooling, and one idle number nobody had put in words:
at rest, visible, the page spends about an eighth of a CPU core redrawing a mat where nothing
the player did has changed.

**The three findings that matter most.**
1. **The hidden pile-up is R4's finding; the soak cannot yet name its holder** (CR4-092): the
   snapshots are taken while the page is visible, after the pile-up has been released, so the
   next run needs a snapshot inside the hidden phase; the fix is CR4-046.
2. **The visible heap growth cannot be attributed from a minified build** (CR4-093): the
   snapshot's growing closures are named `_t`, `Qt` and `F`; the one readable class is "1,684
   more plain Objects"; a non-minified perf build and a 60-minute run would say what they are.
3. **At idle the page does 124 ms of work and 122 style recalculations a second** (CR4-094): a
   measured number for R4's pollers, CSS animations and per-tick redraws, and the baseline to
   beat.

**Counts.** 4 findings: 2 `memory` (measured), 1 `perf` (measured), 1 `docs`; 0 `owner-decision`.
Verified: see each finding's `Verified by`.

**Measure first.** A soak with `--hidden=20 --snapshot` and a snapshot taken inside the hidden
phase (a one-line change to `bench/soak.mjs`) after CR4-046; a 60-minute visible soak from a perf
build with `minify: false`.

---

## Findings

### CR4-092  The hidden pile-up is the one-shot effects' `onfinish`; the soak's snapshots are taken when it has already drained
- **Tag**: memory
- **Priority / Effort / Risk**: P2 / S / low
- **Confidence**: measured
- **Where**: `docs/active/review/baseline/soak.txt:33-40,77-85` (hidden 12 to 17 min: DOM nodes 1,876 → 3,347, listeners 830 → 1,505, about 294 nodes and 136 listeners a minute, "elements in the document" only 1,617 → 1,734, so the growth is detached nodes; all back to 1,875 and 830 at the first visible sample; `✗ … grew … while hidden (limit 20 / 10)`), `:72-76` (hidden: 0 fps, engine ticks 10.0/s, page task 8.1 ms/s against 124.5 visible, style passes 0.3/s); the mechanism, read in R4: `docs/active/review/R4_drawing.md` CR4-046 (`matFx.js:47-61`, `tokenFx.js:19-32`: one-shot effects remove their element on `onfinish`, which never fires while no frame runs; no caller reads `isDrawingPaused`), with, as this area's own attribution (R4 does not say so), two likely feeders of new one-shot effects while hidden: the engine's ticks keep publishing `EFFECT_FIRED`, `CYCLE_COMPLETE` and the fight events the effects watch (CR4-046 names them), and CR4-050's pollers keep rendering; unproven until a hidden-phase snapshot names the detached classes; the tool: `bench/soak.mjs:12` (`--snapshot`: "heap snapshots at the start and end of the fit") and `:224` (the run line, `soak.txt:10`: "hidden 12.0–17.0 min · … heap snapshots"), `:23,53` of `soak.txt` ("heap snapshot (start)" at 3.0 min and "(end)" at 30.0 min, both visible samples), `bench/browser/soakLib.mjs:48-51` (the hidden checks: task share, tick share) and `:57-63` (nodes and listeners limits 20 and 10 a minute); `docs/reference/TICKETS.md:51` (T-333: "Guess, not checked: elements removed while no frame runs stay alive until the next rendered frame")
- **What**: The soak measured the pile-up exactly (the ticket has the numbers) and guessed its cause; R4 confirmed the guess by reading the code; which events feed new effects while hidden is this area's inference, not yet a measurement. What the soak cannot yet do is name the holder from a snapshot: both snapshots are taken while the page is visible, the second at the end of the run, thirteen minutes after the window was restored and the pile-up released. A run with `--snapshot` will keep saying the heap classes grew by 1 MB and nothing about the 1,500 detached nodes. The desktop app is probably unaffected (WebView2 never tells the page it is hidden; the minimise event pauses only the frame clocks, R12's CR4-098), so this is the browser build's, and a background tab left for hours is the case.
- **Evidence**: As cited; the class diff of the two snapshots (`soak.txt:89-107`) shows no detached DOM class at all, which is consistent with the release at 18.0 min.
- **Fix sketch**: Fix CR4-046 (a timer fallback beside `onfinish`, or `getAnimations().forEach(a => a.finish())` on `setDrawingPaused(true)`), then re-run `npm run bench:soak -- --hidden=20 --snapshot` with one more snapshot taken at the last hidden sample (`bench/soak.mjs`, beside the end-of-fit snapshot) so the detached classes and their retainers are in the report; the hidden limits (20 nodes, 10 listeners a minute) then become the gate they were written as. Must not change: the soak's visible-phase thresholds and the saved baseline's shape; the engine's hidden tick rate (100 %, by design).
- **Verified by**: Sonnet verifier, 2026-11-07: partly; corrected. Every soak number and the two visible-sample snapshots confirmed, and CR4-046's mechanism; the `soak.mjs` line cites were wrong (fixed) and the "feeders" were this area's inference presented as R4's: now stated as unproven attribution.
- **State**: ticket T-333 (triaged 2026-11-07)

### CR4-093  The visible heap grows 52 KB a minute, and the perf build's minification hides what is growing
- **Tag**: memory
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: measured
- **Where**: `baseline/soak.txt:55-69` (JS heap used +51.83 KB/min over 27 fitted minutes, r² 0.97, WARN at 50, fails at 200; nodes, listeners, subscribers, documents flat; renderer private memory +1,102 KB/min, r² 0.61, level 165.6 MB, 117 MB at the first sample to 178 at the last), `:89-107` (the class diff, start → end: compiled code +1,175 KB retained, closures +1,035 KB retained on +87 objects, scope contexts +583 KB, `Object` +1,684 objects, Blink style caches `PresentationAttributeCacheEntry` 79 → 425, `CSSRatioValue` 154 → 846, `CSSValueList` +703); the reviewer's own diff of the two snapshots by closure name (a read-only script over the two `.heapsnapshot` files): +57 anonymous closures, +19 `native_bind`, +2 `_t`, +2 `F`, one each of `Qt`, `Be`, `ft`, `en`, `onPointerDown`, `onDoubleClick`, `attach`, `complete`, `read`, `progress`, `dispose`, `reset`: minified names, because the soak runs the perf build (`bench/soak.mjs:234`, `vite build --mode perf`; `vite.config.js:120` sets only `outDir` for that mode, so esbuild minifies); `docs/reference/TICKETS.md:52` (T-335)
- **What**: The heap's slow climb is real (r² 0.97) and small (1.3 MB in half an hour; at that rate a day is 75 MB, which a player who leaves the game open would meet as a slower page, not a crash); the ticket already says compiled code may be V8 warming up and the closures are the lead. The snapshot cannot say which closures: the perf build is minified, so the growing functions are named `_t` and `Qt`, and the retainer paths that would name the arrays they close over are the same. The 1,684 extra plain Objects and the Blink style-cache growth (`CSSRatioValue` ×5, presentation-attribute entries ×5) point the same way R4 does: inline `style` and `aspect-ratio` values written per render and per effect. The renderer's private memory grew twenty times faster than the JS heap (1.1 MB a minute, 60 MB over the run) with a weak fit; nothing in the report explains it, and the heap snapshot cannot see it (GPU textures, canvas backing stores, decoded images: R12's CR4-096).
- **Evidence**: As cited; the closure-name diff is reproducible from the two snapshot files with a 40-line node script (node types `closure`, `object`, `native`, grouped by `name`).
- **Fix sketch**: Give the perf build readable names for the soak only (`build.minify: false` or `terserOptions.keep_fnames` under `mode === 'perf'`; the draw bench's calibration stamp must be checked for a change in frame cost, since unminified code is slightly slower), then a 60-minute soak with `--snapshot` and the retainer paths of the top growing closures read in DevTools; add `performance.measureUserAgentSpecificMemory()` (or the CDP `Memory.getDOMCounters` plus `Browser.getProcessMemory` the soak already reads) per sample to split the renderer's growth into JS, DOM, canvas and image. Must not change: the soak's visible thresholds; the engine's work.
- **Verified by**: Sonnet verifier, 2026-11-07: partly; corrected. The slopes, the class diff, the unminified-build inference (`vite.config.js:120` sets only `outDir`) and T-335's text confirmed; the renderer figures restated (level 165.6 MB, 117 → 178); the `soak.mjs` line cite fixed; the two snapshot files exist in the director's worktree (45.8 and 46.5 MB). The closure-name diff was the reviewer's and was not re-run.
- **State**: ticket T-335 (triaged 2026-11-07)

### CR4-094  At idle, visible, the page spends 124 ms a second and 122 style passes a second redrawing a mat where nothing changed
- **Tag**: perf
- **Priority / Effort / Risk**: P3 / M / low
- **Confidence**: measured
- **Where**: `baseline/soak.txt:72-76` (visible, 25 intervals: 164.7 fps, 10.0 engine ticks/s, 124.5 ms/s page task time, 14.7 ms/s script, 121.7 style passes/s, 5.6 layouts/s; hidden: 8.1 ms/s task, 0.3 style passes/s), `:19-52` (the fps column: 165 at every visible sample but two, 164 and 161 at the fit's first two, the display's refresh rate, so a frame is rendered every refresh), `bench/soak.mjs:1-3` (the question the soak asks: "does it stop drawing while hidden?"; it did not ask "does it stop drawing while nothing changes?"); the causes are R4's: `R4_drawing.md` CR4-051 (an infinite `steps(1,end)` colour animation inside a filtered box on every station awaiting a choice; drop-shadow filters), CR4-050 (fifteen pollers, several setting a fresh object), CR4-048/049 only with the pointer moving, and the per-tick React commits (0.57 a tick, `PERFORMANCE.md:827-872`), plus the ambient life's eight steps a second (CR4-059) and the walkers' per-step transforms
- **What**: With no player input and a mat at the Token cap, the visible page renders a frame at every one of the display's 165 refreshes, recalculates style 122 times a second, and spends an eighth of one CPU core doing it; only 15 ms of the 124 is JavaScript, the rest is style, layout and paint. The engine's ten ticks a second account for a small part (the hidden phase, where the engine still ticks, costs 8 ms/s). The rest is drawing that runs whether or not anything the player can see has moved: CSS animations that never rest, pollers that set state on a timer, and per-tick redraws of unchanged things. On a laptop this is the fan; on the desktop app minimised it is the same cost, because WebView2 never hides the page (R12's CR4-098). This number is the baseline R4's fixes should move; nothing here is a new cause.
- **Evidence**: As cited.
- **Fix sketch**: None of its own: R4's CR4-050, CR4-051, CR4-059 and CR4-046 are the fixes; after each, `npm run bench:soak -- --minutes=10 --hidden=0` and read the visible "page task ms/s" and "style passes/s" lines (and add both to `soak-baseline.json`'s compared metrics, which today compare memory slopes only, `soakLib.mjs:52-73`). The target is a page that renders only when something changed: style passes near the engine's tick rate, task time a third of today's. Must not change: what is drawn.
- **Verified by**: Sonnet verifier, 2026-11-07: partly; corrected. Every visible and hidden number confirmed; two samples read 164 and 161 rather than 165 (stated); the R4 findings exist and say what is attributed to them; `PERFORMANCE.md`'s 0.57 commits a tick is at :864,874.
- **State**: ticket T-350 (triaged 2026-11-07)

### CR4-095  Docs: the memory tickets' guesses are now findings, and the soak's hidden check is right but its snapshots are not where the question is
- **Tag**: docs
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `docs/reference/TICKETS.md:51` (T-333: "Guess, not checked: elements removed while no frame runs stay alive until the next rendered frame" → R4's CR4-046 checked it: `onfinish`-only removal; "the desktop app is probably unaffected (WebView2 keeps the page visible when minimised: unverified)" → `src-tauri/src/lib.rs:31-33` and `src/ui/drawingPause.js:3-7` confirm WebView2 never hides the page and the minimise event pauses the frame clocks only, so the one-shot effects, which do not read the pause, keep finishing: unaffected by this pile-up, affected by CR4-094's cost), `:52` (T-335: "the closures and contexts are the lead" → CR4-093: the lead cannot be followed from a minified build), `bench/soak.mjs:1-3,18-20` (the header says what the hidden phase checks; it does not say that the snapshots are visible-phase only, CR4-092), `docs/reference/ARCHITECTURE.md:375-394` (§5.4 drawingPause: accurate, including "`isDrawingPaused()` has no caller in game code"), `baseline/soak.txt:12-14` (the `browserslist` nag printed into every soak report: `npx update-browserslist-db@latest` once would stop it); `docs/reference/ARCHITECTURE.md:386` ("16 pollers outside `ui/dev`") against R4's fifteen in the game (the sixteenth is a dev tool under `components/dev`), the two docs should agree
- **What**: Two tickets carry guesses this review has checked; they should say so, and name the findings. The soak's own header should say when its snapshots are taken.
- **Evidence**: As cited.
- **Fix sketch**: The planning agent updates T-333 and T-335 at triage; a line in `soak.mjs`'s header; one `npx update-browserslist-db@latest` (a `package-lock.json` change, so a commit of its own). Must not change: nothing in code.
- **Verified by**: Sonnet verifier, 2026-11-07: confirmed; the ticket quotes, the WebView2 comment, the drawing-pause lines, §5.4 and the soak header as described; the ARCHITECTURE/R4 poller-count difference it noticed is now listed.
- **State**: ticket T-382 (triaged 2026-11-07)

---

## Notes (no `path:line` of their own, or another area's)

- **Steady, checked.** Over 27 fitted visible minutes: DOM nodes −0.67/min (noise), listeners −0.08/min, EventBus subscribers −0.12/min (485 on 82 events, the largest `game_reset` with 172: the fan-out at a travel or new game, not per tick), documents and frames flat at 11 (the page plus ten SVG pictures), Tokens flat at 132. Nothing the page owns leaks while visible.
- **The engine alone is steady**: `bench/README.md:22,42` (S6, eight game-hours of ticks, checkpoints over game time) and the engine bench's S6 row; the soak's note at `soak.mjs:3` says so, and the hidden phase's 100 % tick rate at 8 ms/s of task time agrees.
- **GPU process memory** flat (174 KB/min, r² 0.04). The renderer's growth (CR4-093) is the one unexplained slope.
- **Not done here**: no soak, no snapshot, no browser was run (the reviewer's rule); the closure-name diff read the director's two snapshot files on disk. R12's CR4-096 (the preloader retains every decoded sprite) and CR4-098 (the minimised desktop app keeps the visible costs) are this area's two leads filed under the shell.
