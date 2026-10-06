# Buff & Boost Diversification — Orientation

**Status:** orientation only. Nothing here is decided, and nothing here is a
plan. It exists so that when we start planning the buff-diversification phase,
we begin from *what the engine can actually do today* rather than from memory.

Written 2026-08-01, at the end of C-11 of the Area Deck Rework.

---

## 1. The one-paragraph summary

The effect machinery is in better shape than the effect *vocabulary*. We have a
solid three-bucket modifier system, four working scopes, and a composable effect
model — but almost everything flows through **one axis (SPEED)** at **one scope
each**, and six of the thirteen declared effect types have no consumer at all.
The gap to close is not "build a buff system." It is "make the buff system we
have reach the rest of the game."

---

## 2. What exists today

### The modifier primitive (UMI)

Every buff in the game is ultimately one of these:

```js
{ type: 'SPEED', target: { category: 'mining' }, bucket: 'percentage', value: 0.2, source: 'outpost_1:st_smithy' }
```

- `type` — which axis it moves (see the table in §3).
- `target.category` — a skill, or `ALL`.
- `bucket` — `flat` | `multiplier` | `percentage`. Members of a bucket **sum**;
  the buckets resolve in sequence. This is locked (§15.3) and is what makes
  duplicate auras stack additively rather than compounding.
- `source` — the removal key. Getting this wrong is the recurring bug: two
  copies sharing a source means removing one cancels both.

### The four scopes

| Scope | Lives in | Lifetime | Set by |
| :--- | :--- | :--- | :--- |
| **Card** | `card.aggregator` | The card instance | Tokens, gear, the assigned hero |
| **Hero** | `hero.aggregator` | The hero | Equipment, status effects |
| **Area** | `AreaModifiers.js` | Until loop wrap | In-deck Boost cards (C-4) |
| **Global** | `GlobalModifiers.js` | While installed | Outpost cards (C-11) |

Area and Global are runtime-only and rebuilt from state — they are never saved.

### The composable effect model (D-60, C-3)

A card carries a **list** of effects. Each declares:

- **`phase`** — `on_draw` | `on_activate` | `on_complete`
- **`reach`** — `self` | `next_card` | `loop`
- **`kind`** — `work_output` | `hazard` | `restore` | `buff` | `token_stamp` | `combat`

`reach: 'loop'` is the aura archetype (switches on at the card, runs to the
wrap — so slot 1 covers the deck and slot 4 does nothing). `reach: 'next_card'`
is the sequencing archetype. Neither buffs its own card, deliberately.

---

## 3. What actually works — the honest matrix

This is the part worth reading. **Declared ≠ consumed.**

| Axis | Consumed by | Reachable from |
| :--- | :--- | :--- |
| `SPEED` | `StatProcessor.calculateWorkcycleStats` | Card + Area + **Global** |
| `WORK_TIME` | `StatProcessor` via `TokenAxes` | **Card only** |
| `YIELD` | `LootSystem` via `TokenAxes` | **Card only** |
| `INPUT_COST` | `WorkProcessor`, `CardPreflight` | **Card only** |
| `DAMAGE` | `StatProcessor.calculateCombatStats` | **Hero only** |
| `DEFENSE` | `StatProcessor.calculateCombatStats` | **Hero only** |
| `XP_BONUS` | — | *nothing reads it* |
| `LOOT_MULT` | — | *nothing reads it* |
| `FAIL_CHANCE` | — | *nothing reads it* |
| `HP_REGEN` | — | *nothing reads it* |
| `THORNS_REFLECT` | — | *nothing reads it* |
| `STAT_BONUS` | — | *nothing reads it* |
| `LOGIC_OVERRIDE` | one reference, no real consumer | *effectively nothing* |

**The headline:** SPEED is the only axis that crosses scopes. An Outpost aura
saying "+20% yield" or a Boost card saying "−50% input cost" would parse, load,
register cleanly — and do **nothing**, silently. That silence is the main risk
to design around.

---

## 4. The four gaps

