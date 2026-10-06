# Handoff — Hero Speech Bubbles

*Written 2026-09-23 for the agent picking this up. Paste the prompt below, or
point the agent at this file.*

---

## The prompt

You are picking up **Hero Speech Bubbles** on Fantasy Guild.

**Read `CLAUDE.md` first — it is how the owner wants to be worked with, and it
is not optional.** In short: the owner does not code, so explain in plain
language; ask design questions as multiple choice with trade-offs and your
recommendation first, never open-ended and never a silent guess; verify by
running `npm test` and by actually playing the game before you call anything
done; stay in scope and mention anything unrelated rather than folding it in;
work in small slices, each committed.

**The job, in the owner's words:** *"I want to give the heroes 'speech
bubbles' to help guide the player and communicate key information, as well as
give character to the heroes. This will be an adaptation of our current alert
badges. Instead of just an icon that is hovered over, a speech bubble with the
key information will show up above the hero's head."* Examples given: *"I
need to equip a Pickaxe to work this Copper Ore Vein Token"*, *"I need Oak
Wood to work this Campfire Token."*

**Two things worth knowing before you start:**

1. The owner's original brief also listed a "worked Token UI overhaul" (Token
   stays put and the hero walks to it; a hero can approach from either side;
   the badges and progress bar have more room to work with). **That part is
   already done** — Hero Movement (`docs/hero_movement_roadmap_v1.md`) and
   Token Work Presentation (`docs/token_presentation_roadmap_v1.md`), both
   merged to `main`. Don't redo it or re-open its locked decisions; if
   something in it looks wrong or unfinished, bring evidence to the owner
   rather than assuming it needs work.
2. Speech bubbles were named as their own, separate item and explicitly
   marked **out of scope** while that work was happening
   (`docs/HANDOFF_token_presentation.md`'s "Out of scope" list). This session
   is that item, now in scope.

**Where things are:**
* `src/ui/components/board/TokenEventAlert.jsx` — the **existing alert system
  this is meant to adapt**. `useEventAlert()` is the state machine (shown,
  hovered, fading, dismissed); `EventAlertMark` draws a small icon at a
  Token's top-left corner that reveals a speech-bubble tooltip **on hover**.
  Two callers today: `TokenEventAlert` (per Token, by instance id) and
  `MatPointAlerts.jsx` (a bare mat point — a refused drop, nothing to attach
  to). ⚠️ **The bubble text today is generic, not per-situation.** It comes
  from `ALERT_HINT` in `boardConstants.js` — one sentence per *alert type*
  ("Waiting for materials — nothing in the Bank or on the board"), not one
  naming the *specific* missing thing. The owner's examples ("I need to
  equip a **Pickaxe**", "I need **Oak Wood**") name the actual missing
  tool/item, which is closer to what `TokenProgressBar.jsx`'s hover dropdown
  already shows, sourced from `getMissingRequirements` in
  `src/systems/board/RecipeResolver.js` (it already names specific missing
  tools, items and Tokens by name). Expect this to need that data source, not
  just a re-skin of `ALERT_HINT`.
* `src/ui/components/board/MatHero.jsx` + `src/systems/board/HeroMotion.js`
  — where a hero actually is on the mat (`HeroMotion.bodyView`/`heroPointOf`).
  A speech bubble anchors to the **hero**, not the Token — new territory,
  since today's alert anchors to the Token.
* `src/ui/components/board/matLayers.js` — the mat's whole stacking order
  (`MAT_Z`). A bubble layer needs its own place in this list, drawn above
  heroes at minimum; work out where before wiring it in.
* `docs/hero_movement_roadmap_v1.md`, `docs/token_presentation_roadmap_v1.md`
  — the completed work referenced above. Read before touching anything
  hero- or Token-badge-related.
* `docs/HANDOFF_token_presentation.md` — the previous handoff. Its **traps**
  section (main not green, browser-pane quirks, never hand-edit `data/*.json`,
  concurrent sessions sharing this checkout) still applies verbatim; re-read
  it there rather than have it repeated here.

**Questions to expect yourself asking the owner**, once you've explored
(as multiple choice, with a recommendation — don't guess):
* **Trigger** — does a bubble show only while a hero is blocked/stuck (the
  direct swap for today's alert), or also for other "guidance" moments
  (arriving at a job, going idle, a level-up)?
* **Coexistence** — does the speech bubble *replace* the on-Token alert icon
  entirely, or do both exist for a while?
* **Queuing** — one message at a time per hero, or can several stack/queue?
* **Crowding** — with up to 8 heroes on screen, how do nearby bubbles avoid
  overlapping each other or the UI around them?

**How to work this, before any code:** explore the files above, write a short
brief for the owner (what exists today, what you understand them to want, the
open questions above as multiple choice with your recommendation), get their
answers, write the decisions into `docs/hero_speech_bubbles_roadmap_v1.md` the
way the other roadmap docs in this list do (locked decisions with ids,
director's picks marked provisional, slices with a "verified when"), then
build one slice at a time — tests, a run in the game, one commit, merge.
