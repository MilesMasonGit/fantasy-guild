# Free Playmat — handoff to the next agent

**Written 2026-09-16.** `main` is at **`9a07a0f`**. Slices 1.0 through 1.7 are
done and merged. Slice **1.8** is next and has not been started.

Read this once, then work from `docs/free_playmat_roadmap_v1.md`, which is the
authoritative plan. This file only tells you where things stand and which traps
have already cost this project real time.

---

## 1. Read these first, in this order

| File | What it is |
| :-- | :-- |
| `CLAUDE.md` | How the owner wants to be worked with. Not optional. |
| `docs/free_playmat_roadmap_v1.md` | ⭐ **The authoritative plan.** Locked decisions FP-40…FP-100, provisional picks FPP-1…FPP-21, and §7's implementation status table with a full account of every finished slice. |
| `docs/concept_free_playmat.md` | The vision, FP-1…FP-39, and the risk list FPR-1…FPR-8. |
| `PROJECT_HISTORY.md` | Background on finished work. Not current. |

**Decisions marked locked are not to be re-litigated.** If you believe one is
wrong, bring evidence to the owner and let them decide.

---

## 2. Who you are working for

The owner **does not code**. This shapes everything:

* **Explain in plain language**, especially anything to do with git or GitHub.
  Say what a command does and why, not just the command.
* **Ask, don't assume — as multiple choice.** When a design decision is not
  already made somewhere, stop and ask, with labelled options, the trade-offs
  spelled out, and your recommendation first. Never an open-ended question, and
  never a silent guess.
* **Verify before saying it's done.** Run the tests, and for anything that
  appears on screen, run the game and actually exercise it. Report what you
  observed, not that code was written.
* **Stay in scope.** Tell the owner about unrelated problems you spot; do not
  fold them into the current change.
* **Work in small slices**, each committed, so there is always a clean rollback
  point.

A lesson learned the hard way: **do not frame questions around scaffolding that
is being removed.** An earlier question assumed the grid would persist and the
owner had to correct the whole premise. There are no tiles; Tokens and flags sit
freely on the mat.

---

## 3. Where the work stands

### Done and merged

Stage 1 slices **1.0 → 1.7**. In player terms: the 6×6 grid is gone from the
game and from the code; a Token lands exactly where you let go of it and can be
crowded right up against its neighbours; heroes are commanded by **flags** they
hold rather than by being placed on squares, with per-skill allow/disallow and
priority rules; the mat's size is a live developer setting, and shrinking it
pulls stranded Tokens back inside; and the mat now fills the window with art
that stays crisp.

§7 of the roadmap has the full detail of each slice, including what was verified
in the game and every judgement call made on the owner's behalf.

### Not started

| Slice | Scope |
| :-- | :-- |
| **1.8 Arrivals on the mat** | Map bursts, crafted Tokens and spawns land on the mat and may push, never into a `Cannot` break (FP-16, FP-17); FP-46's full-mat refusals. Spawns and transforms start checking `Cannot`. The loot layer carries items only, in mat units. Bought and reward Maps land beside the Hall (FP-18); Managers restock in the exact spot (FP-19). |
| **1.9 Tray retired** | Delete `Tray`, `TrayMiniBoard` and every Tray route; Vault ↔ mat by direct drag (FP-45); hero tabs to the bottom (FP-54); quests re-pointed; a Guild Hall upgrade track widening the flag radius (FP-23). |
| **1.10 Wording** | "adjacent" → "nearby" everywhere. ⚠️ RenderGolden must be regenerated and its diff actually read. |
| **1.11 Tune and tag** | Bake the Mat Tuner values the owner settles on into defaults; bump the five version files; tag **v0.8.0**. |

Stages 2 (autonomous heroes, walking) and 3 (living mat) are outlined only.

### Two things slice 1.8 inherits

1. **Spawns currently search the Mat Tuner's nudge reach.** That was a
   director's pick in 1.6d-1, explicitly flagged to revisit in 1.8, which owns
   spawns.
