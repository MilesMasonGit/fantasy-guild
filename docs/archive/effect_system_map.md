# Effect System Map

*A technical description of how Token effects travel from the CMS into the game,
written 2026-08-20 for the effect-authoring redesign. Read-only investigation —
nothing in the code, content or config was changed.*

**What this is for.** You said the CMS is cumbersome for giving Tokens their
game-defining effects, that some things aren't wired in, and that you'll be
adding many more effect types as development goes on. This document is the
factual half of that problem: what the machinery actually is today, verified
against the code rather than against comments. It deliberately does **not**
propose a new UI.

**How to read it.** Section 1 is the important one — it answers "what does one
more effect type cost?", because that number decides the shape of the work.
Sections 2–7 are the supporting detail. Section 8 lists bugs found along the
way, which I have **not** fixed.

**One framing correction up front.** Your brief pointed at ticket CR2-074 as the
"half-wired effects" ticket. CR2-074 is real and I verified it exactly — but it
is about **gear/equipment** effects on heroes, a different subsystem from Token
effects. Its nine-unread/three-unwritten census does not apply to Tokens. The
Token effect palette turns out to be in *much* better shape than that. Section 4
gives both tables so the distinction is clear.

---

## 1. ⭐ What adding one new effect type costs today

### The short answer

For a **plain number** effect (the common case — a value that scales something),
adding one costs **three edits in three files**, and the whole job is perhaps
twenty lines. That is genuinely cheap.

The problem is not the cost. **The problem is that two of the three steps fail
silently if you skip them**, and the silent failure looks exactly like a working
effect right up until you play the game and notice nothing happened.

### The three files, in order

| # | File | What you add | If you forget |
|---|---|---|---|
| 1 | `src/systems/effects/constants.js` | One line in `EFFECT_TYPES`, e.g. `CHARGE_SAVE: 'CHARGE_SAVE'` | **Silent.** `EFFECT_TYPES.CHARGE_SAVE` evaluates to nothing, the palette row below gets an empty type, every Token authored with it stores an effect with no name, and the game's lookup matches nothing. The CMS still shows the button and still lets you fill in a number. |
| 2 | `src/config/registries/modifierPalette.js` | One entry in `MODIFIER_PALETTE`: type, label, shape, group, hint | **Loud, in the good way.** The button simply never appears in the CMS. You notice within seconds because you cannot author the thing. This is the one step that fails usefully. |
| 3 | The consumer — usually `src/systems/board/BoardRunner.js` | One call: `TileModifiers.resolveAxis(index, EFFECT_TYPES.CHARGE_SAVE, base, config.skill)` at the point in the cycle where the number is used | **Silent, and this is the dangerous one.** The CMS offers the effect, you author it, it saves into `data/tokens.json`, the game loads it, the tile's modifier store holds it correctly — and nothing ever asks for it. Zero warnings, zero test failures, zero visual difference. |

Step 3 is the whole story. Steps 1 and 2 are bookkeeping; step 3 is the actual
feature. And step 3 is invisible by omission.

### Why step 3 is invisible

The engine's modifier store (`ModifierAggregator`) is a completely generic bag.
`addModifier` accepts any object with a `source` field and stores it — there is
no check that the `type` is a known effect (`ModifierAggregator.js:122`). On the
reading side, `_forEachMatching` filters with a bare string comparison,
`mod.type !== effectType` (`:330`). So:

- an effect nobody reads is stored forever and never asked for → silent;
- an effect type with a typo matches nothing → silent;
- an effect read by the game that nobody authors resolves to zero → silent.

There is no registry of "who consumes what", and nothing at boot cross-checks
the palette against the consumers. The good news is that this makes step 3 the
**only** thing that has to be got right; the bad news is that it is exactly the
step with no safety net.

### The worked example you asked for

You suggested *"reduces the cycle time of the Token below it."* Walking that one
concretely turns up two separate answers, and the split matters:

**The "reduces cycle time" half already exists.** It is `WORK_TIME`, palette row
2, already fully wired: `BoardRunner.js:402` resolves it, floored at one second.
Authoring it today takes zero code — put a Work Time modifier on a block with a
negative percentage value. So that particular effect costs nothing.

**The "below it" half does not exist and is not a small change.** Adjacency in
this game has no direction. `neighboursOf(index)` returns all eight surrounding
tiles as an unordered set, and every consumer — `TileModifiers.applicableBlocks`,
`RecipeResolver.contextTiersAround`, `TriggerSystem.handleAdjacent` — iterates
that set with no notion of which side a neighbour is on. Adding directional
targeting is a change to the adjacency layer, then to the block data shape
(a direction field), then to the CMS. That is a structural feature, not a new
effect type, and it would touch all four of the same files plus `adjacency.js`.

So for a clean walkthrough of a genuinely new effect, take **"a chance the
neighbour's cycle does not spend a charge"** — call it `CHARGE_SAVE`. It is a
proc (a percentage rolled once per cycle), which is the most common new-effect
shape after a plain scalar.

1. `src/systems/effects/constants.js` — add `CHARGE_SAVE: 'CHARGE_SAVE'`.
2. `src/config/registries/modifierPalette.js` — add
   `{ type: EFFECT_TYPES.CHARGE_SAVE, label: 'Charge Save Chance', shape: PROC, group: 'Support', hint: '…' }`.
