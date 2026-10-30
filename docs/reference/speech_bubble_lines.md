# Speech bubble lines — every line a hero can say

*Written 2026-09-27 for Token Lifecycle feedback Q6 (FB-22). This is the owner's audit list:
every line a speech bubble can show, what makes it appear, and whether it is on.
Tell us what to add, remove or reword.*

**How to read this.** Words in `{curly brackets}` are filled in by the game, e.g. `{token}`
becomes "Oak Tree". The game shows bubble text in capitals if the all-caps setting is on.

**Status:**
- **Kept** — the hero says it.
- **Dropped (FB-21)** — the hero no longer says it. The wording is still in the game, so any
  dropped line can be switched back on with a one-line change.
- **Retired (information layers)** — heroes no longer speak about a Token's problems: the
  Token's problem mark (yellow while it waits, red when it can't) and the mark's hover say what is
  wrong ([concept_info_layers.md](../active/concept_info_layers.md)). The wording is kept in
  code as a record (`blockedText` in `heroBubbles.js`).
- **Unsure — owner to decide** — kept for now; we'd like your call.

Where the switches live (for whoever changes them): moments in `MOMENT_SPOKEN`
(`src/ui/components/board/heroSpeech.js`). The problem lines (section 1) are retired: nothing
speaks them any more, and bringing them back is code work, not a switch. None of these lines
live in the game data (`data/*.json`); they are all in code.

---

## 1. The hero is stuck on a Token (problem lines) — all retired

These used to show while the problem lasted. Since the information layers (brief 120) the
Token's problem mark says each of these instead, and its hover gives the exact reason
(`problemText` in `src/ui/components/board/problemMark.js`).

| # | Line | When it appears | Status |
|---|---|---|---|
| 1 | I need {items} to work {token}. | The Token (usually a station) is out of the items it uses. `{items}` names what is missing, e.g. "Oak Wood" or "Oak Wood and Stone". Waits **3 seconds** first, so it doesn't flicker when items are about to arrive. | **Retired** |
| 2 | I need more items to work {token}. | Same as 1, when the game can't name the missing items. | **Retired** |
| 3 | I need {a tool / Token} nearby to work {token}. | The recipe needs another Token next to it (e.g. "I need a Pickaxe nearby to work Copper Ore Vein."). Several are joined: "a Pickaxe and an Anvil". | **Retired** |
| 4 | {token} has nothing to make. | Same situation as 3, when the game can't name what is missing. | **Retired** |
| 5 | {token} has too few charges left. | The Token, or a Token next to it that the recipe uses, hasn't enough charges for one more cycle. | **Retired** |
| 6 | There is no room for what {token} makes. | A finished cycle makes a Token and there is nowhere for it to go (mat full or too crowded around it), or a Foundation's building has nowhere legal to stand. | **Retired** |
| 7 | My {skill} level is too low to work {token}. | The hero has the skill but not a high enough level (also used by promotion Tokens). If the Token names no skill it reads "My level is too low to work {token}." (FB-54). | **Retired** |
| 8 | I don't have the {skill} skill to work {token}. | The hero doesn't have that skill at all (also used by promotion Tokens). If the Token names no skill it reads "I don't have the skill to work {token}." (FB-54). | **Retired** |
| 9 | Choose a recipe for {token}. | A hero is on a station that has no recipe chosen. *(The Q1 line.)* | **Dropped (FB-21)** — after Q1 you ruled that an unset station shows only its gear, with no alert: it is waiting, not broken. The hero now keeps quiet too, to match. Rare anyway: heroes don't go to unset stations, so this only happened if a recipe was cleared while a hero was working. **Retired** with the rest: the yellow mark says "Choose a recipe". |
| 10 | Choose what to build on {token}. | The same for a Foundation with nothing chosen. | **Dropped (FB-21)** — the same ruling covered Foundations ("Choose what to build" alert replaced by the gear), so we treated it the same way. **Retired** with the rest: the yellow mark says "Choose what to build". |

### What the problem mark's hover says instead

One mark per Token, at its centre. Its hover says exactly what, read the moment the pointer
arrives. A red problem beats a yellow one when a Token has both.

| Problem | Mark | Hover |
|---|---|---|
| Out of the items it uses (line 1, 2) | yellow | Needs {items} (or "Needs items") |
| A Token it needs is not beside it (3, 4) | yellow | Needs {a Pickaxe and an Anvil} nearby (or "Nothing to make") |
| Too few charges for a cycle (5) | yellow | Too few charges left / Too few charges on the {Tag} nearby |
| Nothing chosen on a station (9) | yellow | Choose a recipe (a click opens the recipe list) |
| Nothing chosen on a Foundation (10) | yellow | Choose what to build (a click opens the list) |
| A spawner short of an item | yellow | Needs {items} to spawn |
| What it makes has nowhere to go (6) | red | No room for what it makes / Token cap full / No room to build here (a Foundation) |
| The hero's level is too low (7) | red | Needs {Skill} {level}/99 |
| The hero lacks the skill (8) | red | Needs the {Skill} skill |
| The hero on it holds no tool for it (a pickaxe put down mid-work; the hero then lets go) | red | Needs {Pickaxe} / Needs {Iron Pickaxe or better} |
| A spawner with nowhere to put a spawn | red | No room to spawn |
| A spawner at the mat's Token cap | red | Token cap full |

Every problem the engine raises has a mark, a promotion Token's included (its skill and
charges rows above). A resting Token is not a problem: it is drawn greyed, with no mark.

