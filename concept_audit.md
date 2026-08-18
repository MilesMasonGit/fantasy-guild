# Concept Audit — which of these are actually features?

**For the owner to fill in.** Prepared 2026-08-18, before code review round 2.

## Why this exists

The `theme` field turned out to be something an agent introduced rather than a
feature you asked for — and it had reached the code, the content JSON, the
tests, the CMS editor, *and* your decision log as **D-139** and **D-166**.

That last part is what makes this audit necessary. The review's rules tell each
session to check the decision logs before calling something broken, and never to
re-litigate a locked decision. If some entries in those logs are an agent's
inventions wearing the same D-numbers as your real decisions, then nine review
sessions will faithfully preserve things you never wanted. That is a plausible
account of how a lot of the tangle got here.

Only you can settle this. The code cannot tell us which concepts you wanted.

## How to use it

Mark each entry:

- **REAL** — a feature you want; the review treats it as intended
- **NOT REAL** — never a feature; schedule it for removal like `theme`
- **ABANDONED** — was real once, isn't any more; remove it
- **?** — you're not sure; I'll dig into what it does and report before you decide

Skip anything you don't have an opinion on and leave it `?`. A half-filled audit
is still worth far more than none.

**Sizes below are lines of code, and they're indicative, not exact** — a concept
usually leaks past the file that names it.

---

## A. Confirmed not real

| Concept | Where | Size | Status |
|---|---|---|---|
| **Token / Map `theme`** (woodland, riverlands) | `tokenConstants.TOKEN_THEMES`, `tokenRegistry`, `mapRegistry`, `Cartographer` price stepping, `TokenGroups`, `recipePoolRegistry`, `tagRegistry`, `data/tokens.json`, `data/maps.json`, CMS editor | ~11 src files + 2 data files + 3 test files + a CMS surface | ✅ **NOT REAL** (confirmed 2026-08-18) — removal pending |

⚠️ There are **two unrelated `theme` concepts** in the code. The visual/UI theme
(`SettingsManager`, `SettingsModal`, `GISurface`, `AudioSystem`) is real and
stays. Only the content theme on Tokens and Maps goes.

Also to strike when it goes: **D-139** and **D-166** in `playmat_decisions.md`,
plus theme references in `cms_rework_v2_decisions.md`, `playmat_roadmap_v1.md`
and `cms_rework_v2_roadmap.md`.

---

## B. Strong evidence of abandonment — these need your call

### B1. The entire **card** system — ~2,200 lines · your verdict: ______

**The big one.** Before Tokens, the game ran on Cards. That machinery is still
here and still imported by live code, but it appears to be running on empty.

- **The evidence it's dead**: `DatabaseManager.cardFiles` is set to `{}` with a
  comment saying `data/cards/` was moved to `data/archive/cards/` during the
  playmat rework. So `cardRegistry.CARDS` loads from nothing — the registry is
  effectively empty at runtime, bar 3 entries in `specialCards.js`.
- **The evidence it's alive**: `cardRegistry` is imported by nine modules
  including `GameState`, `DiscoveryManager`, `QuestBoardSystem` and
  `WorkProcessor`. Something still calls into it every run.
- **Size**: `src/systems/cards/` + `src/config/cards/` = **2,203 lines** across
  17 files, plus `cardRegistry` (390) and `cardConstants` (111).

**Caveat, and it's important**: some files under `systems/cards/` are genuinely
live — the board uses the combat processors and `CardPreflight`. So this is
probably not "delete the folder" but "a live engine is living inside a dead
feature's namespace", which is its own kind of mess.

**Question: are Cards still a concept in the game at all, or did Tokens replace
them entirely?**

### B2. Concepts that only the card system references · your verdict: ______

These three have exactly one importer each: `cardRegistry`. If Cards go, they go.

| Concept | File | Size |
|---|---|---|
| **Invasions** | `invasionRegistry.js` | 133 |
| **Events** (random events?) | `eventRegistry.js` | 121 |
| **Dungeons** | `dungeonRegistry.js` | 70 |

**Question: are invasions, random events and dungeons features you want?**

### B3. **Biomes** — 350 lines · your verdict: ______

`biomeRegistry.js` is one of the largest registries, imported by `CardValidator`,
`Formatters` and the barrel. But `tokenConstants.js` states plainly: *"there are
no biome systems, bonuses or mechanics anywhere in the game. Names are flavour."*

