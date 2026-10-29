# Eye-check 2026-10-28: Token bars (brief 250)

*One plate for every Token, the gear on hover for a choice waiting on you, no
charges on enemies, and your pennant as every hero's flag.*

**Branch:** your folder is already on it (`git switch feat/token-bars`); the
game is running at http://localhost:5173. Play in your usual save (slot 3), or
a New Game in an empty slot for a fresh Starter Camp. When you are done, the
director switches your folder back to `main`.

Shots of each state (taken by the builders, small): `docs/active/eyecheck/shots/2026-10-28_tokenbars_*.png`.

## Checks

1. **An idle Token, hovered, shows the plate under it** (rule 3). Rest the
   pointer on a Copper vein nobody works: a plate appears under the Token with
   its charges, and the name steps down below the plate. No round ring
   anywhere. Try a berry bush that is resting (charges 0 and a refill clock),
   a Stump (its regrow clock), a quest board (its progress, e.g. 1/1) and the
   Goblin Camp (its count, e.g. 3/3). A Token with nothing to say (a plain
   tree at full charges still says its charges; a decoration says nothing)
   shows no plate, only its name.
   Verdict: ok (owner 2026-10-28, "seems fine", merge)

2. **The worked plate has no output icon** (rules 1 and 4). Put a hero on a
   tree: the plate under the hero shows the cycle fill and the charges, no Oak
   Wood icon. Put a hero on a Furnace that is running fine: its plate shows the
   Smithing/Smelting skill icon. Hover the worked Token: the plate opens to the
   skill, any problem, the charges and the time to the next cycle.
   Verdict: ok (owner 2026-10-28, "seems fine", merge)

3. **Problems still show at rest** (rule 2). A Furnace out of coal, or a Bare
   tree with no Orchard, keeps its yellow '!' on the Token without hovering;
   hovered, the plate shows the problem too.
   Verdict: ok (owner 2026-10-28, "seems fine", merge)

4. **A choice waiting on you turns its '!' into the big gear** (P1). Buy a Wood
   Foundation from the Shop and place it: it shows the yellow '!'. Rest the
   pointer on it: the '!' becomes a big gear in the same spot; moving the
   pointer across it does not flicker; clicking it opens the build list. The
   same on a Workbench with no recipe chosen. A station waiting on items keeps
   its '!'.
   Verdict: ok (owner 2026-10-28, "seems fine", merge)

5. **Enemies show name and HP only** (P1). Hover a goblin: its name and HP bar,
   no charges number, no plate.
   Verdict: ok (owner 2026-10-28, "seems fine", merge)

6. **Every hero's flag is your pennant at 2×** (P2). Look at the flags on the
   mat (each hero the same pennant), drag one to a new spot (the reach ring
   centres on the pole's foot), pin one on a Token. Open a hero's panel (the
   pennant behind the shoulder) and the Atlas's Region list (the "you are
   here" pennant).
   Verdict: ok (owner 2026-10-28, "seems fine", merge)

## Questions that came up while building

*Owner 2026-10-28 approved the batch as it stands: the recommended option (A) holds for a–c; d and e stay as built.*

a. **The pennant jumps a little when you drop it.** While carried it is
   centred on the pointer, so on release it moves about 23 px right and 31 px
   up to stand with its foot where you let go (the old flag jumped more).
   - A: keep it as is (recommended for now: smaller than before).
   - B: carry it with its pole foot under the pointer, so it lands without a jump.

b. **The flag colour swatches in Edit Hero now change nothing you can see.**
   - A: keep them until the later flag rework (recommended: the saved colour
     stays for it).
   - B: hide them now.

c. **An idle hero stands over the right half of the smaller pennant's cloth.**
   - A: leave it (recommended until the flag rework).
   - B: move where idle heroes stand (hero movement changes; a small engine change).

d. **On a quest board, the quest tooltip that shows on rest partly covers the
   idle plate** (shot `p3_quest_board`). OK, or move one of them?

e. **On a small mat** the plate keeps its full size (as the worked plate
   does), so it looks large beside small Tokens. OK?

## Owner CMS steps

- In the Token editor, set **Art size: Small** on **Oak Stump** and **Fir
  Stump**, then Sync **on `main`** (after this look, once the director has
  switched your folder back). The director then checks a stump regrows its
  sapling and places cleanly at the smaller size.
