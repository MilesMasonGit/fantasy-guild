# Change packs: how an agent proposes content

`data/` is written only by the CMS's Sync to Game. An agent that wants to add, change or
delete content writes a **change pack** into this folder instead. The owner reviews it in
the CMS (**Changes to review** in the top bar), accepts or rejects each entry, tweaks any
in the normal editor, and Syncs as usual. Finished packs move to `applied/` with a record
of what was applied, so a pack can be undone from there. Everything in this folder except
this README is git-ignored.

Design: `docs/active/concept_cms_agent_authoring.md`. Code: `cms/src/engine/changePacks.js`
(the format and its check), `cms/changePackInbox.js` (the folder).

## What to read first

The owner's unsynced work is in the newest **`cms/backups/autosave_*.json`** (the CMS
writes one every few minutes while they edit, keeping the last five). Read your
"before" values from there, not from `data/`, so you see what the owner sees. Its shape:
`{ items, tokens, effects, recipePools, starterCamp }`; maps are items with
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
    Or `starterCamp`: the Starter Camp, one record (see below).
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

Numbers are a proposal: the owner runs Recalculate after accepting.

## The helper

```
node cms/changePackTool.mjs stamp cms/incoming/<id>.json   # fill in fingerprints, then check
node cms/changePackTool.mjs check cms/incoming/<id>.json   # will the CMS accept it?
```

`stamp` reads the newest autosave (or `data/` when there is none, which may flag
conflicts the owner then judges); `--from <workspace.json>` names another. The CMS lists a
malformed pack with the same reasons and will not open it for review.

## What the CMS does with it

- One row per entry: new / changed / deleted, before and after, the note, the art flag.
- Accept, reject, or open in the editor to tweak first; accept all, reject all.
- A row is a **conflict** when a create's id already exists, or an edit's or delete's
  entity has changed since (fingerprint) or is gone. It is never applied silently; the
  owner may apply it anyway on purpose.
- **Finish review** applies the accepted entries to the workspace and moves the pack to
  `applied/`. **Undo** there puts the workspace back as it was before the pack, flags any
  entry the owner has edited since, and returns the pack to the inbox.
