# Brief 795 — Telling the player: messages that wait

*Written 2026-11-21 by the planning agent from the Systems Audit, group 8, Telling the player (A42
Notifications, A43 Cards, badges and bars), interviewed by topic 2026-11-19/20:
[silent moments](../audit/topic_silent_moments.md), [news told twice](../audit/topic_banners_twice.md),
[wording drift](../audit/topic_wording_drift.md) (the event words). Its sister brief is
[790 Telling the player: one way to write it](790_audit_telling_the_player.md). Runs after
[710](710_mat_polish.md) (the "!" above Tokens) and 790 W1. Owner answers 2026-11-21 folded in.*

**What the player gets.** Two kinds of message, chosen by whether the player must act: a **popup**
that floats up and goes for things that sort themselves out ("Copper Vein exhausted", "Sawmill
built"), and a **speech bubble** that waits until you look for anything stopped, gone or needing you
("My axe broke!", "Needs Coal", "Recovered, ready to work!"), clearing itself once the need is met or
once you hover or click it, while the Token's "!" stays until the problem is fixed. The moments that
are silent today speak, and the news from time away is told once, in the summary, with only open problems left as banners, which go by themselves
once fixed.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (the notifications layer,
the engine events, time away), `docs/reference/TEXT.md`, and the topic files above (rule table, then
Evidence with path:line, read at tag `audit-build`; check the code, it wins). Where things are today:

- **Popups exist already as callouts** (`src/ui/components/board/callouts.js`, `CalloutLayer.jsx`,
  2.2 s, over the thing they are about): spawned, demolished, refunded, an effect firing, `Needs Coal`.
  The popup kind is these callouts.
- **Hero messages** are timed moments above the head (`heroSpeech.js:17-30`, `HeroBubbleLayer.jsx`:
  5 s default, 3 s for "{token} Depleted", a callout's length for a status landing, gear broke 5 s).
  None waits.
- **Silent today**: `TOKEN_RESTING` (`Respawn.js:118`) and `HERO_RECOVERED` (`WoundedSystem.js:93`) have
  no listener in the UI; an event's end withdraws its banner (`routing.js:169-175`); every transform
  shows the same 1 s glow (`TokenGlows.js`).
- **Banners** stay until clicked, three shown (`banners.js`); after While you were away closes, all its
  news is pushed again as banners (`routing.js:186-220, 330-362`, `catchUpNews.js`).

## Phases

| Phase | Tickets | What | Tier |
|---|---|---|---|
| M1 | T-496 | **Two kinds of message.** **Popup** = the callout (floats up, gone in a few seconds): for moments that sort themselves out. **Speech bubble** = a hero's (or a spot's) bubble that stays until the player hovers or clicks it, and **clears itself once its need is met**. Hovering or clicking dismisses it even while the problem stands; the Token's "!" (brief 710) stays until it is fixed, so nothing nags and nothing is lost (owner 2026-11-21). Popups appear **over the Token** they are about, even when no hero did it (owner 2026-11-21). each persistent message carries a clear condition the UI checks when the relevant state changes (an engine event or the store, not a per-frame poll). Re-sort today's moments by the topic's table: a Token **used up** becomes a popup over the Token ("Oak Forest used up"; today a 3 s hero bubble, "{token} Depleted"); **gear broke** becomes a speech bubble ("My axe broke!"), cleared when the hero holds a working tool of that kind again or is given another job; a status landing stays a popup ("Venom!"); the timed idle lines (Nothing to work here, Waiting for…, I need a job) are not in the owner's table: keep them as they are. A hero's stack still holds at most `MAX_BUBBLES`; a persistent bubble never gives way to a timed one. Saving: persistent bubbles are UI state, rebuilt from the game's state on load where their need still stands (gear still broken), not saved. | builder |
| M2 | T-497 | **The silent moments speak.** Using M1's two kinds: **recovery** — speech bubble "Recovered, ready to work!" on `HERO_RECOVERED`, cleared when hovered, clicked or the hero starts work; **a Token running dry and resting** — popup over the Token "Copper Vein exhausted" on `TOKEN_RESTING` (the word from 790 W6); **a transform** (a building finished, a Stump grown back, a Token turned) — the 1 s glow stays, plus a popup of its new name ("Oak Tree", "Sawmill built"); **an event leaving** — no marker: an event leaves with a banner only, with its own goodbye line (owner 2026-11-21; brief 760 V7, T-602), so T-497's event part is dropped from this phase; **running out of what the work needs** (Coal, Food, and the bait, seed and arrows the other briefs stop on) — speech bubble **`Needs Coal`** on the hero, always "Needs" and the item's name, whether they ran dry or never had any (owner 2026-11-21), cleared when the Bank holds the item again (or dismissed by a hover, the "!" staying). Build the running-out bubble once, keyed by item, so T-573 (arrows, brief 750 S2), T-623 (bait) and T-629 (seed, both brief 770 G1) call it instead of each adding their own; today's station callout `Needs Coal` (`callouts.js:27`) keeps the same words. | builder |
| M3 | T-506, T-507, T-503 | **News told once; problem banners clear themselves; Expired.** After While you were away closes, no recipe, knock-out or other milestone is replayed as a banner: only what still needs the player stays (the Bank or a stack still full, an event still standing), judged on the state at close, not on the summary's rows. The summary and the remaining banners take their words from one writer (`routing.js` deliverCatchUpNews, `catchUpNews.js`, `bannerKinds.js`). **Bank full** and **stack full** banners go by themselves once fixed (a free Bank slot; that stack below its cap) or when clicked; milestone banners stay until clicked, as now (`banners.js`). **Expired** for every way an event goes by itself (time ran out, never worked, worked until empty), **Demolished** for the player's act, on the card, the goodbye banner (brief 760 V7) and the away summary; the summary lists events one line per kind: `[icon] Fish Shoal ×3 · 2 expired · 1 still here` (and demolished when any); "left unworked" retires (planning agent's call 2026-11-21). ⚠️ This phase does **not** change when the summary opens: T-618 (living mat: under a minute resumes as left, a minute or more always opens the summary, replacing the 2-minute line `SHOW_GAP_MS`) owns that; T-506's "no 2-minute line" is done by T-618 (brief 765 W3 owns the time-away threshold). T-560 (combat: defeats lead the summary) stays in brief 740 C10, which writes its order into this phase's writer when M3 has landed. | builder |

## Order and parallel work

- **M1 → M2** (M2 uses M1's kinds). **M1 and M2 after brief 710 P3** (the "!" that stays on the
  Token once a bubble is dismissed) and M2 after 790 W6 (the Exhausted word; or use the string and let
  W6 move it).
- **M3 after 790 W1** (times in the summary) **and 790 W5** (both retype `bannerKinds.js`). M3 touches
  the notifications files only, so it may run beside M1 or M2.
- Two code agents at a time.

**Overlaps with other audit briefs.**

- **Event leaving** (owner 2026-11-21: banner only): brief 760 V7 (T-602) pushes the goodbye banner
  with the event's own line; M3 here gives the words Expired and Demolished (T-503) and the summary
  line; no marker in M2. Whichever of V7 and M3 lands second uses the first's strings.
- **Running out**: M2 builds the "Needs X" speech bubble; T-573 (brief 750 S2, arrows), T-623 (brief
  770 G1, bait) and T-629 (brief 770 G1, seed) stop the work and call it, **after M2**.
- **Time away**: brief 765 W3 (T-618) owns when the summary opens and should land beside M3; T-619
  (765 W3, kills once) and T-560 (740 C10, defeats first) read the same summary writer, after or with
  M3.
- **T-559** (combat, Defeated) renames knock-outs in banners and the summary: after 790 W5, beside or
  after M3.

## Done when

- Gate green. Bench work check: **same work** (messages only; no engine rule changes. If M3's change
  to what is replayed touches the catch-up's run, stop and report).
- Pure tests for the message kinds (a speech bubble stays until hovered, clicked or its need is met; a
  popup expires) and the banner clear rule.
- Seen in the running game: a Vein running dry (popup over it) and a Forest used up (popup, no hero
  bubble); a tool breaking (bubble stays until hovered; clears when a new tool is equipped); a hero
  recovering; a Stump growing back and a building finishing (glow plus the name, over the Token); a
  station out of Coal (the hero's `Needs Coal` bubble stays until hovered, the "!" stays after, and
  both clear when Coal is given from the QA panel); a time away with a recipe, a knock-out and a
  full Bank (summary lists all; only the Bank-full banner remains; it goes when a slot is freed); a
  summary with two Fish Shoals, one expired.
- Tickets closed into `docs/archive/tickets_done.md`.

**Eye-check: yes, one look after M2 and M3** (new message kinds, Needs Coal, the banners after time
away).

## Owner to-do

- None in the CMS (the events' goodbye lines are brief 760 V7's and the content agent's).
