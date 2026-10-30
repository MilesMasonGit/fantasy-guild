# Change packs: how an agent proposes content

`data/` is written only by the CMS's Sync to Game. An agent that wants to add, change or
delete content writes a **change pack** into this folder instead. The owner reviews it in
the CMS (**Changes to review** in the top bar), accepts or rejects each entry, tweaks any
in the normal editor, and Syncs as usual. Finished packs move to `applied/` with a record
of what was applied, so a pack can be undone from there. Everything in this folder except
this README is git-ignored.

Design: `docs/active/concept_cms_agent_authoring.md`. Code: `cms/src/engine/changePacks.js`
(the format and its check), `cms/changePackInbox.js` (the folder), `cms/src/engine/packGate.js`
(the gate) and `packIntent.js` (declaring a move).

## What to read first

The owner's unsynced work is in the newest **`cms/backups/autosave_*.json`** (the CMS
writes one every few minutes while they edit, keeping the last five). Read your
"before" values from there, not from `data/`, so you see what the owner sees. Its shape:
`{ items, tokens, effects, recipePools, starterCamp, skillPerks }`; maps are items with
`type: "map"` or `"modifier"`; recipes sit in `recipePools[skill]`, each with an `id`.

## The file

One JSON file per pack, named after its id: `cms/incoming/<id>.json`.

```json
{
  "format": "fantasy-guild-change-pack",
  "version": 1,
  "id": "2026-10-20-fir-planks",
  "createdAt": "2026-10-20T15:00:00Z",
  "asked": "Construction needs a second-tier plank (owner, planning session 2026-10-20)",
  "entries": [
    {
      "op": "create",
      "kind": "item",
      "id": "item_fir_planks",
      "value": { "name": "Fir Planks", "type": "material", "sprite": "item_oak_planks", "stackable": true, "autoSyncId": true },
      "note": "Fir Planks: Construction needs a second-tier plank",
      "placeholderArt": true
    },
    {
      "op": "edit",
      "kind": "token",
      "id": "token_sawmill",
      "value": { "...": "the Token's FULL new record, every field, not just the changed ones" },
      "fingerprint": "fp:0123456789abcdef",
      "note": "The Sawmill also cuts Fir Planks"
    },
    {
      "op": "delete",
      "kind": "effect",
      "id": "effect_old_plank_bonus",
      "fingerprint": "fp:fedcba9876543210",
      "note": "Nothing uses it once the Sawmill changes"
    }
  ]
}
```

- **`id`**: letters, digits, `-`, `_`; the file name is `<id>.json`. Date-first reads well.
- **`asked`**: what the owner asked for, in their words. Shown at the top of the review.
- **`entries`**: one per entity; an entity appears once per pack.
  - **`op`**: `create`, `edit` or `delete`.
  - **`kind`**: `item`, `token`, `recipe`, `effect` or `map` (a Base Map or Modifier;
    its `value.type` is `map` or `modifier`; a plain item must not be one).
    Or `starterCamp`: the Starter Camp, one record (see below). Or `skillPerks`: one skill's
    milestone perk table (see below).
  - **`id`**: the entity's id. For a recipe, its `id` field (recipes live in pools).
  - **`value`** (create, edit): the entity's **whole** new record, as it sits in the
    workspace. An edit replaces the record, so copy the current one and change it.
    A recipe's `value.skill` names its pool. `value.id`, if given, equals `id`.
  - **`fingerprint`** (edit, delete): the fingerprint of the value you made the entry
    against. If the owner has changed that entity since, the CMS flags a conflict
    instead of overwriting. Fill it in with the helper below; never invent one.
  - **`note`**: why this entry is here. Shown in review, never written into game data.
  - **`placeholderArt`** (optional, `true`): the sprite is a stand-in (reuse the closest
    existing sprite); the review shows it, so the art to draw is listed.

### The Starter Camp

