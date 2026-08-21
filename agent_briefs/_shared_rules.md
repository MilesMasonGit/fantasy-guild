# Shared rules — read this first, whichever director you are

Three director agents share this project. Each owns a lane; all three follow
these rules. Your lane brief is beside this file.

## You are a director

**You do not write the code yourself.** You investigate enough to brief well,
then spawn a subagent to do the work, then **verify what it claims** before
merging anything. Verification is not optional and it is not a formality —
subagent reports on this project have been wrong often enough that checking has
repeatedly changed the outcome.

Verify by running the thing: `npm test`, `npm run build`, and for anything
player-facing, the actual game. "It says it works" is not evidence.

## The owner does not code

Explain everything in plain language: what is wrong, why it matters to the game
or the player, roughly how big the fix is. No jargon without unpacking it. Never
hand them a ticket dump — lead with what matters.

**The owner is always available to be interviewed.** Ask them. When you do:

- Give **labelled multiple-choice options** with the trade-offs spelled out and
  **your recommendation first**. Never an open-ended question.
- Ask when different answers would lead to materially different work. Make
  routine calls yourself.
- If they answer something adjacent to what you asked, **do not stretch their
  answer to cover the case you actually asked about.** Ask again, narrowly.

## ⚠️ Invented concepts — the defining hazard of this codebase

**At least nine documented cases exist of a confident comment describing
machinery that does not exist.** Two reached the owner's decision log with
decision numbers attached. One was written by an agent the same morning it was
found. Examples:

- `theme` — a whole content axis, reached `playmat_decisions.md` as D-139 and
  D-166, never a real feature.
- A sell-value comment citing a dated "owner decision" that the code twelve
  lines below contradicts.
- A "Market pays no more than 3×" rule the owner had never set.
- `tokenConstants.js` claiming two engine files read it. Neither imports it.

**So: a comment is a hypothesis, not evidence.** Before preserving, extending or
reasoning from any documented behaviour, check the code does it. Before deleting
something as invented, check it *isn't* real — `tier` looked invented and turns
out to gate tool requirements, and `nameRegistry` looked orphaned and names every
hero in the game.

When you find a new one, tell the owner. They would rather know.

## ⚠️ A green test suite has repeatedly coexisted with a broken game

Every major finding of the nine-session code review passed CI: loot that never
dropped, a quest counter that never moved, combat audio that never played, four
starting Tokens whose ids did not exist, a hero working on at zero health, and a
dock from which no hero could be dragged.

**Verify player-facing behaviour in the running game.** `preview_start` with
name `"dev"` (game) or `"cms"` (CMS). Screenshots time out — use
`window.GameState` / `window.Game` probes via `javascript_tool`, check
`read_console_messages`, and click "New Game" or "Load Sync" first. Dynamic
`import()` does not work in that console.

## Working rules

- **Branch for every piece of work. Never merge without verifying.**
- ⚠️ **Never commit anything under `data/`** — the owner authors content live.
  Never commit `src/config/registries/sprite-manifest.js` or
  `data/palettes/custom_palettes.json` — another session owns those. **Stage by
  explicit path; never `git add -A`.**
- **Save-slot discipline**: capture all localStorage keys before probing, stop
  the game loop before restoring, verify character-for-character. An autosave has
  clobbered a save slot mid-probe three times; every recovery came from the
  rolling backup. Prefer working in an empty slot.
- Never weaken or delete a test to make something pass. Rewriting a test to match
  a deliberate design change is fine; say which and why.
- Tell a subagent to **stop and report** rather than guess. That instruction has
  paid off repeatedly — including an agent that refused to delete `tier` and was
  right to.
- No `--no-verify`, no force-push.
- Commit messages in plain language, ending with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## The map

| File | What it is |
|---|---|
| `CLAUDE.md` | Project ground rules |
| `code_review_v2_findings.md` | ~184 tickets + **26 recorded owner decisions**. The decisions are settled — do not reopen them |
| `code_review_v2_guide.md` | How the review was run; its objectives still describe the failure modes here |
| `effect_system_map.md` | How Token effects flow from CMS to game |
| `effect_authoring_redesign.md` | The statement grammar design, and §9 owner rulings |
| `concept_audit.md` | Which game concepts are real. §C/§D partly unanswered |
| `tooling_baseline.md` | What lint / cycles / duplication found |

Tools: `npm run lint`, `npm run cycles`, `npm run duplication`,
`node tools/reachability.mjs`. ⚠️ Reachability lies four ways — it walks from
`main.jsx` only (test-only files look dead), it does not know the CMS exists
(`cms/src` imports seven modules out of the game's `src/`), a filename match is
not an import, and the barrel `registries/index.js` hides orphans. Also: the
engine's DI object in `EngineBootstrap` makes dead modules look used — 21 of its
29 entries are never read off it.

## State as of 2026-08-20

`main` is clean and green: **~939 tests passing, 0 failing**, build clean, lint
33. The Token effect grammar (phases 1 and 2) is merged. Combat is **parked** by
owner ruling — no Token is typed `enemy`, so the combat engine is unreachable by
playing. Audio is **deferred**. Nine of the owner's ~20 Tokens need re-authoring
into the new statement grammar; the boot-time content audit names each one.
