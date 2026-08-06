# Concept: Skills

This document owns **what a skill is** — what skills do, where their requirements live, and the shape of the world's skill list.

It does not own what a hero *is* (identity, jobs, promotion, equipment, recovery) — that is [`playmat_hero_concept.md`](playmat_hero_concept.md). It does not own Tokens or the economy — that is [`playmat_grid_concept.md`](playmat_grid_concept.md).

Reasoning for every decision ID (D-nn) is in [`playmat_decisions.md`](playmat_decisions.md).

> **Status: PAUSED — design-ahead, not a build target.** §1–§6 are settled *as design*. §7 is the remaining agenda: the list itself.
>
> ⚠️ **Nothing in this document is implemented in the first playmat build.** That pass **ports the existing 15-skill system** (`src/config/registries/skillRegistry.js`) unchanged, so existing card data keeps working through the card→Token conversion (D-79). **This postpones D-66 rather than violating it** — the redesign still stands, it just happens after the board is proven. See [`playmat_roadmap_brief.md`](playmat_roadmap_brief.md) §4.

---

## 1. What a Skill Is

**A skill is a lock. A hero's six slots are their keyring.**

This is not a stylistic framing — it is what the mechanics permit and nothing more. A skill does exactly three things (D-67): **Speed**, **Access**, **Efficiency**. All three are numbers on the hero, and all three are identical for every skill. Meanwhile the hero makes no decisions during a cycle — heroes never move themselves (D-59), tools are Tokens rather than hero property (D-117), inputs are pulled automatically (D-24), and there are no failure states: a Token either runs or waits (D-127).

**Therefore two production skills cannot play differently from each other.** Every difference you could invent between Fishing and Mining — bait, tools, yields, rare drops — is a property of the *Token*, and would work identically if the Token demanded the other skill.

This closes one question and opens a better one. The test for whether two skills should be separate is not *do they feel different*:

> **Two skills should be separate if, and only if, you want a hero to be able to do one but not the other.**

### 1.1 What Skill Granularity Actually Controls
✅ **D-203** — **Granularity is a dial on workforce rigidity, not on power or on content volume.**

Eight heroes holding six skills each can cover nearly every skill in a ~20-skill world. **Lockout is not the binding constraint and never was** — hero-time is (D-115). What granularity changes is something else:

```
COARSE skills → a fungible workforce.
                Any hero can be redeployed to any tile that needs staffing.

FINE skills   → a rigid workforce.
                Every hero has one post, and moving them starts a new skill at 1.
```

This is why granularity matters despite skills being mechanically identical. It sets **how much the board resists being reorganised**, which sharpens machinery the design already has: D-63 makes leaving a hero in place compound, and D-54/D-131 already charge a forfeited cycle for moving anyone. Fine skills turn that soft friction into a hard one.

**The chosen setting is moderate: heroes have a lane.** A hero can be redeployed within a family but not across one — a miner can work any mine, but putting them on a forge starts from zero.

---

## 2. The Game Has Exactly Three Verbs
✅ **D-192** — **A hero can gather, fight, or make. There is no fourth verb.**

This follows from the Token types that require a hero at all ([`playmat_grid_concept.md`](playmat_grid_concept.md) §3.1):

| Token type | Needs a hero? | Verb |
| :--- | :--- | :--- |
| **Resource** | Yes | **Gather** |
| **Enemy** | Yes | **Fight** |
| **Crafting Station** | Yes | **Make** |
| Context, Buff, Passive Generator, Structure | No | — |
| Map | No (D-142) | — |

Several activities that sound like verbs are not:

* **Trading is making.** A Market is a Crafting Station whose output happens to be currency (D-141).
* **Exploring is not an activity at all.** D-142 removed hero-time from Maps entirely — buying is a menu, opening is a click.
* **Processing and crafting are one verb.** A Charcoal Kiln and an Armoury are the same machine with different Context Tokens beside them.

### 2.1 Every Skill Must Key a Token
✅ **D-193** — **A skill with no Token to work cannot exist.**

D-63 levels skills through *use*. A skill nothing works can never level, so it can never gate, so it is a word rather than a mechanic.

⚠️ **This constrains the flavour space, and it should be entered knowingly.** A skill like Lore, Survival or Agility exists only if a Token is authored that requires it.

> **This is a rule about what *can* exist, not a verdict on particular names.** Crime, Explore and Social have no Token *today* — but if content gives them one, they are legitimate skills. Science and Occult were on exactly that footing until Minions (§6) gave both something concrete to make.

