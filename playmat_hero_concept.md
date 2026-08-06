# Concept: Heroes

Heroes are the engine of the playmat economy. This document owns **what a hero is** — identity, skills, jobs, progression, equipment and recovery.

**It does not own how heroes interact with the board.** Placement, occupancy and work rules live in [`playmat_grid_concept.md`](playmat_grid_concept.md) §4, because they are board mechanics. §2 below summarises them as context and does not restate them as decisions.

Reasoning for every decision ID (D-nn) is in [`playmat_decisions.md`](playmat_decisions.md).

> **Status: IN PROGRESS — design-ahead, not a build target.** §1 and §3 are settled *as design*. §4 is the remaining agenda.
>
> ⚠️ **The first playmat build ports the existing hero system as-is.** Only what the board strands falls away — Energy (no card draws), hazard-avoidance traits (no hazards), item durability (D-118). Traits, rolled classes and the current equipment slot count all ship unchanged and are reworked later. See [`playmat_roadmap_brief.md`](playmat_roadmap_brief.md) §4.

---

## 1. What a Hero Is

**Heroes are named individuals you train** (D-179). Not staff, not units — people with a history you made.

Because traits and random rolls are cut (D-73), **a hero's identity is entirely a record of your decisions**: which Tokens you left them on, which job you promoted them into, what you chose for them to become. Bren is *your first recruit, the one who's been on the forge since the third hour* — and nothing about that came from a dice roll.

**This is settled by the roster size.** The tension that framed this document — *a guild of named adventurers is an RPG; twenty interchangeable staff is a colony sim* — resolves cleanly at **eight heroes** (D-181). Eight named people is a cast you can hold in your head. The colony-sim risk was a function of the number, and the number came down.

```
Start with 1 hero.  End with about 8.
Seven recruitments across the entire game.
```

Every one of those is a milestone, not a transaction.

---

## 2. How Heroes Work on the Board *(context — owned by the board doc)*

A hero **works exactly one Token and stands on top of it**. One hero per Token; heroes never move themselves; a hero whose Token stops producing simply idles. Roster size is the production ceiling — **the number of actively worked tiles equals the number of placed heroes**. Moving a hero mid-cycle forfeits that cycle. Unplaced heroes live in the Hero Dock.

Full rules: [`playmat_grid_concept.md`](playmat_grid_concept.md) §4.

---

## 3. Settled

### 3.1 What a Hero Contributes
A hero is **primarily a gate** — their presence is what makes a Token run at all — **and secondarily a modifier**. The Token sets what is possible; the hero sets how well it goes (D-62).

Skill level changes three things, and deliberately not a fourth (D-67):

| Effect | Detail |
| :--- | :--- |
| **Speed** | Higher skill works the Token faster. |
| **Access** | Tokens carry minimum skill requirements. This is what makes levelling *necessary* rather than optional. |
| **Efficiency** | Fewer inputs consumed per cycle; slower Token depletion. |
| ~~Quality~~ | **Not a hero effect.** Rare drops and double yields are properties of the Token, which keeps outcomes predictable. |

### 3.2 Growth
**Heroes get better at what they actually do** (D-63). Skills level through *use*, per hero — work a hero on ore for hours and they become a better miner.

This makes placement a **compounding** decision rather than a momentary one: leaving Bren on the mine buys tomorrow's better miner as well as today's ore. That gives the board memory and rewards keeping a good layout stable, which is a deliberate counterweight to micromanagement.

### 3.2a Six Skills, Always
✅ **D-180** — **A hero always has exactly six skills.** Promotion **removes two and adds two** — never more, never fewer.

```
RECRUIT          6 foundation skills, all production
   ↓ promote       −2 foundation   +1 combat +1 specialist
BASIC CLASS      4 foundation  1 combat  1 specialist
   ↓ promote       −2 foundation   +2 specialist
SPECIALISED JOB  2 foundation  1 combat  3 specialist
```

> ⚠️ **The earlier worked example here — *Labour, Combat, Lore, Scouting, Craft, Survival* — is void.** D-193 established that a skill with no Token to work cannot exist, and Lore, Scouting and Survival have none. The shape above replaces it; the actual entries are open ([`playmat_skills_concept.md`](playmat_skills_concept.md) §6).

**A hero's skill list is a constant width with changing contents.** That is what makes promotion feel like becoming a different person rather than accumulating a bigger sheet: you *give something up* to gain something, and what you gain is access to skills that didn't exist for you before.

