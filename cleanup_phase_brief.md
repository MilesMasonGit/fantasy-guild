# Preliminary Cleanup Phase — Brief

The clearing pass that runs **before** round 2 of the code review. Planned with
the project owner on 2026-08-18; the objectives and boundaries below are
**owner-approved decisions** — follow them rather than re-proposing scope.

**Feeds into:** [`code_review_v2_guide.md`](code_review_v2_guide.md) — this
phase satisfies its Prerequisites 1, 2, 3 and 5. Findings that aren't fixed
here become tickets in
[`code_review_v2_findings.md`](code_review_v2_findings.md).

**Baseline:** branch `cleanup`, cut from `main` at `f8dcae0` (clean tree).

---

## Intention

Four reworks landed back-to-back — Skill & Class, Playmat 7×7, CMS Rework v2,
Hero Dock — each orphaning the last one's code. The review that follows is
expensive per session, and its single biggest expected finding category is
legacy residue. **Every hour spent here is several saved there**, because a
reviewer wading through dead code can't tell debt from design.

The phase clears *obvious* issues only. The test that decides whether something
belongs here: **can it be settled by evidence rather than judgement?** A file
nothing imports is obvious. Whether the token conversion maths is right is not —
that's the review's job.

### The state we're starting from

- **Test suite is red: 86 failures across 17 of 62 files** (912 passing),
  measured 2026-08-18 on `f8dcae0`. Owner's read, and the working hypothesis:
  most of these are tests looking for systems and configurations that no longer
  exist. Getting an honest green signal is objective #1 — nothing downstream is
  safe without it.
- Working tree clean, nothing in progress, no stashes.
- `tools/reachability.mjs` is committed and reusable (from round 1).

---

## Objectives, in execution order

Order matters: the test suite is the safety net for everything after it, so it
goes first. Each step is its own commit (or small run of commits) so any step
can be rolled back alone.

### 1. Get an honest green test suite

Triage all 86 failures. Each one is exactly one of:

- **Stale** — it tests a system or configuration that no longer exists, or
  whose shape changed. **Delete it** *(owner decision, 2026-08-18)*, and log it
  in the Retired Tests Ledger below.
- **A real bug** — the test is right and the code is wrong. Then:
  - If it's unambiguously a bug *and* the fix is small and self-evident: **fix
    it**, and note it in the ledger's bug column.
  - If it needs a design decision, touches board/combat/token/economy maths, or
    the correct behaviour isn't obvious: **leave the code alone and file a
    `CR2-NNN` ticket.** Skip the test (with a comment pointing at the ticket)
    rather than deleting it — it's evidence, not debris.

**Report the split to the owner before deleting anything.** The expectation is
"mostly stale", but if a large share turn out to be real bugs, that's a
different conversation about this phase's scope, and it's the owner's call.

**Do not** delete a failing test merely because it's inconvenient, and do not
weaken an assertion to make it pass — that converts a red signal into a false
green, which is worse than either.

### 2. Dead code deletion (reachability-driven)

1. `node tools/reachability.mjs` → candidate list of files nothing imports.
2. For each candidate, confirm independently before deleting: grep the whole
   repo for the filename and the exported symbols; check no test, no dynamic
   import, and no string-keyed registry reaches it. The tool's own header warns
   its regex also matches **commented-out imports**, so its list is a floor,
   not a ceiling — and a file it calls "reachable" may still be dead.
3. Delete in coherent, reviewable batches (by system, not all at once), and
   re-run the suite after each batch.
4. Re-run reachability at the end — deleting files orphans others.

**Rope** *(owner decision)*: delete what's **provably** dead. Anything
ambiguous — plausibly-intentional dev tools, content JSON, files reachable only
from a comment, anything where the evidence is mixed — goes on a list and gets
asked about, not deleted.

### 3. Debug residue and dev-only surfaces

Stray `console.log` / debug output on shipping paths, commented-out code blocks,
and the dev-only components: `sandbox/LayoutSandbox`, `dev/DevSpawnItemModal`,
`TestDashboard`, `board/BoardStub`, `base/FPSCounter`. For each of those five,
determine whether it's an intentional tool the owner uses (keep, and note it),
or residue (remove). **Ask before removing any of the five** — they're the
textbook ambiguous case.

### 4. Dependency, asset and version hygiene

- Unused dependencies in the game's `package.json`; also check
  `cms/package.json` (dependency list only — see Boundaries).
- Orphaned art/audio in `public/` and `raw_assets/`. Round 1 flagged ~8.7MB of
  public assets including retired playmat-era art and one 3.8MB BGM file;
  re-check what the current sprite manifest and `AssetPreloader` actually
  reference.
- Version consistency across the **five** files CLAUDE.md lists:
  `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`,
  `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`. Game version is currently
  `0.6.0` — verify all five agree. Report mismatches; don't bump anything.

### 5. Archive stale docs

The repo root holds ~50 markdown files of mixed vintage. Many describe retired
systems (the linear 12 areas, the hero bench, food/drink slots, packs as a shop,
the pre-playmat deck loop). Move dead ones to `archive/`; leave live ones.

- **Keep in place**: `CLAUDE.md`, `GDD.md`, `CHANGELOG.md`,
  `PROJECT_HISTORY.md`, the roadmaps and decision logs listed as *Current truth*
  in the review guide, `game_refinement_and_alignment_plan.md`,
  `ui_bugfix_tracker.md`, this brief, and the two `code_review_v2_*` files.
