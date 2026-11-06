Status: briefed 2026-11-05 (approved 2026-11-05; brief 490)

# Drag hints: who can work this Token

**The idea (owner, 2026-11-05).** While you drag a hero over a Token, every
hero shows whether they could work it: the tool it needs and the skill it
needs, each marked pass or fail. If you grabbed the wrong hero, you see at a
glance which one is right.

## What the player sees

- **When**: the marks appear the moment the dragged hero is over a Token and
  go when it leaves that Token or is dropped. Nothing changes until then.
- **Where**: over **every hero's sprite on the mat** and on **every hero's
  card in the hero bar** (the bar is always on screen, so a hero off-screen
  or tiny at mat zoom still shows). The **dragged hero** shows them too, on
  the carried sprite, so you see you've grabbed the wrong one before letting
  go. Busy heroes (working, fighting, walking) show them like the rest.
- **Two marks**, side by side:
  - **Tool mark**: the sprite of the tool the Token needs. A hero holding a
    fitting tool shows **their own tool**; a hero without one shows the
    needed kind at the lowest tier that will do.
  - **Skill mark**: the skill's icon with **the hero's level** in that skill
    on it.
- **Pass or fail**: each mark has a **green outline when the hero passes**
  and a **red outline, drawn darker, when they don't**. Tool: a fitting kind
  at the needed tier or better passes; no tool of that kind, or one too weak
  (a copper pickaxe on an iron vein), fails. Skill: the hero's level at or
  above the Token's passes.
- **Tokens with no tool need** (a Redberry Bush): **the skill mark only**. A
  Token that needs neither tool nor skill shows nothing.
- **Enemies** (owner, 2026-11-05: combat has no skill checks): each hero
  shows **what they hold in their hands** instead, as a quick reminder of how
  they're armed: one sprite per hand item (a two-handed weapon once). No
  green or red outline, since nothing is being checked. Bare hands show
  nothing.
- **Size** (owner, 2026-11-05): each mark is the size of an item floating on
  the mat: a 32 px sprite drawn at 2×.

## Calls made without asking (routine)

- **Water** (several tool kinds at any tier): a hero holding any kind the
  water takes passes and shows that tool; a hero holding none shows the
  water's first kind, red.
- **Same rules as the game's**: pass and fail come from the checks the game
  already uses to decide whether a hero may work a Token (the yellow
  "no tool" and "level too low" alerts), never a second copy of them.
- **Bubbles**: a hero's alert bubble steps aside while the marks show and
  returns after the drag.
- **Hero bar cards**: the marks keep their mat size there too if a card has
  room; if not, show the owner a screenshot before shrinking them.

## Not in this

- Who would be **best** at it (speed, yield, a better weapon): this is only
  "can they".
- Dragging anything other than a hero.