* **The roster is always exactly 6 skills wide**, so a full 8-hero guild shows 48 skill values — readable in one view, and the number never grows.
* **Removed skills are banked at their level, not lost** (D-71), so a reversed promotion restores them intact.
* **The world's skill list is larger than any hero's six.** How much larger is open (§4.1).

### 3.2b Hero Level
✅ **D-182** — **A hero has an overall level derived from their six skills.** It is a summary, not a separate grind — there is no hero XP independent of skill XP.

It exists to give a single number for comparing heroes at a glance, sorting the roster, and gating things that aren't tied to one specific skill.

### 3.3 Classes and Jobs
Heroes advance along a **branching class tree** (D-70):

```
RECRUIT
   ├── Fighter ──┬── (specialisation)
   │             └── (specialisation)
   ├── Wizard ───┬── ...
   ├── Rogue ────┬── Thief
   │             └── Assassin
   └── ...
```

Every hero starts as an unspecialised **Recruit**, is trained into a **basic class**, and each basic class branches into **specialised jobs**.

This **transforms the existing class system rather than deleting it.** The game currently rolls a class randomly at generation and uses it as a passive stat bonus; here the same nine classes become an *earned tier chosen by the player*. It is also what preserves the guild fantasy against a large roster.

**Promotion** (D-68) requires a **skill threshold plus a resource cost**, and does two things:
1. Grants job-specific perks.
2. **Changes which skills the hero can learn** — removing some, granting others. An Explorer promoted to Ranger loses Arcane and gains Fletching.

**Removed skills are banked, not lost, and jobs are reversible** (D-71). A skill a promotion takes away goes dormant at its current level and returns intact if the hero ever holds a job that uses it again. Promotion is a reconfiguration, not a gamble — across 15–20 heroes, irreversible mistakes would stop players engaging with the system at all.

### 3.4 Traits and Perks
**Traits are cut** (D-73). There is no random roll at generation. **Every difference between two heroes is earned, never rolled** — a Recruit is a Recruit, and what they become is entirely the player's doing.

**Perks survive** and are granted automatically, never chosen:

| Source | Grants |
| :--- | :--- |
| **Jobs** | That job's perks — the concrete form of D-68's "special attributes". |
| **Skill milestones** | A perk at a skill level threshold, regardless of job. |

*Content mapping for authoring:* the existing 90 class perks re-home onto the job tree; the 90 trait perks re-home onto skill milestones. All 180 survive with a clear new owner.

⚠️ *Accepted cost:* recruits are **fungible**. With no innate roll there is no reason to prefer one new hero over another, so recruitment is a question of *how many*, never *which*.

