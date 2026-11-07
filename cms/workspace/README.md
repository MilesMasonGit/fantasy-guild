# The CMS workspace on disk

`workspace.json` here is the CMS's workspace: every item, Token, recipe, effect, perk table,
Guild Hall star and world table as authored, plus the simulator's dials, between one Sync to Game
and the next. It is the one authoritative copy; the browser keeps only a cache of it.

- The CMS page reads it on start and writes it about a second after each change. The File Manager
  (Backups) says "Workspace: on disk, saved HH:MM".
- The command line reads and writes the same file: `npm run cms -- <command>` (see
  `cms/README.md`).
- Every write bumps `revision`. A write made from an older revision is refused, so two tabs, or a
  tab and the command line, never overwrite each other: the page shows "The workspace on disk
  changed elsewhere; reload to see it", and keeps its refused edits in Backups as `refused_<time>`.
- The file is not in git (only this README is). `data/` is what git keeps, written by Sync.
- ⚠️ Never edit `workspace.json` by hand while the CMS is open; use a change pack
  (`cms/incoming/README.md`) or the command line.
