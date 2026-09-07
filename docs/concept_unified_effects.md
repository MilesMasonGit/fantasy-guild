# Unified Effects — concept

*Written 2026-09-07 from a design session with the owner. This is the vision
half. The authoritative plan, with the locked decisions and the implementation
status table, is [`unified_effects_roadmap_v1.md`](unified_effects_roadmap_v1.md).*

---

## 1. The one-sentence version

> Every rule in the game — on a Token, on an item, on an enemy — is a **named
> effect**: a title the player learns to recognise, wrapping one or more
> statements that generate their own sentence, stored once in a library and
> referenced everywhere it is used.

Two things follow from that sentence, and they are the whole point:

* **For the player**, "Shrimp Trawler" is a thing that happens. It pops up on
  the tile when it fires. It means the same thing on a potion as it does on a
  Token, because it *is* the same thing.
* **For the author**, giving a potion an effect the Bay already has is picking
  it from a list, not re-authoring it and hoping the numbers match.

## 2. What already exists, and what does not

This is not a rewrite. The statement grammar built in the effect-authoring
redesign is sound and stays exactly as it is — the same nine keywords, the same
four slots, the same generated rules text, the same palette-driven editor where
adding an effect is a palette row and not a screen.

**What exists:**

| | |
|---|---|
| The statement grammar | `src/systems/effects/statements.js` — nine keywords, legality declared |
| Generated rules text | `src/systems/effects/statementText.js` — the sentence *is* the rule |
| The palette | `src/config/registries/modifierPalette.js` — drives the editor |
| The status engine | `src/config/registries/statusRegistry.js` — 7 statuses, data-driven, with `combat_resolved` and `slot_resolved` decay hooks |
| Statuses reaching enemies | `src/systems/board/StatusApplication.js` — `applyToEnemy` is written and routed, and has never run |
| The proc popup | `TILE_EVENT_ALERT` + `src/ui/components/board/TileEventAlert.jsx` — a tile-anchored bubble, already published from eight sites |
| The hero aggregator | every hero carries one; the board reads exactly one axis off it (`SPEED`, `BoardRunner.js:144`) |

**What does not exist:**

| | |
|---|---|
| Any effect on any item | all 54 items carry the same 14 fields; none of them is an effect, and `ItemEditor.jsx` has no effect UI |
| A charge pool on an item | no `uses`, no charges, no durability |
| A named, reusable effect | statements are inline on the Token that owns them |
| `CYCLE_START` | only `CYCLE_COMPLETE` is published |
| An engagement moment | fights are created silently in `BoardCombat.js:180` |
| A hero scope on `resolveAxis` | it merges tile and guild only |

And one thing that exists but should not: **`data/effects.json`** — 56 entries
keyed `"0"`–`"55"`, each `{id, name, targetEntityTypes, drainTrigger,
description}`, read by nothing in the game or the CMS. See §6.

## 3. Bearers

The grammar's subject generalises from *a Token* to **a bearer**. A bearer
answers three questions; everything else about the grammar is unchanged.

| | **Token** (an enemy is one) | **Item** |
|---|---|---|
| Where its effects live | a list of library references | a list of library references |
| What a filter means | the adjacent tiles | bearer-relative: my hero, the Token they are working, the enemy they are fighting |
| What a proc spends | `usesRemaining` against `def.uses` | `uses` — the identical rule |
| What zero does | the Token is destroyed, the tile empties | the item is destroyed and unequipped |

**Enemies are not a third bearer.** They are Tokens, and `StatusApplication`
already resolves a tile to *its occupant* — the hero standing on it, or the live
enemy in a fight there. So the only genuinely new bearer is the item.

The one real extension to the grammar is the **filter**, because an item has no
adjacency. It needs a small bearer-relative vocabulary — *my hero*, *the Token
they are working*, *the enemy they are fighting* — resolved honestly and said
out loud in the sentence, exactly the way `Applies` already resolves "adjacent
Coast Tokens" to "the heroes on them" and renders those words.

