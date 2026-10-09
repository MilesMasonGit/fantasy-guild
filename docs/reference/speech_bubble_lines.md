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
- **Unsure — owner to decide** — kept for now; we'd like your call.

Where the switches live (for whoever changes them): moments in `MOMENT_SPOKEN`
(`src/ui/components/board/heroSpeech.js`), problem lines in `SILENT_BLOCKS`
(`src/ui/components/board/heroBubbles.js`). None of these lines live in the game data
(`data/*.json`); they are all in code.

---

## 1. The hero is stuck on a Token (problem lines)

These show while the problem lasts and disappear the moment it is fixed. They sit nearest
the hero's head.

| # | Line | When it appears | Status |
|---|---|---|---|
| 1 | I need {items} to work {token}. | The Token (usually a station) is out of the items it uses. `{items}` names what is missing, e.g. "Oak Wood" or "Oak Wood and Stone". Waits **3 seconds** first, so it doesn't flicker when items are about to arrive. | Kept |
| 2 | I need more items to work {token}. | Same as 1, when the game can't name the missing items. | Kept |
| 3 | I need {a tool / Token} nearby to work {token}. | The recipe needs another Token next to it (e.g. "I need a Pickaxe nearby to work Copper Ore Vein."). Several are joined: "a Pickaxe and an Anvil". | Kept |
| 4 | {token} has nothing to make. | Same situation as 3, when the game can't name what is missing. | Kept |
| 5 | {token} has too few charges left. | The Token, or a Token next to it that the recipe uses, hasn't enough charges for one more cycle. | Kept |
| 6 | There is no room for what {token} makes. | A finished cycle makes a Token and there is nowhere for it to go (mat full or too crowded around it), or a Foundation's building has nowhere legal to stand. | Kept |
| 7 | My {skill} level is too low to work {token}. | The hero has the skill but not a high enough level (also used by promotion Tokens). If the Token names no skill it reads "My level is too low to work {token}." (FB-54). | Kept |
| 8 | I don't have the {skill} skill to work {token}. | The hero doesn't have that skill at all (also used by promotion Tokens). If the Token names no skill it reads "I don't have the skill to work {token}." (FB-54). | Kept |
| 9 | Choose a recipe for {token}. | A hero is on a station that has no recipe chosen. *(The Q1 line.)* | **Dropped (FB-21)** — after Q1 you ruled that an unset station shows only its gear, with no alert: it is waiting, not broken. The hero now keeps quiet too, to match. Rare anyway: heroes don't go to unset stations, so this only happened if a recipe was cleared while a hero was working. |
| 10 | Choose what to build on {token}. | The same for a Foundation with nothing chosen. | **Dropped (FB-21)** — the same ruling covered Foundations ("Choose what to build" alert replaced by the gear), so we treated it the same way. Say if you want it back. |

**Not covered:** a few rare promotion-Token problems have no wording yet, so the hero says
nothing for them (as before).

## 2. Moments (things that happened)

These appear for **5 seconds** and then go by themselves. A hero shows at most 3 bubbles at
once; the oldest moment gives way.

| # | Line | When it appears | Status |
|---|---|---|---|
| 11 | Working at {token}. | The hero arrives at a Token to work it. | **Dropped (FB-21)** — everyday; this is the "I'm working on Oak Tree" line from your feedback. |
| 12 | No work in range. | The hero was busy (walking to a job or working) and is now standing at their flag with nothing to do. | **Unsure — owner to decide.** Kept for now: an idle hero is worth knowing about. But it also fires each time the last Token in a flag's range runs out, which on a busy mat can be often. |
| 13 | LVL UP! {level} {skill}! (+{n}) | One of the hero's skills levels up, e.g. "LVL UP! 25 Mining!" for a single level, "LVL UP! 25 Mining! (+4)" when several coalesce; the numbers are drawn in their own colour. The hero bar's lasting level-up bubbles use the same words. `(+n)` shows only when `n` is 2 or more; it is the levels gained since this hero's last level-up bubble for that skill, so several quick level-ups show as one bubble with the total (the count starts again once the bubble has gone). The notification column still carries its own level-up line. | Kept |
| 14 | *(line 7 or 8, word for word)* | **B5 (FB-45):** you dropped the hero's flag on a Token they can't work — skill not held (line 8) or level too low (line 7). The flag stands there as a normal area flag instead of being pinned, and the hero says why once. A Token you disallowed, or one whose skill is switched off in the hero's rules, is refused silently (no wording yet); a spawner is never pinned and nothing is said. | Kept |
| 15 | {token} Depleted | The hero whose work spent a Token's last charge says it (a tree they felled, a vein they emptied, a fight that used up an enemy or a tool beside it). Shows for **3 seconds**, one line per kind of Token so a hero chopping tree after tree keeps one bubble. Nobody says it when no hero spent the charge. | Kept |

## 3. Callouts (not speech bubbles)

Quick popups in one style (a green speech-bubble shape that appears over the thing, holds
~2 s and fades). Nobody says them; they are drawn by the mat (`CalloutLayer`), and can be
switched off together with the `alerts` draw switch.

| # | Line | When it appears |
|---|---|---|
| C1 | ! Spawned {token} | A spawner makes a Token, shown over the **spawner**. The Guild Hall says it for a new quest ("! Spawned quest" / "! Spawned tutorial quest"). Not shown during a catch-up. |
| C2 | {effect name} | A named effect fires on a Token (a bonus drop, a status landing), shown over that Token. The wording is the effect's own title. |
| C3 | {reason} | A drop the mat refused: the rule's reason (or "Drop Rejected: {token}") at the spot you aimed at. The Guild Hall dragged off the mat says "Guild Hall cannot be removed from the playmat." over the Hall. |

The "-1" / "+50" charge number is not a callout: it is a small number rising from the Token's
charges bubble.

## 4. Not shown any more

The floating alert marks on Tokens are gone: no exclamation marks for a spawned Token, a
Token that ran dry, a restock, a spawner short of an item or room, or a stuck worked Token.
"Hero went elsewhere" (a notification when a hero left a Token with a fixable problem) is gone
too, with no speech line either: the hero just moves on. A stuck Token still shows its
red outline and a greyed cycle ring, and a hero standing at it says lines 1-8 above.