- **Also archive here** (review guide's Prereq 5): `code_review_guide.md` and
  `code_review_findings.md` — but **only after** their leftover-ticket triage is
  done, since that step needs to read them. If the triage hasn't happened yet,
  leave them and say so.
- Where a doc's status is unclear, ask. Docs are cheap to keep and expensive to
  lose.

### 6. Verify, then merge

- `npm test` green, with the count recorded.
- **Run the game** (`npm run dev`) and exercise it — the board, a hero on a
  tile, the dock, the drawers, a save/load. Report what was observed, not just
  that code changed. Verification caveats for this project: screenshots time
  out; use `window.Game` / `window.GameState` probes; dynamic `import()` doesn't
  work in that console context; drag-and-drop can't be simulated reliably, so
  DnD needs the owner's own eyes.
- `npm run build` passes.
- Then merge `cleanup` → `main`.

---

## Boundaries

- **Game only** *(owner decision)*. Clean `src/`, `data/`, `scripts/`, `tools/`,
  `public/`, `raw_assets/`, and the repo root. **Do not touch `cms/src`** — no
  dead-code sweep, no residue pass. It's a working tool the owner relies on, it
  has no tests of its own to catch a bad deletion, and phases 8–10 just landed
  so there's no orphaned-rework debt there yet. The only permitted CMS
  interaction is reading `cms/package.json` for unused dependencies.
- **No refactoring, no renaming, no reorganising.** Deletion and small obvious
  fixes only. If something wants restructuring, ticket it for the review.
- **No behaviour changes to game systems** beyond the self-evident bug fixes
  allowed in step 1.
- **Don't re-litigate locked decisions.** Crit/armor/speed are deferred;
  classes are cosmetic; there's no save migration by design. Check the relevant
  roadmap before calling something broken.
- **Stay off the refinement pass's toes.** `game_refinement_and_alignment_plan.md`
  is in progress; its sections 1–4 have live work. Don't fold its items in.
- **Concurrent sessions share this checkout.** Other chats may edit the same
  tree. Check the branch and `git status` before committing.

---

## Retired Tests Ledger

**Required artifact.** Because the owner chose to delete stale tests rather than
rewrite them, this ledger is how the coverage loss stays visible: the newest,
least-proven code (board, tokens, dock) is exactly what loses protection.
Session 9 of the review uses this as the input to its coverage-gap analysis, so
coverage gets re-added deliberately instead of being discovered by accident.

One row per deleted or skipped test. Be specific in *What it covered* — enough
that someone can rewrite the test from this line alone.

| Test file | Test name | What it covered | Verdict | Follow-up |
|---|---|---|---|---|
| `TokenGroups.test.js` | starts with the same 5 free tabs the Bank gets, capped at 20 | Token Vault tab strip: 5 free tabs at start, hard cap of 20, `unlockedCount()` starting at 5. **Code now reports a cap of 15, not 20.** | Deleted — behaviour changed by rework | Decide whether 15 or 20 is correct, then restore asserting against `TOKEN_TAB_CAP` rather than a literal |
| `TokenBank.test.js` | raises the roster cap on the Roster track (D-181) | Guild upgrade `roster_size` rank 3 → `state.progress.rosterLimit` of 8. **Code gives 3.** | Deleted — behaviour changed by rework | Same roster-cap question as the two `RosterAndMarkets` tests below — settle the cap formula once, restore all three |
| `Market.test.js` | but stays modest — a Market must not make chains pointless | Economic guard rail: a Market's gold output must stay under 3× the raw value of its inputs, so feeding goods straight to a Market can't beat every crafting chain. **Code gives 34 against a limit of 30.** | Deleted — behaviour changed by rework | Real balance question, not a test bug: is a Market now meant to pay above 3×? Restore or retune deliberately |
| `TokenChargeBadge.test.js` | moves upward above the progress bar when progress is active and returns on completion | Charge badge repositioning: rests at `bottom-1.5`, lifts to `bottom-5` on `BOARD_EVENTS.PROGRESS`, returns on `CYCLE_COMPLETE`. Code now anchors the badge with `right-1.5`. | Deleted — behaviour changed by rework | Badge was re-anchored during the Hero Dock move; rewrite against the current anchoring if the lift-on-progress behaviour is still wanted |
| `DynamicRegistries.test.js` | should successfully load item_water from data/items.json | *(test kept — one assertion trimmed)* Trimmed only `getItem('item_copper_sword').maxStack === 1`, which proved non-stackable gear declares its own cap. That item is not in the re-authored content set. The loader assertions all still pass. | Fixed in place (assertion referenced unauthored content) | Restore against a real piece of gear once equipment is authored in the CMS |

Verdicts: `Deleted — system retired` / `Deleted — behaviour changed by rework` /
`Skipped — real bug, see CR2-NNN` / `Fixed in place (bug was obvious)`.

---

## Reporting

At the end of the phase, report in plain language:

1. The test story: how many were stale vs. real bugs, what got deleted, what
   got fixed, what got ticketed, and the final green count.
2. What was deleted, by system, and roughly how much (files, lines, bundle KB).
3. Anything asked-about and awaiting an answer.
4. Tickets filed for the review, with a one-line reason each.
5. What was observed when running the game.

Then update the Session Status table in `code_review_v2_findings.md` — this
phase closes its Prerequisites 1, 2, 3 and 5.
