Status: briefed 2026-10-14 (approved 2026-10-14; brief 120)

# Information layers: the mat, hover and the Token card

*From the owner's refinement pass ([refinement_pass_todo.md](refinement_pass_todo.md)
§2, "Information Architecture"). Owner interview, 2026-10-13, three rounds;
**done** (owner closed it). The look of every piece follows
[UI_STYLE.md](../reference/UI_STYLE.md). Replaces the bubble rules described
in `TokenBubbles.jsx`'s header; supersedes the "Bubbles and framerate" note in
[design_pass_notes.md](design_pass_notes.md).*

## The rule

Three layers, each showing less than the one below it:

1. **The mat** shows that things are happening and what is wrong. No numbers.
2. **Hover** adds a name and the charges. Nothing else.
3. **The card** (click) holds the detail, written as icon lines with hover
   tooltips for the explanations.

The mat must stay light to draw: fewer elements than today, nothing animating
on an idle Token.

## 1. The mat, nothing hovered

- **A worked Token**: a **thin progress bar** (1–2 art pixels) along its foot
  that fills each work cycle. No ring, no seconds.
- **Problems**: **one problem mark**, coloured by severity: **yellow** =
  waiting (needs items, needs a recipe chosen), **red** = can't (no room, the
  mat is full). Hover on the mark says exactly what.
- **Player choices keep their own icons**: the disallow mark and the
  demolition mark, the whole time they apply.
- **Count changes**: the **-1 / +50 floater** still pops (a pop of activity);
  the charges, quest and spawner rings no longer appear by themselves.
- **Health bars** on heroes and enemies show **only when hurt or fighting**
  (and on hover). Full health: no bar.
- **Hero speech bubbles stop reporting blocks**: the problem mark and its
  hover say why. Heroes still speak for unusual moments (level-ups and the
  other lines in `docs/reference/speech_bubble_lines.md`); the blocked lines
  are marked retired there when this is built.
- While a Token is dragged: nothing (as today).

## 2. Hover

- The **white 1-art-pixel outline** at once (T-147).
- After **~150 ms** of resting on it: the **name** above the Token and its
  **charges ring** (today's ring, with its number). Sweeping the cursor across
  the mat shows outlines only.
- **A hero**: outline, name and HP bar.
- **An enemy**: outline, name and HP bar.
- No per-bubble tooltips on the mat beyond the problem mark's.

## 3. The Token card (click)

### Behaviour

- **Lives beside its Token** and follows it, as today's inspect pop-up does.
- **One card at a time**: clicking another Token replaces it; clicking bare
  mat or Escape closes it. Dragging a Token keeps its card attached.

### The look: a full-art card

- **The 256 px art fills the card behind the information**, like a full-art
  trading card (not a header picture).
- **Text sits in slightly opaque boxes** over the art so it stays readable.
- **Which art**: by **activity** by default (the skill or trade the Token is
  for: a Copper Vein shows the mining scene), with a **per-Token override**
  set in the CMS. A Token with no art for its activity yet gets a plain card.
  Today only a few pieces exist (`public/assets/backgrounds/`: one fishing
  scene, four stations, a few card scenes), so the owner's art list gains the
  missing activity scenes.
- **Items stay plain**: Bank item inspection doesn't get the card treatment.

### What it shows, top to bottom

Each block appears only if it applies. Icons carry the meaning; hovering any
icon or number gives the full explanation.

1. **Name** and the close X (UI_STYLE "Panel headers").
2. **Work line**: `[skill icon] 20 · +35 XP`: the skill, the level it needs,
   the XP one cycle gives.
3. **Cycle line**: `[clock] 4s · [charges] 37` (∞ when unlimited).
4. **The current recipe only**, in groups using the standard item bar
   (UI_STYLE "Item references"):
   - **Needs**: item bars with have/need, red when short.
   - **Tools**: a **hollow, outlined bar with no count** for a tool the work
     requires (an Ore Vein shows its pickaxe here). Until T-126 makes tools
     hero gear, it names the tool Token the work needs nearby.
   - **Makes**: item bars, with the chance on rare and secondary outputs.
   - **Stations** get a **Change recipe** button here (it opens the recipe
     picker; the recipe list's own overhaul is a separate topic).
5. **Lifecycle lines**, icon + time: `[regrow] 0:12`, `[spawn] 3/5 · next
   0:40`, `[grow] 2:05`, rest, turn. Hover explains ("Respawns 12 s after it's
   used up").
6. **Drops**, with chances.

**An enemy's card**: name; **HP bar with numbers**; a **combat line**
(`[combat skill icon] level · XP per kill`, mirroring the work line); drops
with chances.

**Not on the card**:
- who is working it (the mat shows that);
- **Disallow and Demolish**: these move to the **map tool modes** (a later
  topic in the refinement list) and leave the card **when those modes ship**,
  not before;
- a quest bounty's **Dismiss** stays as it is until the quest rework decides.

## Build order and notes for the director

1. **T-146** (outline room on animated frames) and **T-147** (hover outline)
   first; the card and hover work assume them.
2. **The mat layer**: the progress bar, the single problem mark, floaters
   only, health bars when hurt, blocked speech lines retired. This replaces
   most of `TokenBubbles.jsx` and its ring row. **Measure before and after**
   (`bench:draw --compare`, a cost-log line in PERFORMANCE.md): fewer
   elements should draw cheaper; prove it.
3. **Hover**: the 150 ms delay, name and charges ring, hero and enemy HP.
4. **The card**: layout and icon lines on the existing `TokenInspectPopup`
   anchor; the art backdrop and the CMS per-Token override field (the CMS
   field is code; the owner sets the pictures).
5. Disallow and Demolish leave the card with the map tool modes.

Every step changes what players see: **owner eye-check** per step. New icons
(clock, charges, regrow, spawn, grow, problem mark) follow UI_STYLE "Sprites
and icons": a placeholder sprite and a line on the owner's art list where none
exists.