3. `src/systems/board/BoardRunner.js` — inside `completeCycle`, at the charge
   decrement around line 235, resolve the axis and roll it before decrementing.

Three files. Nothing in the CMS changes at all — it reads the palette and
renders a proc row automatically. That is the system working as designed, and
it is worth saying plainly: **for scalar and proc effects, the CMS already
extends itself.**

### Where it stops being three files

The cheap path holds only while the effect is a **number**. The palette declares
four "shapes" (`MODIFIER_SHAPES` in `modifierPalette.js`), and the shape decides
how much extra work there is:

| Shape | What the effect carries | Extra files beyond the three |
|---|---|---|
| `deterministic` | `{ type, bucket, value }` | none |
| `proc` | same, value is a percentage | none |
| `item` | `{ type, itemId, chance, quantity }` | four more (below) |
| `convert` | `{ type, consumes: [], produces: [], chance }` | four more (below) |

A **new shape** — say an effect that names a *skill* rather than an item, or one
that carries two numbers — costs these four additional edits, none of which are
enforced:

| File | What it holds | If you forget |
|---|---|---|
| `cms/src/stores/useEntityStore.js` (`makeModifier`, line 398) | the blank payload a new modifier of that shape starts with | **Silent and actively harmful.** The `if` chain falls through to `return { type, bucket: 'percentage', value: 0 }` — you get a scalar payload for a non-scalar effect. |
| `cms/src/components/editors/EffectBlocks.jsx` (`ModifierRow`, line 566) | the form fields for that shape | **Silent.** The nested ternary falls through to the bucket-and-value form, so the author fills in a number for an effect that wanted an item. |
| `cms/src/components/editors/EffectBlocks.jsx` (`summarise`, line 951) | the one-line description in the collapsed block header | Cosmetic — shows a wrong summary. |
| `cms/src/engine/descriptionDictionary.js` | the player-facing Token description | Cosmetic, **and already broken for every shape** — see bug B1. |

Plus, if the effect is not a plain scalar, the game's consumer cannot be
`resolveAxis` — it needs its own collector, the way `BONUS_DROP` uses
`TileModifiers.collectItemGrants` and `CONVERT` is handled directly in
`TriggerSystem.fireBlock`. So a fifth game-side decision appears.

### And two things nothing forces at all

- **Tests.** `src/tests/AdjacencyEffects.test.js` covers the existing axes well
  (roughly 30 assertions on `resolveAxis`), but nothing requires a new axis to
  have a test. The suite stays green whether or not you wire step 3.