2. **A Token with nowhere clear to go stays overlapping its neighbour** after a
   mat shrink, rather than being removed. 1.8's pushing is the real answer.

---

## 4. Repo and git conventions

* `main` is canonical. Start work on a **short-lived branch off `main`** named
  for the job, then merge back when verified. There are currently no other
  branches.
* ⚠️ **Nothing has been pushed to GitHub.** `main` is **141 commits ahead of
  `origin/main`** by the owner's explicit instruction: *"we won't push to Git
  until we're finished the full implementation."* **Do not push** without asking.
* Latest tag is `v0.7.2`. Slice 1.11 tags `v0.8.0`.
* Version numbers live in **five files** and must be bumped together:
  `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`,
  `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`.
* Log changes in `CHANGELOG.md` under `## [Unreleased]`, in plain language the
  owner can read.

### ⚠️ Other sessions share this checkout

The working tree permanently holds another session's animation work. **Never
stage these:**

```
cms/src/App.jsx
cms/src/components/layout/TopBar.jsx
src/ui/components/dev/AnimationStudioModal.jsx
cms/src/components/editors/AnimationEditor.jsx      (untracked)
docs/concept_skill_and_class_rework_v2.md           (untracked)
```

Check `git branch --show-current` before every commit, and stash before blaming
yourself for unexpected red tests.

---

## 5. Traps that have already cost this project time

* ⚠️ **Never hand-edit `data/*.json`.** The CMS is the exclusive authoring
  surface and its one-way "Sync to Game" destroys anything authored outside it.
  Use the CMS or a test fixture.
* ⚠️ **This PowerShell mangles double quotes in `git -m` messages**, here-strings
  included. A merge once silently failed with *"merge: is - not something we can
  merge"* and the branch delete then refused. Keep commit and merge messages free
  of `"`, or pass them with `-F <file>`, and check `git log` afterwards.
* ⚠️ **`git add` aborts the entire command** when one pathspec names a file that
  is already staged as deleted — every other path goes unstaged while the commit
  still "succeeds". Stage deletions separately, and **always print
  `git diff --cached --name-status` before committing.** This bit twice.
* ⚠️ **ESLint's `unix` formatter is not installed** and silently reports zero
  problems. Use the default formatter or `--format json`.
* ⚠️ **After any large rename sweep, run an ESLint `no-undef` pass** over the
  changed files. A `HeroDockTab` ReferenceError that blanked the whole screen got
  past the tests and was only caught by running the game.

---

## 6. Testing

**The test suite is not green, and that is expected.** The baseline on `main` is
**11 failing tests in 6 files**:

| File | Count |
| :-- | :-- |
| ContentRules (redberry band) | 1 |
| EconSimRunner (anchor flag) | 1 |
| EconSimTime (config-less rows) | 1 |
| ItemSellValue (1g sells) | 1 |
| OneRuleOnePlace (Map materials) | 2 |
| TerrainRegistry | 5 |

**Always capture the baseline before your first edit** and compare against it,
never against green. As of `9a07a0f`: 11 failed / **2951 passed** / 29 skipped.

**ESLint:** there are **7 pre-existing errors** on the board area's files, every
one of which exists on `main` at the same line (unused `VerticalHeroDock`,
`useState`, `useMemo`, two `alphaHitTest` imports, and `fx`/`fy` in `Tray.jsx`).
Do not fix them as part of a feature slice, and do not add new ones.

**Prove your tests by neutering them.** The house standard on this project: break
the behaviour one way at a time, confirm a *named* test fails, restore the file
and confirm it is byte-identical. Report the table. This has repeatedly caught
tests that passed for the wrong reason.

---

## 7. Verifying in the running game

`npm run dev`, then exercise it. Several quirks will otherwise look like product
bugs:

* ⚠️ **Screenshots time out.** The game renders a particle overlay at 60 FPS so
  the renderer never idles. Use `read_page`, console reads and JavaScript probes,
  and **report measured numbers**. Say plainly that you measured rather than
  photographed — do not claim a visual check you did not make.
