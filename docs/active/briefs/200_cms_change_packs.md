# Brief 200 — CMS change packs

**Source of truth:** [`concept_cms_agent_authoring.md`](../concept_cms_agent_authoring.md)
(approved 2026-10-09). Ticket **T-133**. Briefed 2026-10-20 by the features
director: the owner wants the starting batch of map items authored by an agent
(the Atlas rework), and this is the agreed way.

**Needs:** nothing. CMS code only (`cms/`); never writes `data/` (the owner's
Sync does).

**Branch:** `crunch/change-packs`. **Tier:** builder. **Eye-check:** yes, in
the CMS (a small review screen).

## P1 — Autosave and the inbox

- **Change:** the CMS autosaves the workspace to disk every few minutes while
  editing (the server's existing last-5 rotation, `isAutoSave`), so agents
  can read unsynced work. A change-pack format (JSON: pack id, what was asked,
  entries of create / edit / delete for items, Tokens, recipes, effects,
  maps, each with a note and an optional placeholder-art flag) and an inbox
  folder `cms/incoming/` (applied packs move to `cms/incoming/applied/`); the
  server lists, reads and archives packs. A schema check refuses a malformed
  pack with a readable reason.
- **Done when:** tests cover autosave rotation, pack parsing and refusal, and
  the inbox listing.

## P2 — Review in the CMS

- **Change:** a "Changes to review (n)" badge; a review screen per pack with
  one row per entry (new / changed / deleted, before and after, the note,
  the placeholder-art flag); accept, reject, or open in the normal editor to
  tweak before accepting; accept-all and reject-all; a conflict flag when the
  owner changed the entry after the pack was made (never overwrite);
  applying merges into the current workspace (the owner then Syncs as
  usual); undo an applied pack from the archive, flagging entries edited
  since.
- **Done when:** a test pack with a new item, an edit and a delete is
  reviewed, partly accepted, tweaked, applied and undone in the running CMS,
  with no Sync and `git status` of `data/` unchanged.

## P3 — The starting maps (a pack, not code)

- **Change:** an agent writes the first real pack: the starting batch of
  Base Map and Modifier items for Cartography, each with a sprite from
  `public/assets/tokens/map/` (64 px placeholders, flagged placeholder art)
  and contents in line with `concept_atlas.md` and the existing map budget
  code. The director checks it; the owner reviews it in the CMS and Syncs on
  `main`.

## Owner to-do

- Eye-check the review screen; review and accept the maps pack; Sync on
  `main`.
