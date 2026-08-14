# CMS Rework v2 — Decisions Log (in progress)

Interview started 2026-08-13. This supersedes `cms_rework_concept.md` and
`cms_rework_roadmap_v1.md` entirely — those documents describe the
card-sequence game (Area Decks, task cards), which no longer exists. The game
is now the 7×7 playmat of Tokens (`playmat_decisions.md`). Per **D-109**, the
CMS was deliberately deferred until the playmat rework was done; this is that
follow-up.

**Status: interview in progress, not yet approved for implementation.**

---

## Scope

**CMS-1 — Authors Tokens, Items and Maps. Not heroes/classes/skills.**
*Why:* Tokens are the core object of the whole game now — producers,
context/buff Tokens, enemies, Managers. Items are the Bank-stored stock they
consume/produce. Maps are what a themed Map yields when burst (D-139).
Heroes/classes/skills were excluded because that system (promotion,
re-training, banked skills) only just shipped and is still settling —
authoring against it now risks the same rot the old CMS suffered against a
moving skill list.

**CMS-2 — Economy balance pass, not combat.**
*Why:* same reasoning the old concept doc used and it still holds — the 7-stat
combat engine is a framework still in flux (per `cms_rework_concept.md` §3.6a),
so hard-modelling it now would model maths that's still moving. Combat
balancing stays deferred as its own later project.

---

## Data authority

~~**CMS-3 (superseded by CMS-53) — The CMS becomes the source of truth;
`data/` JSON is generated from it via field-level merge sync.**~~
*Superseded after real use — see CMS-53.* Original reasoning kept for the
record: the old destructive "Sync to Game" (whole-file replace) wasn't to
be repeated, so sync was designed as a merge — change one field, only that
field changes in the written file.

**CMS-4 — No game→CMS import path.**
*Why:* the old CMS needed import because content was authored partly by hand
in JSON alongside a stale CMS. That situation doesn't exist here — the game
has had **zero** CMS through the entire playmat build (D-109), so current
`data/` content is hand-authored placeholder, not a corpus worth preserving
mechanically. Cheaper to re-author by hand in the new CMS than build and
maintain an importer for content that's being redone anyway.

**CMS-5 — The CMS reads its vocabulary live from the game's registries.**
*Why:* carried forward unchanged from the old concept doc's founding
principle (§3.1) — "engine logic lives in the game, the CMS provides the
content." Skills, Token categories/tags, and equip slots are asked of the
game, never hardcoded a second time in the CMS. This is what stopped the
CMS offering skills that didn't exist (`industry`, `culinary`, `nautical`)
from happening again.

