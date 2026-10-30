# Eye-check 2026-10-30: Classless heroes part 1 and the Ledger tab (brief 270 K1, brief 290 L1)

**Branch:** the director switches your folder to `feat/classless-k1` (it also
holds the hero-orders clean-up) and starts the game at http://localhost:5173
before telling you. ⚠️ **Don't Sync the CMS while on this branch**: the
director switches your folder back to `main` after the look.

**Save slot:** start a **New Game in an empty slot**. Loading your usual save on
this branch turns every hero classless for good (jobs dropped, levels kept), and
`main` can't read it back until this merges. The old-save check below uses its
own slot.

Shots from the builder: `docs/active/research/classless_k1/` (sword fight,
bow fight, the sheet, the refusal, the old Knight).

## The game (classless heroes)

1. **A new hero's sheet.** Recruit a hero and open their sheet. You should see
   one list of all 20 skills at level 1: the four combat skills, the nine
   Starting skills, the seven specialist ones (tinted). No job title, no
   "Change job", no locked or set-aside skills. HP 11.
   Verdict: **ok** (owner 2026-10-29: "Looks good")
2. **The weapon decides the style.** QA panel → Classless heroes → "New hero vs
   Goblins: sword, then bow". The hero with a Copper Sword fights the first
   Goblin; on their sheet Melee XP climbs. Drag the Copper Bow from the Bank
   onto them, then drag them onto the next Goblin: Ranged XP climbs, Melee
   stays.
   Verdict: **ok** (owner 2026-10-29: "Looks good")
3. **Gear can ask a level.** QA panel → "QA Iron Sword asking Melee 15", then
   drag it from the Bank onto a new hero. It is refused with "Needs Melee 15"
   and stays in the Bank.
   Verdict: **ok** (owner 2026-10-29: "Looks good")
4. **Barehanded.** Send a hero with empty hands at a Goblin: they punch with
   their Melee level and earn Melee XP.
   Verdict: **ok** (owner 2026-10-29: "Looks good")
5. **An old save.** In another empty slot: QA panel → "Old save: a promoted
   Knight". Open the Knight's sheet: Melee 25, Magic 33, Enchanting 7, Fletching
   18, every Starting skill 12; no Leadership, Armory or Commerce; no job; 43 HP.
   Verdict: **ok** (owner 2026-10-29: "Looks good")
6. **Promotion is gone.** The Fighter's and Wizard Academies are still in the
   content but do nothing: dragging a hero onto one is refused ("Nothing to work
   here"). They wait for your CMS to-do below.
   Verdict: **ok** (owner 2026-10-29: "Looks good")

## The CMS (the Ledger tab, already on `main`)

Open after the director has switched your folder back to `main`, and refresh
the CMS tab first.

7. **Ledger tab** (top bar, after Progression): every entry listed with status,
   stage and note; edit one in place; filter to Planned; add a "+ Planned stub";
   promote it to Draft with the arrow. "First reach" reads Starter Camp almost
   everywhere until map stages are set (expected).
   Verdict: **ok** (owner 2026-10-29: "Looks good")
8. **Ledger settings**: stage budgets, ±25 %, the target player, the pace curve
   (placeholder points for you to set).
   Verdict: **ok** (owner 2026-10-29: "Looks good")

## Questions (recommendation first) — **owner 2026-10-29: as built (A) on all seven**

a. Armour's level requirement: (A) the author picks one of the four styles per
   piece (built); (B) the hero's best combat skill; (C) no armour requirement
   until combat v2.
b. Where the job title was on the sheet: (A) nothing (built); (B) a total level.
c. Entries with no status: (A) Live (built); (B) Draft until the first-fill pack.
d. A map with no stage: (A) counts at the stage where you first get it (built);
   (B) the tutorial's maps count as stage 1 by rule.
e. Item costs through an enemy drop: (A) marked incomplete until fights can be
   timed (built); (B) estimate fight time from enemy level now.
f. The ledger's rules: (A) classless heroes, one job each (built); (B) the game
   as it is today.
g. The pace curve: (A) entered as time per level, time-to-reach shown (built);
   (B) entered as time to reach a level.

## Your CMS steps after the merge (on `main`)

- Give the Copper Dagger and the Iron Dagger one style each (they fight Melee
  until then).
- Set level requirements on weapons and armour (e.g. the iron tier at 15;
  armour also picks its style).
- Retune the Goblin and the tutorial's goblin step: a new hero with a Copper
  Sword wins about 8 % unfed, nearly always with Shrimp, never barehanded (the
  builder's rough estimate).
- Delete or repurpose the Fighter's Academy, the Wizard Academy, their two
  Training effects, and the Stone Foundation recipe that builds the Fighter's
  Academy.
- Give the Shrimp Market a skill other than Commerce (cut), or remove it.