## 2. Moments (things that happened)

These appear for **5 seconds** and then go by themselves. A hero shows at most 3 bubbles at
once; the oldest moment gives way.

| # | Line | When it appears | Status |
|---|---|---|---|
| 11 | Working at {token}. | The hero arrives at a Token to work it. | **Dropped (FB-21)** — everyday; this is the "I'm working on Oak Tree" line from your feedback. |
| 12 | Nothing to work here. | The hero was busy (walking to a job or working) and is now standing at their job with nothing to do and nothing to wait for: a camp with no Token in its reach they can work, or a Token they can no longer work (a tool put down). Was "No work in range." while heroes worked a flag's area (hero orders, brief 260 O3). | **Unsure — owner to decide.** Kept for now: an idle hero is worth knowing about. It also fires each time the last Token in a camp's reach runs out. |
| 13 | *(none on the mat)* {level} {skill}! | One of the hero's skills levels up. **No longer a speech line**: on the mat the skill's icon and number float over the hero for about 30 seconds (the old number flashes gold and rolls up to the new one; several skills sit side by side; after time away they roll from old to new). The hero bar keeps a lasting alert until you clear it, worded `{level} {skill}!`, e.g. "50 Stealth!", the number drawn in its own colour; one alert per skill, a later level rewriting it; the wheel or the arrows page through them. The notification column still carries its own level-up line. | **Moved off the mat** (level-up moment) |
| 14 | *(retired)* | Was said when a hero's flag, dropped on a Token they could not work, stood there as an area flag instead. Since hero orders (brief 260) such a drop is **refused**: the hero keeps the order they had, and the reason shows as callout C3 over the Token ("Needs Pickaxe", "Mining level too low (needs 25)", "Nothing to work here"); while you drag, the same words show in a red bubble over the Token under the pointer. | **Retired** (hero orders) |
| 15 | {token} Depleted | The hero whose work spent a Token's last charge says it (a tree they felled, a vein they emptied, a fight that used up an enemy or a tool beside it). Shows for **3 seconds**, one line per kind of Token so a hero chopping tree after tree keeps one bubble. Nobody says it when no hero spent the charge. | Kept |
| 16 | Waiting for {enemy}. | Said instead of line 12 when the hero goes idle because the fight they were sent to is another hero's: every fight is one-on-one (brief 220 C5), so they wait beside the enemy and take it the moment it is free. | Kept |
| 16a | I need a job. | Said instead of line 12 when the Token the hero was ordered onto is gone for good (used up with nothing coming back, removed or demolished): they idle at its last spot with the "needs a job" mark until given a new order (brief 260 O1). A hero sent to a spot says nothing on arriving. "Waiting for {Token}." (line 16) is also said by a hero ordered onto a Token another hero works. | Kept |
| 16b | *(nothing)* | A gatherer whose node is resting (a vein refilling, a tree growing back) goes quiet instead of saying line 12: they wait silently and work it the moment it is back; the job flag's hover and the roster say "Waiting for Copper Vein" (brief 230 S1b, owner 2026-10-24). | **Silent by ruling** |
| 17 | {enemy} Beaten | Line 15 said of an enemy: the hero who beat it says it (brief 220 C5). Shows for **3 seconds**, one line per kind. | Kept |

## 3. Callouts (not speech bubbles)

Quick popups in one style (a green speech-bubble shape that appears over the thing, holds
~2 s and fades). Nobody says them; they are drawn by the mat (`CalloutLayer`), and can be
switched off together with the `alerts` draw switch.

| # | Line | When it appears |
|---|---|---|
| C1 | ! Spawned {token} | A spawner makes a Token, shown over the **spawner**. The Guild Hall says it for a new quest ("! Spawned quest" / "! Spawned tutorial quest"). Not shown during a catch-up. |
| C2 | {effect name} | A named effect fires on a Token (a bonus drop, a status landing), shown over that Token. The wording is the effect's own title. |
| C3 | {reason} | A drop the mat refused: the rule's reason (or "Drop Rejected: {token}") at the spot you aimed at. The Guild Hall dragged off the mat says "Guild Hall cannot be removed from the playmat." over the Hall. A hero dropped on a Token they cannot work says why over that Token ("Needs Pickaxe", "Nothing to work here"). |
| C4 | Needs {Pickaxe} | A hero sent to this Token (or to a camp it stands in) passed it over because they hold no tool of the kind it needs (or not a good enough one: "Needs Iron Pickaxe or better"), shown over the **Token**: at a camp only the one the hero would have worked (the nearest passed over for want of a tool), so a cluster of veins says it once. Said when the hero looks, then at most once every 8 seconds per Token while they keep passing it over (an idle hero looks every second). |
| C5 | Needs {Coal} | A station its hero stands at is out of an input: the first item the Bank is short of, over the **station**, in C4's red look (brief 230 S1b). Said when the stuck hero looks again, then at most once every 8 seconds per station. |

The "-1" / "+50" charge number is not a callout: it is a small number rising from the Token's
charges corner.

## 4. Not shown any more

No exclamation marks pop up for a spawned Token, a Token that ran dry or a restock.
"Hero went elsewhere" (a notification when a hero left a Token with a fixable problem) is gone
too, with no speech line either: the hero just moves on. A stuck Token shows its red outline,
its work bar held grey, and one problem mark (yellow waiting, red can't) whose hover says what
is wrong; nobody speaks lines 1-8.