> The illustrative Recruit list in [`playmat_hero_concept.md`](playmat_hero_concept.md) §3.2a — *Labour, Combat, Lore, Scouting, Craft, Survival* — was written before this and is **not a candidate list**. Half of it cannot exist.

---

## 3. Where a Skill Requirement Lives
✅ **D-194** — **A Token requires exactly one skill.** One Token, one skill, one number, one reason it can fail.

✅ **D-195** — **Which object carries that requirement depends on the verb:**

| Verb | The requirement lives on | Consequence |
| :--- | :--- | :--- |
| **Gather** | **The Resource Token itself.** An Iron Mine demands Mining. | Resource Tokens have no Context Tokens (D-51: base Tokens take no inputs), so there is nowhere else for it to live. |
| **Make** | **The recipe** — the combination of adjacent Context Tokens that defines what the station produces (D-18). | A Forge with a Blade Schematic and a Forge with a Rune Schematic demand **different skills**. |
| **Fight** | **Possession of a combat skill**, with no level requirement. | See §4. |

**Putting the crafting requirement on the recipe is the most consequential call in this document.**

```
Forge + Blade Schematic   →  demands Weaponsmithing
Forge + Rune Schematic    →  demands Runecraft      ← same Token, different worker
```

Three things follow:

* **Skills join the adjacency game.** Moving a Context Token changes *who can work that tile*. This is the direct lever [`playmat_grid_concept.md`](playmat_grid_concept.md) risk 2 asks for — "if placement stops feeling meaningful, the answer is more recipe-defining context Tokens, not bigger buff numbers."
* **One station Token can host a dozen crafting skills**, so crafting depth costs recipes rather than Token types.
* **Re-tasking your workforce becomes a placement act.** Swapping a Schematic is how you point a specialist at different work.

⚠️ *Accepted cost:* what a tile demands is **no longer readable from the tile alone** — it depends on its neighbours. The inspection panel (D-145) and the alert mark (D-149) both have to state the skill, not just the shortage.

> **A recipe may be formed by several Context Tokens** (§5.1 of the board doc: an Iron Anvil *and* a Helmet Schematic drive one Forge). The skill therefore belongs to **the recipe**, not to each Context Token individually. Otherwise a second conflict rule would be needed on top of D-20's.

---

## 4. Combat Skills

✅ **D-196** — **There are three combat skills: Melee, Ranged and Magic. Every hero holds exactly one, and Recruits hold none.**

A hero's first promotion grants their combat skill. **An unpromoted hero cannot fight at all.**

### 4.1 Why One Style Per Hero Matters
The combat engine already runs a genuine **rock-paper-scissors triangle** between the three styles, shifting both hit chance and damage (`CombatFormulas.js` → `rpsOutcome`, `RPS_HIT_SHIFT`, `RPS_DAMAGE_SHIFT`). Today every hero holds all four combat skills and simply swaps weapons, so the triangle is nearly decorative.

**Locking a hero to one style turns it into a real matchup problem.** A melee hero is genuinely bad against certain enemies, and the answer is a different *person*, not a different sword.

> This is the **only place in the entire design where two skills produce different gameplay rather than different words** — and it costs nothing to build, because the triangle already exists.

*Consequence:* an eight-hero guild will want at least two, probably three, fighting styles covered.

### 4.2 Defence Folds In
✅ **D-197** — **There is no separate Defence skill. A hero's combat skill supplies both halves.** A Melee 30 hero attacks at 30 and defends at 30.

The engine currently reads `defense` for max HP, block chance and the defensive half of every hit roll. All three now read the hero's single combat skill instead.

*Consequence:* there is no way to build a tanky hero distinct from a damaging one **through skills**. Defensive building moves entirely to equipment — which gives D-184's nine slots a job and gives armour crafting permanent demand, partly answering the board doc's risk 12.

### 4.3 Enemies Gate on Possession, Never on Level
✅ **D-198** — *(amends D-130)* — **Whether a hero holds a combat skill decides *if* they can fight. How high it is never decides *whether*.**

D-130 stated there is no skill gate on enemies, because **risk is managed by attention**: no difficulty warning, no preview, retreat always available. That intent survives intact. A Recruit being unable to fight is a *possession* gate, not a difficulty gate — the game still never tells a player their hero is outmatched.

### 4.4 What Combat Skills Do Not Do
Combat skills are **not** D-67 skills. They feed the 7-stat engine directly and exercise almost none of the three effects:

