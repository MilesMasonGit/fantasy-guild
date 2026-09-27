# Kickoff prompt — Token Lifecycle playtest feedback (organiser and planner)

Paste the text below into a new session, then paste your list of changes after it.

---

You are taking over the **Token Lifecycle** work in Fantasy Guild after its first build. The
build is finished and merged: the Spawner System, the Shop, Foundations, upkeep, the nine starting
skills and the seven skill chains. I've played it and I have a long list of changes, fixes and
ideas, which I'll paste below this prompt.

**Your first job is not to change code.** It is to:

1. **Organise my list into a document**, `docs/token_lifecycle_feedback_v1.md`.
   - Group the items by area (Shop, spawners, a particular chain, UI, heroes, combat, balance and
     numbers, bugs, and so on).
   - Give every item an id (**FB-1, FB-2, …**) and keep my own words beside your summary.
   - Mark each item's kind: *bug*, *tweak* (numbers or content, done through the CMS), *small
     change* (a few hours of code), or *rework* (needs its own design or roadmap).
   - Note what each item touches (files, systems, decisions it would change) once you've checked
     the code.
   - Write the document and commit it before you interview me.
2. **Interview me on whatever needs more detail.**
   - Ask as multiple choice with the trade-offs spelled out and your recommendation first (see
     `CLAUDE.md`), a few questions at a time.
   - Record every answer in the document straight away.
   - Where my feedback changes a decision already marked in the roadmap (TL-, SP- or DP-), say so
     plainly and record the new answer as a new decision (continue with **TL-12**, **TL-13**, …),
     rather than silently overriding the old one.
3. **Prioritise with me.**
   - Start with **quick wins**: bugs, tweaks and small changes you can finish, verify and merge in
     short slices, in this session.
   - Park the **larger reworks** as later phases. Each one gets a short brief (goal, decisions so
     far, open questions, files involved) so a different agent can start it cold.
   - Write the result as a prioritised plan in the same document, with a status table I can
     follow.

Only after I approve that plan do you start on the quick wins.

**Read these first, in this order:**

1. `CLAUDE.md`: how I work.
   - I don't code, so explain things in plain language, especially git.
   - Ask design questions as multiple choice with your recommendation first.
   - Verify before you say something is done: run `npm test`, and for anything visible, run the
     game and exercise it.
   - Stay in scope; tell me about unrelated problems rather than fixing them.
   - Work in small, committed slices.
2. `docs/token_lifecycle_playtest_pack.md`: what the build contains, every placeholder number and
   where to change it, and the known issues. **Much of my list will refer to things described
   here.**
3. `docs/token_lifecycle_roadmap_v1.md`: the record of the first build.
   - §0 is how work was run and verified.
   - §2 holds the decisions: SP- from the concept, TL-1…TL-11 mine.
   - §3.1 has the data shapes.
   - §8 is the final status table, with a note of what each slice did and what it left behind.
4. `docs/concept_token_lifecycle.md` §1–§3, §9 and §10: the design behind it.

**Facts and rules that will save you time (all learned the hard way):**

- **Versions stay in 0.8.x (TL-11).**
  - Bump within 0.8 (0.8.1, 0.8.2, …) when I accept a build.
  - The version lives in five files that must change together: `package.json`,
    `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`,
    `src-tauri/Cargo.lock`.
  - Never move to 0.9 unless I explicitly say so.
- **Test baseline:** `npm test` on `main` has **exactly 10 known failures**, all older than this
  work: ContentRules (1), EconSimRunner (1), EconSimTime (1), OneRuleOnePlace ("at least one
  authored Map still has materials") and TerrainRegistry (6). Compare failing test **names**, not
  counts.
- **Content goes through the CMS only.** Never hand-edit `data/*.json`: the CMS's Sync writes those
  files whole and destroys anything it doesn't model. The authoring route that worked every time
  (roadmap §8, rows 7.1–7.7):
  - Run the CMS dev server.
  - On a sandbox route (`?p2=1`), turn off persistence on both CMS stores.
  - Load the game data, then do a control sync that must change nothing.
  - Author with the store's own actions, then sync.
  - Reload and sync again: it must report no changes (a fixed point).
  - **Register sprites before starting the CMS server**, or restart it afterwards. Otherwise a sync
    can write empty files.
- **Content and code go in separate commits.** A repo hook refuses any commit that mixes `data/`
  with code, including a merge commit. The CMS sync makes its own commit. So merge a content branch
  in steps: its sync commit, then its code commit. Don't use the hook's escape hatch.
- **Git:** no double quotes in commit messages run through PowerShell. `main` is canonical: branch
  per slice, merge back when verified. Several chats may share this checkout, so check the branch
  right before committing.
- **If you use parallel subagents in worktrees:**
  - They start from an **old commit** and must run `git merge --ff-only main` first.
  - They need `node_modules`, `cms\node_modules` and `public\assets` linked as junctions.
  - **Before deleting a worktree, remove those junctions** as links only
    (`[System.IO.Directory]::Delete(path, $false)` on each). Otherwise a recursive delete follows
    them into the real folders.
  - Stop any dev servers they left running.
  - Content lanes must run one at a time (DP-12): they all rewrite the same data files.
- **Verifying in the browser pane:**
  - Screenshots time out. Use `window.Game` / `window.GameState` and `import()` probes.
  - After a code edit, Vite serves changed modules under `?t=` URLs, so an `import()` can reach a
    second, empty copy of a module. Restart the dev server before probing.
  - A drawer opens on the next animation frame, which doesn't run while the pane is hidden.
  - If the page sits on LOADING, navigate to it once more.
  - Subagents share the pane's tabs, so work in a tab you created.
  - `DevTools.advanceTime(minutes)` fast-forwards the game (it takes **minutes**, not ms).
    `DevTools.giveItem(id, n)` fills the Bank.
- **Two things I've already corrected:**
  - Item loot is collected by **hovering**, not clicking (TL-9).
  - Tokens that a station makes go straight onto the mat (TL-8).

Start by reading, then organise my list below.

---

*(Paste your list here.)*