So the code both asserts biomes are meaningless **and** carries 350 lines of
them. One of those is wrong.

**Question: are biomes flavour, a real mechanic, or another `theme`?**

### B4. Registries whose only importer is the barrel · your verdict: ______

`registries/index.js` re-exports everything, which makes these look used when
nothing actually consumes them:

| Concept | File | Size |
|---|---|---|
| **Tiles** | `tileRegistry.js` | 192 |
| **Names** (generated names?) | `nameRegistry.js` | 90 |

**Question: is either of these live?**

---

## C. Vocabularies nothing enforces

Not necessarily invented — but defined in one place and then not used, with the
engine comparing bare strings instead. Classic drift.

### C1. `tokenConstants.js` · your verdict: ______

Defines the canonical `TOKEN_TYPES` (9), `TOKEN_RARITIES` (4) and `TOKEN_THEMES`
(2), with `isTokenType` / `isTokenRarity` / `isTokenTheme` guards.

**Nothing in the running game imports it.** Its only consumers are
`ContentRules.test.js` and the CMS. The engine checks token types by comparing
string literals directly.

**Question**: should the engine use these constants (so a typo is catchable), or
are the constants redundant?

### C2. The nine **Token types** · your verdict: ______

`resource`, `station`, `passive`, `context`, `buff`, `manager`, `market`,
`enemy`, `map`. Each carries a D-number in the source comments — and `theme` has
taught us those aren't proof of anything.

**Question: are all nine real? Any that an agent invented?** Flag any that look
unfamiliar and I'll trace what they actually do.

### C3. **Rarity** · your verdict: ______

Documented as "drop frequency and nothing more — must never become a power
tier". Worth confirming that's your intent, since it's the kind of rule an agent
would invent to justify a field.

---

## D. Probably real — quick confirmation only

Please just tick or strike these; I don't expect surprises, but `theme` came from
somewhere.

| Concept | Where | Size | REAL? |
|---|---|---|---|
| **Skills** (the 27) | `skillRegistry.js` | 266 | |
| **Jobs / promotion tree** | `jobRegistry.js` | 317 | |
| **Items** | `itemRegistry.js` + `data/items.json` | 148 | |
| **Tokens** | `tokenRegistry.js` + `data/tokens.json` | 315 | |
| **Enemies** | `enemyRegistry.js` + `data/enemies.json` | 459 | |
| **Maps** | `mapRegistry.js`, `guildHallMaps.js` | 169 | |
| **Status effects** | `statusRegistry.js` | 171 | |
| **Quests** | `questRegistry.js` + `data/quests.json` | 99 | |
| **Recipes / recipe pools** | `recipeRegistry.js`, `recipePoolRegistry.js` | 188 | |
| **Equipment categories** | `equipmentCategories.js`, `equipmentConstants.js` | 273 | |
| **Triggers** | `triggerRegistry.js` | 103 | |
| **Loot / drop tables** | `dropTableRegistry.js` | 131 | |
| **Traits** | `traitRegistry.js` | 143 | |
| **Classes** (cosmetic per the 15-skill rework) | `classRegistry.js` | 141 | |
| **Tags** | `tagRegistry.js` | 211 | |
| **Area sets** | `areaSetRegistry.js` | 180 | |
| **Modifier palette** (CMS authoring only) | `modifierPalette.js` | 164 | |

---

## E. One question that isn't about a concept

**Do you want the decision logs audited too?**

`theme` reached `playmat_decisions.md` as two numbered decisions. If agents wrote
entries there that you never approved, the logs are unreliable as "current
truth" — which is exactly the authority the review guide grants them.

Options, roughly in order of cost: leave them and treat every D-number as
*suggestive* rather than binding; have me flag the ones tied to concepts you mark
NOT REAL here; or read the decision logs properly against your memory, which is
the only way to actually know.

---

## What happens next

1. You mark up whatever you have opinions on.
2. Everything **NOT REAL** or **ABANDONED** becomes a removal task, handled like
   `theme` — code, data, tests, decision-log entries.
3. Everything **?** I investigate and report on before you decide.
4. The rest is confirmed as intended, and the review can finally stop asking
   "is this a feature or is this mess?" for each one.

This ordering matters: removing an invented concept deletes code, tests and docs
in one clean sweep, and it's much cheaper than reviewing that code carefully
first and *then* deleting it.