- **Content validation.** `src/systems/core/ContentAudit.js` runs at boot and
  reports dangling references (a Token pointing at an item that doesn't exist).
  It does **not** check effect types. An effect naming a type nothing reads
  produces no audit line.

### The one-sentence version

> Adding a scalar effect is three files and about twenty lines, but the file
> that actually makes it *do* something is the one with no guardrail, so
> "authored but inert" is the natural resting state of a half-finished effect.

---

## 2. What an "effect" actually is, end to end

Here is one real authored Token followed all the way through. I have used the
**Forge Altar**, because it exercises two different effect shapes at once.

### Step 1 — what the CMS asks the author for

In the Token editor there is a section called **Effect Blocks**
(`TokenEditor.jsx:392`). The author presses one of five preset buttons — Aura,
Tool/Context, Sustained Aura, Reaction, Grant — which creates a **block**. A
block is one flexible container with five optional parts:

| Part of a block | Question it answers | Where it's edited |
|---|---|---|
| Target | *Who does this reach?* Everything adjacent, or a named tag / Token / category | `EffectBlocks.jsx` lines 128–190 |
| Context / Tool Provision | *What capability does this hand to neighbours?* (e.g. `pickaxe`) | `ProvidesSection`, line 855 |
| Reacts to | *Does this fire on an event instead of applying constantly?* | `TriggerSection`, line 262 |
| Upkeep | *Does keeping this switched on cost items on its own clock?* | `UpkeepSection`, line 431 |
| Modifiers | *What numbers or grants does it actually apply?* | `ModifierRow`, line 566 |

For the Forge Altar the author set the Target to "By exact Token → Forge", then
added two modifiers: a **Work Time** modifier at percentage `0.2`, and a **Bonus
Drop** modifier for 2 Copper Ore at 100%.

### Step 2 — what lands in `data/tokens.json`

Pressing "Sync to Game" writes the whole file. The Forge Altar's entry, trimmed
to the effect:

```json
"token_forge_altar": {
  "name": "Forge Altar",
  "tokenType": "passive",
  "tier": 1,
  "effectBlocks": [
    {
      "target": "token",
      "targetToken": { "mode": "id", "value": "token_forge" },
      "cost": null,
      "modifiers": [
        { "type": "WORK_TIME", "bucket": "percentage", "value": 0.2 },
        { "type": "BONUS_DROP", "itemId": "item_copper_ore",
          "chance": 100, "quantity": 2 }
      ],
      "provides": []
    }
  ],
  "charges": 500
}
```

That is the whole data shape. **Three levels:** a Token has `effectBlocks`; a
block has a target, a cost, a trigger, a `provides` list and `modifiers`; a
modifier has a `type` plus whatever payload its shape requires.

Two things to notice about the payloads, because they are the source of a lot of
the editor's complexity:

- `WORK_TIME` is `{type, bucket, value}` — a number. `bucket` says *how* the
  number combines with others: `flat` adds, `multiplier` multiplies,
  `percentage` is a fraction where `0.2` means +20%.
- `BONUS_DROP` is `{type, itemId, chance, quantity}` — **no `bucket`, no
  `value`**. It is a completely different payload sitting in the same array.

### Step 3 — what the game reads

At boot, `tokenRegistry.js` loads `data/tokens.json` as-is. Nothing validates it.
Whenever the board changes, `TileModifiers.rebuildTile(index)` runs for the
affected tiles and its neighbours. For each tile it walks the eight surrounding
tiles and, for each neighbouring Token's blocks, asks four questions
(`TileModifiers.js:130–170`):

1. Does the block have any modifiers? If not, skip.
2. Does it have a trigger? If so, skip — triggered blocks belong to a different
   system.
3. Is `target` `'hero'`? If so, skip.
4. Does `matchesTokenTarget` say this block's target names the Token on *this*
   tile? For the Altar: `mode: 'id'`, `value: 'token_forge'`, so only a Forge
   matches.
5. Is the block's upkeep paid? (`cost: null` means always paid.)

If all pass, every modifier in the block is copied into that tile's aggregator,
stamped with a source id like `tile:24:token_forge_altar:0`.

### Step 4 — what changes in play

A Forge sitting next to the Altar reaches its cycle-time calculation in
`BoardRunner.js:400`:

```js
const cycleTime = Math.max(1000, TileModifiers.resolveAxis(
    index, EFFECT_TYPES.WORK_TIME, io.cycleTimeMs || config.cycleTimeMs || 10000, config.skill
));
```

`resolveAxis` gathers every `WORK_TIME` contribution reaching that tile, merges
it with any guild-wide ones, and runs the locked three-bucket formula:

```
Final = (Base + Σflat) × (Σmultipliers) × (1 + Σpercentages)
```

The Forge's base is 12000 ms. One +0.2 percentage contribution gives
12000 × 1.2 = **14400 ms**.

⚠️ **Which is slower, not faster.** `WORK_TIME` is milliseconds-per-cycle, and
the palette's own hint says so: *"NEGATIVE is faster."* The Altar's description
reads "Matching tokens gain +20% Speed", but the authored value makes the Forge
take 20% **longer**. This is a live authoring trap, and the fact that the
auto-generated description says the opposite of what the number does makes it
worse. See bug B1.

Separately, the `BONUS_DROP` never goes near `resolveAxis` — an item id is not a
number and cannot go through a formula. It is picked up by a second, parallel
path: `BoardRunner.js:220` calls `TileModifiers.collectItemGrants(index,
BONUS_DROP)` after the Forge's own outputs, rolls each grant's chance, and drops
the ore onto the board.

**So "an effect" is really two different mechanisms wearing one name:** scalars
that flow through a shared formula, and payloads that are collected and executed
by a specific consumer. Every complication in the editor traces back to that
split.

---

## 3. Where the vocabulary is declared

You found four sites. There are **nine**, of which four are genuinely
authoritative, two are legitimate derived copies, and three are stale or wrong.

| # | File | What it declares | Who reads it | Verdict |
|---|---|---|---|---|
| 1 | `src/systems/effects/constants.js` | `EFFECT_TYPES` — 16 names, the engine's full historical bag. Also `TARGET_CATEGORIES`, `SCOPES`, `MODIFIER_SOURCE_TYPES` | The game's consumers, and site 2 | **Authoritative** for names. But it is a bag, not a contract — several entries have no consumer, and its own comments say so |
| 2 | `src/config/registries/modifierPalette.js` | `MODIFIER_PALETTE` — the 8 effect types content may be authored against, plus `MODIFIER_SHAPES`, `MODIFIER_BUCKETS`, `TARGET_MODES` | **The CMS only.** Nothing in the running game imports it | **Authoritative** for what's authorable. See the note below |
| 3 | `cms/src/utils/constants.js` | Nothing about effects of its own — it is a pure re-export of site 2 | Every CMS effect screen | **Correct by design.** A pass-through, exactly as CMS-5 intends |
| 4 | `cms/src/components/editors/EffectBlocks.jsx` | The **shape → form fields** mapping (`ModifierRow`, line 571) and the **shape → summary line** mapping (`summarise`, line 951). Also a hardcoded context-tag list at line 873 | The Token editor | **A fourth de-facto vocabulary.** Adding a shape means editing here, and nothing links the two |
| 5 | `cms/src/stores/useEntityStore.js` | `makeModifier` (line 398) — the **shape → blank payload** mapping. Also `BLOCK_PRESETS` (line 360) | The Token editor | **A fifth.** The same four shapes enumerated a third time, in a third place |
| 6 | `cms/src/engine/descriptionDictionary.js` | A **completely different, obsolete** modifier vocabulary: `mod.axis`, `mod.isPercent`, `mod.targetMode`, `block.convert`, `block.bonusDrop` | Every Token description the CMS generates | **Stale and actively producing wrong text.** See bug B1 |
| 7 | `src/systems/equipment/EquipmentManager.js` (lines 184–306) | Twelve bare uppercase modifier strings for hero gear — `'DAMAGE'`, `'HASTE'`, `'SUNDER'` etc., typed directly rather than imported from site 1 | The hero aggregator | **A parallel vocabulary that bypasses site 1 entirely.** This is CR2-074's territory |
| 8 | `src/config/registries/triggerRegistry.js` | `TRIGGER_EVENTS` (4) and `TRIGGER_SCOPES` (2) — what a block can react to | The game's `TriggerSystem` *and* the CMS | **Authoritative, and the best-behaved of the lot.** Adding a row here makes the trigger available in the CMS with no CMS change, and the game consumes the same list |
| 9 | `src/config/registries/statusRegistry.js` | A third naming style for hero status effects — lowercase snake_case (`yield_pct`, etc.) | `StatusEffectSystem` | Different subsystem, but worth knowing it exists so it isn't mistaken for the Token vocabulary |

Two smaller stale references, not full vocabularies but worth knowing:
`cms/src/engine/contentGenerator.js:77` is an AI prompt telling the model it can
create effects called `THORNS_REFLECT`, `SPEED` and `DAMAGE` — none of which are
authorable or consumable for Tokens. And `data/schemas/` contains three JSON
schema files from the retired card system; nothing loads them.

### On `modifierPalette.js` living in the game's `src/` (CR2-010)

This is real and the review confirmed it: `modifierPalette.js` sits under the
game's source tree but **nothing in the running game imports it**. Its only
consumers are the CMS and a handful of tests. Dead-code tooling reports it as
removable, and during the cleanup phase it nearly was deleted — which would have
broken the CMS with the game's tests still green.

The file's own header explains why it lives there: the intent is that "adding a
consumer and adding a row here should be the same commit," and putting the
palette next to the engine is meant to encourage that. **In practice the file
proximity is doing no enforcement at all** — nothing checks the two ever move
together. Whatever the redesign does, this is the natural place to put a real
link between "authorable" and "consumed" rather than a hoped-for one.

### The duplication, stated plainly

The concept of a **shape** — the thing that decides what payload an effect
carries — is written down in **four separate places** that must agree:
`modifierPalette.js` (declares it), `useEntityStore.makeModifier` (builds the
payload), `EffectBlocks.ModifierRow` (renders the form), `EffectBlocks.summarise`
(describes it). None of them references the others. All four are `if`-chains or
ternaries whose final branch is "assume it's a number". That is why a new shape
silently degrades into a scalar instead of erroring.

---

## 4. What is wired at both ends

### Token effects — the table that matters for authoring

I checked every entry in `MODIFIER_PALETTE` against a grep of every consumer in
`src/`. **All eight are wired at both ends.** You can safely author any of them
today.

| Effect | Shape | CMS can author? | Game consumes it? | Where the game reads it |
|---|---|---|---|---|
| Yield | number | ✅ | ✅ | `BoardRunner.js:192` — scales the rolled output quantity |
| Work Time | number | ✅ | ✅ | `BoardRunner.js:402` — cycle length, floored at 1000 ms |
| Input Cost | number | ✅ | ✅ | `BoardRunner.js:135` — items consumed, floored at 1 |
| XP Bonus | number | ✅ | ✅ | `BoardRunner.js:233` — XP awarded to the working hero |
| Double Loot Chance | proc | ✅ | ✅ | `BoardRunner.js:179` — rolled once per cycle |
| Failure Chance | proc | ✅ | ✅ | `BoardRunner.js:160` — rolled once per cycle |
| Bonus Drop | item | ✅ | ✅ | `BoardRunner.js:220` (ambient) and `TriggerSystem.js:98` (triggered) |
| Convert | convert | ✅ *(only inside a triggered block)* | ✅ | `TriggerSystem.js:102` |

Alongside the modifiers, the other four parts of a block are also wired:

| Block feature | CMS can author? | Game consumes it? | Where |
|---|---|---|---|
| Target (`tag` / `id` / `tokenType`) | ✅ | ✅ | `TileModifiers.matchesTokenTarget` |
| Trigger — 4 events, 2 scopes | ✅ | ✅ | `TriggerSystem.init` / `handleAdjacent` / `handleGlobalItemThreshold` |
| Upkeep (items on a cadence) | ✅ | ✅ | `BlockUpkeep.tickUpkeep`, gating via `isBlockPaid` |
| Context / Tool provision | ✅ | ✅ | `tokenRegistry.getProvidedTagsWithTiers` → `RecipeResolver` |

**So the headline answer to "which effects are half-wired?" is: for Tokens, none
of them are.** That is a genuinely good result and worth knowing before the
redesign starts, because it means the redesign is about ergonomics and future
safety, not about repairing a broken pipeline.

### But five real gaps sit around the edges

These are places where the *combination* is unwired even though each piece is
fine on its own. Every one of them fails silently.

| Gap | What happens | Verified |
|---|---|---|
| **A number modifier inside a triggered block does nothing.** `TileModifiers.applicableBlocks` skips any block with a trigger (line 158), and `TriggerSystem.fireBlock` only handles `BONUS_DROP` and `CONVERT` (lines 98, 102). So a Yield or Work Time modifier on a Reaction block is dropped by both systems | Silent. Nothing warns. The CMS happily offers all six number effects on a triggered block | Read both files |
| **`target: 'hero'` is skipped by everything.** `TileModifiers.js:164` skips blocks with it; nothing else reads it. The CMS always writes `target: 'token'` and offers no way to change it | Harmless today — a dead field, not a trap. Worth deleting or wiring | `grep` across `src/` — one mention, the skip |
| **Skill-restricted modifiers can't be authored.** `resolveAxis` takes a `category` and `_forEachMatching` filters on `mod.target?.category`, so the engine *supports* "+10% Yield, mining only". No CMS field writes `target.category`, and `makeModifier` never sets it. Every Token modifier is therefore category-`ALL` | The `config.skill` argument BoardRunner passes is currently doing nothing for Token-authored effects | Read `ModifierAggregator:332`, `makeModifier:398` |
| **`token.provides` has no CMS field.** The game reads context tags from *two* places — `def.provides` and `block.provides` — and `getProvidedTagsWithTiers` merges both. The CMS creates `provides: []` on every Token (`useEntityStore.js:298`) but has **no UI to fill it**; it can only write `block.provides`. Five game-side readers check `def.provides` *only* | See bug B2 — the Copper Pickaxe works but is invisible on the board | Read all five readers |
| **`isTool` can't be authored.** `tokenRegistry.toolContextTags()` and `TokenInspection.jsx:324` read `def.isTool`; no CMS editor writes it and no Token in `data/tokens.json` carries it. `toolContextTags()` has no non-test caller at all | Dead in practice | `grep` |

### Gear effects — CR2-074, verified

Separately from Tokens, hero gear has its own effect vocabulary in
`EquipmentManager.js`. I re-ran the census and **CR2-074 is exactly right**:

**Nine written by gear, read by nobody:**
`DAMAGE`, `SKILL_LEVEL`, `HPBONUS`, `TICKSPEEDBONUS`, `SLOW_ENEMY`, `SUNDER`,
`EVASION`, `LIGHT`, `HASTE`.

**Three read by combat code, written by nobody:**
`BLOCK` (`CombatFormulas.js:145`), `ARMOR` (`:235`, `:267`),
`STATUS_IMMUNITY` (`StatusEffectSystem.js:40`). Each resolves to 0 every time.

**Three wired at both ends:** `DEFENSE`, `ACCURACY`, `RESIST_FLAT`.

One important addition to the ticket, which is good news for you: **none of
these twelve broken names is authorable in the CMS at all.** `ItemEditor.jsx`
(188 lines) contains no field for `assignedEffect`, `damage`, `defense`,
`hpBonus`, `skillBonus` or anything else on that list. So this is a trap waiting
for whenever the gear pass happens — it cannot bite you while authoring Tokens
today.

---

## 5. Where the clutter comes from, structurally

`EffectBlocks.jsx` is 992 lines. Here is what those lines are:

| Lines | What it is | Size |
|---|---|---|
| 1–26 | Imports and header comment | 26 |
| 27–73 | The list shell: render blocks, five "Add block" preset buttons | 47 |
| 75–253 | `Block` — one block's header, summary, **target picker with three inline mode branches**, then it hosts the four sections below | 179 |
| 254–429 | `TriggerSection` — event picker, source picker (three more mode branches), global watch-item picker, threshold, cooldown, three warnings | 176 |
| 430–565 | `UpkeepSection` — an item search, an item list, a cadence field, its own create-item modal | 136 |
| 566–765 | `ModifierRow` — **four mutually exclusive shape branches** in one nested ternary, plus its own item search and create-item modal | 200 |
| 767–820 | `ItemList` — a third item picker, used only by Convert's two sides | 54 |
| 821–854 | `TagPicker` | 34 |
| 855–949 | `ProvidesSection` — a tag list with a hardcoded quick-pick vocabulary | 95 |
| 950–992 | `summarise` — regenerates a description with a fourth copy of the shape logic | 43 |

**The answer to your question is: it is all three at once, in roughly equal
measure.** But they are separable, and the ranking matters for the redesign:

**1. Five unrelated concepts share one screen (≈ 490 lines, the largest share).**
Target, Provides, Trigger, Upkeep and Modifiers are genuinely independent
mechanics. They were put in one container by an explicit design decision
(CMS-61: "one flexible container, not named module types"), so that a Token
could both produce and carry an aura. The decision is defensible; what it costs
is that **every block shows all five sections all the time**, whether or not they
apply. A pure Aura block renders an empty Trigger button, an empty Upkeep
section and an empty Provides section — three-fifths of the form is noise for
that case. This is the biggest single driver of the "cluttered" feeling and it
is a layout problem, not a code problem.

**2. One concept with four cases (≈ 200 lines).** `ModifierRow` is a single
nested ternary — `convert ? … : item ? … : proc ? … : (scalar)` — spanning
roughly 180 lines. Each branch is small, but they are inlined rather than being
four small components, so the file has no seams to read along. This is what
makes adding a fifth shape feel expensive: you are editing the middle of a
190-line expression.

**3. Accumulated special-casing (≈ 190 lines of near-duplication).** There are
**four separate item-picking implementations** in this one file, with the same
`toLowerCase().includes()` filter written out four times (lines 455, 576, 770,
and the select at 375) and the create-item modal wired up twice. There are also
six inline warning messages, each with its own literal condition. None of these
were wrong when written; they accumulated because each new section needed "pick
an item" and there was no shared control to reach for.

**One more structural note.** The block's collapsed header is generated by
`summarise` (line 951), which encodes the shape logic a fourth time — and the
player-facing description is generated by yet another file
(`descriptionDictionary.js`) with a *fifth*, obsolete version. So "what does this
effect say it does" currently has two independent implementations, one of which
is broken (bug B1). A redesign that produces one description function used by
both would remove that whole class of problem.

---

## 6. The "context" mechanism

This is the second half of the Token effect ecosystem, and it is the more
important half mechanically: `RecipeResolver.js`'s header calls adjacency's real
job **definition, not amplification** — "a Forge with a Helmet Schematic beside
it makes helmets; the same Forge with nothing beside it makes nothing at all."
Buffs are the light optimisation layer on top.

### How a Token declares context

A Token hands a **capability tag** — a plain lowercase string like `pickaxe` or
`cookbook` — to its eight neighbours. There are two places it can be declared,
and this is the source of the split described in section 4:

1. **`token.provides`** — a top-level array. The game reads it. **The CMS has no
   field for it**, so it is always `[]` in authored content.
2. **`block.provides`** — inside an effect block. Both read and authorable
   ("Context / Tool Provision" in each block).

`tokenRegistry.getProvidedTagsWithTiers(def)` merges both into a map of
`{tag: highestTier}`. Tier comes from the block's own `tier` field if it has one,
otherwise the Token's `tier`, otherwise 1. The CMS has no per-block tier field,
so in practice everything provides at the Token's tier.

The real Copper Pickaxe declares its tag the second way:

```json
"token_copper_pickaxe": {
  "tokenType": "context",
  "tags": ["Pickaxe"],
  "effectBlocks": [
    { "target": "token", "targetToken": null, "cost": null,
      "modifiers": [], "provides": ["pickaxe"] }
  ]
}
```

⚠️ Note the block has **zero modifiers**. Its entire purpose is the `provides`
array. So an "effect block" here isn't carrying an effect at all — it is carrying
a capability. That is a naming problem the redesign might want to address.

Also note `tags: ["Pickaxe"]` (capitalised) is a *different thing* from
`provides: ["pickaxe"]` (lowercase). `tags` is what a *targeted buff* can aim at
via `matchesTokenTarget(mode: 'tag')`; `provides` is what a *station* requires.
They look identical in the editor and mean unrelated things.

### How a Token requires context

The other side is `acceptedTokens`, a top-level field with its own editor section
("Accepted Tokens / Tools", `TokenEditor.jsx:278`):

```json
"token_copper_ore_vein": {
  "acceptedTokens": [{ "tag": "pickaxe", "minTier": 1 }]
}
```

### How the game resolves it

Three functions in `RecipeResolver.js`:

- **`contextTiersAround(index)`** walks the eight neighbours and merges every
  Token's provided tags, keeping the highest tier for each.
- **`checkAcceptedTokens(index, def)`** checks each requirement against that map.
  A requirement can name a `tag` with a `minTier`, or a list of exact
  `tokenIds`. If any fails, the Token produces nothing, with the reason
  `missing_tool`.
- **`resolveRecipe(index, instance)`** then handles the *other* kind of context —
  recipes. A station with a recipe pool filters its recipes to those whose
  `requiresContext` tags are **all** present nearby. Zero matches → the station
  makes nothing. Two or more → a deliberate **conflict** error state rather than
  a silent pick (decision D-20).

Then charges: `wearAdjacentSupport` uses `servesFrom` to find which neighbours a
completing station is being served by, and burns one charge from each. A context
Token serving three stations wears three times as fast — described in the code as
"a rate trade, not free value."

### The gap worth knowing about

`ContentRules.test.js:289` checks that every recipe's `requiresContext` tag is
provided by *something*. It only looks at `def.provides`, not `block.provides` —
so as soon as a pooled recipe depends on a CMS-authored context tag, that test
will fail even though the content is correct. And **nothing at all validates
`acceptedTokens` tags**: a Token requiring `pikaxe` would simply never run, with
no test failure, no audit line and no in-game message beyond a generic alert.

---

## 7. Constraints any redesign must respect

I checked each of these against the code rather than against comments, since
this project has a documented history of comments describing machinery that
isn't there.

### Load-bearing — changing these breaks something real

| Thing | Why it's load-bearing | Verified how |
|---|---|---|
| **The `effectBlocks` array shape** | Four game modules read it directly: `TileModifiers`, `TriggerSystem`, `BlockUpkeep`, `tokenRegistry`. There is no adapter layer and no schema — the JSON is consumed as-is | Read all four |
| **The `{type, bucket, value}` scalar shape** | The three-bucket formula and `ModifierAggregator` are described as LOCKED in `status_effects_plan.md §15.3` and pinned by ~50 assertions in `Mutators.test.js` and `AdjacencyEffects.test.js`. Renaming `bucket` or changing what `percentage` means breaks hero statuses, gear and Tokens simultaneously — they share one aggregator | Read the aggregator and the tests |
| **Block ordering, because saves index into it** | `BlockUpkeep` stores `instance.blockUpkeep = {0: {...}}` and `TriggerSystem` stores `instance.blockCooldowns = {0: …}`, both keyed by **position in the array**. Those live on the board instance, which is inside `GameState` and saved wholesale. **Reordering a Token's blocks in the CMS silently remaps existing saves' upkeep and cooldown state to the wrong block.** Giving blocks stable ids would fix it — and would be a good thing to do as part of the redesign, not after | Read `BlockUpkeep.js:33-50`, `TriggerSystem.js:44`, `SaveManager.js:118` |
| **`data/tokens.json` as a full-file overwrite** | The sync route (`cms/vite-plugin-cms-api.js:522`) takes whatever the CMS posts and writes the file. No validation, no merge, no diff, no backup. The only guard is a path-traversal check. Any field the CMS does not model is **destroyed on the next sync** — this is the known CMS-3 hazard, and it is still live | Read the route in full |
| **`modifierPalette.js`'s location** | The CMS imports it by relative path across the project boundary. Moving or renaming it breaks the CMS build with the game's tests still green (CR2-010, confirmed still true) | Read `cms/src/utils/constants.js:29` |

### Not load-bearing — safe to change

| Thing | Why it's free |
|---|---|
| **`token.buff`** (the legacy single-buff field) | Handled as a fallback in `effectBlocksOf` and `blocksOf`, but **no Token in `data/tokens.json` uses it**. It can go whenever the compatibility branch does |
| **`block.target: 'hero'`** | One reader, which skips it. No producer |
| **`descriptionDictionary.js`'s modifier section** | It already reads a vocabulary that doesn't exist. Rewriting it cannot make anything worse |
| **`data/schemas/*.json`** | Card-era. Nothing imports them |
| **`EFFECT_TYPES` entries with no consumer** | `SPEED`, `DAMAGE`, `DEFENSE`, `HP_REGEN`, `THORNS_REFLECT`, `STAT_BONUS`, `LOGIC_OVERRIDE` are documented in `modifierPalette.js` as deliberately not offered. They are inert names |

### Existing authored content is a very small constraint

`data/tokens.json` currently holds **10 Tokens, of which 3 have effect blocks**
(Copper Pickaxe, Forge Altar, Copper Ore Minecart) — and one of those three has
an empty modifier list. Whatever the data shape becomes, migrating today's
content is a ten-minute job. **This is the cheapest moment there will ever be to
change the shape**, and that is worth weighing heavily.

### The solver does not read effects

I checked all fifteen files in `cms/src/engine/`. Only `descriptionDictionary.js`
touches `effectBlocks`. The balance solvers (`tokenSolver`, `chargeSolver`,
`evCalculator`, `valuePropagator` and the rest) work from production
inputs/outputs and never look at modifiers. **So the redesign does not have to
keep the solver working — it is already not connected.** Whether it *should* be
is a separate question worth raising: an effect that doubles a neighbour's yield
is obviously an economic input the balance maths is currently blind to.

### Cannot be determined without running the game

- **Whether the WORK_TIME sign confusion (section 2) actually reads as slower in
  play.** The code path is unambiguous, but I have not placed a Forge Altar
  beside a Forge and timed a cycle. Two minutes in a running game settles it.
- **Whether the missing connection line for the Copper Pickaxe (bug B2) is
  visible as a gap on the board**, or whether some other visual cue makes the
  relationship legible anyway. Needs eyes on the board.
- **How the editor actually feels at authoring speed.** Line counts and section
  structure tell you where the complexity is; they do not tell you which
  interaction is the most annoying. That is your walkthrough's half of this.

---

## 8. Bugs found — noted, not fixed

Per the brief, I have changed nothing. These are recorded here for triage.

### B1 · The Token description generator reads a vocabulary that does not exist

**Where:** `cms/src/engine/descriptionDictionary.js:144–155`

**What:** The modifier-description loop reads `mod.axis`, `mod.isPercent`,
`mod.targetMode`, `block.convert` and `block.bonusDrop`. **None of those fields
exist.** Real modifiers carry `type`, `bucket`, `value` (or `itemId`/`chance`/
`quantity`). The code falls back to the literal string `'Speed'` for the axis
name and `Math.round(mod.value * 100)` for the value.

**Consequences, both visible in `data/tokens.json` right now:**

- Every number modifier is described as "Speed", whatever it actually is.
- Any modifier without a `value` field — which is every Bonus Drop and every
  Convert — produces `Math.round(undefined * 100)` = `NaN`.

The Forge Altar's authored description is currently:

> `"Matching tokens gain +20% Speed. Matching tokens gain NaN% Speed."`

Two modifiers, both described as Speed, the second as `NaN%`. And the +20% is
backwards: the underlying `WORK_TIME` value makes the Forge **slower**.

**Why it went unnoticed:** `src/tests/CMSDescriptionDictionary.test.js` tests 5
and 6 assert against the *obsolete* shape — test 5 passes a modifier written as
`{targetMode:'adjacent', axis:'speed', value:0.20, isPercent:true}`. The tests
are green because they and the code share the same wrong idea of the data.

**Severity: this is the single most user-visible defect in the effect pipeline.**
It is why authoring feels untrustworthy — the tool tells you what your effect
does, and it is wrong.

### B2 · Context tags authored in the CMS draw no connection line on the board

**Where:** `src/ui/components/board/ConnectionLines.jsx:55, 69`;
`src/ui/components/drawer/TokenInspection.jsx:189`

**What:** These UI readers gate on `def.provides?.length` — the top-level array
the CMS **cannot write**. A Token whose capability lives in `block.provides`
(the only place the CMS puts it) fails the gate.

**Consequence:** the Copper Pickaxe works mechanically — `RecipeResolver` uses
the merged map, so the Copper Ore Vein correctly detects it and correctly wears
its charges — but **the board draws no line between them**, and the Token
inspection drawer shows no "Tool — unlocks" panel. The relationship is real and
invisible.

**Fix shape:** these five call sites should use
`getProvidedTagsWithTiers(def)` like the engine does, rather than reading one of
the two channels. Or, better, collapse the two channels into one.

### B3 · A number modifier inside a triggered block silently does nothing

**Where:** `src/systems/board/TileModifiers.js:158`;
`src/systems/board/TriggerSystem.js:88–115`

**What:** `TileModifiers` skips any block carrying a trigger. `TriggerSystem`
handles only `BONUS_DROP` and `CONVERT`. A Yield, Work Time, Input Cost, XP
Bonus, Double Loot or Failure Chance modifier placed on a Reaction block is read
by neither. The CMS offers all six on such a block with no warning.

**Fix shape:** either hide number effects on triggered blocks the way `CONVERT`
is hidden on untriggered ones (the `triggeredOnly` flag already exists and works
— it would just need its mirror image), or give triggered scalars a meaning
(a temporary buff, say) and implement it.

### B4 · Nothing validates a context tag requirement

**Where:** `src/systems/core/ContentAudit.js` (no check);
`src/tests/ContentRules.test.js:289` (checks recipes, not `acceptedTokens`)

**What:** `acceptedTokens[].tag` is a free string matched against provided tags.
A typo produces a Token that permanently makes nothing, with no audit line and
no test failure. ContentAudit already does this class of check for items,
sprites, maps and enemies — context tags are simply missing from `RESOLVERS`.

Related: `ContentRules.test.js:289` counts only `def.provides`, so it will report
a false failure once a pooled recipe depends on a CMS-authored context tag.

### B5 · The CMS quick-pick tag list is hardcoded

**Where:** `cms/src/components/editors/EffectBlocks.jsx:873`

**What:** `['pickaxe', 'axe', 'hammer', 'anvil', 'saw', 'furnace', 'pie_tin',
'cookbook']` is typed into the component. This is exactly the pattern CMS-5
exists to forbid — a hand-maintained vocabulary in the CMS that will drift from
what the game's content actually uses. `RecipeEditor.jsx:51` already does the
right thing, deriving the tag list from the Token set.

### B6 · Minor: `toolContextTags()` is dead, and `isTool` is unauthorable

**Where:** `src/config/registries/tokenRegistry.js:308`

`toolContextTags()` has no non-test caller. It depends on `def.isTool`, which no
CMS editor writes and no Token in `data/tokens.json` carries — so it would return
an empty set even if something called it. `TokenInspection.jsx:324` also branches
on `isTool` and will always take the "Drives" path.

---

## Appendix: the files that matter

If you want to point a future session at this system, these are the files.

**Game side — vocabulary**
- `src/systems/effects/constants.js` — every effect name the engine has ever had
- `src/config/registries/modifierPalette.js` — the 8 authorable ones, with shapes
- `src/config/registries/triggerRegistry.js` — the 4 trigger events
- `src/config/registries/tokenConstants.js` — Token types, rarities, themes

**Game side — machinery**
- `src/systems/effects/ModifierAggregator.js` — the three-bucket formula, shared
  by Tokens, heroes, gear and statuses
- `src/systems/board/TileModifiers.js` — collects neighbours' effects onto a tile
- `src/systems/board/BoardRunner.js` — the six number-effect consumers, in
  `completeCycle` and the tick loop
- `src/systems/board/TriggerSystem.js` — triggered blocks
- `src/systems/board/BlockUpkeep.js` — per-block upkeep
- `src/systems/board/RecipeResolver.js` — the context mechanism
- `src/systems/core/ContentAudit.js` — the boot-time content check

**CMS side**
- `cms/src/components/editors/EffectBlocks.jsx` — the 992-line editor
- `cms/src/components/editors/TokenEditor.jsx` — the screen it sits on
- `cms/src/stores/useEntityStore.js` — block/modifier construction, presets
- `cms/src/utils/constants.js` — the re-export boundary
- `cms/src/engine/descriptionDictionary.js` — the broken description generator
- `cms/vite-plugin-cms-api.js:522` — the sync route

**Content and tests**
- `data/tokens.json` — 10 Tokens, 3 with effect blocks
- `src/tests/AdjacencyEffects.test.js` — the axis behaviour tests
- `src/tests/Mutators.test.js` — the three-bucket formula tests
- `src/tests/ContentRules.test.js` — content vocabulary validation
- `src/tests/CMSDescriptionDictionary.test.js` — green, and testing the wrong shape