| | Speed | Access | Efficiency |
| :--- | :--- | :--- | :--- |
| **Gather** | ✔ | ✔ | ✔ *(slower Token depletion)* |
| **Make** | ✔ | ✔ | ✔ *(fewer inputs, slower depletion)* |
| **Fight** | capped hard by D-103's fixed post-kill rest | possession only (D-198) | Enemy Token lasts more kills |

**The six-slot sheet therefore holds two different kinds of thing**, and this is deliberate rather than an oversight. Production skills are D-67 numbers; the combat skill is a combat-engine input. They share a container and a levelling mechanism, and nothing else.

---

## 5. The Shape of the List

### 5.1 Three Layers
✅ **D-205** — **The world's ~20 skills (D-185) fall into three layers with different owners:**

| Layer | Count | Held by | Granted by |
| :--- | :--- | :--- | :--- |
| **Foundation** | **6** | Every Recruit, by definition | The starting state |
| **Specialist** | **~11** | One or two per job | Promotion |
| **Combat** | **3** | Exactly one per promoted hero | The first promotion |

Nothing else can be in the list. Given D-192 and D-193, every entry is a gather key, a make key, or one of the three combat skills.

### 5.2 The Foundation Six
✅ **D-200** — **The Recruit's six skills are the complete skill vocabulary of the starting content.** Nothing in the opening game may demand a seventh.

This is what makes a Recruit a genuine blank slate rather than a pre-made choice: they are **wide and shallow**, able to do a little of everything badly. Promotion is then legibly a *narrowing* — you trade breadth for depth.

⚠️ It is also a hard authoring constraint on the first Map's content (D-108).

### 5.3 Specialist Skills Are Unlocked by Promotion
✅ **D-201** — **A specialist skill enters the player's guild when a hero is promoted into a job that grants it.** Not by reaching a theme, not by finding a rare Token.

```
Recruit → Druid   grants Nature
                  → the player can now work Nature Tokens
```

**The job tree is the skill unlock tree.** This gives the game a second progression axis running alongside Maps, and it is **player-driven rather than content-driven** — a Nature Token can sit on the board from the first hour, and the player unlocks it by deciding who to become.

*Consequence:* the failure mode of owning a Token you cannot work is real but always **self-inflicted and self-correctable**. The fix is a promotion, and promotions are reversible (D-71).

### 5.4 No Permanent Skills
✅ **D-199** — **Promotion can remove any skill. No slot is protected.**

A fully-promoted hero, after two promotions, holds:

```
2 foundation  +  3 specialist  +  1 combat  =  6
```

✅ **D-202** — **Recruit is a waiting room, not a permanent role.** Every hero is expected to promote eventually.

⚠️ **These two together put the entire coverage burden on the job tree**, and it is the largest authoring constraint this document creates. A fully-promoted hero keeps only 2 of the 6 foundation skills. Across eight heroes that is 16 foundation slot-instances against 6 foundation skills — ample, **but only if different jobs retain different ones.**

> **Authoring rule, load-bearing:** the job tree must be designed so that the foundation six stay collectively covered by a fully-promoted guild. This replaces the permanent-core-skill rule that was considered and rejected.

---

## 6. Minions — the First Authored Mechanic

**Minions are crafted Tokens that stand on another Token in the hero layer and work it in a hero's place.** Their board behaviour — charges, the Access cap, the speed penalty, Manager restocking, combat minions — is owned by [`playmat_grid_concept.md`](playmat_grid_concept.md) §3.5. This section owns only what they mean for the skill list.

### 6.1 Three Skills Make Them
✅ **D-210** — **Necromancy, Science and Nature.** Necromancy makes fighters; Science and Nature both make production workers, drawing on **different, non-overlapping skill pools** — a Tamed Monkey might carry Crime where no Science construct can.

**These are three skills rather than one, and §1's test is why.** The test is *"should a hero be able to do one but not the other?"* — not *"do they play differently"*, which no two production skills ever can. A Scientist cannot build a Tamed Monkey and a Beastmaster cannot build a Drill Drone, so the partition is real.

*What this rescues:* Science and Occult were flagged in §2.1 as surviving only if something concrete could be named that they **make**. Minions are that thing.

### 6.2 Minions Hold Ordinary Skills in Extraordinary Combinations
✅ **D-212** — **Every skill a minion holds comes from the ordinary list. There are no minion-only skills** — but a minion may hold **pairings no job grants.**

