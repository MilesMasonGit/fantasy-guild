Status: draft

# Combat depth options

*Research for the combat detail pass (owner question, 2026-10-23: "we have a
system of trading hits, but not really any detail about how hit percentages
work, damage ranges, etc."). Options only; nothing here is ruled. It builds
on the rulings in [concept_combat.md](../concept_combat.md) and marks every
place an option would **amend** one.*

## Where the depth should live

Fights here run without the player: often offline, never with a button to
press. So depth cannot live in reflexes or mid-fight choices; it lives in
**preparation**: which hero, which weapon, which armour, which food and
elixirs, which enemy the flag points at. Idle games that do this well (Melvor
Idle, RuneScape's auto-combat, Legends of Idleon) share one shape: a few
**stats on gear that answer a few kinds of enemy**, plus a clear readout of
whether you will win. The test for every option below is **readability**: can
a player, looking at their hero and the enemy, tell whether the fight is
winnable and what would change the answer? Hidden dice and long formulas
fail that test even when they add "depth".

Scale used throughout (from the rulings): Recruit 10 HP, punches 1 every 3 s;
bronze sword 2, iron sword 3, +1 damage per 20 levels; HP 10 + level; base
miss 10 %, crit 5 % for double; armour takes 1 off each hit, minimum 1.

---

## Lever 1. Hit chance: what makes a swing miss

Today's ruling: 10 % base miss, sliding 5–25 % with the level gap.

- **A. As ruled.** Level gap only. *Depth*: little; nothing the player crafts
  changes it. *Cost*: none.
- **B. Accuracy and Dodge as plain percentages, added to the ruling.**
  Miss = 10 % + level-gap shift + enemy Dodge − hero Accuracy, kept between
  5 % and 40 %. A "Nimble" bandit with Dodge 15 makes a Fighter miss 25 %;
  an Accuracy +10 ring brings it back to 15 %. *Depth*: a real reason to
  carry an accuracy piece against some enemies. *Readability*: high; every
  number is a visible percentage. *Build*: small (one sum). *Offline*: none.
  *Amends* the ruling lightly (adds gear and enemy terms to the gap).
- **C. RuneScape-style opposed rolls** (attack roll against defence roll).
  Hit chances come out as numbers like 63.4 %. *Depth*: high; *readability*:
  poor, the player cannot do it in their head. Not recommended.
- **D. No misses, "glancing" hits** that do half (rounded down, min 1).
  Smooths fights, but at 2-damage weapons a glance and a hit look alike.

**Recommendation: B.** One added stat each side, all in percentages.

## Lever 2. Damage: fixed or a range

Ruling: fixed hits, no spread.

- **A. Fixed (as ruled).** The floating "3" is always 3; the preview can be
  exact. *Readability*: best.
- **B. A small range per weapon** ("2–3"). Average 2.5. Adds texture but
  makes the preview a guess and the floating numbers noisy. *Amends* the
  ruling.
- **C. A rhythm instead of dice**: a weapon trait such as "every 4th swing
  hits +1", built as a Rules-system move (the "every Nth swing" moment the
  bosses already need). Variety without randomness.

**Recommendation: A**, with **C as a later weapon trait** once the boss moves
exist. Ranges add noise, not choices.

## Lever 3. Armour model

Ruling: flat, each point takes 1 off every hit, minimum 1.

At these small numbers flat armour is **very strong**: 1 armour halves a
bronze sword's 2. That is a feature if it is budgeted, because it creates the
most readable trade-off in the system, **fast weapons against soft enemies,
heavy weapons against armoured ones**:

| Weapon (level 20, +1) | Hit | vs armour 0 | vs armour 2 |
|---|---|---|---|
| Iron dagger, 2 s | 2+1 = 3 | 1.5 per s | 1 per 2 s = 0.5 per s |
| Iron sword, 3 s | 3+1 = 4 | 1.33 per s | 2 per 3 s = 0.67 per s |
| Iron greataxe, 4 s | 5+1 = 6 | 1.5 per s | 4 per 4 s = 1.0 per s |

- **A. Flat as ruled, budgeted**: armour stays small (0–1 per piece early, a
  full set about one point under the tier's typical hit). *No amendment.*
- **B. Flat plus Pierce**: a weapon stat that ignores that many armour
  points. Gives fast weapons an answer to armour. *No amendment* (an
  addition).
- **C. Percentage reduction** (armour 20 = −20 %). Rounds to nothing at
  2-damage hits; unreadable at this scale. Not recommended. *Amends.*
- **D. Armour as a shield pool**: "Armour 4" soaks the first 4 damage of each
  fight, then is gone. Readable, but makes armour irrelevant in long duels.
  *Amends.*

**Recommendation: A + B.** Keep flat armour, budget it, add Pierce.

## Lever 4. Crits

Ruling: about 1 in 20 swings crits for double.

- **A. As ruled, doubled before armour.** A useful quirk: against armour 2,
  an iron sword's normal hit is 4−2 = 2 but a crit is 8−2 = 6, three times as
  much. Crits are naturally the answer to armour, with no extra rule.
- **B. Crit chance as a gear stat** (+5 % per point, capped at 25 %). Gives
  daggers and rogues' gear a clear identity. *No amendment.*
- **C. Crits ignore armour entirely** (8 instead of 6 above). More swing,
  one more rule to explain.
- **D. A guaranteed crit every Nth swing** (no dice). Fully predictable;
  feels mechanical. Possible later as a weapon trait.

**Recommendation: A + B.** Say in the combat panel "crits double before
armour" once; the player learns it from seeing big crits on armoured enemies.

## Lever 5. Gear stat axes (what a crafted piece can carry)

Without this, every iron sword is the same and crafting is a ladder only.

- **A. One stat per slot**: weapons carry Damage and Speed, armour carries
  Armour. Simplest; crafting choices are only "next tier".
- **B. A main stat plus one chosen bonus from a short list**, picked by the
  crafter through an extra ingredient at the station (a gem, a resin, a
  feather). The list, five items:
  - **Accuracy** (−miss %), **Crit** (+crit %), **Pierce** (ignore armour),
    **Vitality** (+Max HP), **Guard** (+1 armour).
  - "Iron sword + Pierce 1" is made with an iron bar and a garnet; "Iron
    sword + Crit 10 %" with a bar and a hawk feather. Gives gathering a
    reason to collect odd materials and gives the guild a rack of swords for
    different enemies.
  *Readability*: high (one bonus line per piece). *Build*: moderate (recipes
  and an item field; the bonus is a Rules "provides" effect, which already
  carries accuracy, armour and damage modifiers). *Offline*: none.
- **C. Random bonuses** (Diablo-style rolls). Exciting loot, but heavy
  inventory sorting and unclear crafting. Better kept for **rare boss drops**
  only.
- **D. Set bonuses** (wear three iron pieces, +1 armour). Later, through the
  Rules system.

**Recommendation: B** for crafted gear, **C only for a few boss drops**.

## Lever 6. Enemy kinds that ask for different gear

Gear stats only matter if enemies differ. Today enemies differ by level and
style.

- **A. Numbers only** (the CMS overrides HP, armour, speed). Works, but the
  player cannot see why one enemy is hard.
- **B. A small set of named kinds, each with an icon**, each a preset of the
  numbers and each with an obvious answer:

  | Kind | What it does | Answered by |
  |---|---|---|
  | Armoured | +2 armour, slow | Pierce, heavy weapons, Crit |
  | Nimble | Dodge 15 | Accuracy |
  | Swift | small hits every 2 s | Armour (Guard) |
  | Brute | big hits every 4 s | Vitality, more food |
  | Venomous | poisons on hit | food, a cure elixir |

  An enemy can carry none, one, or two. *Readability*: high; it is the
  "rock, paper, scissors" the player can see. *Build*: small (CMS presets).
  ⚠️ The ruling "the player sees only the enemy's style icon, no weak-to
  line" was about the style cycle; a kind icon is a second icon, so this
  **touches** that ruling and needs the owner's say.
- **C. Damage types** (slash, crush, pierce, each enemy resisting some).
  Classic, but triples the gear needed. Not recommended.

**Recommendation: B**, starting with Armoured, Nimble and Swift.

## Lever 7. A fight preview (win odds)

The readability test, made visible.

- **A. A coloured badge** when the flag or hover is on an enemy: green "Easy",
  yellow "Needs food", red "Likely loses". Worked out from average damage per
  swing each way (cheap arithmetic, no dice).
- **B. A sentence in the combat panel and hero hover**: "Kills in about 10
  swings (30 s). Takes about 18 damage. No food needed." Same arithmetic,
  more detail.
- **C. A true win percentage** ("82 %"), from running the fight a few hundred
  times in the background when the player hovers. Accurate, but a number
  invites distrust when an 82 % fight is lost. Costs only on hover, nothing
  offline.
- **D. An after-fight recap**: "Overnight: 41 wins, 1 knockout, 6 bread
  eaten." The idle-game staple; it is how players learn what went wrong.

**Recommendation: A + B + D.** All cheap; none touch catch-up. ⚠️ If the
preview counts the style matchup, it quietly tells the player the cycle,
which **touches** the "learn the cycle" ruling. Option: leave the matchup out
of the badge, or accept it.

## Lever 8. Player-set tactics

Small settings on the hero's Fight rule, set once, obeyed offline.

- **A. Eat threshold in three steps**: Low (25 %), Half (50 %), Early (75 %).
  *Amends* "below 25 % HP the hero eats". Matters: in the Recruit fight below,
  eating at 2 HP costs a swing the Recruit did not need.
- **B. Retreat when low with no food left**: the hero walks away below 20 %
  HP. No kill, no loot, but no knockout, so no lost gear or food. Strong for
  offline safety.
- **C. Only fight what the preview calls green (or green and yellow)**:
  uses Lever 7's badge to choose fights. Stops a badly geared hero farming a
  camp that beats them all night.
- **D. Save elixirs for bosses**. *Amends* "an elixir is drunk at the start
  of every fight".
- Target priority is not needed while every fight is one-on-one.

*Cost*: a per-swing HP check or a per-engagement preview; trivial offline.
**Recommendation: C first, then B.** A and D are fine later.

---

## Recommended starter package

Four levers that work as one set, none needing the owner to undo a ruling:

1. **Flat armour, budgeted, plus Pierce** (Lever 3 A+B). Speed against
   armour becomes the main gear choice.
2. **One crafted bonus per piece** from Accuracy, Crit, Pierce, Vitality,
   Guard (Lever 5 B), with Accuracy and Dodge feeding the miss chance
   (Lever 1 B) and Crit feeding Lever 4 B.
3. **Three enemy kinds with icons**: Armoured, Nimble, Swift (Lever 6 B).
   Each is answered by one bonus.
4. **The preview badge, the panel sentence and the overnight recap**
   (Lever 7 A+B+D).

Kept as ruled: fixed damage, 5 % crits for double, misses 10 % ± gap, eat at
25 %. Next after this set: the "only fight green" and retreat tactics.

### Example 1: Recruit against a goblin

Recruit: 10 HP, punch 1 every 3 s, one bread (+4). Goblin: 8 HP, hits 1
every 3 s, no armour, no kind. Preview: **yellow**, "Kills in about 9
swings (27 s); takes about 8; may eat once."

| Time | Swing | Recruit | Goblin |
|---|---|---|---|
| 1.5 s | Goblin hits 1 | 9 | 8 |
| 3 s | Recruit hits 1 | 9 | 7 |
| 4.5–10.5 s | trade three each | 6 | 5 |
| 12 s | Recruit **Miss** | 6 | 5 |
| 13.5 s | Goblin hits | 5 | 5 |
| 15 s | Recruit hits | 5 | 4 |
| 16.5 s | Goblin **Miss** | 5 | 4 |
| 18–24 s | trade, Recruit lands three | 3 | 1 |
| 25.5 s | Goblin hits | 2 (below 25 %) | 1 |
| 27 s | Recruit eats bread, +4 | 6 | 1 |
| 28.5 s | Goblin hits | 5 | 1 |
| 30 s | Recruit hits | 5 | **0, win** |

A 30 s duel, one bread used. (Without the bread rule the Recruit would have
won at 27 s on 2 HP: why a later eat-threshold setting is worth having.)

### Example 2: level-20 Fighter against an iron-tier Armoured troll

Fighter: 30 HP, iron armour 2. Hill troll (Armoured): 30 HP, armour 2, hits
5 every 4 s, so 5−2 = **3** per hit on the Fighter.

**Plain iron sword** (3 + 1 for level = 4; 4−2 = 2 a hit, crit 8−2 = 6).
Average about 2 per swing: about 15 swings, **45 s**. The troll lands about
10 hits of 3 = 30 in that time. Preview: **red, "Likely loses without 2+
food"**.

**Iron sword + Pierce 1** (garnet at the anvil): 4−2+1 = **3** a hit, crit
8−2+1 = **7**. Preview: **green, "Kills in about 10 swings (30 s); takes
about 18"**.

| Time | Swing | Fighter | Troll |
|---|---|---|---|
| 2 s | Troll hits 3 | 27 | 30 |
| 3 s | Fighter hits 3 | 27 | 27 |
| 6 s | both hit | 24 | 24 |
| 9 s | Fighter hits | 24 | 21 |
| 10 s | Troll hits | 21 | 21 |
| 12 s | Fighter hits | 21 | 18 |
| 14 s | Troll **Miss** | 21 | 18 |
| 15 s | Fighter **Miss** | 21 | 18 |
| 18 s | both hit | 18 | 15 |
| 21 s | Fighter hits | 18 | 12 |
| 22 s | Troll hits | 15 | 12 |
| 24 s | Fighter **Crit! 7** | 15 | 5 |
| 26 s | Troll hits | 12 | 5 |
| 27 s | Fighter hits | 12 | 2 |
| 30 s | Fighter hits | 12 | **0, win** |

Same hero, same tier, one crafted bonus: a lost fight becomes a 30 s win on
12/30 HP with no food. An iron greataxe (6−2 = 4 a hit, 4 s) wins in about
the same time, so the player has two answers; an iron dagger (3−2 = 1 a hit)
would take over a minute, so the badge shows red and the player learns
"daggers for soft things". The crit at 24 s did 7 where a normal hit did 3,
which is how crits read as anti-armour without a rule.

### Cost notes

Every lever is a sum per swing; none adds engine steps to offline catch-up
(GDD §14). Only fight length does that, and the package keeps even duels at
about 10 swings, as ruled. The background-simulation win percentage
(Lever 7 C) is the only heavy option, and it runs on hover only.
