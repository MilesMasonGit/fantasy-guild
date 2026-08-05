# Concept: Heroes

Heroes are the engine of the playmat economy. This document owns **what a hero is** — identity, skills, jobs, progression, equipment and recovery.

**It does not own how heroes interact with the board.** Placement, occupancy and work rules live in [`playmat_grid_concept.md`](playmat_grid_concept.md) §4, because they are board mechanics. §2 below summarises them as context and does not restate them as decisions.

Reasoning for every decision ID (D-nn) is in [`playmat_grid_decisions.md`](playmat_grid_decisions.md).

> **Status: IN PROGRESS.** §3 is settled. §4 is the open agenda for a dedicated design session. Nothing in §4 should be implemented until it is settled — but §3 and §5 are stable and can be built against.

---

## 1. The Core Tension

The existing game gives every hero a name, a portrait, a class, a trait, 15 skills, a 10-tier perk ladder and 6 equipment slots. That was built for a game with a handful of heroes.

**The board wants 10–20 of them.**

Those two facts do not fit together, and squeezing them is what this document is for. The tension is not merely administrative:

> A guild of a few named adventurers is an **RPG**. A roster of twenty interchangeable staff operating production tiles is a **colony sim**. How far heroes simplify decides which game Fantasy Guild is.

The direction taken so far is **simplify, but keep the guild fantasy** — which is why D-70's class tree exists. Heroes are not interchangeable staff; they are people you train into specialists. Every decision below should be checked against that.

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
**3–4 slots per hero**, retaining the item-tag rule preventing two of the same equipment type — no two pairs of gloves (D-65).

**Equipment is permanent.** Item durability is retired game-wide; Token depletion is the only wear mechanic (D-118). Gear therefore leaves the economy only through defeat-loss.

> **Consequence:** crafted gear is a **milestone purchase, not a consumable** (D-125). Demand comes from roster growth and from better recipes unlocking, not from wear. Gear crafting will go quiet between Map unlocks — if that reads as dead content, **promotion costs consuming gear** is the natural place to add demand, and it belongs to this document.

### 3.6 Defeat and Recovery
A hero reduced to 0 HP leaves the board, enters the existing **Wounded** state, and may lose equipment permanently. Their tile idles until re-staffed (D-74).

**Healing already exists and is unchanged.** `RegenSystem` restores HP to **idle** heroes, and a hero pulled off a Token is idle — so **retreating a wounded hero is the healing mechanic** (D-136). Withdraw, let them recover, send them back.

All combat risk is opt-in: enemies never initiate, and a hero only fights because the player placed them there. There is no difficulty warning and no skill gate on enemies — **risk is managed by attention** (D-130). Retreat is always available; leaving a hero unattended in a fight they cannot win means death.

### 3.7 Visual Identity
**Heroes are drawn as their job, not as individuals** (D-75). A Smith looks like a smith; a Ranger like a ranger. Portraits are not used on tiles.

At 15–20 heroes on small tiles over Token art, twenty distinct faces would be unreadable and would tell the player nothing useful. Job sprites make **the board self-documenting** — the whole staffing arrangement reads at a glance — and the art budget scales with the number of **jobs**, not the number of heroes.

---

## 4. Open — the Session Agenda

### 4.1 The Skill List
**To be designed from scratch, not migrated** (D-66). The existing 15 skills were sized for a three-hero game; at this roster they would mean 225–300 individually levelling bars.

Two constraints already bind it:
* Small enough to read across ~15 heroes.
* **Scoped by job** (D-68), so each hero displays only a handful regardless of how many exist in the world. This is what lets the global list be richer than any one hero's view of it.

*Open:* the list itself, how many a job grants, and whether there is a core set every hero shares.

### 4.2 Roster Cap and Recruitment
Roster size **is** the production ceiling, so this is an economic decision as much as a hero one.

*Open:* what caps the roster, how the cap grows, where new heroes come from, and what they cost. Guild Upgrades are the obvious home for roster growth, since they already exist and live on the Guild Hall tile.

*Constraint:* recruits are fungible (D-73), so recruitment is about quantity. If it needs to be more interesting than that, the lever is the **job tree** — a recruit arriving pre-trained or with a job already unlocked — not reintroducing random rolls.

### 4.3 Food, Drink and Energy
Energy is currently a live per-hero resource consumed per task, with automatic food/drink top-ups below a threshold.

*Open:* whether Energy survives at all, and how food and drink are consumed on a board where a hero works one Token indefinitely.

⚠️ **A previous attempt at this created a death spiral** — food short → heroes slow → food production slows → food shorter — with no free foundation to break it, because a hero standing on an input-free Token still needs feeding. Any model chosen here must show its recovery path.

*Note:* healing does **not** depend on this. `RegenSystem` already handles HP (§3.6). What food and drink would add is something *on top* of passive regen.

### 4.4 Job Tree Contents
Which basic classes exist, how they branch, what each job grants and removes, and what promotion costs. Structure is locked by D-70; contents wait on the skill list.

### 4.5 Smaller Open Items
* Does a Buff Token adjacent to two heroes affect both?
* Which skill governs working a Map?
* Do heroes gain XP from combat as well as from production, and on what basis?
* Whether promotion consuming gear is the answer to §3.5's quiet crafting chain.

---

## 5. Constraints the Board Design Imposes

The hero design is free to change a great deal, but the board depends on these holding. Breaking one means reopening a board decision.

| # | Constraint | Why the board needs it |
| :--- | :--- | :--- |
| 1 | **Roster stays around 10–20 placed heroes.** | The board's central equation is *worked tiles = placed heroes*. Far fewer leaves a dead board; far more removes hero-time as the scarce resource and collapses §6.2's chain-depth constraint. |
| 2 | **Heroes remain the best way to work a Token.** | Passive Generators are deliberately inefficient so that heroes stay the ceiling. If heroes become weak or expensive enough that unstaffed Tokens compete, the board's core pressure inverts. |
| 3 | **Skill "Access" gating survives.** | Minimum skill requirements on Tokens are what make levelling necessary, and they are the only mechanism gating a player from working high-tier content early. |
| 4 | **The post-kill rest must stay a hard floor on time-per-kill.** | Hero power *should* shorten fights — that is the point of investing in a hero. What D-103 protects is the **ceiling**: an over-levelled hero one-shotting weak enemies still waits out the rest. A hero mechanic that removes or bypasses the rest would make farming trivial content unbounded. |
| 5 | **A hero's board sprite must read as their job.** | The board's legibility at a glance depends on it (D-75). |
| 6 | **Anything consumed continuously needs a free foundation.** | The board guarantees no supply deadlock because base Tokens need no inputs. A per-hero continuous consumable reintroduces that risk through the roster (§4.3). |