That is where their strategic distinctness lives: a minion is not merely a cheaper worker, it is a combination you cannot train into a person.

*D-194 is unaffected.* "One skill per Token" constrains **Tokens, not holders** — a two-skill minion simply satisfies more Tokens' requirements.

*Rejected:* **minion-only skills**, which would have given Science and Nature exclusive content and revived skills §2.1 killed — but a player who never takes Nature would be locked out permanently, with no in-game signal about what they were missing.

### 6.3 What Minions Cost the Design
Recorded here because both consequences bear on the skill list:

* **They partly undo D-203's rigidity.** Skill granularity exists to make the workforce rigid — heroes have a lane, and moving them costs. Minions are how a player buys out of that. This is legitimate as a *pressure valve* (Passive Generators are exactly that for chain depth), but specialisation only stays meaningful while minions stay expensive.
* **They are crafting's first exclusive content.** D-165 left crafting always dearer than the Map equivalent, which made it a consolation prize. **No Map sells a Drill Drone.** This is the strongest reason crafting has ever had to exist, and it stays consistent with D-162 because the *recipe* still comes from a Map.

### 6.4 What Minions Prove About the Method
Minions were the first mechanic run through this document's process, and the process worked in both directions. It caught two collisions that would otherwise have shipped — the Manager-restocking loop that deleted the roster ceiling, and combat minions idling the active half of the game — and it also **corrected this document twice**: §2.1's death list was too absolute, and §1's test was briefly misapplied to Science and Nature.

> **The register these specs use is per-Token variety plus an authoring convention, not category law** (D-97, and now D-213 for tools). A skill being primarily about one thing does not mean it cannot do others, and a Token needing a tool does not mean every Token of its type does.

---

## 7. Open — the Remaining Agenda

### 7.1 The List Itself
The structure is settled; the entries are not. What remains is **how many gathering skills and how many crafting skills**, and what they are.

**The derivation runs from the economy's sinks, not from flavour.** Every crafting chain must terminate in something the game consumes, and the board doc already fixes what those are:

| Sink | Demand profile | Decided by |
| :--- | :--- | :--- |
| **Gear** | Spiky — roster growth and defeat-loss only | D-125, D-74, D-184 |
| **Consumables** — potions, scrolls, runes | **Continuous and high volume** | D-186, D-187, D-190 |
| **Food and Drink** | Continuous | D-183, D-189 |
| **Gold**, via goods-specific Markets | Continuous, and the main one | D-141, D-128 |
| **Tokens**, via crafting | Late game only | D-144, D-148, D-165 |
| **Map material costs** | Continuous, small | D-100, D-150 |

A crafting skill that does not feed one of these has nothing to produce, and a gathering skill that does not feed a crafting chain has nowhere for its output to go. **The chains determine the skills.**

### 7.2 The Gathering / Crafting Balance
Whether gathering is shallow (~5) and crafting deep (~12), or the two are balanced, is **deferred until the chains are mapped**.

*What the mechanics currently favour:* crafting has recipes to subdivide (D-195) and gathering does not, so crafting can go deep at the cost of Context Tokens rather than Token types. Gathering can only be as fine-grained as the number of distinct materials.

### 7.3 Smaller Open Items
* Whether **skill milestone perks** exist at all. Deferred (D-204) — skill *acquisition* is currently the identity mechanism, and perks may not be needed.
* How **XP is earned from combat**, given a hero holds exactly one combat skill.
* Whether **Science and Occult** have descendants, which depends on whether anything concrete is named that they make.
* How the **inspection panel and alert mark** state a recipe-derived skill requirement (D-195's accepted cost).

---

## 8. Constraints This Imposes Elsewhere

| # | Constraint | Who it binds |
| :--- | :--- | :--- |
| 1 | **The job tree must keep the foundation six collectively covered** across a fully-promoted guild. | The job tree (hero doc §4.4) |
| 2 | **The first Map's content may demand only the foundation six.** | Content authoring (D-108) |
| 3 | **Every skill must key at least one Token type**, or it cannot level and cannot exist. | The skill list |
| 4 | **A Token's skill requirement must be visible before placement**, and the tile must state it when it blocks work. | UI (D-145, D-149) |
| 5 | **Enemy Tokens carry no skill level requirement**, only a combat-skill possession check. | Content authoring (D-130, D-198) |
| 6 | **The combat engine's `defense` reads must be repointed** at the hero's single combat skill. | Combat port (D-136, D-197) |