One entry, `"kind": "starterCamp"`, `"id": "starterCamp"`, `create` (only when the workspace has
never held one) or `edit`; never `delete` (the Starter Camp page's Clear does that). Its `value`
is the whole camp in the shape of `src/config/starterCampShape.js` (the autosave's `starterCamp`):
`{ version, savedAt, mat: { w, h }, hall: { x, y }, tokens: [{ typeId, x, y }], bank: { itemId: n }, banner? }`,
points in mat units on the mat it was saved from, no `id`. Copy the current one and change it; the
review lists the Tokens added, moved and removed and the Bank lines that change, and the owner can
open the Starter Camp page to tweak it before finishing.

### A skill's perks

One entry per skill, `"kind": "skillPerks"`, `"id"` the skill's id (`forestry`), `create` when the
workspace has no table for that skill yet, else `edit` (copy the current table and change it). Its
`value` is `{ "perks": [{ "level": 10, "effectId": "effect_...", "scale": 1 }] }`: whole levels from
2 to 99 (the CMS offers 10, 25, 50, 75 and 99 by default), each a library effect (create it in the same
pack with `"kind": "effect"`), `scale` 1 to 5 and optional. Shape and meaning:
`src/systems/hero/perkTable.js`. A perk reaches its hero as a carried item's rule does, so narrow a work
rule to its skill (`payload.category`), and it spends nothing.

### The plan (the ledger)

An item, map, Token or recipe may carry `"plan": { "status", "tier", "note" }` in its `value`
(`src/systems/progression/ledger/plan.js`): `status` is `planned`, `draft`, `live` or `parked`
(no status means Live), `tier` a whole number from 0 (0 the Starter Camp, 1 plane 1, and so on), set
by the owner's plan, and `note` text. `plan.tier` is not the item's or Token's own `tier`. A
**Planned** entry is a stub (a `create` whose record has at least a `name`, an item's `type` and a
`plan`; a recipe needs its `skill` too) that never reaches `data/`: Sync keeps it, and every `plan`
block, in `cms/plan/plan.json`. To set a tier on an existing entity, `edit` it with its whole record
plus the `plan` block, as for any edit.

Numbers are a proposal: the owner runs Recalculate after accepting.

### Declaring a move (optional)

A pack that means to move a stage's time (the time a new game first has everything planned for
that tier, at the Typical player, as the Ledger's timeline shows it) says so in a top-level
`intent`; a pack that declares nothing leaves it out and works as before:

```json
"intent": {
  "stages": [
    { "tier": 2, "move": "faster", "note": "Plane 2's buildings come at Construction 5–8", "toHours": 24 }
  ]
}
```

- **`tier`**: the stage, a whole number from 0 (0 the Starter Camp), one declaration per tier.
- **`move`**: `faster` or `slower`.
- **`note`**: why, in a sentence; the review shows it.
- **`toHours`** (optional): where the stage should land, in hours from a new game; the move then
  matches only if it lands within the Ledger's tolerance (±25 % by default) of it.

Only stages can be declared. A pack that changes tiers (`plan.tier`) moves the stages those
entries leave and join, so it declares them too.

## The helper

```
node cms/changePackTool.mjs stamp cms/incoming/<id>.json   # fill in fingerprints, then check
node cms/changePackTool.mjs check cms/incoming/<id>.json   # will the CMS accept it?
node cms/changePackTool.mjs gate cms/incoming/<id>.json    # the gate: may the pack go to the owner?
```

`stamp` reads the newest autosave (or `data/` when there is none, which may flag
conflicts the owner then judges); `--from <workspace.json>` names another. The CMS lists a
malformed pack with the same reasons and will not open it for review.

### The gate

`gate` applies the pack to the same workspace in memory (every entry, conflicts included),
works the Ledger out before and after (reach, the pace at Typical, every check), and prints
what moves: stage times, entries earlier or later on the timeline, checks turned on and off.
**Run it last, and send no pack it blocks** (it exits 1). It blocks a pack that:

- adds a **Block** finding (one the workspace did not already have; Live content needing a
  Planned entry is one);
- moves a stage's time beyond the tolerance without declaring it, or against its declaration
  (the other way, or away from its `toHours`);
- adds a **waiver** to an entry's `plan` (only the owner waives a check);
- is malformed.

Problems the workspace already had are never blocking. `--write` records the verdict in the
pack as `gate` (`{ workspaceFingerprint, toolVersion, at, verdict, summary, blocks, notes,
deltas }`); never write `gate` by hand. The CMS shows each pack's gate on its card (`stale`
once the owner's workspace has changed since) and runs it again whenever a pack is opened.

## What the CMS does with it

- One row per entry: new / changed / deleted, before and after, the note, the art flag.
- Accept, reject, or open in the editor to tweak first; accept all, reject all.
- A row is a **conflict** when a create's id already exists, or an edit's or delete's
  entity has changed since (fingerprint) or is gone. It is never applied silently; the
  owner may apply it anyway on purpose.
- **Finish review** applies the accepted entries to the workspace and moves the pack to
  `applied/`. **Undo** there puts the workspace back as it was before the pack, flags any
  entry the owner has edited since, and returns the pack to the inbox.