1. **Scope reach.** Yield, work time and input cost are card-local; damage and
   defence are hero-local. Widening these is mostly a matter of consulting more
   aggregators at the point of resolution, the same one-line-per-scope change
   C-11 made for SPEED — but each needs a deliberate decision about whether an
   area or guild aura *should* reach it.

2. **Dead axes.** Six types exist as constants with no consumer. Each needs
   either a consumer or deletion. XP and loot in particular are obvious buff
   targets a player would expect to work.

3. **No conditions, no chance** (logged as **W-10**). The two examples you gave
   — *"0.1% chance to roll Pirate Treasure Loot on Fishing tasks"* and *"+20%
   work speed on Areas with an Elite Enemy"* — need a condition predicate and a
   chance roll that the UMI has no room for today.

4. **Thin trigger vocabulary.** Three phases and three reaches. There is no
   `on_fail`, no combat-start/kill trigger, and no duration model other than
   "until the loop wraps."

---

## 5. Questions worth settling in the planning session

Not answers — just the decisions that will shape the work. Roughly in the order
they unblock each other.

**On expression**
- Do conditions belong in the modifier (a `when` clause on the UMI) or in the
  effect wrapper above it? This is the single biggest structural fork.
- Is "chance to trigger" a property of an effect, or its own effect kind?
- Should a buff be able to target a **tag** (`Fishing`, `Hazard`) rather than
  only a skill category?

**On reach**
- Which axes should a *global* aura be allowed to move? All of them, or is
  "yield is local, speed is global" a deliberate constraint worth keeping?
- Should Boost cards be able to affect the **hero** (heal, restore energy,
  grant a status) rather than only the cards around them?

**On triggers and duration**
- Do we want failure-triggered and combat-triggered effects?
- Is "until loop wrap" the only duration, or do we want N-cards / timed /
  permanent-until-replaced?

**On authoring and safety**
- Should authoring a modifier on a **dead axis** be a load-time error? Silent
  no-ops are the failure mode most likely to waste design time.
- Where does the CMS fit — do buffs become authorable there, or stay in JSON?

---

## 6. Where the code is

| File | What it owns |
| :--- | :--- |
| `src/systems/effects/ModifierAggregator.js` | Three-bucket math, `collect*`/`resolveAxis` |
| `src/systems/effects/constants.js` | `EFFECT_TYPES`, `TARGET_CATEGORIES` |
| `src/systems/effects/TokenAxes.js` | Yield / work-time / input-cost resolution |
| `src/config/cards/effectRegistry.js` | Phases, reaches, effect kinds, validation |
| `src/systems/cards/effects/effectResolvers.js` | Runtime dispatch of effects |
| `src/systems/loop/LoopBuffs.js` | Aura + next-card lifecycle (area scope) |
| `src/systems/loop/AreaModifiers.js` | Per-area aggregators |
| `src/systems/loop/GlobalModifiers.js` | The guild-wide aggregator |
| `src/systems/cards/logic/StatProcessor.js` | Where most axes are actually consumed |

Tests that pin current behaviour: `Mutators.test.js` (three-bucket rules),
`GlobalAuras.test.js` (scope + stacking + rehydration), `CardFailure.test.js`.

---

## 7. Settled — don't reopen

- **Three-bucket math** (§15.3). Members of a bucket sum; buckets resolve in
  sequence. Two +25% sources give +50%, never ×1.5625.
- **D-60** — effects are a composable list; card type is a label, not a
  capability gate.
- **D-68** — aura power is free-form. There are no tiers, and the designer sets
  magnitudes per card. The engine's job is to be expressive, not pre-tuned.
- **D-23** — duplicate auras stack additively.
- **Runtime-only aggregators** — area and global buffs are rebuilt from state,
  never serialized. Any new scope should follow this.

---

## 8. First thing to do when we start

Pick one non-SPEED axis — **YIELD** is the natural candidate — and take it all
the way from an authored Outpost aura to a changed number in the bank. That one
vertical slice will expose the real shape of the scope-widening work and tell us
whether the condition/chance question needs answering before or after.
