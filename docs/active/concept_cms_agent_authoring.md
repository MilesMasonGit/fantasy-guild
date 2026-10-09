# Agents author content through the CMS

*Stage A tool from [ideas.md](ideas.md). Owner interview, 2026-10-09. **Done.**
Ticket: T-133.*

`data/` is written only by the CMS's Sync (CLAUDE.md). This design lets an
agent prepare content that the owner reviews inside the CMS, without anyone
editing `data/` by hand and without overwriting the owner's unsynced work.

## Today (checked in the code)

- The CMS's local server keeps named workspace backups on disk in
  `cms/backups/` (File Manager: save, load, delete, Restore from Game).
- The server can rotate the last 5 autosaves
  (`cms/vite-plugin-cms-api.js:146-160`, `isAutoSave`), but **nothing in the
  CMS ever sends one**: the only caller saves by hand with `isAutoSave: false`
  (`cms/src/components/shared/FileManagerModal.jsx:52`). Unsynced work lives
  only in the browser unless the owner saves a backup.
- `cms/backups/*` is git-ignored apart from one committed workspace.

## The design

- **Autosave**: the CMS writes the workspace to disk **every few minutes while
  editing** (rolling, the server's existing last-5 rotation).
- **Agents read that disk copy**, so they see unsynced work too.
- **Change packs**: an agent writes a file of proposed changes (create, edit,
  delete items, Tokens, recipes, effects, maps) into an **inbox folder**
  (e.g. `cms/incoming/`). The CMS shows a "Changes to review (n)" badge.
- **Review per entry**: each new, changed or deleted entry is a row with
  before/after; **accept, reject, or open it in the normal editor to tweak
  before accepting**; accept-all and reject-all too. Deletions are shown
  clearly.
- **Conflicts**: if the owner changed an entry after the pack was made, the
  row is flagged as a conflict instead of overwriting.
- **Applying merges into the current workspace**; the owner then Syncs as
  usual. Applied packs move to an archive.
- **Undo a pack**: from the archive, an applied pack's entries are reverted;
  entries the owner has edited since are flagged rather than silently undone.
- **Notes**: each pack says what was asked for; each entry says why it's there
  ("Fir Planks: Construction needs a second-tier plank"). Shown in review,
  never written into game data.
- **Art**: a new entry reuses the closest existing sprite and is flagged
  **placeholder art**, so a list of art to draw falls out automatically.
- **Numbers**: agents propose the design and rough numbers; the owner runs the
  simulator (Recalculate) after accepting, as with their own edits.
- **Scope**: agents may create, edit and delete content. They don't carry out
  the owner's CMS to-do checklists (the owner does those).

## How the owner asks

In chat: the owner describes what they want in a planning or director
session; the session interviews them if needed, briefs a cheap agent to write
the pack, checks it, and says it's waiting in the CMS inbox.