**CMS-53 — Reverses CMS-3: sync is one-way, full-file write, not a merge.**
Decided after actually working with the merge model — it was judged too
complicated and too easy to break silently. The CMS writes `data/` JSON
wholesale, in one direction.
*Why this is safe, unlike the old destructive sync it resembles on the
surface:* the old bug wasn't caused by "one-way" as such — it came from
overwriting content the CMS had **no model for**, while other content still
lived only in hand-edited JSON. Here, **`data/` is never hand-edited again
once the CMS is live** (confirmed directly) — the CMS is the exclusive
authoring surface for everything in its scope (CMS-1: Tokens, Items, Maps).
A full overwrite can't destroy anything the CMS doesn't know about if
nothing is ever created outside the CMS again. Deletion becomes trivial as
a side effect: something is gone from the output because it's gone from the
CMS — no tombstones, no three-state tracking, no merge logic to get wrong.
*Consequence for CMS-4 (no import):* the first real sync must be a **full
cutover**, not an early/incremental one. Content is built up completely
inside the CMS first; sync only happens once it represents a full,
intentional replacement for `data/` — not a routine save hit while content
is still partial. Confirmed as the intended workflow ("spend most of my
time creating content, then push it").

---

## Recipes and context tokens

**CMS-6 — Recipes may be gated by a *combination* of context tags, not just one.**
*Why:* the existing pattern (`token_forge`, `token_smelter` in
`tokenRegistry.js`) gates each recipe on a single `requiresContext` tag —
fine when a station has 2–3 recipes, but Kitchen-type stations want dozens.
Smithing already solves a similar problem with two independent axes
(material context × shape context: an Ingot Mould + a Blade Mould together
decide the output). The Kitchen mechanic generalizes this exact pattern:
**Tool context × Cookbook context** — a Pie Tin + a Strawberry Cookbook keys
the station to Strawberry Pie. Swapping either context token changes the
output. This needed a real design pass, not a CMS-only decision — see
"Kitchen mechanic" below.
*CMS consequence:* the Token/recipe editor must support N context tags per
recipe, not 1. This is new relative to the old CMS's model and relative to
how Forge/Smelter are authored today.

**CMS-7 — Kitchen mechanic resolved: two-axis context gating, not auto-select and not one-token-per-recipe.**
*Why rejected alternatives:*
- *Auto-select from Bank stock* (no context token) was rejected — late-game
  the player will have every ingredient stocked simultaneously, so
  auto-match degrades to "always makes the same thing" and removes player
  control over what a multi-recipe station actually produces.
- *One Context Token per exact recipe* was accepted as a fallback but
  rejected as the primary plan — dozens of recipes would mean dozens of
  Context Tokens cluttering the Bank/board, which is the clutter problem
  that killed the earlier spatial playmat (Risk 7, `token_object_brief.md`).
- *Drag an ingredient onto the tile to set the recipe* was rejected outright
  — items aren't placed that way in this game; there's no such interaction
  today.
*Why this is different from smithing's axes, worth remembering:* smithing's
context tokens exist to disambiguate — raw copper ore alone doesn't say
sword vs. helmet. Food recipes are usually already unambiguous from their
exact ingredient set (flour+egg+sugar = Cake, nothing else). The two-axis
model here is doing double duty: Tool narrows to a *category* of dish, and
Cookbook picks the *specific* dish within it — giving explicit player
control (not implicit stock-matching) while still capping the number of
distinct context tokens needed to roughly (# tools + # cookbooks), not
(# dishes).

---

## Authoring workflow

**CMS-8 — Reuse the standalone app shell.** Own `cms/` folder, own dev
server, writes into the game's `data/` folder — same separation as before.
Rebuild the screens and schema inside it; the plumbing (Vite app + API
plugin reading/writing `data/`) isn't the part that was broken.

**CMS-9 — Priority authoring flow: build a Token top-down.**
Start from "I want a Strawberry Pie to exist" and work backward to what it
needs (Cookbook, Tool, raw ingredients) until everything bottoms out at
something gatherable — the same backward-chaining instinct the old CMS
concept doc named (§3.5) but never actually supported, now the first flow
to get right rather than a later nicety.

**CMS-10 — Balance checks on authoring: value propagation, chain
reachability, gold/XP-per-hour velocity.**
*In scope:*
- **Value propagation** (D-128) — flag recipes whose output value doesn't
  roughly track input cost, so deep chains keep paying off rather than
  laundering value.
- **Chain reachability** — flag a recipe asking for an ingredient nothing in
  the CMS produces (a dangling reference).
- **Gold/XP-per-hour velocity** — flag a Token's earn rate as out of band
  for its tier/Map cost.
*Explicitly deferred:* Map kit completeness (D-139's "does this Map hand
over a usable self-contained kit") was raised but not prioritized this
round — may return once Map authoring itself is further along.

---

## Authoring order and the Item editor

**CMS-11 — Build the Item editor first.**
*Why:* Items are the leaf nodes everything else references — a Token's
inputs/outputs and a Map's `materials` all point at Items. Building this
screen first means Token authoring never stalls on "this ingredient doesn't
exist yet."

**CMS-12 — The natural authoring sequence starts at the end product.**
Picture "I want Strawberry Pie": the first decision is the **Item** itself —
name, description, an initial guessed value — before anything about how it's
made. The recipe that produces it, and the Items *it* requires, come after,
recursively, until everything bottoms out at something gatherable. This is
CMS-9's backward chaining, now given a concrete first step.

**CMS-13 — Item editor fields for v1:** name/description, `type` + `tags`
(these key recipe/context gating, not cosmetic), a sprite picker (v1 can take
a filename/id, real asset-picking UI can come later), and conditional
consumable fields (`restoreAmount`, `regen`, `restoreType`, `equipSlot`) that
only appear when `type` warrants them rather than always-visible clutter.
`stackable` defaults true per D-137 and is rarely a real decision.

---

## Global Values — a formula-driven economy

**CMS-14 — An Item's value is a guess until a recipe exists, then the
balance engine owns it.**
When you name an Item you type a starting value by eye (CMS-12). Once a
recipe that produces it is authored, the balance engine (CMS-10) computes
what the value *should* be from input cost and a global markup dial, and
**auto-corrects** the Item's stored value to match — it does not just flag a
mismatch and wait for approval. The owner's stated goal: values should be
steerable through a small set of tunable **Global Values**, not maintained
by hand across hundreds of items.
*Rejected alternatives:* flag-with-suggestion (keeps manual override, but
defeats the point — the goal is *not* re-touching every item by hand when a
dial moves) and flag-only (same problem, more manual work).

**CMS-15 — Three Global Value dials identified so far, more expected:**
1. **Production markup per step** — a tunable "% value added per processing
   step" that expresses D-128 ("items worth more used than sold") as a
   number instead of case-by-case guessing.
2. **Map ROI ratio** — a Map's Token pool should sell, on average, for less
   than the Map's price, but be worth more than the Map's price when
   actually *used* through its production chain. How much less/more is a
   dial, not a fixed rule. This one spans Map price as well as recipe
   chains, so its formula reaches outside a single Item's dependency tree.
3. **Gold/XP-per-hour velocity bands** — ties to CMS-10's velocity check; a
   per-tier/theme target for what earn rate "feels right."
*Open:* more dials will likely surface once authoring actually starts: this
is a starting set, not a closed one.

**CMS-16 — Recompute is on-demand via an explicit "recalculate economy" action.**
Editing anywhere in the chain (a recipe, an Item, a Global Value dial) does
**not** live-ripple through every dependent value as you type. You make your
edits, then trigger a recalculate pass that reflows the whole economy at
once.
*Why:* simpler to build than live dependency tracking, and a global dial
change is expected to be expensive enough (touches everything downstream)
that an explicit trigger is preferable to a background recompute running on
every keystroke. *Cost, accepted:* you don't see a change's effect until you
ask for it — worth revisiting if that turns out to make tuning feel
disconnected from the number you just typed.
*Consequence for CMS-14:* auto-correction of an Item's value happens as part
of this same recalculate pass, not immediately when its recipe is edited.

---

## Targeted buffs — a new Token category, not a schema tweak

Today's buff Tokens (`token_sawmill`, `token_shrine`, `token_campfire`,
[tokenRegistry.js:395](src/config/registries/tokenRegistry.js:395)) are
**untargeted**: `buff: { target: 'token'|'hero', modifiers: [...] }` applies
uniformly to whatever is adjacent, and D-119/D-120 lock the effect size to
tiny (~5–10%) specifically because an untargeted buff touches everything
nearby. A Token like "double all adjacent Shrimp outputs" breaks both
assumptions on purpose — narrow target, large effect — so this needed
reconciling rather than silently overriding D-119/D-120.

**CMS-17 — Targeted buffs get their own, larger effect budget.**
*Why:* D-119/D-120's tiny-effect rule exists because an *untargeted* buff
touching everything nearby must stay small or it dominates the board. A buff
narrow enough to affect only one Token type/tag can't be stacked onto
everything indiscriminately — you need the specific target nearby for it to
matter at all — so it can afford real weight without breaking the "power
comes from better Tokens, not stacked modifiers" principle. D-119/D-120
stand as written for untargeted buffs; this is a new, separate rule for
targeted ones, not an amendment to the old one.
*Open:* the actual size of the "large" budget isn't pinned down yet — a
natural fit for a Global Value dial (CMS-15) rather than a fixed number.

**CMS-18 — A targeted buff may target by tag, by exact Token id, or by
tokenType category — chosen per Token, not a single fixed method.**
*Why:* different buffs want different precision. "Boost all adjacent
seafood" wants a tag; "boost specifically Shrimp Beds" wants an exact id;
"boost all adjacent resource Tokens" wants the coarse `tokenType`. The CMS's
buff-targeting field needs to support all three modes rather than picking
one, since the owner intends to use different ones for different Tokens.
*CMS consequence:* the Token editor's buff section needs a target-mode
selector (tag / id / tokenType) plus a value picker that adapts to the
chosen mode — not a single free-text target field.

**CMS-19 — Large targeted buffs default to `noStackDuplicates: true`.**
*Why:* D-23/D-82's uncapped stacking assumed tiny effects (eight 5% buffs =
a modest +40%). Eight "double Shrimp" buffs stacked uncapped would be +800%,
which breaks the same principle CMS-17 just carved an exception into more
carefully. Rather than relying on every author remembering to flag each big
buff individually (today's opt-out model, `token_shrine`'s
`noStackDuplicates` flag), the **large-targeted-buff category defaults to
no-stack**, and an author opts a specific Token *out* of that default if one
is deliberately meant to be stackable. Untargeted tiny buffs keep today's
opt-out-per-Token behavior unchanged.

---

## Modifier types the Token editor authors

Grounded in the existing modifier system (`EFFECT_TYPES`/`TARGET_CATEGORIES`
in [constants.js](src/systems/effects/constants.js)), which is bigger than
the four shipped buff Tokens actually use.

**CMS-20 — Authorable effect types: YIELD, WORK_TIME, INPUT_COST (production);
HP_REGEN, XP_BONUS, LOOT_MULT, FAIL_CHANCE (support); WORK_SPEED (new, see
CMS-21); skill-scoped STAT_BONUS (see CMS-22).**
*Excluded, per CMS-2:* DAMAGE, DEFENSE, THORNS_REFLECT and the combat
`TARGET_CATEGORIES` (melee/ranged/magic) stay out — combat balancing is a
later project.

**CMS-21 — `SPEED` splits into `WORK_SPEED` and `COMBAT_SPEED`.**
*Why:* the existing single `SPEED` type covers both work-tick speed and
combat attack speed under one name (`constants.js:6`). If the CMS authors
`SPEED` as-is, nothing stops a Token from accidentally becoming a combat
buff — the ambiguity lives in the type itself, not in how carefully an
author uses it. Splitting into two named types removes the ambiguity
permanently rather than relying on the CMS to police which Token categories
may use it. **Requires an engine change** — the current `SPEED` consumers
need to be renamed/split, not just a CMS-side restriction. The CMS only ever
offers `WORK_SPEED`.

**CMS-22 — `STAT_BONUS` is authorable, restricted to skill-related bonuses only.**
*Why:* its own code comment calls it "generic... for skills/combat" —
deliberately vague. Restricting the CMS's exposure of it to skill-related
effects (e.g. bonus levels/XP rate toward a specific skill) keeps it inside
CMS-2's economy scope rather than reopening the combat-scope question.

**CMS-23 — Targeted buff filtering (CMS-18: by tag, by exact id, by
tokenType) needs new engine plumbing, not just a CMS field.**
*Why:* `TileModifiers.rebuildTile` (`TileModifiers.js:81`) currently applies
every adjacent buff Token's modifiers to a tile **unconditionally** —
filtering by target only happens later, when something reads the axis, and
only by skill `category` (`TARGET_CATEGORIES`). Tag- and id-level targeting
doesn't exist in the runtime yet. Building the CMS's target-mode selector
(CMS-18) is authoring UI; making tag/id targeting actually work on the board
is a separate engine task in `TileModifiers.js`/`ModifierAggregator`.

**CMS-24 — Effects with no dial: CMS records intent, a developer wires the logic.**
*Why:* `LOGIC_OVERRIDE`-style custom behavior (arbitrary code triggers) can't
be captured as a form field. Rather than excluding these Tokens from the CMS
entirely, the author describes the intended behavior in a notes field and
flags the Token as "needs custom logic" — it becomes a visible to-do instead
of silently not working, but the CMS stays a data tool rather than growing a
scripting surface.

---

## Proc modifiers, charges, and a wider palette

**CMS-25 — Modifiers have two distinct authored shapes: deterministic and proc.**
A deterministic modifier is `{ type, bucket, value }`, same as today (always
applies, resolved through `ModifierAggregator`'s flat/multiplier/percentage
buckets). A **proc** modifier is a different shape — `{ type, chance,
effectIfTriggered }` — a per-cycle roll, not a bucket value.
*Why:* the schema didn't distinguish these before, but the code's own intent
already did — `constants.js` describes `LOOT_MULT` as a "chance for double
loot" and `FAIL_CHANCE` as a "chance for failure," which are not bucket
math. Giving them separate editor sections stops an author from building a
modifier that's ambiguous about which math path resolves it.
*CMS consequence:* the Token editor's modifier UI branches on which shape is
selected, rather than one generic form for every effect type.

**CMS-26 — D-126 holds for proc modifiers too: a Context/Buff Token's charge
burns on service, independent of whether its effect actually triggered.**
*Why:* one predictable rule for every buff, deterministic or probabilistic —
a Token serving 100 cycles wears out in 100 cycles regardless of luck. The
alternative (charge only burns on a hit) was considered and rejected:
"only wears out when it works" reads intuitively but makes wear rate
unpredictable and would be a second rule sitting alongside D-126 rather than
an extension of it.

**CMS-27 — Palette additions: `BONUS_DROP`, `CHARGE_EXTEND`, `SELL_BONUS`.**
- **BONUS_DROP** — a chance to yield an extra, *different* item on top of a
  Token's normal output. Distinct from `LOOT_MULT`, which multiplies the
  Token's own output rather than adding something unrelated.
- **CHARGE_EXTEND** — adds uses/charges to an adjacent depleting Token,
  extending its lifespan rather than boosting its output. A maintenance
  effect, new to the palette.
- **SELL_BONUS** — increases gold from Market sales specifically. Narrow and
  Market-only, per D-141's goods-specific Markets.
*Considered, not included:* `ACCESS_REDUCTION` (lowering the skill
requirement to work an adjacent Token, per D-67's Access gate) was proposed
but not picked up this round — it's a gate, not a number, and would need its
own design pass if it comes back.

**CMS-28 — `RANGE_EXTEND` is wanted, and it reopens D-81.**
Confirmed intentional: some Tokens will have reach beyond the standard 8
adjacent tiles, and other Tokens that extend a neighbor's reach further
still. Explicitly a **rare, powerful effect**, not a common one.
*Why this needed flagging rather than folding in quietly:* D-81 was chosen
specifically so adjacency — which already does three jobs at once (recipe
definition, buffs, in-place upgrading) — is "learned exactly once." A Token
that breaks the 8-tile rule reopens that promise for whatever it touches.
⚠️ **Open, not yet resolved:** which of adjacency's three jobs an extended
reach applies to (recipes? buffs? both?), how far "extended" reach goes, and
whether it stacks (a Token extending another Token's already-extended
reach) all need their own design pass before this is buildable. Recorded
here as a confirmed direction, not a finished mechanic.

---

## Triggered Tokens — a fifth category, event-driven rather than cycle-driven

The "Masonry Wheelbarrow / Stoneshaper Sigil" example surfaced two distinct
new things, not one:

- The **Wheelbarrow** procs off a *neighbor's* cycle-complete event (Ore Vein
  mined), not its own — every proc modifier discussed so far (CMS-25)
  assumed a Token reacts to its own cycle.
- The **Sigil** has no work cycle and no hero at all. It watches for a
  condition (Stone existing) and acts on a **cooldown**, not a timer. This
  doesn't fit Producer, Context, Buff, or Manager — the four Token
  categories that exist today.

**CMS-29 — Triggered Tokens are a new, fifth Token category:** event-driven,
no work cycle, no hero required, rate-limited by a cooldown rather than a
cycle time. Distinct from a Passive Generator (D-116), which still runs its
own cycle unstaffed — a Triggered Token doesn't cycle at all, it waits and reacts.

**CMS-30 — A trigger's scope (adjacency vs. global) is chosen per Token,
same pattern as CMS-18's per-Token targeting.**
Some Triggered Tokens react only to a specific adjacent neighbor's event
(the Wheelbarrow, scoped to its Ore Vein); others react globally to a
condition anywhere in the economy (e.g. an item existing in the Bank at
all), consistent with D-83's "supply is global and non-spatial." Both are
real, both are wanted — this isn't a single rule to settle once, it's
another target-mode field alongside CMS-18's tag/id/category options.
*Confirmed directly:* the Sigil in the worked example specifically wants
adjacency-scoping (react to Stone produced by *this specific neighbor*), not
global reactivity — but other Triggered Tokens should be able to react
globally instead.

**CMS-31 — D-116 ("Passive Generators are strictly worse than staffed
equivalents") does NOT apply to Triggered Tokens.**
*Why:* D-116 exists to stop an unstaffed Token from out-producing a staffed
one on raw output, which would undermine heroes being the production
ceiling (D-115). A Triggered Token like the Sigil isn't competing on that
axis — it's automation/utility, closer in spirit to a Manager (D-140, also
hero-less, deliberately powerful because restocking-yourself is exactly the
chore it exists to remove) than to a Generator. Triggered Tokens get their
own balance treatment, not D-116's.

**CMS-32 — The event/action vocabulary is a live registry, same principle
as CMS-5.**
The owner was explicit: these are "baseline effects, with more that I might
need coded in later." The CMS must not hardcode a fixed list of triggerable
events and actions — it reads them from the game's registry the same way it
already reads skills, tags and equip slots (CMS-5). A developer adding a new
`EVENT_TYPE` (e.g. "adjacent Token depletes," "hero enters Wounded") or
`ACTION_TYPE` in code makes it immediately available in the CMS's Token
editor, with no CMS-side schema change required. This is the same
game-defines/CMS-provides-content split CMS-1 through CMS-5 already
established, applied to a new axis.
*Open:* the concrete starting list of `EVENT_TYPE`s (cycle-complete,
neighbor-cycle-complete, item-threshold-reached, deplete, place...) and
`ACTION_TYPE`s (produce item, convert item, instant-complete neighbor,
chain-cascade) hasn't been enumerated yet — CMS-32 settles that the
*mechanism* is extensible, not what the day-one list contains.

---

## Event types for Triggered Tokens

Grounded in the existing `EventBus`/`BOARD_EVENTS`
([boardEvents.js](src/systems/board/boardEvents.js)), which already publishes
real board state changes — CMS-32's "live registry" turns out to mean mostly
**exposing a subset of what already fires**, not inventing new plumbing.

**CMS-33 — Authorable event types: `CYCLE_COMPLETE`, `TOKEN_DEPLETED`, and
`COMBAT_RESOLVED`.**
`CYCLE_COMPLETE`'s existing payload (`{ tile, typeId, heroId, failed }`)
already carries what the Wheelbarrow example needs — "my neighbor just
finished." `TOKEN_DEPLETED` covers reacting to a neighbor running out.
*Excluded:* the UI-only events (`PROGRESS`, `ALERT_CHANGED`,
`SPRITES_CHANGED`) are plumbing for progress bars, alert icons and particle
sync — not meaningful game-state changes, so left off the authorable list
entirely rather than offered per-Token.
*Not included this round, not ruled out:* `TILE_CHANGED`/`HERO_MOVED`
("react to a neighbor being placed/swapped, or a hero arriving") — a bigger
design surface for proc/cooldown rules that wasn't picked up in this pass.

⚠️ **`COMBAT_RESOLVED` reopens CMS-2's combat-out-of-scope boundary.**
CMS-2 explicitly deferred combat balancing as its own later project. Include
it here only for Triggered Tokens reacting to a kill nearby (e.g. an
economy Token that does something when an adjacent enemy is defeated) — this
is **not** a reversal of CMS-2's broader stance that the 7-stat combat
engine itself stays unmodelled. Flagged so this narrow exception doesn't
get read later as "combat is in scope now."

**CMS-34 — Triggers fire on success only; a failed cycle (`failed: true`)
does not fire the listener.**
*Why:* a chain reaction should cascade because something actually happened.
Reacting to a stuck/failed neighbor would trigger off nothing being
produced, which reads as a bug rather than a feature. (A "sympathy" effect
that specifically reacts to failure was raised and set aside — not built for
v1.)

**CMS-35 — Global-scoped triggers (the Sigil's "Stone exists anywhere" case)
reuse the existing global `inventory_updated` event plus an author-specified
item + threshold, rather than a new raw event type.**
*Why:* there's no per-item "X was produced" event today, only a coarse
"the Bank changed" signal (`InventoryManager`'s `inventory_updated`). Rather
than building item-specific board events, a globally-scoped Triggered Token
subscribes to the existing coarse event and evaluates its own
author-specified condition (watched item id, quantity threshold) each time
it fires. This resolves CMS-30's global-scope case without new engine event
plumbing beyond a threshold check.

---

## Removed and restructured from the old CMS

Audited against the old CMS's actual tab list (`Items, Recipes, Tasks,
Stations, Enemies, Areas, Subskills, Tags, Effects, Loot Tables` —
[Sidebar.jsx:15](cms/src/components/layout/Sidebar.jsx:15)).

**CMS-36 — Removed entirely, no CMS home at all, not even preserved-inert:**
- **Areas** — D-43 deleted the concept from the game outright.
- **Tasks (cards)** — D-79 converted cards to Tokens one-for-one; the Token
  editor built this session **is** the replacement, not a screen alongside it.
- **Subskills** — tied to a skill list redesigned twice since; consistent
  with CMS-1 already excluding heroes/skills from v1 scope.
- **The old Effects table** (56 placeholder entries) — superseded outright
  by this session's modifier/event system (CMS-17–CMS-35). Nothing worth
  preserving; the new system isn't a parallel concept, it's a real one.

**CMS-37 — Quests and Invasions get no CMS scaffolding, not even a
placeholder tab.**
*Why:* neither ever had a CMS editor to begin with, and D-30–D-34 already
marked Hazards/Invasions **suspended** in the game itself (not deleted),
pending a test of whether the board needs an antagonist. Building CMS
surface for a mechanic the game hasn't decided on yet risks the exact rot
CMS-1 already avoided with heroes/skills. If/when either returns, it gets
its own design pass first — a placeholder tab was explicitly rejected as
likely to drift stale.

**CMS-38 — Stations fold fully into the Token editor; Enemies keep a
separate screen.** *(Refined by CMS-68: "separate screen" turned out to
mean the same Token editor with a reserved section, not a different schema.)*
*Why the split:* both are just Tokens in the game's own model today (D-104:
"enemies are NOT a special case... one economic model covers the whole
board"; stations are `tokenType: 'station'`) — a generic Token editor
filtered by type would technically cover both. But Enemies were kept
separate anyway because combat stats are a near-certain future field once
CMS-2's combat-balancing deferral lifts, and a dedicated space now means
that expansion has somewhere to land rather than retrofitting a filtered
generic view later.

**CMS-39 — Recipes become skill-pooled, not Token-owned.**
Recipes belong to a **skill** (e.g. Cooking); any station Token of that
skill draws from the shared pool, rather than each station privately owning
its own `recipes[]` array as Forge/Smelter do today.
*Why:* directly matches the owner's framing — "a Kitchen token would have
access to all the Cooking skill recipes" — and future-proofs a second
station of the same skill (e.g. a later Camp Stove) sharing Kitchen's
recipe library automatically instead of needing its own copy authored.
⚠️ **This is a real engine change, not just a CMS screen.** Today's
`token_forge`/`token_smelter` store `recipes[]` inline
([tokenRegistry.js:329](src/config/registries/tokenRegistry.js:329)).
Moving to a shared skill-keyed registry means the runtime needs to resolve
"which recipes can this Token attempt" by skill lookup rather than reading
its own array directly — a change to how `BoardRunner`/`WorkProcessor`
consume recipes, alongside the CMS work.
*Resolved by CMS-76: pooling is opt-in per station, not skill-wide.*

**CMS-40 — The Recipe editor is one screen: authoring AND cross-Token/cross-skill review.**
*Why:* rather than splitting "where recipes are edited" from "where gaps get
reviewed," one screen does both — consistent with wanting to catch missing
recipes or overlapping coverage without switching views.

---

## Loot tables and tags

**CMS-41 — A Token's loot is its `outputs[]` list: independent per-entry
chance, min/max quantity, no clusters.**
Every entry rolls independently — a Token can yield multiple different
items from one completed cycle if several entries hit. Each entry is
`{ itemId, chance, minQty, maxQty }`.
*Why this differs from what's shipped today:* current `outputs[]` entries
(`tokenRegistry.js`) use a single fixed `quantity`, not a range — this adds
min/max. It also formally rules out the legacy cluster/"pick exactly one"
behavior (`LootSystem._processCluster`, `dropTableRegistry.js`) as a model
for Token drops: nothing about working a Token should behave like a
mutually-exclusive roll. That old system stays orphaned/unused rather than
becoming something the CMS authors against — confirmed, not just assumed
dead (CMS-36 already retired the old CMS's "Loot Tables" tab on this
understanding, before this round clarified what "loot table" actually
meant to the owner: not a separate entity, but this exact per-Token
output list).

**CMS-42 — No separate Loot Table entity in the CMS.** Drop chances are
authored inline wherever they're needed — a Token's `outputs[]`, a Map's
`pool[]` — using the pattern above. There's no shared/referenced table
object between them.

**CMS-43 — Tags scope confirmed, unchanged from CMS-6's assumption:**
recipe and Map-material inputs are always an exact `itemId`, never
tag-matched — the old card-sequence importer's `acceptTag` confusion
(`project_cms_rework` memory, L28) doesn't recur because Tasks/cards are
already gone (CMS-36). Item `tags` (buff targeting, CMS-18) and context
Token tag-like `provides`/`requiresContext` strings (CMS-6) are the only
remaining uses of "tag," and both survive as-is.

---

## Deriving sell value — the CMS as a real simulation, not just a formula

There's directly relevant prior art: the old CMS had an iterative solver
(`cms/src/engine/runSimulation.js`,
[`valuePropagator.js`](cms/src/engine/valuePropagator.js)) that seeded
manually-anchored "root" items and propagated `trueCost → sellPrice`
downstream through recipes, re-running until stable
([runSimulation.js:27](cms/src/engine/runSimulation.js:27), up to 10
iterations). The new CMS reuses this shape, but the anchor itself changes —
see below.

**CMS-44 — Root item value is DERIVED from Map economics, not hand-typed.**
Reconsidered from CMS-14/CMS-15's original framing (which implied a human
sets a starting guess even for true primitives). The owner corrected this:
base resources aren't free to acquire anymore — they come from Tokens with
limited charges (`uses`), which are themselves obtained mainly from Maps,
which cost gold (D-139, D-144). That's a real, computable cost chain:

```
Map price  →  cost to acquire this Token (given its pool weight)
           →  cost per charge (given the Token's total `uses`)
           →  cost per unit item (given yield per work cycle, CMS-41)
           →  root item value
```

The Map ROI dial (CMS-15 #2) then pulls the Token's **sell** value below
that computed cost and its **usage** value above it — the owner's original
example, now wired into an actual formula instead of a standalone rule.
*Manual root anchors are still possible in principle* (nothing here rules
out a hand-set value where there's genuinely no Map/recipe chain to derive
from), but they're the exception, not the default starting point CMS-14
originally assumed.

**CMS-45 — Multi-source Tokens anchor to their cheapest acquisition path.**
A Token obtainable from more than one Map, or craftable via a recipe
(D-144), anchors its acquisition cost to whichever path is currently
cheapest — matching how a rational player would actually behave, and
keeping the formula a single traceable number rather than a blend.
*Rejected:* a weighted average across sources (more "representative" but
harder to explain when auditing why a value is what it is) and an
author-flagged "primary source" (more control, but one more field to
maintain per Token when the cheapest-path rule already gives a defensible
default).

**CMS-46 — One Map ROI dial governs both Token pricing and Item root-value
derivation.** Rather than splitting into separate dials for "how Token sell
price relates to Map price" and "how Item root value derives from Token
acquisition cost," a single dial drives both — tune it once, both
relationships move together and stay proportionally consistent.
*Cost, accepted:* if Token-level and Item-level pricing ever need to move
independently as content grows, this dial gets split later; not a concern
worth building for now.

**CMS-47 — Iterative solving is kept**, matching the old engine's approach:
propagation re-runs until stable rather than a single top-down pass. Needed
for anything that isn't a strict tree — an item producible by more than one
recipe, or a context Token whose own value depends on what it gates.

---

## The Map ROI math — aggregate-first, not per-entry-independent

⚠️ **This corrects CMS-45's original framing, not just extends it.**

Working through CMS-45's "cost to guarantee one copy" approach revealed a
break: computing each pool entry's value independently (rarer → costs more
Map-purchases-in-expectation → worth more) and then summing those values
weighted by draw probability does **not** stay proportional to Map price —
the aggregate scales up with how many *distinct* entries are in the pool.
A 20-entry pool would read as roughly 20× more "valuable" than a 2-entry
pool at the identical Map price, which can't be right — pool variety
shouldn't inflate the aggregate ROI check.

**CMS-48 — Aggregate burst value is anchored first; per-entry value is
allocated second, by rarity.**
1. **Anchor the total:** `target total sell value per burst = Map price ×
   sell ratio` (the Map ROI dial, CMS-15 #2 / CMS-46), spread across the
   3–6 items one burst actually yields (D-167, `BURST_MIN`/`BURST_MAX` in
   [Cartographer.js:47](src/systems/board/Cartographer.js:47)).
2. **Allocate that fixed total across pool entries by rarity:** a rare
   entry (low `weight`) gets a bigger per-copy slice than a common one, but
   the slices always sum to the anchored total — **regardless of how many
   distinct entries the pool contains.** This is what CMS-45's version got
   wrong: it computed per-entry value first and let the sum fall out
   however it fell, which drifted with pool size instead of holding to the
   dial's intended ratio.
*Consequence for CMS-45:* "cheapest source wins" for multi-source Tokens
still applies, but the per-source number being compared is now this
aggregate-derived allocation, not the earlier independent-cost formula.

**CMS-49 — Usage value is the same rarity-weighted base, scaled up by a
second dial.**
Each Token's "fair share" value (from CMS-48's allocation) is the shared
foundation for both directions: **sell value** = base × sell ratio (<1),
**usage value** = base × usage ratio (>1). This keeps the two numbers
visibly related — usage is always a defined multiple of sell, not an
independently-tuned number that could drift apart from it for no visible
reason. Two ratios, one shared base, rather than two unrelated formulas.

---

## Combat loot — same machinery, no time dimension

**CMS-50 — Enemy Token loot ROI reuses CMS-48/49 unchanged; combat power
math (DAMAGE/DEFENSE/accuracy) stays deferred per CMS-2.**
*Why this isn't reopening CMS-2:* D-104 already established enemies are
just Tokens ("one economic model covers the whole board"), and D-129
already made a kill count as one cycle for every board system outside the
combat engine. That means an enemy's loot list is CMS-41's output-list
shape, its `uses` is the same finite-charge mechanic as any Token, and its
acquisition cost (from whichever Map it comes from) is CMS-48's exact
formula. None of that touches damage, defense, or hit chance — it's the
*economy* of a fight (is this worth doing), not the *mechanics* of one (can
you win it). CMS-2's deferral was specifically about the 7-stat engine
still being in flux; this doesn't model that engine at all.

**CMS-51 — The ROI check has no time dimension. "How fast" is explicitly a
combat-balance question, not a looting one.**
The relevant comparison is **total lifetime loot value vs. acquisition
cost** — a Cow Token with 50 uses producing 50 Steaks needs those 50 Steaks
to justify the Token's Map-derived acquisition cost in aggregate, the same
lifetime-value check CMS-44's chain already does for a producer (`uses` ×
yield-per-cycle). **Fight duration, gold/hour velocity (CMS-10), and
whether a fight is winnable in reasonable time are explicitly out of scope
here** — they're combat-balance questions for whenever CMS-2's deferral
lifts, not loot-economy ones. This was raised as a candidate ("do we need a
time-per-kill estimate for the velocity check?") and explicitly rejected —
the owner drew the line at value-per-lifetime, not value-per-hour, for
combat specifically.

---

## Sprite recolor / palette suite — untouched

**CMS-52 — The sprite recolor and color palette system carries over entirely
unchanged.** Same as the old concept doc's own stance (§4: "It works well...
essentially independent of the CMS proper. It will not be touched, and saved
palette data is preserved.") — reconfirmed rather than assumed, since
everything else from that document was superseded this session. This is the
one piece of the old CMS that stays exactly as-is.

---

## The Map authoring screen

Grounded in the shipped Map schema (`mapRegistry.js`: `id, name, theme,
price, materials, pool[{kind, refId, weight}]`) and `Cartographer.js`'s
burst mechanics (`BURST_MIN`/`BURST_MAX`, 3–6 items per burst, D-167).

**CMS-54 — Pool entry weight stays free numeric input, not derived from
Token rarity.**
*Why:* considered tying weight to a Token's own rarity tier (since D-175
already says rarity means drop frequency), but kept as free per-entry input
— full author control over this Map's specific pool, no indirection through
a second field to reason about.

**CMS-55 — The Map screen's ROI check follows the same on-demand
recalculate rule as everywhere else (CMS-16). No live-feedback exception.**
*Why:* consistency was chosen over the cheaper-to-compute local case — one
mental model ("recalculate means recalculate") everywhere in the CMS,
rather than some screens updating live and others not.

**CMS-56 — The pool entry picker is one flat, searchable list of all
Tokens, no theme filtering.**
*Why:* simpler to build than a theme-aware default view; you filter by eye
via search when a Map has dozens of candidates. No restriction on reusing a
Token across multiple Maps' pools either — D-139 doesn't forbid it, and a
common resource legitimately belonging to more than one Map is normal.

**CMS-57 — Map price has no pass/fail check at all; it's the manually-set
root, and CMS-48's ROI math is generative, not a validator.**
*Corrects the premise behind CMS-55's question.* Map price isn't compared
against an independent expectation — it **is** the one hand-authored anchor
the whole chain hangs from (per CMS-44/48: `Map price → target aggregate
burst value → per-entry allocation by rarity → root item value`). Because
CMS-48 *derives* each entry's value as its allocated share of a target
computed from Map price, the aggregate can't drift out of range — there's
nothing to warn about, only numbers to display. The Map screen's job after
a recalculate is showing the computed downstream values (per-entry sell/
usage value, resulting item root values), not flagging deviation from a
target. *(Value-propagation warnings elsewhere in the chain, per CMS-10,
are unaffected — this is specific to a Map's own pool aggregate.)*

---

## The Token editor screen — sidebars plus stackable effect blocks

Grounded in `cms/src/components/layout/SupplyChainLayout.jsx`'s existing
3-column shape (left sidebar / center editor / right sidebar), today wired
as literal Inputs/Outputs for Tasks and Recipes.

**CMS-58 — Tokens are NOT single-purpose; a Token can combine categories.**
*Corrects an assumption running through CMS-1–CMS-49:* every Token
discussed so far was implicitly treated as one thing (a Producer, or a
Buff, or a Triggered Token). The owner was explicit this doesn't hold — a
Token can produce AND carry an aura effect at once, or consume items
specifically to power an effect distinct from its production recipe. This
also means the old CMS concept doc's D-3.4 ("cards are single-purpose") does
**not** carry over to Tokens; it was true of cards, not inherited by default.

**CMS-59 — The screen keeps sidebars for production (Inputs/Outputs) but
adds a stack of addable EFFECT BLOCKS in the main view for everything else.**
A Token can have zero, one, or several effect blocks alongside its
production sidebars (or instead of them, for a pure Buff/Trigger Token with
no production at all). This replaces the earlier idea of the sidebars
relabeling per single category (CMS-58 made that framing obsolete before it
was ever logged as a decision) — production stays in the sidebars when
present, everything else stacks as blocks in the center.

**CMS-60 — Each effect block has its own independent cost/cadence, separate
from the production Input sidebar's cycle.**
An aura's upkeep (e.g. 1 Incense every 30s) is not folded into the Token's
production inputs or tied to its production cycle time — it's its own cost
with its own timing, so a Token can produce on one rhythm and sustain an
effect on an entirely different one.

**CMS-61 — An effect block is one flexible container built from already-typed
pieces, not a freeform description.**
A block has optional sections — **trigger** (event + scope, CMS-33),
**cost** (items + cadence, CMS-60), **target** (tag/id/tokenType, CMS-18),
**modifiers** (deterministic or proc, CMS-25) — any of which can be filled
in or left blank, rather than forcing a choice between rigidly separate
named module types ("this is a Buff module" vs "this is a Trigger module").
*Why this doesn't reopen CMS-24:* every section is still fully typed,
drawing from vocabularies already designed this session. This was checked
explicitly — "generic" here means flexible composition of known pieces, not
the freeform/developer-interpreted intent CMS-24 deliberately excluded from
the CMS's authored surface.

---

## tokenType and inline item creation

**CMS-62 — `tokenType` survives as a small, secondary required field, not a
screen-driving category.**
*Why it can't just disappear:* checked against the engine —
`BoardCombat.js` reads `tokenType` to know a Token is an enemy and should
trigger combat at all, and `RecipeResolver.js` reads it too. CMS-18 also
named `tokenType` as one of three buff-targeting modes ("boost all adjacent
resource Tokens"). It's load-bearing at runtime even though CMS-58/59
already established it shouldn't drive the *editor's* layout anymore — that
job now belongs to which sidebars/effect blocks are actually populated.
*Resolution:* keep it as a simple, required dropdown tucked into the
identity section, present for engine correctness but no longer treated as
the primary authoring decision that shapes the rest of the screen.

**CMS-63 — Referencing an unknown Item mid-authoring (in an Input/Output
sidebar entry, or an effect block's cost) opens inline creation, without
leaving the Token screen.**
*Why:* directly serves CMS-9/12's backward-chaining goal — the old CMS's
own design document named this exact workflow (§3.5: create a new
ingredient without losing your place) but never built it. A lightweight
Item form (name, type, tags, starting value — CMS-13's field set) opens
in-place; finishing it returns you to exactly where you were in the Token's
Input/Output/cost entry.

---

## Effect block authoring UX and the description dictionary

**CMS-64 — "+ Add Effect Block" offers starter presets that pre-open likely
sections, still fully editable afterward.**
A preset (e.g. "Aura," "Reaction") just decides which of CMS-61's sections
start open — it doesn't lock you into a rigid category, since it's the same
flexible container underneath. Faster for the common cases without
reintroducing the named-module-type rigidity CMS-61 deliberately avoided.

**CMS-65 — Blocks are freely repeatable; no one-per-type limit.**
A Token can carry multiple blocks of a similar shape — e.g. two
Trigger-flavored blocks reacting to two different neighbors. Consistent
with CMS-58's "Tokens are not single-purpose."

**CMS-66 — Each block's collapsed list entry is an auto-generated summary
line, built from a shared description-generation system that ALSO produces
the in-game player-facing tooltip text.**
*Why this is bigger than a CMS convenience:* D-22 already made tooltips the
game's entire discoverability mechanism ("every Token has description text;
hover gives full function and synergies"). Generating the mechanical
description once — from the block's typed fields (event type, action type,
target mode, modifier type, chance, cost/cadence) — and using it both in the
CMS's block list and as the live tooltip means the description can never
drift from what the Token actually does, and nobody hand-writes the same
mechanical explanation twice.
*Requires:* a phrase-template "dictionary" mapping each typed field/value
combination to natural-language fragments (e.g. `EVENT_TYPE: CYCLE_COMPLETE`
+ adjacency scope → "When an adjacent {typeId} completes a cycle"), which
compose into the full sentence. This is new infrastructure, not something
that exists today — flagged as a real build item, not just a UI detail.

**CMS-67 — Generated descriptions are the default; a per-Token manual
override is available.**
Covers the common case automatically (never drifts from the mechanic by
default), but a specific Token's generated phrasing can be hand-edited when
it reads awkwardly or the author wants added flavor. Same shape as CMS-14's
auto-correct-with-escape-hatch pattern, applied to text instead of numbers.

---

## The Enemy screen — same Token editor, plus a reserved section

**CMS-68 — The Enemy screen is structurally the same Token editor, not a
separate schema.**
Identity fields, the output-shaped sidebar (relabeled "Drops," same
`{itemId, chance, minQty, maxQty}` shape as CMS-41), and the CMS-58/59
stackable effect-block system all carry over unchanged — an enemy Token can
have auras or triggers too (e.g. "while alive, weakens adjacent Buff
Tokens"), which a genuinely separate Enemy schema would have to rebuild from
scratch. Consistent with D-104 ("enemies are NOT a special case... one
economic model covers the whole board") and CMS-38's original reasoning for
keeping Enemies a distinct *screen* — that reasoning was about needing a
place for future combat fields to land, not about enemies needing a
different underlying model.

**CMS-69 — A reserved Combat Stats section is visible but disabled, with a
"pending combat balance pass" note.**
Today's data has enemy Tokens reference a separate `enemyId` pointing at
combat numbers that aren't fully wired up yet. Rather than hiding this
entirely until CMS-2 lifts, the section is scaffolded and visible — greyed
out, not editable — so it's clear the field is coming rather than forgotten,
without the CMS pretending to author numbers for a combat engine that's
still moving.

---

## Identity/header fields

**CMS-70 — Cycle time moves to the RECIPE, not the station header.**
With CMS-39's skill-pooled recipes, a station's header no longer carries a
fixed cycle time — each recipe in the shared pool defines its own. A Feast
can plausibly take longer than Bread, letting recipe complexity correlate
with time, which matters for CMS-51-style lifetime-value reasoning. The
Token header instead just holds which skill it draws its recipe pool from.

**CMS-71 — Header groups into three clusters: Identity, Classification,
Lifecycle.**
- **Identity** — name, auto-generated id (slugified from name, matching the
  old CMS's `idGenerator` pattern), sprite (CMS-13's picker), description
  (generated-with-override, CMS-66/67).
- **Classification** — `tokenType` (secondary field, CMS-62), `theme`,
  `rarity`.
- **Lifecycle** — `uses`/charges, `requiresHero`, `noStackDuplicates`.
This is what's left in the header after CMS-58–62 moved buffs/triggers into
effect blocks and CMS-39/70 moved recipes (and their cycle time) to the
skill pool — confirmed as complete, nothing missing.

---

## Triggered Token actions — routed through Modifiers, no new section

**CMS-72 — No "Production" section added to effect blocks; PRODUCE/CONVERT
route through the existing Modifiers section instead.**
*Corrects the framing I proposed:* rather than a fifth block section
mirroring CMS-41's output-list shape, item-granting and item-converting
behaviors are authored as modifier **types** within CMS-61's existing
Modifiers section — the same way `BONUS_DROP` (CMS-27) already grants an
extra item as a modifier entry. This adds a **`CONVERT`** modifier type
(consumes item(s), grants item(s) — the Sigil's behavior) alongside
`BONUS_DROP` (grants without consuming — the Wheelbarrow's behavior),
rather than building a parallel schema for the same idea.

**CMS-73 — Instant-completing a neighbor's cycle is dropped; not built
without a concrete motivating example.**
*Why:* raised early on as a "domino" framing, but neither worked example
(Wheelbarrow, Sigil) ever needed it — both react to a neighbor's *own*
event, not force one to finish early. The owner reconfirmed the intent was
always "fires when something happens nearby," not "makes something happen
faster." Consistent with this session's general practice: build to a real
example, not a speculative one. Can return later with its own worked case if
a genuine need for it turns up.

---

## Where balance warnings surface

Real prior art: the old CMS's `AuditPanel` (`cms/src/components/audit/`) —
a severity-sorted table (Critical/Warning/Info), filterable by issue type,
click a row to jump straight to that entity — plus a `ProposalReviewModal`
for reviewing changes before they applied.

**CMS-74 — The AuditPanel shape carries over unchanged, populated by each
"Recalculate Economy" pass (CMS-16/55).**
Press recalculate; the panel fills with whatever value-propagation warnings
(CMS-10), chain-reachability gaps, and velocity flags came out of that run.
No live-updating audit view, consistent with recalculate being on-demand
everywhere else.

**CMS-75 — No review/approval step for auto-corrections; the
`ProposalReviewModal` pattern is dropped.**
*Why:* CMS-14 already decided Item values auto-correct without approval,
specifically to avoid re-touching every item by hand when a Global Value
dial moves — a review-before-apply step would reopen exactly that. Instead,
auto-corrections apply immediately as part of the recalculate pass, and show
up in the audit panel as **Info**-severity rows after the fact — the panel
is where you *see* what changed and jump to inspect it, not where you
approve it before it happens.

---

## Skill-pooling scope — resolves CMS-39's open question

Checked against the current data: smithing already has four stations
(Forge, Smelter, Charcoal Kiln, Deep Kiln), but only Forge and Smelter use
multi-recipe `recipes[]` — Charcoal Kiln and Deep Kiln are simple
single-output producers. That asymmetry, already present in shipped
content, is what settled the question below.

**CMS-76 — Skill-pooling is opt-in per station, not a skill-wide rule.**
A station Token has a toggle: draw from this skill's shared recipe pool, or
carry its own private recipe(s). A Kitchen explicitly opts into the full
Cooking pool (CMS-39's original motivation); Charcoal Kiln and Deep Kiln
can stay simple fixed producers despite also being `smithing` — nothing
forces every station of a skill into the pooled model just because one
station of that skill wants variety.

**CMS-77 — A station is strictly pooled OR private, never both.**
No mixing a shared-pool subscription with an additional station-exclusive
recipe on the same Token. *Why this doesn't lose anything:* a would-be
"exclusive" recipe can still be authored *into* the shared pool, gated by a
context-tag requirement (CMS-6) that only this specific station's setup
satisfies — achieving the same practical effect without a second
recipe-source concept for the engine or the CMS to track.

---

## Full review pass — inconsistencies resolved

A full re-read surfaced three places where a later decision quietly changed
an earlier one without the earlier one being revisited, plus one
under-specified connection. Resolved directly rather than left to drift:

**CMS-78 — Item creation no longer prompts for a starting value at all.**
*Corrects CMS-12's "type an initial guessed value" step*, which predated
CMS-44's correction (root value is derived, not hand-typed). Since almost
every Item's value should come from the derivation chain, asking for a
number that's about to be overwritten was a wasted step. An Item's value
field stays blank/pending until a recipe or Map chain exists to derive it —
manual value entry is reserved for the genuine no-chain edge case CMS-44
already flagged as still open.

**CMS-79 — Private (non-pooled) stations keep flat, header-level
`cycleTimeMs`; only pooled recipes use CMS-70's per-recipe shape.**
*Resolves the connection CMS-70/77 left implicit.* Matches today's shipped
data exactly (Charcoal Kiln's flat `config.cycleTimeMs`, no `recipes[]`) —
zero migration needed for simple private stations. **Consequence:** the CMS
Token editor has two different "how long does this take" fields depending
on a station's pooling choice (CMS-76) — header-level for private, per-recipe
for pooled — and must branch its UI accordingly rather than assuming one
shape everywhere.

**CMS-80 — D-116's Triggered-Token exemption (CMS-31) applies only to
Tokens with NO staffed production at all, not per-block on a mixed Token.**
*Resolves a gap CMS-58 opened after CMS-31 was written.* A Token that both
produces (staffed) AND carries a trigger effect block does **not** get
CMS-31's carve-out for the trigger portion — the whole Token is held to
D-116's normal standard once it has any staffed production side. Only a
Token that is purely triggered, with no production sidebar populated at
all, gets CMS-31's exemption.

**CMS-81 — The description generator (CMS-66) covers a Token's PRODUCTION
side too, not just effect blocks. One composed description per Token.**
A Token's full tooltip — "Consumes 2 Oak Wood, produces 1 Charcoal. When
adjacent Ore Vein completes: 10% chance +1 Stone." — assembles from both the
recipe shape and every effect block through the same dictionary, per
CMS-67's manual-override safety valve. *Why:* CMS-66's own reasoning (never
hand-write what the mechanic already states structurally) applies just as
much to the production half as to effects — splitting them would leave the
production description free to drift from the recipe the same way CMS-66
was built to prevent.

---

## Roadmap review pass — what reading the actual code changed

The preliminary roadmap (`cms_rework_v2_roadmap.md`) was checked against
`cms/src/` and the game's own loading code by reading the files, not just
their names. Four structural facts came out of it that no decision so far had
accounted for, because every decision above assumed a data pipeline that
turns out not to exist yet.

**CMS-82 — Tokens and Maps move into `data/` JSON as a Phase 0 game-side
change, before any CMS editor is built.**
*The problem found:* CMS-53 says the CMS writes `data/` JSON wholesale, but
there is no `data/tokens.json` and no `data/maps.json`, and nothing in the
game reads such a file. Tokens live in
[tokenRegistry.js](src/config/registries/tokenRegistry.js) (750 lines of
hand-authored JS) and Maps in
[mapRegistry.js](src/config/registries/mapRegistry.js) — both hardcoded
source, not loaded content. [DatabaseManager.js:14](src/config/DatabaseManager.js:14)
still carries the never-completed TODO *"Phase 4 replaces this with a
`/data/tokens/**/*.json` glob."* So for the two entity types this entire
rework exists to author, CMS-53 was unbuildable as written.
*Why Phase 0 rather than Phase 8 (the roadmap's original placement):* the
on-disk shape and the CMS's Token schema are the same object. Fixing the
shape first makes them identical by construction; fixing it last means six
phases of editors get built against a guessed schema and the mismatch
surfaces only after every screen already depends on it.
*Rejected:* doing it at cutover (Phase 9) — fewest intermediate broken
states, but it concentrates the most uncertain work into the single riskiest
moment with no earlier chance to discover the schema is wrong.

**CMS-83 — The hardcoded JS registries are emptied at cutover; `data/`
becomes the only source of content.**
*The problem found:* CMS-53's deletion promise ("something is gone from the
output because it's gone from the CMS") is currently false.
[itemRegistry.js:1219](src/config/registries/itemRegistry.js:1219) ends with
`ITEMS = { ...STATIC_ITEMS, ...DYNAMIC_ITEMS }` — 1,180 lines of hardcoded
`STATIC_ITEMS` merge *underneath* whatever `data/items.json` says. A full-file
overwrite therefore cannot delete anything the JS registry also declares.
*Resolution:* at cutover `STATIC_ITEMS` and the Token/Map registry bodies are
emptied, so `data/` is genuinely the only source and CMS-53's reasoning
becomes true rather than aspirational. This also finally kills the duplicate
legacy-vs-`item_*` registry problem that has been masking data bugs.
*Cost, accepted:* the game has no content between the registries being emptied
and the first full sync, making cutover a hard commitment with no partial
state — which is already what CMS-53 intended ("a full cutover, not an
early/incremental one").
*Rejected:* keeping the registries as fallback defaults (safer boot, but
retracts CMS-53's deletion promise and makes the duplicate-registry confusion
permanent) and mechanically converting the registries to JSON now (contradicts
CMS-4's no-import stance).

**CMS-84 — Game-side engine work is interleaved into the phase that needs it,
not run as a separate track and not deferred.**
*The problem found:* the decisions above name at least six engine changes —
CMS-21 (`SPEED` → `WORK_SPEED`/`COMBAT_SPEED`), CMS-23 (tag/id targeting,
which `TileModifiers.js` cannot do at all today), CMS-29/32/33 (Triggered
Tokens as a new runtime category plus an event registry), CMS-39 (recipe
resolution by skill), CMS-41 (min/max output quantities), and now CMS-82 —
and the preliminary roadmap sequenced none of them anywhere. It planned CMS
screens only.
*Resolution:* each phase carries its own engine half, so every phase ends with
a CMS screen whose output the game can actually consume and can be verified
end to end by clicking through.
*Consequence, accepted:* Phase 4 (effect blocks) is far larger than it
appeared and splits into several phases — it was carrying three engine
changes invisibly.
*Rejected:* one engine phase up front (cleanest schema story, but a long
stretch with nothing visible, and Triggered Tokens would be built before any
real content had exercised them) and deferring all engine work (fastest
visible CMS progress, but it is exactly how the old CMS rotted — offering
fields for things the game had no concept of).

**CMS-85 — Enemy is a filtered view of the single Token list, not a separate
nav entry and not a separate collection.** *Resolves the open question left
by CMS-68.*
One `tokens` collection in the store, one nav entry, filtered by
`tokenType: 'enemy'`. Follows CMS-68 and D-104 ("one economic model covers the
whole board") to their conclusion — an enemy *is* a Token, so it lives in the
Token list. CMS-69's reserved Combat Stats section still appears when
`tokenType` is enemy, so CMS-38's original reason for wanting a distinct space
(somewhere for future combat fields to land) is still served.
*Cost, accepted:* enemies are found by filtering rather than by a dedicated
tab.
*Note:* this makes CMS-38's "Enemies keep a separate screen" fully superseded
— first refined by CMS-68 (same editor, reserved section), now resolved by
CMS-85 (same list too).

**CMS-86 — There is no manual Item value entry at any point. An Item with no
derivation chain is a Critical audit row, not a hand-typed number.**
*Narrows CMS-44 and completes CMS-78.* CMS-44 allowed a manual anchor "in
principle" for the genuine no-chain edge case; that allowance is now
withdrawn. The Item editor's value field is always read-only, showing whatever
the recalculate pass derived. An Item nothing produces and no Map yields shows
blank and raises a **Critical** row in the audit panel telling you to give it
a source.
*Why the stricter option was chosen over an editable "manual anchor" flag
(which would have matched CMS-14's and CMS-67's auto-correct-with-escape-hatch
pattern):* an escape hatch on values is the one place the pattern is dangerous
— a hand-set value silently stops tracking the Global Value dials, which is
precisely the hand-maintenance CMS-14 exists to abolish. Every value being
derived, with no exceptions, also means a dangling item can never hide behind
a plausible-looking number.
*Cost, accepted:* a genuine no-chain item (a quest reward, a gift) cannot be
priced and will sit as a permanent audit warning until it is given a source.

**CMS-87 — Generated descriptions are composed by the CMS and baked into
`data/` as a plain string at sync time. The phrase dictionary lives only in
the CMS.** *Resolves the storage question CMS-66/81 left open.*
The game reads `description` as an ordinary string and needs no
description-composition code, no shared module, and no knowledge that a
dictionary exists. CMS-67's manual override is simply a stored string that
wins over the generated one at compose time.
*Why not generate live in the game from a shared dictionary module* (which
would make the tooltip incapable of ever going stale): it adds a permanent
cross-project runtime dependency, and that exact coupling is what silently
broke the CMS — see the note below. *Why not store the typed fields alongside
the string* ("keeps the door open"): duplicated information that two writers
can disagree about, for a door nothing currently needs to open.
*Cost, accepted:* editing a phrase template changes nothing in the game until
the next sync — acceptable because CMS-53 already makes sync the only route
anything takes into `data/`.

---

## Surfaced by Phase 0 implementation

**CMS-88 — The design commentary inside the Token and Map registries moves to
[`token_content_notes.md`](token_content_notes.md), not into the JSON and not
into the CMS.**
*The problem found:* CMS-82's move to `data/` JSON would have silently dropped
~190 lines of inline commentary — 29% of the Token data block. It was not
decoration: it cites decisions (D-116, D-127, D-213, D-82, D-141), explains why
specific numbers are what they are, and warns what breaks if they drift.
*The distinction that shaped the options:* the commentary splits into durable
**rules** ("every Passive Generator is strictly worse than its staffed
equivalent") and perishable **worked examples** justifying specific numbers
("the Grove makes 2 every 12s; this makes 1 every 30s, a fifth of the rate").
The rules outlive any content; the examples describe numbers the CMS will
retune.
*Resolution:* both go to a single companion document, organised rules-first.
Consistent with how this project already documents itself — and every one of
these notes cites a D-number that lives in those docs anyway. The registry
files keep a short pointer to it so it stays findable, and restate the one rule
a test depends on (D-213's tool-free source, asserted by
`ContentRules.test.js`).
*Rejected:* a per-Token `notes` field in the JSON owned by the CMS (ties the
perishable notes to the numbers they explain, and connects to CMS-24's notes
field — but makes `notes` a field the CMS must model from Phase 2, and
section-level principles have no Token to attach to); keeping it all in
`tokenRegistry.js` as a commentary block (starts drifting the moment content is
retuned, with nothing linking a note to its Token); and accepting the loss
(some notes explain constraints the re-authored content must still honour).
*Cost, accepted:* the notes are one step further from the data, so they are the
easiest thing to forget to update.

**CMS-89 — The game declares a canonical Token vocabulary
(`src/config/registries/tokenConstants.js`), and the CMS reads it.**
*The problem found:* `tokenType`, `rarity` and `theme` were free strings.
Nothing anywhere declared which values are legal — the set existed only as
whatever `tokenRegistry.js` happened to use. That was survivable while Tokens
were hand-edited JavaScript held in one person's head; it stops being
survivable the moment the CMS offers them as dropdowns, because CMS-5 requires
the CMS to read its vocabulary from the game rather than keep a second copy,
and there was nothing to read.
*Not reusable:* `CARD_RARITIES` in `cardConstants.js` looks like the answer and
is not — it is card-era, has no `mythic`, and carries `epic`/`legendary` that
no Token uses.
*Resolution:* a new game-side file declares `TOKEN_TYPES` (9 values),
`TOKEN_RARITIES` (4) and `TOKEN_THEMES` (2), derived from what shipped content
actually uses, and `ContentRules.test.js` asserts every Token classifies within
them — catching drift in either direction. Adding a value in the game makes it
available in the CMS with no CMS-side change, which is CMS-32's extensibility
pattern applied to classification.
*Deliberately absent:* a category for Triggered Tokens (CMS-29). The CMS must
not be able to offer a Token category the board cannot run, so Phase 6 adds it
when the runtime does.

---

## Surfaced by Phase 1 implementation

**CMS-90 — `ITEM_TYPES` in the game is canonical, extended with `ingredient`
and `drink`.** *Resolves the Phase 0 question below; owner delegated the choice
("whichever list works is fine").*
The game's eight values plus the two that shipped content already used, giving
`material, ingredient, tool, weapon, armor, food, drink, potion, currency,
drop`. Nothing was removed, so **no existing item needs migrating** — all five
values in `data/items.json` are covered. The old CMS's capitalised list is
deleted rather than reconciled; the CMS reads the game's (CMS-5).
*What the investigation actually found, which makes this low-stakes:* almost
nothing reads `item.type`. Tokens resolve inputs by exact `itemId` and gate on
Token context tags, never on type (CMS-43). Its live consumers are the Bank's
display and a dev spawn filter. Shipped data is already loose about it —
`item_blackberry_pie` and `item_carrot` are typed `material` while tagged
`food`, and nothing broke.
*Consequence:* **CMS-13's claim that `type` and `tags` "key recipe/context
gating" is wrong for this engine.** They are organisational, not mechanical.
Anything that later needs to reason about a group of items should get a real
field rather than overloading these.

**CMS-91 — Item tags are vestigial. They stay in the CMS as free-form strings,
with no fixed vocabulary, pending a decision to remove them entirely.**
*Raised by the owner:* "I may end up removing item tags as the context tokens
for crafting make them not needed." **Checked against the code, and correct.**
* Token inputs and outputs carry only `itemId, quantity, chance, currency` —
  there is no tag-matching path in the Token economy at all.
* Crafting context runs on a **separate Token vocabulary** (`provides` /
  `requiresContext`: `ctx_axe`, `ctx_ingot_mould`, `ctx_blade_mould`,
  `ctx_helmet_schematic`, `ctx_plank_schematic`, `ctx_dredge`), which is what
  CMS-6's two-axis gating extends. Item tags were never part of it.
* The only live readers of item tags are two `tags.includes('drink')` checks
  (`effectResolvers.js`, `BankTab.jsx`) deciding HP vs Energy — already
  redundant with the explicit `restoreType` field, which every restoring item
  carries.
* The remaining consumers (`ModularSyncer.js`, `RequirementRegistry.js`'s
  `acceptTag`, `GradualInputSystem.js`) are card-era and dead.
*Resolution for now:* the Item editor offers tags as **free-form strings with
autocomplete over tags already in use**, not a hardcoded list. The old CMS's
`PERSONALITY_TAGS` is deleted — a hardcoded vocabulary is exactly what CMS-5
forbids, and there is no game-side list to read because tags carry no mechanical
meaning to read one from.
*Why not remove them outright now:* the owner said "may", not "will", and
removal is a small engine job (migrate the two drink checks to `restoreType`,
drop Bank tag-search) that should be its own deliberate change rather than a
side effect of building an editor. Free-form tags cost nothing and survive
either outcome.

**CMS-92 — Pooled recipes live in `data/tokenRecipes.json`, keyed by skill, and
a Token opts in with `recipePool: '<skillId>'`.**
*Implementation shape for CMS-39/76/77, decided in Phase 3.* A single file plus
an optional `data/tokenRecipes/**` folder glob, mirroring the Token and Map
layout settled in Phase 0.
*Why a separate file rather than living on the Token:* a pooled recipe is owned
by the **skill**, not by any station — that is the whole point of CMS-39 — so it
has no natural home on a Token, and putting it on one would reintroduce the
copying problem pooling exists to remove.
*Deliberately NOT `data/recipes.json`:* that is the card-era recipe list
`recipeRegistry.js` loads, it uses tag-matched inputs (which CMS-43 rules out),
and the Token economy does not read it at all. Reusing it would have merged two
unrelated systems under one name.
*How CMS-77 is enforced:* `recipesForToken()` resolves `recipePool` first and
ignores `recipes[]` entirely, so a Token holding both would have its private
recipes silently dropped. The CMS makes that unreachable (opting in deletes
them) and `ContentRules.test.js` asserts it for hand-authored data.

**CMS-93 — Context-tag vocabulary is read from what Tokens actually `provide`.**
The Recipe editor's context picker offers only tags some Token supplies, rather
than free text or a hardcoded list — the same game-defines/CMS-provides split as
CMS-5 and CMS-89, applied to context. A recipe gated on a tag nothing provides
can never run, so offering only real tags is the cheapest possible prevention.
*Note:* this is Token `provides`/`requiresContext`, which is a **different
vocabulary from item tags** (CMS-91) and the only one that gates crafting.

**CMS-94 — Reverses CMS-21: `SPEED` is NOT split. The CMS simply never offers
it.** *Owner decision after the premise was checked against the code.*
CMS-21 argued that one `SPEED` type covering both work-tick and combat attack
speed was an ambiguity living in the type itself. **That premise is no longer
true:**
* board work cycles resolve `WORK_TIME`, a separate axis, in `BoardRunner`;
* combat attack speed comes from `FormulaRegistry`'s `BASE_ATTACK_SPEED_MS` and
  is not modifier-driven at all;
* `SPEED`'s only runtime reader is `StatProcessor`, part of the retired
  card-era system.
So the split would have renamed a legacy axis nothing reads. The CMS's palette
offers `WORK_TIME` and omits `SPEED`, which achieves CMS-21's actual goal — an
author cannot accidentally build a combat buff — with no engine change.
*Rejected:* renaming `SPEED` → `COMBAT_SPEED` anyway as future-proofing (churns
trait/threat/event registries for a future that may not arrive in this shape),
and deleting `SPEED` outright (same benefit, larger blast radius across dormant
systems).
*Cost, accepted:* if hero Speed later becomes a real board property (deferred as
G-1), the naming question returns — but with actual consumers to name against.

**CMS-95 — The authorable modifier palette is declared in the game
(`modifierPalette.js`), and an axis joins it only when something reads it.**
*The problem found:* `EFFECT_TYPES` holds twelve axes; **only three had any
consumer** (`YIELD`, `WORK_TIME`, `INPUT_COST`). `XP_BONUS`, `HP_REGEN`,
`LOOT_MULT`, `FAIL_CHANCE` and `STAT_BONUS` — four of which CMS-20 lists as
authorable — were read by nothing, anywhere. Exposing them would have let an
author build a Token whose effect silently does nothing: the old CMS's 56
placeholder Effects, rebuilt.
*Resolution:* the palette is a game-side declaration listing each authorable
axis with its shape (CMS-25's deterministic vs proc), and **Phase 4 built the
missing consumers** for `XP_BONUS`, `LOOT_MULT` and `FAIL_CHANCE` rather than
exposing them hollow. Adding a consumer and adding a palette row should be the
same commit.
*Deferred rather than exposed:* `HP_REGEN` and `STAT_BONUS` (they belong to the
hero, not the tile, and need their own consumer), and CMS-27's `BONUS_DROP` /
`CHARGE_EXTEND` / `SELL_BONUS` (they grant items, extend charges and change
Market prices rather than scaling an axis — they arrive with their consumers in
Phase 5).
*Side effect worth noting:* implementing `FAIL_CHANCE` makes `CYCLE_COMPLETE`'s
`failed` flag real for the first time — it was hardcoded `false`. Phase 6's
triggers fire on success only (CMS-34), and now have something to check.

**CMS-96 — Token tags are mechanical, and are a different thing from item
tags.** A targeted buff may name a tag (CMS-18), so `tags` on a **Token** is
read at runtime by `TileModifiers.matchesTokenTarget`. This is deliberately
unlike item tags, which CMS-91 found vestigial. Three tag-like vocabularies now
coexist and should not be confused: Token **context** (`provides` /
`requiresContext`, gates crafting), Token **tags** (buff targeting), and item
tags (organisational only).
*Failure mode closed:* an unknown target mode matches **nothing**. A typo in a
target spec makes a buff visibly inert rather than silently universal — which
matters because targeted buffs carry CMS-17's much larger effect budget.

**CMS-97 — An effect block whose upkeep cannot be paid switches OFF, and comes
back on when stock returns.** *Fills the gap CMS-60 left.*
CMS-60 gave each block its own cost and cadence but never said what happens
when the Bank is empty. The block's modifiers stop applying and resume the
moment the item is back — mirroring how a station with missing inputs waits
rather than degrading (D-127), so "the thing it needs isn't there" has one
meaning across the whole board. Multi-item upkeep is all-or-nothing: a block
can never half-consume its cost and still lapse.
*Rejected:* accruing debt (an effect that works while unpaid makes its cost
decorative, and debt exists nowhere else in the game); destroying the Token
(depletion is the one wear mechanic and it is charges, D-118 — and losing a
rare Token to a brief stock gap while away is punishing in an idle game); and
scaling to the fraction paid (partial effects contradict D-127 and the modifier
system has no shape for them).
*Cost, accepted:* an aura lapsing mid-session is something the player has to
notice.

**CMS-98 — Item-granting modifiers have no effect-size rule; the economy solver
governs them.** *Resolves CMS-72's open question.*
A 5% chance of +1 Stone is not comparable to +5% yield, so a shared "size" rule
would be comparing unlike things. Phase 8's value propagation already prices
item flows, so a `BONUS_DROP`'s real weight surfaces in gold-per-hour and the
velocity check (CMS-10) automatically.
*Cost, accepted:* no inline warning while authoring — an over-generous grant
shows up when you recalculate, not when you type it.

**CMS-99 — `CONVERT` is deferred to Phase 6, with the triggers that give it a
firing moment.**
CMS-72 pairs `BONUS_DROP` (grants without consuming) with `CONVERT` (consumes
and grants). `BONUS_DROP` has an obvious moment to fire — a neighbour completing
a cycle — but **`CONVERT` without a trigger is indistinguishable from ordinary
production inputs and outputs**, which the sidebars already author. It belongs
with Triggered Tokens (CMS-29), whose whole point is reacting to an event.
*Consistent with this rework's practice:* build to a real example, and never
offer a field the engine cannot honour.

**CMS-100 — A block with a trigger is event-driven and NEVER ambient.**
*Found by building Phase 6 on top of Phase 5.* A triggered block's modifiers
are **actions that fire when something happens**, not an aura that applies
continuously. `TileModifiers` therefore skips triggered blocks entirely, and
`hasAdjacencyEffect` does not count them.
*Two real bugs this fixed, both silent:* a triggered `BONUS_DROP` landed
**twice** — once when its event fired and again as an ordinary adjacency grant
— and a Triggered Token **wore two charges per event**, once as a reaction
(CMS-26) and once as ambient support serving a neighbour's cycle (D-126).
*Consequence worth remembering:* "has a trigger" is a load-bearing structural
distinction, not a label. A block cannot be both ambient and reactive.

**CMS-101 — A trigger's cooldown is set BEFORE its actions run.**
Otherwise a Token whose action changes the thing it watches re-enters itself:
the Sigil converts Stone while listening for Stone, which loops until the Bank
is empty. Setting the cooldown first makes self-referential triggers safe to
author, which matters because they are the natural shape — a Token that reacts
to an item usually acts on that item.

**CMS-102 — The CMS hides an action until the block can fire it.**
`CONVERT` is offered only once a block has a trigger (`triggeredOnly` in the
palette). Same principle as CMS-95's "an axis joins the palette only when
something reads it", applied within a block: the CMS must never offer an action
the runtime would never run.

---

## The Phase 8 arithmetic, settled ahead of building it

Answered before Phase 8 starts rather than during, per the roadmap's §4. Worked
against the real Woodland Map: 200g plus 5 Oak Wood, 29 pool entries, total
weight 249, 3–6 items per burst (D-167).

**CMS-103 — Rarity premium is STRONG: per-copy value is inverse to draw weight.
And sell value is explicitly low-stakes.**
Per-copy value is allocated so the slices always sum to the anchored total
(CMS-48) with a rarity exponent at its full setting — on Woodland that gives
Heartwood (weight 1) ≈ 305g against Oakwood Grove (weight 26) ≈ 12g.
*The owner's reframing, which matters more than the number:* **"selling the
tokens is really secondary. It almost doesn't matter what they sell for, as in
optimal play the player is almost never selling tokens, always using them for
their full value. I still want to give rarer drops a higher value so it feels
right, but getting this slightly off really doesn't matter to gameplay."**
*Consequence for Phase 8 — this is the important part:* the sell side exists to
make a rare find *feel* right, not to be accurate. **Precision effort belongs on
the usage side** (CMS-49's usage ratio and the production chains it feeds), not
on the sell allocation. A tempting rabbit hole is now explicitly out of scope.
*Note on the tension with D-175:* rarity still is not a power tier. A rare
Token is not stronger — it is simply harder to acquire, and acquisition cost is
what this prices. Value and power remain separate axes.

**CMS-104 — Unlimited-charge Tokens use an assumed-lifetime dial.**
`uses: null` means unlimited (D-176), which makes "cost per charge" a division
by infinity and would price everything they produce at zero. **This is not an
edge case** — 5 of Woodland's 29 pool entries are unlimited (Trout Stream,
Campfire, Shrine, Lumber Camp, Hunter's Blind), and the Trout Stream is one of
the Foundation-six Tokens the starting Map depends on. A Global Value dial
supplies an assumed lifetime, keeping one formula for every Token.
*Rejected:* pricing them by time instead (a second formula for a subset, and
CMS-51 drew the line at value-per-lifetime rather than value-per-hour), and
leaving their items unpriced as Critical audit rows (would permanently unprice
Fish, Raw Shrimp and everything downstream).

**CMS-105 — A multi-output cycle splits its cost with rarity as a factor.**
The Trout Stream yields Fish and Raw Shrimp from one charge. The scarcer output
takes a larger share per unit, rather than every unit from the cycle being
worth the same. Consistent with CMS-103's treatment of rarity at the Token
level, applied within a cycle.

**CMS-106 — Value flows ONE way. A Token that is not an item's anchor is
solved backwards to hit the velocity band.**
*Confirmed with the owner.* Each item takes its value from exactly one anchor
(CMS-45's cheapest path). A second Token producing the same item cannot
re-derive its value — the value is already set — so instead **the solver tunes
that Token until its earn rate lands in band**. The economy becomes
self-levelling rather than over-determined.
*Prior art, noticed late:* the old `taskSolver.js` did exactly this, balancing
entities against gold-per-hour targets. The roadmap review filed it as
"reference for CMS-10's velocity check"; it turns out to be central to how the
solver works, not peripheral.

**CMS-107 — ⚠️ WHICH lever the solver tunes is deferred to its own discussion,
and it blocks Phase 8's solver.**
The owner named four levers and declined to settle them in passing:
**Drop Value, Frequency, Quantity, and Chance.** Stated preference is to tune
**Quantity or Chance** rather than cycle time — but *"deciding on which to use
and where is the tricky part, worth its own discussion."*
*Why this genuinely needs its own pass:* the levers are not interchangeable.
Cycle time is bounded by D-164's 10–30s band, which `ContentRules.test.js`
enforces. Quantity is an integer and small, so it moves in coarse jumps (2 → 3
is +50% with nothing between). Chance is continuous and fine-grained but turns
a steady producer into a probabilistic one, changing how the Token *feels* to
watch. Drop Value is the anchor itself and moving it would defeat the point.
**Phase 8 cannot start until this is settled** — it decides what the solver
actually does.

**CMS-108 — The Map anchor uses FULL cost: gold plus the value of its
materials.**
Woodland costs 200g *and* 5 Oak Wood, so the burst is worth a ratio of both.
This is deliberately circular — Oak Wood's value comes from a Token that came
from a Map — and that circularity is precisely what CMS-47's iterative solver
was chosen for: it re-runs until stable rather than assuming a strict tree.
*Rejected:* anchoring on gold alone, which would make D-100's material
component economically free and therefore decorative.

### ⚠️ Recurring failure worth naming: item references hide in new places

Three consecutive phases added a new place an item id can live, and the rename
walker missed **every one of them** — each time silently, leaving authored
content pointing at a dead id:

| Phase | New reference site |
| :--- | :--- |
| 3 | pooled recipes' inputs/outputs (own collection, not on the Token) |
| 5 | block upkeep costs, and `BONUS_DROP`'s item payload |
| 6 | a trigger's `watchItemId`, and `CONVERT`'s `consumes`/`produces` |

Phase 6 replaced the hand-maintained walker with a **deep walk matching on
field name** (`itemId`, `watchItemId`) rather than on path. A site added later
is now covered the day it is added rather than the phase after. Verified across
all seven current sites at once.

### ⚠️ Found during Phase 0, needs an answer before Phase 1: what is an Item's `type`?
*(Resolved by CMS-90 above; kept for the reasoning.)*

Three lists disagree, and none is authoritative:

| Source | Values |
| :--- | :--- |
| The game (`itemRegistry.js`) | `material, tool, weapon, armor, food, potion, currency, drop` |
| `data/items.json` (63 items) | `material, ingredient, weapon, food, drink` |
| The old CMS (`constants.js`) | `Material, Ingredient, Tool, Weapon, Armor, Food, Drink, Consumable, Treasure, Quest Item` |

Shipped content uses two values (`ingredient`, `drink`) the game does not
declare; the game declares three (`potion`, `currency`, `drop`) nothing uses;
and the CMS's list is capitalised, matching neither. **Type is not cosmetic** —
CMS-13 has it keying recipe and context gating — so an Item authored as
`Material` and synced would write a value the game does not recognise.

The same problem applies to item **tags**, which the old CMS hardcoded as
`PERSONALITY_TAGS` with no game-side counterpart at all (`tagRegistry.js`'s
`FLAVOUR_TAGS` are card-era Token-targeting tags, a different thing).

Phase 0 made the CMS import the game's list so there is at least a single
source rather than a fourth copy, and left both lists annotated as known-wrong.
**Which values the merged vocabularies should contain is a content question for
the owner, and the Item editor cannot be built until it is answered.**

### ⚠️ Found during the review, not yet a decision: CMS-5's live imports broke the CMS

`cms/src/utils/constants.js` imports `SUB_SKILL_TO_PARENT` from the game's
`skillRegistry.js`. On `main` that export still exists and the CMS builds. On
the unmerged `skill-class-rework` branch it is deliberately gone — sub-skills
were retired there — so the CMS is broken on that branch now and `main` will
break the moment it merges. Exactly one symbol is affected; everything else
compiles once it is stubbed.

The repair is deletion rather than restoration: the only consumer is the CMS's
fictional-skill remap machinery, which CMS-4 (no import path) and CMS-36
(subskills deleted) already make obsolete.

This is CMS-5's founding principle (read vocabulary live from the game's
registries, never copy it) working exactly as designed and showing its price:
it makes CMS-vs-game drift impossible, and in exchange the game can break the
CMS at any time with no warning. The trade is probably still correct — the
drift it prevents produced the fictional `industry`/`culinary`/`nautical`
skills — but "the CMS should fail loudly rather than silently when the game
moves" is a real question that hasn't been asked yet. Recorded here rather
than resolved by assumption.

---

## Open — not yet covered

- The description-dictionary's phrase templates (CMS-66) — the mechanism is
  settled, the actual template set per EVENT_TYPE/modifier type isn't
  written yet
- CMS-48's exact rarity-allocation formula (how weight translates into each
  entry's slice of the anchored total) — the shape is settled, the precise
  arithmetic is an implementation detail for whoever builds the solver
- CMS-44's remaining chain steps (cost per charge, cost per item) still need
  to compose with CMS-48's corrected per-Token value — not yet re-verified
  end to end
- ~~What happens for a genuine edge case with no Map/recipe chain~~ —
  **resolved by CMS-86** (no manual entry ever; Critical audit row)
- ~~Whether Enemy is a separate top-level nav entry or a filtered view~~ —
  **resolved by CMS-85** (filtered view of one Token list)
- Whether CMS-72's PRODUCE/CONVERT modifier types participate in any
  "effect size" budget (CMS-17/D-119-120's small-vs-large rules were framed
  around continuous axis modifiers, not one-shot item grants) — confirmed
  during the roadmap review as genuinely a Phase 4 question: it is a balance
  number, not a schema shape, so nothing earlier depends on it
- Whether the CMS should fail loudly rather than silently when the game
  removes something it imports (see the CMS-5 note above) — raised by the
  review pass, not yet asked
- ~~The exact `data/` file layout for Tokens and Maps under CMS-82~~ —
  **settled in Phase 0**: a single `data/tokens.json` / `data/maps.json` plus
  an optional folder glob, mirroring items and recipes exactly, so content can
  be split across files later without touching the loader
- ~~What an Item's `type` and `tags` may be~~ — **resolved by CMS-90/CMS-91**
- Whether item tags are removed from the game outright (CMS-91) — the owner
  raised it as likely; the migration is small and deliberately not bundled into
  Phase 1