### 3.5 Equipment
✅ **D-184** — **A hero carries a 9-slot flexible grid** (superseding D-65's 3–4). Any item goes in any slot; the item-tag rule still prevents two of the same equipment type — no two pairs of gloves.

At eight heroes this is 72 slots across the whole game, filled gradually and permanently. The earlier cut to 3–4 was justified entirely by a 20-hero roster and no longer applies.

**Gear does not wear out, but it is not permanent either.** Item durability is retired game-wide — Token depletion is the only wear mechanic (D-118) — so equipment never degrades through use. It leaves the economy **only through defeat-loss** (D-74), which makes losing a fight the sole thing that costs you gear.

> **Consequence:** crafted gear is a **milestone purchase, not a consumable** (D-125). Demand comes from roster growth, from better recipes unlocking, and from replacing what combat takes. Gear crafting will go quiet between Map unlocks — if that reads as dead content, **promotion costs consuming gear** is the natural place to add demand.

⚠️ **The open question is not the slot count — it is how equipping actually works.** Nine slots × eight heroes is a lot of drag-and-drop through the Dock, and the Dock's ergonomics were already flagged (§4.5). See §4.7.

### 3.6 Defeat and Recovery
A hero reduced to 0 HP leaves the board, enters the existing **Wounded** state, and may lose equipment permanently. Their tile idles until re-staffed (D-74).

**Healing already exists and is unchanged.** `RegenSystem` restores HP to **idle** heroes, and a hero pulled off a Token is idle — so **retreating a wounded hero is the healing mechanic** (D-136). Withdraw, let them recover, send them back.

All combat risk is opt-in: enemies never initiate, and a hero only fights because the player placed them there. There is no difficulty warning and no skill gate on enemies — **risk is managed by attention** (D-130). Retreat is always available; leaving a hero unattended in a fight they cannot win means death.

### 3.7 Visual Identity
**Heroes are drawn as their job, not as individuals** (D-75). A Smith looks like a smith; a Ranger like a ranger. Portraits are not used on tiles.

At 15–20 heroes on small tiles over Token art, twenty distinct faces would be unreadable and would tell the player nothing useful. Job sprites make **the board self-documenting** — the whole staffing arrangement reads at a glance — and the art budget scales with the number of **jobs**, not the number of heroes.

---

## 4. Open — the Session Agenda

### 4.1 The Skill List — *moved to its own document*
✅ **D-185** — **The world holds around 20 skills.** Each hero carries six of them (D-180) and touches roughly ten across a full career of two promotions — so **half the list is never seen by any one hero.**

That size is chosen so jobs feel like genuinely different professions rather than variations: a Ranger and a Smith should share almost nothing beyond basics. It also leaves room for **signature skills** that only one job grants — Fletching, Runecraft — which is what makes a promotion feel like gaining access to something new rather than swapping a number.

> **Skills now have their own spec: [`playmat_skills_concept.md`](playmat_skills_concept.md).** It owns what a skill is, where requirements live, the three combat skills, and the three-layer structure of the list. Only the hero-facing facts are restated here.

Settled there, and binding on this document:

* **The game has exactly three hero verbs** — gather, fight, make (D-192). A skill with no Token to work cannot exist (D-193).
* **Three combat skills — Melee, Ranged, Magic — and every hero holds exactly one.** Recruits hold none, so **an unpromoted hero cannot fight** (D-196). Defence folds into that one skill (D-197).
* **The Recruit's six are the complete skill vocabulary of the starting content** (D-200) — wide and shallow, so promotion is legibly a narrowing.
* **Specialist skills are unlocked by promotion**, not by theme or rarity (D-201). The job tree is the skill unlock tree.
* **No slot is protected** (D-199), and **Recruit is a waiting room, not a permanent role** (D-202) — which puts foundation coverage entirely on the job tree. See §4.4.

*Open:* the list itself. See [`playmat_skills_concept.md`](playmat_skills_concept.md) §6.

### 4.2 Roster Cap and Recruitment
✅ **D-181** — **The roster runs from 1 hero at the start to roughly 8 at the end.**

⚠️ **This is less than half what the board document assumes, and it breaks a stated constraint** — §5's first entry required 10–20 placed heroes, warning that far fewer "leaves a dead board". That warning needs testing rather than ignoring:

```
48 usable tiles, 8 heroes
   8 worked tiles ............... 17% of the board
  40 tiles of everything else ... 83%
```

**The board fills with support rather than workers**, at roughly **three support Tokens per worked Token** — context defining recipes, buffs, a Manager, a passive generator or two. Eight clusters of four tiles is 32, plus the Guild Hall and some standalone passives puts a mature board near 40 of 48.

**That is a feature, not filler.** Every support Token is a placement the player chose: which recipe this station runs, what buffs it, what keeps it stocked. A board of 8 workers and 32 support pieces is 40 decisions, not 8 decisions and 32 pieces of scenery.

*Board size and roster ceiling are both explicitly tunable late in development.* If the ratio proves wrong in play, either number can move — they are balance dials, not structural commitments.

**What the smaller roster buys is worth the risk:**
* **Eight named people is a cast you can hold in your head.** The colony-sim failure mode disappears entirely.
* **Chain depth becomes a much sharper decision.** A five-step chain costs five of eight heroes — 62% of the entire guild for one output, against 33% at a roster of 15. §6.2's central constraint gets considerably stronger.
* **Recruitment becomes a milestone.** Seven acquisitions across a whole game means each one is an event, not a transaction — which repairs D-73's accepted cost that "recruits are fungible". At this scale each new person matters regardless of being a blank slate.

*Still open:* what gates each of the seven recruitments, and what they cost. Guild Upgrades are the obvious home (D-163 already has a Roster track), but milestone-gating would suit "each one is an event" better than simply paying gold.

### 3.7 Food, Drink and Energy
✅ **D-183** — **Energy is cut. Food and drink both restore HP.**

Energy was a per-hero stamina resource consumed per task. It is gone entirely — nothing meters how much work a hero can do, only how much punishment they can take.

**Food and drink converge on one job: healing.** With `RegenSystem` already restoring HP passively (D-136), consumables are the *fast* heal — which makes them a combat resource rather than a maintenance chore. Nothing depends on them, so **the old death-spiral risk cannot recur**: an unfed hero simply heals slowly instead of quickly.

*Why cutting Energy is safe:* nothing else in the design depended on it. Skill Efficiency (D-67) governs *input* consumption, not stamina; the pacing constraint is D-164's cycle time; and the throughput ceiling is roster size (D-181). Energy had no remaining job.

⚠️ **What is still open is *when* a consumable gets used** — and it is the more interesting half of the question. See §4.7.

### 4.4 Job Tree Contents
Which basic classes exist, how they branch, what each job grants and removes, and what promotion costs. Structure is locked by D-70; contents wait on the skill list.

### 4.5 The Hero Dock
🔶 **Deferred here from the UI document.** The Dock holds unplaced heroes *and* is where jobs, skills and equipment are managed — for a roster of 15–20. It was already flagged as awkward when it held three heroes with six slots each.

Its shape depends on what heroes turn out to need managing. The structural facts it must accommodate: unplaced heroes live there (D-76), heroes are drawn as their job (D-75), **equipment is a 9-slot grid** (D-184), and idle heroes carry a bright yellow mark (D-172).

⚠️ **Nine slots across eight heroes makes this heavier than it was.** The Dock is now the surface for 72 equipment decisions, plus jobs, skills and promotions — for a roster of named individuals the player is meant to care about. This is the largest remaining hero question.

Candidate shapes already considered: a compact strip for placing plus a full-screen roster view for managing; an expandable Dock that grows upward over the board; or a placement-only strip with roster management behind its own nav bubble.

### 3.8 Consumables Fire at the Start of a Fight
✅ **D-186** — **When combat begins, the hero automatically uses one of every consumable they carry.** Each applies a status effect — to the hero or to the enemy — that lasts for **the whole fight** and ends with it.

```
Bren enters combat carrying:
  Firebrand Draught  → +30% damage, this fight
  Bitter Tonic       → enemy attacks slowed, this fight
  Hearty Stew        → heals him to full at the outset
→ all three fire at once, automatically
```

**This resolves the timing problem by finding the one moment every consumable naturally has.** A fight has a beginning; a Token cycle does not have a comparable threshold. Every constraint the question set is met:

| Constraint | How |
| :--- | :--- |
| No micromanagement | Equip once; it fires every fight thereafter |
| Supports varied effects | Buffs, debuffs and heals all have the same trigger |
| Works unattended | Combat continues while the player is away |
| No menu | The loadout *is* the configuration |

**It also gives D-184's nine flexible slots a real decision.** A slot spent on a consumable is a slot not spent on gear, so a hero's loadout becomes a stance: *permanently stronger* versus *stronger in every fight*. Two heroes with identical jobs can be built entirely differently.

✅ **D-187** — **Consumables are bulk goods.** A single crafting cycle yields many — one herb and one reagent making twenty potions is the intended scale.

This follows directly from D-186: if every fight consumes one of each carried consumable, demand is continuous and high. Producing them one at a time would make the alchemy and culinary chains a bottleneck rather than a supply. **Consumables are ammunition, not treasures.**

> **Consequence for the economy:** combat becomes a genuine, permanent sink for the culinary and alchemical chains — something they lacked entirely once Energy was cut (D-183). The more a player fights, the more those production lines matter.

### 3.9 A Slot Is a Link, Not a Container
✅ **D-188** — **An equipped consumable is a pointer to the Bank, not a stack the hero carries.** The slot names a *type*; each trigger draws one from the global Bank.

* **Equip once and never touch it again.** The slot never empties or needs reloading.
* **An empty Bank is graceful, not a stop.** The hero fights without that buff and resumes the moment supply returns — exactly how Tokens behave when starved of inputs (D-24, D-48).
* ⚠️ **Heroes share one stockpile.** Two heroes carrying the same potion burn through it twice as fast; four burn it four times as fast.

> That last point is the interesting one. **Consumable supply becomes a roster-wide budget rather than a per-hero one** — outfitting every hero with the same premium draught quadruples its drain, so a player must either scale production to match or diversify what each hero carries. Scarcity emerges from the roster rather than from a rule.

### 3.10 Food and Drink Are Not Consumables
✅ **D-189** — **Food and Drink are their own category, separate from Consumables.** Consumables subdivide further — Potion, Scroll, Rune — and it is *those* that D-186's fight-start rule governs.

| Category | Purpose | Trigger |
| :--- | :--- | :--- |
| **Gear** | Permanent stats | Always on |
| **Food / Drink** | Restore HP (D-183) | ⚠️ Open (§4.7) |
| **Consumables** — Potion, Scroll, Rune | Status effects on hero or enemy | Fight start (D-186) / production cycle (D-190) |

Keeping them separate is what lets healing have a trigger that suits healing without forcing every other consumable to share it.

### 3.11 Production Consumables Run on Duration
✅ **D-190** — **On a production Token, a consumable fires at the start, applies a status effect lasting a set number of work cycles, and fires again the moment that effect expires.**

```
Hero placed on the Forge
  → Craftsman's Tonic fires  → [Haste] for 20 cycles
  → 20 cycles elapse, Haste expires
  → another Tonic fires automatically
  → repeats while the hero remains
```

**The duration is what makes this affordable.** A per-cycle trigger would consume an order of magnitude more than combat does — eight heroes at a 20-second cycle would burn forty consumables a minute. A tonic lasting twenty cycles is roughly one every seven minutes per hero, which bulk production (D-187) can comfortably sustain.

✅ **D-191** — **Status effects split into production and combat families**, both carried by the existing status-effect engine. *Haste* speeds production; *Aggression* speeds attacks. A consumable's family determines where it does anything at all.

*This gives the status engine a substantial new job.* It survives the rework intact and was previously only exercised by combat; now it carries the entire consumable layer on both sides of the board.

### 4.7 When Do Food and Drink Fire?
Consumables are settled (D-186, D-190). **Food and Drink are not** — they are a separate category (D-189) with a different job: restoring HP.

The fight-start trigger fits them badly. A hero at full health entering a fight would waste a meal, and healing is most valuable *while losing*, not before starting.

Candidates:
* **Fight start, but only when wounded** — same trigger, one condition. Nothing is wasted, and a hero tops up before each fight.
* **A mid-fight HP threshold**, as the old system used. Healing lands when it matters, at the cost of a second trigger rule.
* **Out of combat only** — food is what an idle hero eats, accelerating the passive regen that already exists (D-136). Potions fight; food recovers.

### 4.8 Smaller Open Items
* Does a Buff Token adjacent to two heroes affect both?
* ~~Which skill governs working a Map?~~ — **none.** D-142 removed hero-time from Maps entirely; they are opened by the player, not worked.
* How heroes gain combat XP, given each holds exactly one combat skill (D-196).
* Whether promotion consuming gear is the answer to §3.5's quiet crafting chain — now partly answered by D-197, which moves all defensive building onto equipment and so gives armour crafting permanent demand.

---

## 5. Constraints the Board Design Imposes

The hero design is free to change a great deal, but the board depends on these holding. Breaking one means reopening a board decision.

| # | Constraint | Why the board needs it |
| :--- | :--- | :--- |
| 1 | ~~Roster stays around 10–20.~~ **REVISED by D-181 to ~8.** The board's equation still holds (*worked tiles = placed heroes*), but at 8 the board needs a **~3:1 support-to-worked ratio** to stay full. Far *more* heroes would remove hero-time as the scarce resource and collapse §6.2's chain-depth constraint. | Content must supply enough context, buff, Manager and passive Tokens to fill ~40 of 48 tiles around 8 worked ones. |
| 2 | **Heroes remain the best way to work a Token.** | Passive Generators are deliberately inefficient so that heroes stay the ceiling. If heroes become weak or expensive enough that unstaffed Tokens compete, the board's core pressure inverts. |
| 3 | **Skill "Access" gating survives.** | Minimum skill requirements on Tokens are what make levelling necessary, and they are the only mechanism gating a player from working high-tier content early. |
| 4 | **The post-kill rest must stay a hard floor on time-per-kill.** | Hero power *should* shorten fights — that is the point of investing in a hero. What D-103 protects is the **ceiling**: an over-levelled hero one-shotting weak enemies still waits out the rest. A hero mechanic that removes or bypasses the rest would make farming trivial content unbounded. |
| 5 | **A hero's board sprite must read as their job.** | The board's legibility at a glance depends on it (D-75). |
| 6 | **Anything consumed continuously needs a free foundation.** | The board guarantees no supply deadlock because base Tokens need no inputs. A per-hero continuous consumable reintroduces that risk through the roster (§4.3). |
