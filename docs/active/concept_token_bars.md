Status: briefed 2026-10-27 (approved 2026-10-27; brief 250)

# Token bars: one plate, fewer things on the mat

*Owner interview 2026-10-27 (planning agent), from the owner's play-testing
notes of the same day (kept whole at
[research/issue_doc_2026-10-27.md](research/issue_doc_2026-10-27.md); its
file paths and code notes are a recording agent's guesses). The owner closed
the topic ("fully explored").*

**Amends** [concept_info_layers.md](concept_info_layers.md) §2 ("Hover adds a
name and the charges ring") and the work plate built in T-239: the round
rings retire, the plate is the one look for what a Token is doing. The rest
of the information-layers rule stands.

## Why

> "It would be better if it was consistently displayed as the bar, and
> perhaps only shown on hover. I'm trying to overall cut down the amount of
> visual stimuli." (owner)

Today two looks exist side by side: a Token a hero works gets the framed work
plate (T-239), a Token nobody works still shows the old round charges ring,
timer bubble, spawner ring and quest ring on hover. That is why a Copper vein
looks different from a tree being chopped: nobody was working it.

## The rules (owner 2026-10-27)

1. **A worked Token, nothing hovered**: today's plate under the hero's feet,
   **without the output item**. It shows the cycle fill plus the charges, or
   the problem (the missing inputs, or the '!'). When there is neither (a
   station with no charge count, running fine) it shows the **skill icon**,
   so every worked plate keeps the same shape.
2. **Problems stay visible at rest**: the yellow (waiting) and red (can't)
   '!' marks do not move to hover. On a worked Token the problem sits in its
   plate (as today); on an idle Token it is the mark on the Token (as today).
3. **An idle Token, on hover**: **the same plate, under the Token itself**,
   with what applies: charges, the respawn or regrow time, the quest's
   progress, the spawner's count, any problem. It replaces the **round
   charges, timer, spawner and quest rings**, which retire from the mat.
   With nothing to say, no plate (the name still shows).
4. **The output item is gone from the plate entirely**, at rest and on hover.
   The Token's sprite says what it makes; the Token card (click) says how
   many and from what.
5. **The opened plate on hover** (worked Token) keeps the rest of its line:
   the skill, the problem or missing inputs, the charges, the time to the
   next one, each with its tooltip.
6. **Enemies never show charges** (the bug in rule 3's old ring: enemies
   carry a hidden use count). An enemy on hover shows its name and HP bar
   only, as the information-layers rule says.

## Small fixes ruled in the same interview

- **A choice waiting on you swaps its '!' for the gear on hover**: a
  Foundation waiting for a building, and a station waiting for a recipe.
  On hover the yellow '!' is replaced, in the same spot, by the gear, drawn
  at **2× (64 px)**; clicking it opens the picker as today. Stations waiting
  on items or room keep their '!' (owner 2026-10-27).
- **Hero flag: the owner's 32 px pennant** (`public/assets/ui/u_flag_pennant.png`)
  drawn at 2× (64 px), **the same pennant for every hero**. No fade while the
  hero works and no colour cue for now: the owner plans a **flag rework**
  later, which settles hero colours and colour-blind cues (T-151 joins it)
  (owner 2026-10-27).
- **Stumps at their true size**: the Oak and Fir stumps set to *Art size:
  Small* in the CMS (32 px art drawn at 64 px). An owner CMS job; the
  director checks the stump still regrows and places cleanly at the smaller
  size.

## Not in this

- Hero HP bars and the fight's plate (`fightPlate.js`) are unchanged.
- The disallow and demolition marks stay as they are (player choices keep
  their own icons).
- The flag rework (colours, fade, colour-blind cues) is a later interview.
