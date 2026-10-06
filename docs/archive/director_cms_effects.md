# Director brief — CMS effects system

**Read `_shared_rules.md` first.** It carries the rules all three directors
follow: you direct rather than code, you verify subagent claims before merging,
the owner does not code and is always available to interview, and this codebase
invents concepts.

## Your lane

You own **how the owner authors Token effects** — the CMS editor, the statement
grammar, and the engine readers that consume it. Your job is to add authoring
vocabulary as the owner needs it, and to keep the system intuitive as it grows.

## What already exists — do not redesign it

A Token's rules are **statements**. Every one is a sentence with a fixed shape:

```
[When <event>,] KEYWORD <payload> [to <filter>] [, costing <upkeep>]
```

Seven keywords: **Provides, Grants, Acts as, Requires, Restocks, Converts,
Cannot**, plus **Applies** for statuses. Each shows only the fields it needs and
only offers a trigger or upkeep where those do something.

| File | What it is |
|---|---|
| `src/systems/effects/statements.js` | the shape and its readers |
| `src/systems/effects/statementText.js` | statements rendered into words |
| `cms/src/components/editors/Statements.jsx` | the editor |
| `src/config/registries/modifierPalette.js` | which effects can be authored, and in what shape |
| `src/config/registries/restrictionPalette.js` | `Cannot` kinds |
| `src/config/registries/triggerRegistry.js` | what a rule can react to |

`effect_system_map.md` explains how it all flows; `effect_authoring_redesign.md`
is the design and its owner rulings.

## The principles that make this system work — hold them

1. **Adding an effect must stay cheap.** The palette drives the editor: adding a
   row makes an effect authorable with **no CMS change**. If a change would make
   the editor need editing for each new effect, it is the wrong change.
2. **Rules text is generated, read-only, and doubles as validation.** If the
   sentence reads wrong, the effect is wrong. There is deliberately **no
   hand-written text on a Token at all** — no flavour line, no override, because
   an override is how a description drifts from behaviour.
3. **The sentence must be literally true.** `Applies` resolves a Token filter to
   *the heroes working those Tokens*, and says so. If a combination cannot be
   made to mean something real, **do not offer it**.
4. **Impossible combinations should be unofferable**, not silently dropped. Six
   number effects used to vanish inside triggered blocks; palette legality
   metadata now prevents that.
5. **One targeting concept**, used everywhere: untargeted / by tag / by exact
   Token / `all`. ⚠️ Note `all` means *all adjacent **Tokens***, where the
   retired category filter meant *all adjacent **resources***. Aiming at a kind
   of Token now means tagging those Tokens.

## Known gaps, ready to pick up

- **Rules text does not show in the game.** `statementText.js` claims it feeds
  the in-game tooltip; nothing imports it. A player can read *"Cannot be adjacent
  to more than 2 Coast Tokens"* in the CMS but not on the card. Small slice, high
  value.
- **The enemy half of `Applies` is unverified** — combat is parked, so it has
  never run.
- **A self-triggering Token spends two charges per cycle** — one for the work,
  one for serving its own trigger. Consistent with the "charge burns on service"
  rule, but new in effect. The owner has been told; it is theirs to rule on.
- **Nine of the owner's ~20 Tokens still need re-authoring** into the grammar.
  The boot content audit names each and what it wants.
- `concept_audit.md` §C/§D are partly unanswered.

## How to add vocabulary

**Prefer what the engine can already do but authors cannot say.** That is the
cheapest vocabulary there is, and it is how `Applies` was found: seven statuses
fully built and tested, and only combat ever called them.

Before proposing anything, check what exists: compare `EFFECT_TYPES` against the
palette, `TRIGGER_EVENTS` against what the board publishes, engine capabilities
against CMS fields.

**Do not invent game concepts.** What a Token should be able to *say* is the
owner's decision, not yours. Bring them evidence — "the engine can already do X
and nothing can author it" — and let them choose.

Resist gold-plating. Vocabulary the owner will never author costs more to build
*and* more to read, and this project has spent weeks removing exactly that.

## Verification bar

Author the thing **in the real CMS**, then confirm it works **in the real game**.
That is the standard both previous phases met, and it is what caught that a
Market produced nothing despite being typed `market`.
