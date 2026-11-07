# Eye-check: the CMS keeps its workspace on disk (branch `prep/cm`)

*Written 2026-11-06 by the director. One look, in your own browser, at the CMS
only. The game is unchanged on this branch (only tests moved).*

## Before you start

- **Your folder is already on the branch.** The director switched it
  (`git switch prep/cm`) and restarted the CMS server from it, so the address
  is the usual one: **http://localhost:5174**. If the tab was already open,
  close it and open a fresh one.
- **Do not Sync to Game until this branch is merged.** A Sync here would commit
  `data/` onto `prep/cm`, not `main`. If you do Sync by accident, say so; the
  director moves the commit over.
- Your content between Syncs used to live only in the browser. On this first
  start the CMS copies it to `cms/workspace/workspace.json` **after** saving a
  backup named `migrated_<time>`. Nothing is deleted from the browser.

## Checks

1. **First start.** Open http://localhost:5174. You should see a short
   "Loading the workspace…" and then, once, a note at the top saying the
   workspace moved to disk.
   `Verdict: ok / change: ___`
2. **Everything is still there.** Look at the Items, Tokens, Recipes and
   Effects lists: the same content as before, including anything you had not
   Synced yet (the Swift Laps star and the Foundations you accepted today).
   `Verdict: ok / change: ___`
3. **Backups window.** Open it from the top bar. Its header reads
   "Workspace: on disk, saved HH:MM", and the list holds a backup named
   `migrated_<time>`.
   `Verdict: ok / change: ___`
4. **An edit reaches disk.** Change one Token's description, wait two
   seconds, reopen the Backups window: the saved time moved. Reload the page:
   the edit is still there and the editor reopens on that Token. Undo your
   edit the same way if you like.
   `Verdict: ok / change: ___`
5. **Poke around.** Open the editors you normally use (Token, Item, Recipe,
   Effects, the Changes page, the ledger tabs). Anything slower, missing or
   odd compared with yesterday goes here.
   `Verdict: ok / change: ___`
6. **New workspace is safe now.** Only if you want to: Backups window, "New
   workspace". It saves a `before-new_<time>` backup first and empties only
   the content; your sim dials and the change-pack reviews stay. Load the
   backup back afterwards.
   `Verdict: ok / skipped / change: ___`
7. **The Studio is untouched.** `npm run studio` (port 5175): Recolor and
   Animation open and work as before.
   `Verdict: ok / change: ___`

## Two choices for you (the director built the recommended one)

- **Q1. Should `cms/workspace/workspace.json` be committed to git as an
  off-PC copy of your unsynced work?**
  a) No, keep it local, as the browser copy was (built, recommended: it changes
  every second you edit and would flood the history).
  b) Yes, commit it on each Sync.
  c) Yes, on every save.
- **Q2. Where should "Workspace: on disk, saved HH:MM" show?**
  a) In the Backups window and the Backups button's tooltip (built,
  recommended: in the top bar it grew the bar from 52 to 81 px).
  b) Also a small "Saved 14:05" chip in the top bar.

## Afterwards

Tell the director the verdicts. Fixes go on `prep/cm`; it merges on the gate;
the director switches your folder back to `main` and runs
`npm install --prefix cms` there (one new library, ajv, for the schemas); this
file moves to `docs/archive/eyecheck/` with your verdicts kept.