### The fallout worth having

`Acts as` on an item means a hero carrying a Copper Pickaxe **supplies the
`pickaxe` capability to whatever tile they work**. The capability system already
exists and is the mechanically important half of adjacency ("a Forge with a
Helmet Schematic beside it makes helmets; the same Forge with nothing beside it
makes nothing at all"). Reaching it from the loadout costs nothing extra once
items are bearers, and it plausibly closes the long-standing gap where
`token.provides` has a reader in the game and no field in the CMS.

## 4. The library

Every statement lives in a named library entry. Nothing is authored inline.

* An entry is a **name plus a group of statements** — usually one, more when one
  idea genuinely needs two sentences.
* A bearer stores a **reference**: the entry's id and a scale. Editing the entry
  changes every bearer at once, which is the point; the CMS shows *used by: 4
  Tokens, 1 item* so an edit is never blind.
* A reference may carry a **scale multiplier** — an integer 1–5, rendered as a
  numeral. The palette declares what a scale touches, per effect type:
  `Provides` scales its value, `Applies` scales stacks, `Grants` scales
  quantity, `Converts` scales its amounts, and `Cannot` and `Works as` do not
  offer one at all. Adding an effect stays one palette row. Scales from separate
  bearers add, capped at 5.
* A statement **authors its own charge cost** — how many charges it consumes and
  at which moment. `0` is the always-on setting. Whether an effect wears its
  bearer down is therefore a decision the author makes per effect, not a rule the
  engine imposes.

### The name is a title, never a description

The redesign's Q3 ruling stands: **there is no hand-written text on a bearer.**
The generated sentence remains the body, the validation loop and the only
description. The name sits above it as a title.

A title can be evocative without lying, *because it never appears without its
sentence underneath.* The moment a name could be shown to the player instead of
its sentence, we are back to descriptions that drift from behaviour — which is
the failure the redesign exists to have removed.

The player-facing form is **name plus a tier numeral** — *Shrimp Trawler II* —
so a potion's stronger version is legible as the same effect, larger.

## 5. Feedback

A named effect that fires publishes `TILE_EVENT_ALERT` with its title, and the
existing bubble does the rest. This is what makes the naming worth the authoring
cost: the player sees *Shrimp Trawler II* pop on the tile and learns what their
build is doing.

**Continuous effects never pop.** A `Provides +10% Yield` that applies all the
time has no firing moment to announce; it is named for reuse and for the rules
panel, and that is all. Only a statement with a moment — a trigger, a cycle
start, an engagement — announces itself.

## 6. The 56, and the rule that comes from them

`data/effects.json` is the corpse of the old effect system: a library of named,
reusable effects assigned to items and enemies. **The same shape as this
concept.** It was deleted from the CMS by CMS-36 and the data file was orphaned
rather than removed.

It failed for one reason, and it is worth being exact about it, because the
reason is not "libraries are bad":

> The names had no mechanism behind them. A name, a description, and nothing
> that read either.

This design differs in the single way that matters — a name wraps a real
statement, which generates its own sentence and is consumed by a real reader.
So the rule the library carries forever is:

> **A named effect cannot exist without a statement that works.**

The orphan file is deleted as part of this work, so that only one thing in this
project is ever called Effects.

## 7. What this deliberately does not solve

* **Combat balancing.** The owner has asked for enemies that scale hero-side
  numbers — damage, armor, accuracy — and that is real scope, but it unparks
  the SCB (CMS-2). It is sequenced last, as its own slice, so nothing else waits
  on it.
* **Directional adjacency.** "The Token below it" still has no meaning; adjacency
  remains an unordered set of eight.
* **The library growing.** "Everything is named" plus "variants are separate
  entries" is how a library reaches 56 rows. The mitigations are the scale
  multiplier (one entry covers five strengths), the *used by* readout, and a
  content audit that names entries nothing references. None of them is a
  guarantee, and the owner should expect to prune.
