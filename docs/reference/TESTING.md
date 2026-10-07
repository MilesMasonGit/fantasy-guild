# Testing and verification

## The merge gate

Nothing merges to `main` until all of these hold:

1. **Tests**: `npm test` shows no new failures. Content-drift failures are
   marked expected (`it.fails`); today one plain red test remains,
   `AssetManager` (T-001), as `docs/active/NOW.md` says. Anything else red is
   new. Run it in the **main folder**: 19 CMS-importing test files can't load
   in a worktree (T-066). The suite takes ~2–3 minutes; read its result with
   `npx vitest run --reporter=dot 2>&1 | tail -30` rather than the full output.
2. **Bench**: `npm run bench -- --compare` exits **0**.
   - Exit 1 = `REGRESSED` (slower). Timing is noisy under machine load; re-run
     before believing it.
   - Exit 2 = `WORK CHANGED`: the change altered what the game does. Stop and
     find out why, unless the ticket says a gameplay change is expected.
   - See [`bench/README.md`](../../bench/README.md).
3. **Cycles**: `npm run cycles` shows no new dangerous import cycle.
4. **Build**: `npm run build` succeeds.
5. **In the game**: anything a player could see is exercised in the running
   game (below). If something truly can't be automated, hand the owner an
   explicit manual check; never quietly skip it or claim it passed.
6. **Look**: anything that changes how the game looks or plays waits for the
   owner's eye-check before merging.

Also: never weaken or delete a test to make something pass. Rewriting a test
for a deliberate design change is fine; say which and why. Delete tests only
together with the code they test.

## Running the game for verification

`preview_start` with name `dev` (game) or `cms` (CMS). The dev server gets its
own origin, so its saves are separate from the owner's real ones. **Use the
port `preview_start` returns**, never a guessed one: another chat may hold
5173. The browser pane is often hidden: read with `read_page` /
`javascript_tool` first; a screenshot is the last resort (retry once, then
switch method). Most past browser failures came from fighting a hidden pane.

**Reading state.** Prefer `read_page`, `read_console_messages` and
`javascript_tool` probes on `window.Game` and `window.GameState`. Dynamic
`import('/src/…')` works if the path matches the one the app loaded; after a
code edit Vite may serve a `?t=` copy (a second module instance whose state is
empty). If reads look impossible, restart the dev server.

**Driving time.** The loop barely ticks in the preview pane. Run it
synchronously: `for (let i=0;i<400;i++) window.Game.LoopRunner.tick(100)`.

**Quirks that look like bugs but aren't:**
- **Screenshots usually time out** (the particle overlay never goes idle). Use
  text tools and say what you verified.
- **A hidden Browser pane stops `requestAnimationFrame`** and reports a 0×0
  viewport. Drawers won't open; layout measurements are junk. Set a size with
  `resize_window` before measuring, or test the function the control calls.
- **Keys**: send `"Enter"`, not `"Return"` (arrives empty). `ctrl+a` arrives
  empty too; `triple_click` a box to replace its value.
- **Click by `ref`** from `find`/`read_page`, not by coordinates (stale frame).
  Re-`find` after anything re-renders the element.
- **`read_console_messages` includes old loads' errors.** For a trustworthy
  check, open a fresh tab, navigate it, then read.
- **`innerText` applies CSS uppercase**; use `textContent` for text checks.
- **Editing a module reloads the page** back to slot select; redo setup after
  every edit, in one script.
- **Subagents share the pane's tabs**; a director should `tabs_create` its own.
- **ResizeObserver never fires** in the pane; responsive code needs a
  `window.resize` path too.
- **Measure containers, not single elements**; single boxes can be stale.

**Drags can be automated** with a synthetic pointer sequence from
`javascript_tool`: `pointerdown` on the handle → one `pointermove` past 8 px →
several stepped moves → `pointerup` at the target, ~30 ms apart, ~250 ms after
the drop. Events: `new PointerEvent(type, {bubbles:true, cancelable:true,
composed:true, pointerId:1, pointerType:'mouse', isPrimary:true,
buttons: type==='pointerup'?0:1, clientX:x, clientY:y})`, moves and up
dispatched on `document`.

**Catching notifications**: subscribe to `notification_added` on
`window.Game.EventBus` before triggering the action.

## Save slots

Saves live in `localStorage` under `fantasy_guild_slot_N`. Planting a
hand-built save is a legitimate way to test loading. **Slot discipline:**
capture every localStorage key before probing, stop the game loop before
restoring, verify character for character. An autosave has clobbered a slot
mid-probe three times. Prefer an empty slot. The owner's test save is slot 3.

## The CMS

Never verify on the real CMS workspace: a test effect left there is written
into `data/` by the next Sync to Game. Mount the component on a throwaway
`?flag` route, either handing it its own `content`, or calling
`useEntityStore.persist.setOptions({ storage: <no-op> })` before seeding and
checking `localStorage['fantasy-guild-cms-v2']` is unchanged afterwards.

## Code tools and their blind spots

`npm run lint`, `npm run cycles`, `node tools/reachability.mjs`.
**Reachability lies**: it walks from `main.jsx` only (test-only files look
dead), doesn't know the CMS imports seven game modules, and the barrel
`registries/index.js` hides orphans. Before deleting something as dead, grep
for it three ways (import, string id, CMS).

## Worktrees (spikes and measurements)

`git worktree add --detach …`; link `node_modules` and `cms/node_modules` as
junctions, and remove the junctions with `cmd //c rmdir` **before** removing
the worktree (otherwise deleting the worktree deletes the real packages). A
second dev server needs its own port and Vite `cacheDir`.
- Keep the worktree **path short** (e.g. `.claude/worktrees/a1`): Windows
  path limits break checkouts of the deeply nested audio files.
- In a worktree, run **simple single git commands** (`git -C <path> …`): no
  loops, heredocs or chained `cd && git`; the safety check refuses git
  commands it can't read.
- Read the worktree's copy of a file before editing it (Edit refuses a file
  you haven't read at that path).

## Shell and tools on this machine (Windows)

Facts past sessions had to re-learn:
- **Bash paths**: use `/c/Users/...` or `C:/Users/...`, never `C:\Users\...`
  (backslashes get eaten). No `/tmp`: Windows programs (Python, Node) can't
  see it; use the session scratchpad. Run Python with `-X utf8`.
- **Scratch scripts**: write them with the Write tool and run them, instead of
  long heredocs piped into an interpreter.
- **Git line endings**: "LF will be replaced by CRLF" warnings are harmless,
  not errors.
- **Chrome**: `chrome.exe --version` opens a real Chrome window on the owner's
  profile. Read the version from the file's properties instead.
- **The Grep tool** takes the regex in `pattern` and flags (`-n`, `-A`, case)
  as its own parameters; ripgrep has no lookaround, and `{` is special.
- **Edit** needs a fresh Read of that file; re-read after another session or a
  CMS Sync may have changed it.
- **Auto-mode "no verdict"** errors are transient: retry once as-is; don't
  redesign the step. A real denial means stop and tell the owner.
- **Debug output**: game code logs at debug level; filter test and bench
  output to the summary lines.
