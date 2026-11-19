Status: approved 2026-11-18

# Systems Audit

*Owner conversation 2026-11-18 with a director session (Opus). Nothing here is
built or scheduled yet. Owner said the audit starts once the outstanding briefs
in the [briefs order table](briefs/README.md) are built.*

## Why

The engine is feature-complete for now, and code review round 4 plus the deep
read (D1 to D4) went after code health and bugs a player can hit. This is
different. The Systems Audit is a **design review**. System by system, it asks
whether each mechanic has a clear identity, works the way the owner wants, and
lines up with the systems next to it. The owner's examples:

- **Fishing spots** are Tokens placed on the map that transform. The owner wants
  them to have their own identity: "Fishing spot" Tokens **appear on water
  sites and disappear after a while**.
- **Effects on heroes and enemies** are handled by several different systems
  that could probably be **better aligned**.
- **Combat** is still young. Each part of it should be **easy to understand**.

## Owner rulings (2026-11-18)

1. **The owner is in the loop.** This is design work, so no agent decides how a
   system should work. An auditor agent may do the reading, but every verdict
   and every change comes from the owner.
2. **The agent's job** is to work out how a system **really** works today (the
   code, not the comments or the GDD), explain it in plain words, and turn the
   owner's feedback into tickets (and concept docs where needed) that align the
   system better.
3. **One main build.** The owner plays one test build of the game, the same one
   for the whole audit, with the QA panel. They pick a system, play it, and give
   feedback.
4. **A cross-system sweep comes first.** Before any single system, one pass maps
   where systems overlap or do the same job in different ways (effects is the
   known case). That map sets the order of the single-system sessions.
5. **Timing:** the audit starts when the outstanding briefs are built. It does
   not run alongside them.

## How one system is audited

1. **Pick the system** (from the sweep's order).
2. **The agent reads it** and writes a short **system card** in plain words:
   - what the player sees and does;
   - what really happens underneath, checked against the code;
   - every setting the owner controls in the CMS;
   - what it touches in other systems, and where it overlaps one;
   - where it differs from the [GDD](../reference/GDD.md);
   - a short "try this" list: how to set it up with the QA panel in the main
     build and what to look at.
3. **The owner plays it** in the main build.
4. **Talk-through:** the owner says what feels wrong, confusing or worth
   changing. The agent asks follow-up questions as multiple choice and stays on
   the system until the owner calls it fully explored.
5. **Write-up, by size** (the same routes as [ideas.md](ideas.md)):
   - a fix or small alignment → a ticket in
     [TICKETS](../reference/TICKETS.md);
   - a new identity or a real redesign (fishing spots, for example) → a
     `concept_<name>.md`, which the planning agent briefs once the owner
     approves it;
   - a look or feel note → [design_pass_notes.md](design_pass_notes.md).
6. The card, the owner's feedback and what it became go into the system's file
   in `docs/active/audit/`.

## The cross-system sweep

One read across all systems that answers one question: **where does the game
do the same kind of thing in more than one way?** Likely topics to check:

- effects, buffs and statuses on heroes, enemies and Tokens (combat statuses,
  Token buffs between neighbours, Food, equipment, milestone perks, Stars,
  Events' buff Tokens, the rules grammar);
- things on a clock (growing, refilling, spawners, transforms, events, upkeep);
- things that appear and disappear on the mat (spawners, transforms, events,
  demolition);
- how each system tells the player what it is doing (cards, badges, bars).

The result is a short overlap map plus a proposed order for the single-system
sessions, which the owner approves as multiple choice.

## The systems

The list of what counts as one system lives in
[audit/SYSTEMS.md](audit/SYSTEMS.md) (owner, 2026-11-18): 36 systems in seven
groups plus the sweep's shared topics, each with its GDD section and the code
to start from. The owner's rules for it: **one card per skill** that has
content; **combat split into five systems**; quests and Limes, the world map
and Regions, time away and saving, and screens and feedback are **in**; the
placeholder specialist skills are out until their rework. The sweep may
propose changes to the list; the owner approves them.

## Related work (read, don't redo)

- [review/](review/README.md): round 4 and the deep read D1 to D4. Their
  findings are about code and bugs; the cards should point to a related finding
  rather than repeat it.
- [star_ideas_review.md](star_ideas_review.md): the owner's "effect families"
  takeaway feeds straight into the effects part of the sweep.
- [concept_combat_v2.md](concept_combat_v2.md),
  [content_fishing.md](content_fishing.md): the current design intent for the
  first two example systems.

## How the audit runs (owner, 2026-11-18)

1. **A new `/auditor` command** runs the sessions: a project skill in
   `.claude/skills/auditor/`, like `/reviewer`. It is read-only on code, works
   on its own long-lived `audit` branch and worktree, and writes its files in
   `docs/active/audit/`.
2. **The auditor files tickets itself, right away**, in
   [TICKETS](../reference/TICKETS.md). Right before each commit it checks
   `main`'s TICKETS.md for the next free number so it doesn't clash with
   planning. The owner expects this pattern to be common: the owner names a
   misalignment, a **read-only subagent checks whether everything lines up in
   the backend** (the code, the CMS data, the GDD), and the auditor files
   tickets from what it finds. The owner sees the tickets in the talk-through.
   Concept docs for real redesigns still go to the planning agent to brief.
3. **One tagged test build of `main`.** A desktop test build (QA panel
   included) is made when the outstanding briefs are merged, and `main` is
   tagged at that point. Every card and every piece of feedback refers to that
   build; fixes don't change it mid-audit.
4. **Fixes go to the director in groups.** Tickets wait until a group of
   related systems is audited (the sweep defines the groups, for example all
   the effect systems), then the planning agent briefs them together so
   aligned changes land at once.

## Where it lives

- The command: `.claude/skills/auditor/SKILL.md` (type `/auditor` in a fresh
  session).
- The living status, start gate and groups:
  [audit/STATUS.md](audit/STATUS.md).
- Tickets carry the origin `SA-A<n>` (or `SA-S0`) and wait as
  `blocked (audit group: <name>)` until their group is briefed.

## Done

Every system in the sweep's order has a card, the owner's feedback, and a
recorded outcome (tickets, concept doc, or "fine as is").