* `window.Game` and `window.GameState` probes work and are reliable.
* **The game loop barely ticks in a preview pane.** Drive it synchronously:
  `for (let i=0;i<400;i++) window.Game.LoopRunner.tick(100)`.
* Press `"Enter"`, never `"Return"` — the latter arrives with an empty key.
  `ctrl+a` also arrives empty, so clear a field by reopening it, and
  `triple_click` a number box before typing.
* Click by element reference, not coordinates; coordinate clicks can map from a
  stale frame and land somewhere else entirely.
* A hidden pane reports a 0×0 viewport, so set a real size before measuring
  layout.
* Use `textContent`, not `innerText`, for text assertions — CSS `text-transform`
  changes what `innerText` returns.

⚠️ **In a fresh game no authored Token is workable and the roster limit is 0.**
That is half-authored content and deliberate design, **not a bug** — the owner
has ruled on both. Register fixture Tokens at runtime if you need a working hero.
Do not report unfinished content as defects.

---

## 8. Known problems, already raised, deliberately not fixed

These are queued as separate tasks for the owner to start. Do not fold them into
a feature slice.

1. **Black-screen crash.** `RecipeResolver.js` (~line 382) calls
   `req.tag.split(...)`, but a recipe whose `requiresContext` holds a plain
   string instead of a tagged item makes `req.tag` undefined. It throws inside
   the progress-bar render, and because **there is no error boundary around the
   mat**, the entire React tree unmounts while the engine keeps ticking. The fix
   is two-part: accept both shapes, and add an error boundary. ⚠️ Find where the
   string shape comes from — do not hand-edit `data/`.
2. **Loose Maps on the mat do not step and will blur.** `BoardMapToken` in
   `MatBoard.jsx` hardcodes a `TOKEN_PX` box and a `w-full h-full` sprite,
   bypassing `tokenSizeFor` and therefore FP-99 entirely.
3. **Tile-named leftovers.** `TILE_CHANGED` → `TOKEN_CHANGED`,
   `TILE_EVENT_ALERT` → `TOKEN_ALERT`, `TileModifiers` → `TokenModifiers`. These
   are on a deliberate allow-list in the grid guard test; the rename is safe to
   do now that 1.6d-2 has merged.
4. **A ~4px overhang at the smallest window.** At the mat's 0.1 scale floor the
   mat draws ~176px into a 168px cell, so a few pixels sit under the Tray —
   where a dropped Token is silently deposited in the Vault chest. Slice 1.7
   greatly reduced this but could not remove it; the only cure is raising the
   floor, which the floor's own comment argues against. Slice 1.9 retires the
   Tray and removes the hazard entirely.
5. **Minor:** a hero drag particle uses a 136px step where the real step is 160;
   an item's `Applies` rule ignores its moment (`TileModifiers.loadoutPayloads`).

---

## 9. Verification debt worth knowing about

Stated plainly rather than buried:

* **Promotion was only partially exercised** in the 1.6d-2 game session — the
  hero worked the Academy but no offer appeared inside the observation window.
  It is covered by unit tests and was seen working in earlier slices.
* **Slice 1.7 was measured, not seen.** Its whole point is how the mat looks, and
  screenshots do not work in the preview pane. The owner was asked to play it.
  If they have not, that check is still outstanding.
* **A true pointer drag at a non-default mat size** was never exercised; the
  engine's placement route and the pointer-conversion input were checked
  separately instead.

---

## 10. Still-open design questions

From the concept, not yet decided and not blocking slice 1.8: the Vault's fate
(Stage 3), growth authoring (Stage 3), painting tools beyond disallow, and loot
pickup with walking heroes (Stage 2).

⚠️ The **Time Bank** is out of scope by the owner's instruction — they may remove
it entirely. Do not try to make it work.

---

## 11. Suggested first move

Ask the owner whether they have played slice 1.7, since its verification is the
one piece of genuine debt, then plan slice 1.8 and bring them the design
questions as multiple choice **before** writing any code. That is the rhythm this
project has run on throughout: plan, ask, build on a branch, verify against the
baseline and in the game, report honestly, merge.
