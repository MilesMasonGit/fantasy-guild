Status: briefed (approved 2026-11-04; [brief 480](briefs/480_early_game_slurm.md))

# The very early game, and Limes the guide

*Owner interview, 2026-11-04, from the detail pass's section 13. Replaces the cartographer's quest Tokens in
[concept_quests_tutorial.md](concept_quests_tutorial.md). The owner's words are in quotes; "planning agent" marks what the
agent filled in.*

## The guide

- **Limes**, a friendly new NPC, using `public/assets/enemies/slime/e_slurm.png` (32 px, at a whole-number scale).
- **"Displayed quite large in the bottom right corner"**, a large portrait over the mat, "popping out when it has something
  to say, and back when it's done".
- **The bubble stays until the step is done.** It can be minimised, which shrinks Limes into the corner and the bubble to a
  small "...".
- **Voice: cheerful and blobby.** Short, warm, a little silly ("Blorp! Drag your hero onto that bush. Berries!"), clear words,
  easy to translate. The owner reads and edits every line at the eye-check.
- **It guides, never locks.** The next thing to use has a **hard gold outline**. Anything else can be done meanwhile; a step
  done out of order just counts.
- **Limes stays as a helper** after the lessons, for big moments and new systems. **The cartographer stays as the eerie story
  figure for the ritual and doesn't teach.**
- **A switch on the new game screen**: Limes's lessons on or off, on by default. Off gives the same start with no bubbles or
  outlines.

## The opening

- **A new game starts with an empty Bank and no free tools.** The first hero comes from the new game screen. The old full kit
  becomes **a QA button**.
- **The whole Starter Camp is visible from the first second**; the gold outline focuses it.
- **Bare hands gather from early Redberry Bushes.** Planning agent: check that the bush asks for no tool today.
- **A scrap heap Token** near the Hall: a hero searches it bare-handed, it gives rusty tools at a good chance and refills after
  a rest, so the player can never be stranded.
- **Rusty Woodaxe, Rusty Pickaxe and Rusty Sword**: work like copper, with **a 1 % chance to break per cycle**, about 100
  cycles or 5 minutes at a 3 s cycle. A hero whose tool breaks stops, with the yellow idle alert. Breaking is a new mechanism;
  nothing breaks in the game today.
- **Lessons pay no rewards.** Everything is earned. Planning agent's sum: a tree gives 1 to 2 wood every 3 s, so a Foundation
  and Bunk Beds take a couple of minutes.

## The lessons, about 10 minutes

1. Drag your hero to a Redberry Bush.
2. Collect (hover the loot).
3. Search the scrap heap, and equip the Rusty Woodaxe.
4. Chop wood.
5. Buy Bunk Beds in the Guild Hall: a second hero.
6. Buy a Foundation and build a Workbench.
7. Craft something.
8. **A safe first fight**: a new small slime near the Hall, with the Rusty Sword and berries as food.

Then Limes shows the world map, and **one big goal carries the rest of the Starter Camp: settle a place**. It names the items
and the player works out how. Planning agent: the first places' prices must lead through copper and the Goblins' drops, so they
are part of this work.

## Smithing's first steps

- **The copper ingot is the first Smithing recipe, at level 1.** Smithing ingots levels you up.
- **"Each level should bring a new recipe. Level 1: ingot. Level 2: dagger, Level 3: woodaxe, etc."** Planning agent: the rest of
  copper's order waits for the metal and gear session, with the Copper Pickaxe near the woodaxe, since rusty tools break. XP
  must change to suit: an ingot pays 1 XP and level 2 takes 83 today. Whether the rule runs past copper is that session's to
  say.

## What it touches

- **Brief 450 S4** drops the old first step; the first hero is the player's. Brief 480 adds the lessons switch to that screen.
- **Brief 410**: the Foundation lesson uses the new Shop and Foundations.
- **The quest board's pinned row (T-176)** doesn't apply as designed. **T-258** and the drafts in `tutorialText.js` go with it.
- **T-014**: Limes's words, in code or the CMS, is the brief's to propose.
- **Content by CMS change pack**: the heap, rusty items, the small slime, the empty Bank, Smithing's levels, ring 1's prices.
- **The ledger** reads the heap as a tool source, and the Starter Camp's budget (30 minutes) must be reported after the change.
- **Rulings of 2026-11-05** (owner, the brief review): the guide is **Limes**, not Slurm. The Redberry Bush's **Thorns has a 10 % chance per cycle**. Breaking is checked **only when a cycle completes**, combat's included; the swing is just art. The Starter Camp's budget becomes **about 40 minutes**. **Seedlings, Forests and trees** are still open for discussion. The pop-up Shop may cover the guide. Brief 480's content waits for the buildings (T-307). Old saves aren't protected.
- **Owner art**: the scrap heap, three rusty tools, the small slime if none of the art fits, and any larger Limes.
