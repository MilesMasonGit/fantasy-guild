# Kickoff — Editor UX pass and content shakedown

## The job

Two things, in this order:

1. **Reorganise the CMS editor UI so it is pleasant to author in.** It has grown
   by accretion across several reworks and nobody has ever laid it out on
   purpose.
2. **Author Tokens across many different configurations and find what breaks.**
   The economic simulator that drives all of this shipped a week ago against a
   thin, uniform corpus. It has barely met real variety.

## Read first

- [`docs/economic_simulator_reference.md`](economic_simulator_reference.md) —
  what the simulator is, how the passes fit together, what each file does, and a
  section on *things that will look like bugs and are not*. **Read that section
  before reporting anything as broken.**
- [`CLAUDE.md`](../CLAUDE.md) — how I work. In short: I don't code, so explain in
  plain language; ask me design questions as labelled multiple choice with a
  recommendation first; verify before saying something is done; and stay in
  scope — tell me about unrelated things you spot rather than folding them in.

Skim, don't study:
[`docs/economic_simulator_roadmap_v1.md`](economic_simulator_roadmap_v1.md) —
its phase table records every deviation and ruling from the build, which is the
fastest way to find out whether something odd is deliberate.

## How to run things

- `npm test` — currently **1764 passed / 28 skipped**. Green at every stopping
  point.
- `npm run dev` — the game. Screenshots time out in this environment; probe
  through `window.Game` / `window.GameState` instead. Dynamic `import()` does not
  work in the console.
- The CMS is a **separate Vite app** — run it from `cms/` with its own
  `npm run dev`.
- To exercise the simulator over real content, write a scratch vitest file and
  delete it afterwards. That is how every phase of the build was verified.
  `cms/src/engine/sim/dryRun.mjs` will not run under plain `node`.

## ⚠️ Two hard rules

**Sync writes `data/` from whatever is loaded in the CMS's browser store.** Load
the wrong workspace, press Sync, and it overwrites the real content on disk. This
has already destroyed my work once. Before syncing, confirm the store holds the
real corpus — currently **62 tokens, 38 items, 6 recipes, 7 maps**. If it looks
wrong, stop and ask me.

**Never name a shipped token, item, recipe or map id in a test.** I author
content continuously, and tests that named content have broken about a dozen
times while nothing was actually wrong. Assert the rule against whatever exists;
use fixtures for specific shapes.

## Part 1 — The UI

Start by using it, not by reading it. Author a Token from scratch, then a
Recipe, then a Map, and notice where you have to hunt, scroll, or guess. Bring
me a short list of what you found before you change anything.

Things I already know are awkward, so you don't need to rediscover them:

- **The Economy Audit tab is where the simulator's output lives** — refusal
  cards, the churn report, the Map table, anchor re-elections. That panel was
  written for one purpose and has had three more bolted on.
- **Derived fields and authored fields sit side by side** with little to tell
  them apart. The simulator overwrites the derived ones on every Recalculate,
  and it isn't obvious which those are.
- **The Simulator Panel** (`SimAnswer.jsx`) carries a lot at once: cycle in band,
  anchor badges, tuning diffs, an earn gauge, a lifetime line, inline refusals,
  a stale badge.

Design decisions about layout are **mine to make** — bring me options, with a
recommendation, rather than rebuilding on your own judgment.

## Part 2 — The content shakedown

This is where the real value is. The simulator has been exercised against a
corpus that is mostly level-1, mostly 12-second, mostly common, mostly
single-output Tokens. Push on the axes it has barely seen:

- **High levels.** Two tokens sit at level 70 and 90; everything else is level 1.
- **Multi-output Tokens** — especially one common output plus one scarce one.
  The scarcity split compounds twice, so a ten-times-rarer output is worth a
  hundred times more per unit. I want to see whether that feels right in
  practice.
- **Chains more than two steps deep.** Craft margins compound.
- **Recipes that consume several different items.**
- **The rarities above common.** Almost nothing shipped is uncommon or above, so
  the rarity weights and scrap premium have barely been exercised on real content.
- **Charges** — very short-lived and very long-lived Tokens, and unlimited ones.
- **Maps with deep pools**, mixed rarities, and prices that actually sit on the
  return curve.

For each configuration: author it, Recalculate, and read what the simulator says.
**A refusal is not necessarily a bug** — it may be the tool correctly telling me
my content is wrong. What I want to know is:

1. Does it refuse when it should, and accept when it should?
2. Does the refusal tell me what to change, in words that make sense?
3. Does anything crash, hang, produce `NaN`, or silently do nothing?
4. Does anything read as *passing* that should have failed? (That is the worst
   category — a bug of exactly this shape shipped and was caught late.)

Keep a running log and bring me findings in batches, sorted by whether they are
engine bugs, UI problems, or content of mine that needs fixing.

## What is already known and not worth reporting

- Enemy, gold and raw-item Map pool entries are fixture-proven only; the Map
  editor can't author them, and the runtime spawns a bogus sprite for unknown
  kinds.
- The anchor re-elect button has never fired on real content, because no item's
  stored election currently disagrees with the rule.
- `useEntityStore` doesn't pass enemies to the connectivity auditor.
- `dryRun.mjs` needs a Vite runner.
- Five items have no producer at all (water, coins, dough, blueberry pie, shrimp
  trawler potion) and are correctly reported as orphans.

## Working style

Small slices, committed when verified — `npm test` green each time. Branch from
`main` for anything more than a one-liner. Log what lands in `CHANGELOG.md` under
`## [Unreleased]`.

If you find something in the simulator's design that seems wrong rather than
mis-built, **stop and ask me** — that design took two review passes and 24
rulings, and most of the surprising parts are deliberate and recorded.
