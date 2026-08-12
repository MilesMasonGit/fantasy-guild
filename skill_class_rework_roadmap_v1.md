# Roadmap v1: The Skill & Class Rework

The implementation plan for the 27-skill list and the 19-entry job tree. Written
against [`skill_class_rework_brief.md`](skill_class_rework_brief.md)
(**D-248…D-265**, the authoritative decisions),
[`playmat_skills_concept.md`](playmat_skills_concept.md) (D-192…D-213, the rules
about what a skill *is*), [`playmat_hero_concept.md`](playmat_hero_concept.md)
§3.2a–3.3, and the code as it stands at `v0.5.0`.

> [!IMPORTANT]
> **[`skill_color_pie_concept.md`](skill_color_pie_concept.md) is the vision, not
> the spec.** It contradicts itself in six places; all six are resolved in the
> brief's §7, and the source doc has **not** been edited. Where the two disagree,
> **the brief wins and this roadmap implements the brief.** Do not author from
> the colour-pie doc's §2 taxonomy — it is thematic grouping with no structural
> weight (D-255).

> [!NOTE]
> **The shape of the job, in one paragraph.** Heroes stop holding all 15 skills
> and start holding 6 of 27. Class stops being a cosmetic roll and becomes the
> thing that decides which 6. The engine gains a **possession** check it does not
> currently have, Defense folds into the single combat skill, and a **promotion
> system that does not exist today** gets built. The list is cheap; the tree is
> the work.

> [!IMPORTANT]
> ## The content is a first draft. The system is the deliverable.
> *(Owner, 2026-08-12.)*
>
> **§1's 27 skills and §2's 19 job sheets are expected to change during
> development** — which skills exist, what each class holds, and what the classes
> even are. This rework exists to make the **system** work, not to lock the
> content.
>
> **What that changes about how it gets built:**
> * **Nothing may hardcode the list.** No `if (skill === 'mining')`, no fixed
>   grid sizes derived from a skill count, no switch on class id. The UI reads
>   whatever the registry holds — 6 skills or 9, 19 jobs or 25.
> * **Adding, renaming or moving a skill between layers must be a data edit**
>   in one file, with no code change anywhere.
> * **Re-parenting a job, changing which skills it grants, or adding a
>   thirteenth must likewise be data.** §3's coverage audit becomes a *test*
>   (Phase 4) precisely so the tree can be rearranged safely afterwards.
> * **Do not over-invest in content polish in Phases 3 and 4.** Author what is
>   needed to prove the system runs, and expect to redo it.
>
> This continues the standing "content is disposable" decision from the 15-skill
> rework. If a phase's work would make a content change expensive, the phase is
> built wrong.

---

## Implementation Status *(update this as work progresses)*

> [!TIP]
> **For future sessions: check this table first.** When you finish a phase,
> change its status here and note the date + branch/commit. If you stop
> mid-phase, mark it **In Progress** and leave a one-line note about where.

| Phase | Status | Notes |
|---|---|---|
| Planning — brief & decisions | ✅ Done (2026-08-11) | [`skill_class_rework_brief.md`](skill_class_rework_brief.md), D-248…D-265 |
| Planning — this roadmap | ✅ Done (2026-08-11) | Job sheets in §2, coverage audit in §3, content gaps in §4 |
| **Pass 1 — The List** | | |
| 0 — Safety, branch & version | ✅ Done (2026-08-12, `skill-class-rework`) | **Tests 46 files/650 → 47/659, all green**; `npm run build` clean. Version 0.5.0→0.6.0 across all five files (⚠️ `Cargo.lock` holds a *second* `version = "0.5.0"` under `dirs-sys` — matched the `[[package]] name = "app"` block only); `GAME_VERSION` 0.6.0→**0.7.0**. New `SkillClassBaseline.test.js` (9) re-pins what Phases 1–2 relocate. **It found a real hole:** `BoardRunner.heroMeetsRequirement` returns early on `skillRequired <= 0` and never consults the skills map, so a hero who does not hold the skill works the Token — harmless today, a hole straight through possession once heroes hold 6 of 27. Pinned by a passing test that Phase 1 must flip. ⚠️ Scope correction: **4** `defense` touch points in `CombatFormulas.js`, not 3, plus the XP award and `calculateHeroLevel` — but `CombatFormulas.test.js` already pins most of Phase 2's behaviour. ⚠️ Old skill ids are referenced widely across the suite (`labor` ×9, `aquatic` ×8, `forge` ×7, `defense` ×7, `social` ×6, `explore` ×5) — Phase 1 is a wide, shallow sweep. ⚠️ **All decision ids renumbered +11** (D-237…D-254 → D-248…D-265); the merge brought real D-237…D-247 with it. Verified in browser: new game boots (1 hero, 15 skills, 120g, 4 Tray Tokens), writes a save at **0.7.0**, and a planted **0.6.0** save is **refused** with "This save is from a previous version and cannot be loaded" — SYSTEM BOOT stays up and the old save is **not overwritten**. Console clean. |
| 1 — The skill registry & possession gate | ✅ Done (2026-08-12, `skill-class-rework`) | **Tests 650 → 663 across 47 files, all green**; build clean. 27 skills in four layers, `SUB_SKILL_TO_PARENT` deleted, heroes generate as **Recruits** (Foundation six). `ALERT.UNSKILLED` added — possession and level are now different marks with different wording. ⚠️ **Scope moved deliberately, see §5.1a**: the Token re-key came *forward* from Phase 3 (leaving it there would have left every Token demanding a deleted skill), and `calculateHeroLevel` came forward from Phase 2 (Phase 1 made every hero read level 0). ⚠️ **Two real bugs found**: `EquipmentValidator` read a now-`null` skill level, so a Recruit could not equip anything and the reason said "level too low" for something levelling cannot fix; and `RetirementFormula` divided by a **hardcoded 11** from the 15-skill system, which made retirement impossible at 6 skills. Verified in browser: a new hero holds exactly `mining, logging, fishing, smithing, crafting, cooking`; the Dock grid renders **6 cells, not 15**; a Recruit on a Woodland Still (now `alchemy`) raises **`unskilled`** with *"This hero doesn't have the skill for this work — levelling won't help"*; the same hero works an Oakwood Grove and banks 4 `logging` XP. ⚠️ A stale Vite module cache produced a blank page and phantom `SUB_SKILL_TO_PARENT` errors after the edits — clear `node_modules/.vite` and restart before believing a dev-server error in this rework. |
| 2 — Combat repoint & the Hero Level split | ✅ Done (2026-08-12, `skill-class-rework`) | **Tests 663 → 672 across 47 files, all green**; build clean. `defense` is gone from combat: one skill supplies attack, defence, max HP and block. **A Recruit cannot fight at all** — `BoardCombat` refuses to start a fight and the tile raises `UNSKILLED`. ⚠️ **Two judgement calls worth knowing**: a hero with no combat skill scores **0, not 1** (a floor of 1 would have made Recruits weak fighters rather than non-combatants) — but `heroMaxHpFromSkills` still floors at 1, because a Recruit stands on the board, takes environmental damage and heals, so 0 HP would make them unrepresentable. ⚠️ **Combat XP is now the full award into one skill, where it was 4/3 of the award across two** (style + a third into Defence); paying 4/3 into the single bar would have silently sped up combat levelling by a third. `DEFENSE_XP_SHARE` left as a commented tombstone. Unarmed heroes now fight in their own style rather than a hardcoded melee. Verified in browser: a Recruit on a Bear starts **no fight**, takes **no damage** (50/50 HP, `idle`), leaves the enemy at **25/25** charges and raises `unskilled`; granting Melee clears the mark, starts the fight **immediately** and the hero begins taking damage; a kill then awards **13 XP to `melee` and creates no `defense` skill**. |
| 3 — Content: re-key, and fill the Foundation holes | ✅ Done (2026-08-12, `skill-class-rework`) | **Tests 672 → 678 across 47 files, all green**; build clean. Three new Map-1 Tokens close the Foundation holes: **Trout Stream** (`fishing`, unlimited charges), **Stew Pot** (`cooking`), **Workbench** (`crafting`, sitting downstream of both Logging and Smithing so Crafting is where two chains first meet). Three Tokens left Map 1 for the Riverlands pool — Bramble Patch (`nature`), Woodland Still (`alchemy`), Lumber Market (`commerce`). ⚠️ **The opening Tray changed shape**: the Still used to teach "stations consume" and no Recruit can work it; swapping in the Stew Pot broke the chain (nothing caught shrimp), so the Copper Seam gave up its slot to the Trout Stream and the opening is now a real two-step — **fish → raw shrimp → Stew Pot → shrimp**. Mining is no longer in the opening; the Seam still arrives with the first Map. `OPENING_TRAY` is exported from `EngineBootstrap` so the tests read the real list rather than a copy — a duplicated list is exactly how the Still survived. **3 new content rules** make the constraint permanent: the first Map may demand only Foundation skills, every Foundation skill must have something to work on it, and the opening Tray must be workable by the one starting hero. |
| **Pass 2 — The Tree** | | |
| 4 — The job tree as data | ⬜ Not started | ✅ Unblocked — the Leadership imbalance is settled by **D-268** (§3.2), evening every shared specialist to exactly 4 of 12 jobs |
| 5 — Promotion, re-training & banking | ⬜ Not started | The bulk of the rework |
| 6 — Roster, recruitment & the Market shift | ⬜ Not started | |
| **Pass 3 — Presentation** | | |
| 7 — The hero card & inspection modal | ⬜ Not started | |
| 8 — The promotion & re-training screen | ⬜ Not started | |
| 9 — Base-class art | ⬜ Not started | 7 sprites (D-265) |
| **Pass 4** | | |
| 10 — Balance pass & report | ⬜ Not started | |

**Branch:** `skill-class-rework`, created off `main` at `804fe18` on 2026-08-12,
after `token-object` fast-forwarded into `main`. Do not implement on `main`.

**Every phase ends with:** `npm test` green, the game exercised in the browser, a
`CHANGELOG.md` entry under `## [Unreleased]`, and a commit. Report *what you
observed*, not that code was written.

**Version:** `package.json` 0.5.0 → **0.6.0** across all five files.
`GAME_VERSION` in `StateSchema.js` 0.6.0 → **0.7.0**. The save gate is a strict
`!==`, so the bump alone refuses every existing save — which is exactly what
D-253 asks for. No migration code.

---

## 1. The 27 Skills

**Ids matter.** Nine survive from the current registry, six are deleted, twelve
are new. Two survivors — `occult` and `science` — **keep their id but change
meaning**, which is safe only because saves are wiped (D-253).

### Foundation (6) — every Recruit holds all of them
| id | Name | Replaces |
| :--- | :--- | :--- |
| `mining` | Mining | `labor` |
| `logging` | Logging | part of `nature` |
| `fishing` | Fishing | `aquatic` |
| `smithing` | Smithing | `forge` |
| `crafting` | Crafting | *(new — was a sub-skill tag)* |
| `cooking` | Cooking | `cooking` *(unchanged)* |

### Combat (3) — exactly one per promoted hero
`melee`, `ranged`, `magic`. **`defense` is deleted** — the single combat skill
supplies both halves (D-197/D-260).

### Shared Specialist (6) — one per base class, and the T2 grants draw from here
`leadership`, `faith`, `nature`, `crime`, `enchanting`, `alchemy`.

`nature` **narrows**: logging leaves for its own skill; foraging and agriculture
fold in (D-256).

### Signature (12) — exclusive to one advanced job each (D-257)
`armory`, `construction`, `occult`, `inscription`, `beastmaster`, `survival`,
`commerce`, `brewing`, `summoning`, `astrology`, `science`, `engineering`.

### Deleted (6)
| Old id | Goes where |
| :--- | :--- |
| `labor` | → `mining` |
| `aquatic` | → `fishing` |
| `forge` | → `smithing` |
| `defense` | → folded into the hero's combat skill |
| `explore` | → `survival` (Scout signature) |
| `social` | → `commerce` (Merchant signature) — **a promotion, not a rename** |

**`SUB_SKILL_TO_PARENT` is deleted entirely.** Sub-skills stop being a levelling
mechanism. If any name is still wanted as a content label, it becomes a tag with
no XP behaviour.

---

## 2. The Job Tree — 19 Entries

Reading: **2 Foundation · 1 Combat · 2 Shared · 1 Signature = 6** at Tier 2.

### Tier 0
**Recruit** — `mining` `logging` `fishing` `smithing` `crafting` `cooking`.
No combat skill. **Cannot fight** (D-249).

### Tier 1 — the 6 base classes
*4 Foundation · 1 Combat · 1 Shared*

| Class | Combat | Shared | Foundation kept | Dropped |
| :--- | :--- | :--- | :--- | :--- |
| **Fighter** | `melee` | `leadership` | mining, logging, smithing, crafting | fishing, cooking |
| **Cleric** | `melee` | `faith` | mining, smithing, crafting, cooking | logging, fishing |
| **Ranger** | `ranged` | `nature` | logging, fishing, crafting, cooking | mining, smithing |
| **Rogue** | `ranged` | `crime` | mining, logging, fishing, crafting | smithing, cooking |
| **Wizard** | `magic` | `enchanting` | smithing, fishing, crafting, cooking | mining, logging |
| **Alchemist** | `magic` | `alchemy` | logging, fishing, crafting, cooking | mining, smithing |

### Tier 2 — the 12 advanced jobs
*2 Foundation · 1 Combat · 2 Shared · 1 Signature*

| Job | Parent | Foundation | Combat | Shared ×2 | **Signature** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Knight** | Fighter | mining, smithing | melee | leadership, faith | **armory** |
| **Warlord** | Fighter | mining, logging | melee | leadership, crime | **construction** |
| **Zealot** | Cleric | mining, smithing | melee | faith, leadership | **occult** |
| **Paladin** | Cleric | smithing, cooking | melee | faith, **enchanting** | **inscription** |
| **Druid** | Ranger | fishing, cooking | ranged | nature, alchemy | **beastmaster** |
| **Scout** | Ranger | logging, crafting | ranged | nature, **crime** | **survival** |
| **Merchant** | Rogue | mining, logging | ranged | crime, leadership | **commerce** |
| **Assassin** | Rogue | fishing, crafting | ranged | crime, alchemy | **brewing** |
| **Conjurer** | Wizard | smithing, fishing | magic | enchanting, faith | **summoning** |
| **Astromancer** | Wizard | crafting, cooking | magic | enchanting, **nature** | **astrology** |
| **Scientist** | Alchemist | fishing, cooking | magic | alchemy, enchanting | **science** |
| **Engineer** | Alchemist | logging, crafting | magic | alchemy, nature | **engineering** |

Every job's 2 Foundation skills are a subset of its parent's 4 — **verified, all
twelve.** A promotion never grants back something the previous tier dropped.

---

## 3. Coverage Audit

This is the check the hero doc calls "load-bearing" (constraint 1: the job tree
must keep the Foundation six collectively covered by a fully-promoted guild).

### 3.1 Foundation coverage — perfect, by construction

| Skill | Advanced jobs holding it | Count |
| :--- | :--- | :--- |
| `mining` | Knight, Warlord, Zealot, Merchant | **4** |
| `logging` | Warlord, Scout, Merchant, Engineer | **4** |
| `fishing` | Druid, Assassin, Conjurer, Scientist | **4** |
| `smithing` | Knight, Zealot, Paladin, Conjurer | **4** |
| `crafting` | Scout, Assassin, Astromancer, Engineer | **4** |
| `cooking` | Paladin, Druid, Astromancer, Scientist | **4** |

24 slot-instances, **exactly 4 jobs per Foundation skill.** A 12-hero guild can
cover all six with room to spare, and even a 6-hero guild would have to choose
badly to lose one. **No authoring change needed.**

### 3.2 ✅ Shared-specialist coverage — evened out (D-268)

**✅ D-268 — Every shared specialist is granted by exactly 4 of the 12 advanced
jobs.** *(Owner, 2026-08-12.)*

**The problem, as authored:** each job holds 2 shared skills — one inherited
from its parent class, one chosen at Tier 2. The inherited half is perfectly
even by construction (2 each), so the T2 pick is the only free variable — and it
landed on Leadership **5 times out of 12**. Net effect:

```
BEFORE     leadership 7 · faith 4 · alchemy 4 · nature 3 · crime 3 · enchanting 3
```

Leadership was held by more than half the tree while Nature, Crime and
Enchanting reached a quarter of it — making the most common shared skill also
the least special, and skewing which authored content ever gets played.

**The fix — three T2 swaps:**

| Job | T2 shared was | now | Why it reads |
| :--- | :--- | :--- | :--- |
| **Scout** | `leadership` | **`crime`** | Scouting is a stealth job |
| **Paladin** | `leadership` | **`enchanting`** | Consecrating and blessing gear |
| **Astromancer** | `leadership` | **`nature`** | Celestial cycles, seasons, star-guided growth |

```
AFTER      leadership 4 · faith 4 · nature 4 · crime 4 · enchanting 4 · alchemy 4
```

| Skill | Advanced jobs holding it | Count |
| :--- | :--- | :--- |
| `leadership` | Knight, Warlord, Zealot, Merchant | **4** |
| `faith` | Knight, Zealot, Paladin, Conjurer | **4** |
| `nature` | Druid, Scout, Engineer, Astromancer | **4** |
| `crime` | Warlord, Merchant, Assassin, Scout | **4** |
| `enchanting` | Conjurer, Astromancer, Scientist, Paladin | **4** |
| `alchemy` | Druid, Assassin, Scientist, Engineer | **4** |

*Why perfect rather than merely better:* every shared skill's content is now
seen by exactly a third of the tree, which makes the authoring budget uniform
and predictable — no skill is worth more or less authoring effort than another.
**Verified: no job holds the same skill as both its T1 and T2 grant.**

⚠️ *Accepted cost:* this departs further from the concept doc's authored intent
than the lighter two-swap option did. The rejected alternatives were a 3–5
spread (2 swaps, less churn, but Leadership stays the most common) and leaving
it at 3–7 (0 swaps, Leadership authored broad-and-shallow by design).

**Phase 4 is unblocked.** §2's Tier-2 table carries the swapped values.

### 3.3 Combat coverage — even
4 advanced jobs per style (`melee`: Knight, Warlord, Zealot, Paladin;
`ranged`: Druid, Scout, Merchant, Assassin; `magic`: Conjurer, Astromancer,
Scientist, Engineer). The RPS triangle (D-196/G5) has a full spread available at
any roster size ≥ 3.

---

## 4. ⚠️ The Content Gap — Read Before Phase 3

**Three of the six Foundation skills have nothing to work, and two have nothing
anywhere in the game.** This was found by mapping every skill-bearing Token in
`tokenRegistry.js` (19 of 38) onto the new list:

| Foundation skill | Map 1 Tokens | Map 2 | Verdict |
| :--- | :--- | :--- | :--- |
| `mining` | Copper Seam, Deep Mine | Silt Bed | ✅ |
| `logging` | Oakwood Grove, Yew Copse, Yew Stand, Heartwood, Windfall Timber | — | ✅ |
| `smithing` | Forge, Smelter, Deep Kiln, Charcoal Kiln | — | ✅ |
| `fishing` | **none** | River Delta (skill 14) | ⚠️ **dead on Map 1** |
| `crafting` | **none** | **none** | ⚠️ **dead everywhere** |
| `cooking` | **none** | **none** | ⚠️ **dead everywhere** |

By D-193, a skill nothing works cannot level, cannot gate, and therefore cannot
exist. **Phase 3 is not a re-key — it contains genuine new content authoring:**
at minimum a Map-1 fishing resource, a Map-1 crafting station with its context
Token, and a Map-1 cooking station with its cookware context Token.

**Tokens that must leave Map 1** under D-261 (foundation-only):

| Token | Today | Becomes | Action |
| :--- | :--- | :--- | :--- |
| Bramble Patch | `nature` | `nature` (shared specialist) | Move to a later Map |
| Glowcap Hollow | `nature` | `nature` | Already Map 2 — stays, but now needs a Ranger line |
| Woodland Still | `alchemy` | `alchemy` (shared specialist) | Move to a later Map |
| Riverside Alembic | `alchemy` | `alchemy` | Already Map 2 |
| **Lumber Market** | `social` | `commerce` (Merchant signature) | **Leaves Map 1 entirely** (D-263) |
| River Market | `social` | `commerce` | Map 2 — but see risk 3 |

**Straight re-keys, no drama:** the five `nature` tree Tokens → `logging`; the two
`labor` mines → `mining`; the three `forge` stations → `smithing`; River Delta
`aquatic` → `fishing`. **Charcoal Kiln is the one judgement call** — it is
`labor` today, which is wrong under either list; it should be `smithing` (it
fuels the forge chain).

⚠️ **Map 1's gold rate must be re-measured after the Market leaves.** Phase 9 of
the playmat roadmap measured ~24 g/min and a ~3.3-minute path to the first Map
purchase *with* the Lumber Market present. That number is now void.

---

## 5. The Phases

### Pass 1 — The List

#### Phase 0 — Safety, branch & version

**Survey — ✅ done 2026-08-12 (read-only; nothing written).**

* **Baseline: 46 test files, 650 tests, all passing**, 30s. This is the number
  every later phase reports against.
* **The fixture split is real and sufficient.** `src/tests/fixtures/testTokens.js`
  is imported by **9 engine suites** — `TokenCycle`, `AdjacencyEffects`,
  `Managers`, `TokenBank`, `Consolidation`, `Placement`, `Market`, `BoardCombat`,
  `Risk13Allocation` — and its header states the rule outright: engine suites run
  on fixtures, `ContentRules.test.js` runs on shipped content. **Risk 6 is
  mitigated.** ⚠️ *But the fixtures carry skill ids too* (`nature` ×4, `forge`
  ×2, `labor` ×2, `alchemy`, `social`), so Phase 3's re-key touches this file as
  well. It is a one-line-per-fixture edit, not a test rewrite.
* ⚠️ **Correction to the scope estimate: it is not "three `defense` reads".**
  `CombatFormulas.js` has **four** touch points — `getHeroDefenseSkill`,
  `heroMaxHpFromSkills` (which *also* averages `COMBAT_SKILL_IDS`, so it changes
  twice over), `getHeroBlockChance`, and `calculateHitChance`'s
  `defenderDefense` parameter threaded from every caller — plus
  `CombatResolutionProcessor.js:41`'s `DEFENSE_XP_SHARE` award and
  `HeroGenerator.calculateHeroLevel`. **Phase 2 is larger than the brief
  implied**, though still small in absolute terms.
* **Re-pin surface, and what already covers it.** `CombatFormulas.test.js`
  already pins `heroMaxHpFromSkills` (level-1 → 50 HP), innate Block from
  Defense, and the hit-chance shift — so **most of Phase 2's behaviour is
  already captured.** What is *not* pinned and must be written in Phase 0:
  `calculateHeroLevel`, and `BoardRunner.heroMeetsRequirement`'s level-only gate
  (the rule Phase 1 replaces).
* ⚠️ **Old skill ids are referenced across the test suite**, not just in
  fixtures: `labor` ×9, `aquatic` ×8, `forge` ×7, `defense` ×7, `social` ×6,
  `explore` ×5. All six are being deleted. Phase 1 must expect a wide but shallow
  test sweep.

**Remaining — ⬜ blocked on the branch decision (§5.0a below).**

* Branch `skill-class-rework`.
* Version 0.5.0 → 0.6.0 in all five files; `GAME_VERSION` → 0.7.0.
* Write the two missing re-pin tests named above.
* **Exit:** game boots, an existing save is refused with the version message,
  tests green at ≥ 650.

#### 5.0a ⚠️ The branch decision — blocking Phase 0's write half

`token-object` is **2 commits ahead of `main`** (`5308b62`, `472479c`) and **has
not been merged**. It carries the R-1…R-4 playmat refinements. There are also
**5 uncommitted files** in the working tree belonging to another session's
in-flight work (Artist persona/skill docs, `watch_assets.js`, `cms/vite.config.js`,
one line of `tokenRegistry.js`).

**Nothing may be written until this is settled**, because switching branches with
another session's uncommitted work in the tree would disrupt it, and committing
on `token-object` would mix this rework into their work.

**✅ Decided 2026-08-12 (owner):**

1. **The other session commits its 5 files first.** This session does not touch
   them and does not commit on their behalf.
2. **`token-object` merges into `main`.**
3. **Then** `skill-class-rework` is created **off `main`**, per the repo rule
   that new work starts from `main`.

**The go signal is:** `git status` clean, and `git log --oneline main -1` showing
the token-object work. Until both are true, Phase 0's write half does not start.

*Why this and not the faster options:* branching off `token-object` would build a
large rework on unreviewed, unmerged work; branching off `main` immediately would
omit the R-1…R-4 refinements and force a messy `tokenRegistry.js` and UI merge
later. Waiting costs time and nothing else.

#### Phase 1 — The skill registry & possession gate
* `skillRegistry.js` rewritten: 27 skills, four layers, `SUB_SKILL_TO_PARENT`
  deleted, `COMBAT_SKILL_IDS` down to three.
* `HeroGenerator.js`: heroes generate as **Recruits with the Foundation six**,
  no random class, no random trait. `traitRegistry.js` deleted.
* `SkillSystem.js`: **possession** — `hero.skills[id]` being absent is now a
  meaningful state, not a bug. `meetsRequirement` fails closed on it.
* `BoardRunner.js`: `heroMeetsRequirement` gains a possession branch, and
  `ALERT` gains a reason distinct from `ACCESS` — *"this hero can't do this
  work"* is a different problem from *"this hero isn't good enough yet"*, and
  D-149's alert mark must say which.
* **Exit:** a Recruit on a `nature` Token raises the new alert; a Recruit on a
  `logging` Token works it.

#### 5.1a ⚠️ Two scope moves made during Phase 1

Both were forced by sequencing errors in this roadmap, not by preference.

1. **The Token re-key moved from Phase 3 into Phase 1.** Phase 1 deletes six
   skill ids that every Token in the game referenced. Had the re-key waited,
   the game would have booted with *every* producer unworkable between the two
   phases. **Phase 3 keeps the part that is genuinely new authoring** — the
   Foundation holes (fishing/crafting/cooking Tokens) and the Map 1 reshuffle.
2. **`calculateHeroLevel` moved from Phase 2 into Phase 1.** A Recruit holds no
   combat skill, so the old "average the four combat skills" returned **0 for
   every hero** the moment Phase 1 landed. Phase 1 caused it, so Phase 1 fixed
   it. The `CombatFormulas` `defense` reads are untouched and remain Phase 2.

**Also deferred out of Phase 1 deliberately:** `classId`, `traitId` and
`traitRegistry` are untouched. The roadmap had them here, but they are inert
cosmetic rolls that hero sprites and the Dock read; replacing them is the job
tree's work in Phase 4, and doing it early would have broken visuals for no gain.

#### Phase 2 — Combat repoint & the Hero Level split
* Three `defense` reads in `CombatFormulas.js` → the hero's single combat skill.
* `calculateHeroLevel` → **average of the hero's 6 held skills** (D-260).
* The combat engine stops reading Hero Level anywhere it meant "combat level".
* `CombatResolutionProcessor`'s `DEFENSE_XP_SHARE` split disappears; all combat
  XP goes to the one combat skill. **Re-tune the award** — a hero now levels one
  combat skill where they levelled two.
* **Exit:** a Recruit has no combat skill and cannot fight at all; a Fighter
  attacks *and* defends off `melee`; a hero who only mines has a rising Hero
  Level and unchanged max HP.

#### Phase 3 — Content: re-key, and fill the Foundation holes
* Re-key the 19 skill-bearing Tokens per §4.
* **Author the missing Map-1 content**: a fishing resource, a crafting station +
  context, a cooking station + context.
* Move Bramble Patch and Woodland Still off Map 1; remove the Lumber Market from
  Map 1's kit.
* Re-check the D-122/D-123 starting state — the four starting Tokens must all be
  workable by a Recruit.
* **Exit:** a new game is playable start to finish on Foundation skills only; all
  six Foundation skills have something to work on Map 1; Map 1's gold rate
  re-measured and recorded.

---

### Pass 2 — The Tree

#### Phase 4 — The job tree as data
⚠️ **Blocked on §3.2's Leadership decision.**
* `classRegistry.js` replaced by a job registry: 19 entries, each with parent,
  granted skills, removed skills, prerequisites, cost, perks.
* No UI, no promotion logic — data plus a validator.
* **Write the coverage audit as a test.** §3.1's "4 jobs per Foundation skill"
  and §3.2's spread should be asserted, so a future content edit that breaks
  coverage fails loudly instead of quietly.
* **Exit:** every job resolves to exactly 6 skills; every T2 job's Foundation
  pair is a subset of its parent's four; all 12 signatures are unique.

#### Phase 5 — Promotion, re-training & banking
**The bulk of the rework.**
* Promotion: threshold on the skills the job carries forward, plus a resource
  cost (D-262).
* **Re-training as a first-class action** (D-248) — it is the only respec the
  player has, not an edge case.
* Banking: removed skills go dormant **at their level** and return intact
  (D-71). Banked state persists through save/load.
* **Exit:** a Recruit promotes to Fighter and loses Fishing and Cooking at their
  levels; re-training to Cleric restores Cooking at the banked level, not at 1;
  a full Recruit → Fighter → Knight run ends on exactly the §2 sheet.

#### Phase 6 — Roster, recruitment & the Market shift
* `guildUpgrades.js`: `roster_size` `maxRank` 5 → 7 (D-251, cap 12).
* Recruitment: recruits are Recruits — no class reveal, no trait reveal. The
  `revealType` machinery in `HeroGenerator` goes.
* Markets demand `commerce` (D-259). Confirm raw selling
  (`CommerceSystem.sellItem`) carries the early economy.
* **Exit:** 12 heroes fieldable; a Market with a non-Merchant on it raises the
  possession alert; selling from the Bank still works with no hero.

---

### Pass 3 — Presentation

#### Phase 7 — The hero card & inspection modal
* `DockSkillsGrid.jsx` is hardcoded to 15 cells in a 5×3 — replaced by a 6-skill
  layout. **Banked skills are hidden here** (D-250).
* The inspection modal shows held skills **and banked skills greyed** (D-250),
  plus the hero's job and where they sit on the tree.
* 12 heroes × 6 skills = 72 values on screen. **Run the clutter check** the
  playmat roadmap established — count competing elements, don't eyeball it.

#### Phase 8 — The promotion & re-training screen
* The tree, what each job grants and takes, what it costs, what the hero would
  keep and bank. Re-training presented as the same act as promoting, not as an
  undo.

#### Phase 9 — Base-class art
* 7 sprites: Recruit + 6 base classes (D-265). Advanced jobs reuse their parent's
  until authored.

---

### Pass 4

#### Phase 10 — Balance pass & report
Deliverable is a written report, as with
[`playmat_balance_report_v1.md`](playmat_balance_report_v1.md). It must answer:
* **What does re-training cost?** D-248 makes this the load-bearing dial and no
  amount of paper settles it (§6, risk 4).
* Map 1's gold rate without a Market, and the real time-to-first-Map.
* How long until a first promotion, and does the Recruit stretch outstay its
  welcome.
* Whether 12 heroes × 6 skills reads or overwhelms.

---

## 6. Risks

| # | Risk | Where it bites | Mitigation |
| :--- | :--- | :--- | :--- |
| 1 | **The 27-skill authoring bill.** Every skill needs at least one Token (D-193) or it cannot exist. Today 6 skills have Tokens; the new list needs 27 covered eventually. | Phases 3 and 10, and every Map after | Author in waves — Foundation on Map 1 (Phase 3), shared specialists as their Maps land, signatures last. A skill with no Token is *allowed to wait*; it is only broken if a job grants it and nothing uses it. |
| 2 | **Leadership held by 7 of 12 jobs.** | Phase 4, and all later content authoring | §3.2 — decide before Phase 4. |
| 3 | **The first *usable* Market may be far later than Map 2.** D-263 puts Markets from Map 2 onward, but Commerce is two promotions deep (D-264). A player reaching Map 2 without a Merchant sees a Market they cannot run. | Phase 6, felt in Phase 10 | Watch it in the balance pass. If it bites, the lever is Map 2's Market placement, not D-257 — do not re-open exclusivity. |
| 4 | **Rigidity overshoots.** D-248 removes free re-slotting; if re-training is priced high, a mis-promoted hero feels bricked, which is the exact failure D-71 exists to prevent. | Phase 5, judged in Phase 10 | Ship re-training cheap and raise it. It is far easier to make a forgiving system harsher than to win back a player who felt punished. |
| 5 | **Two alert reasons that look the same.** "Can't do this work" and "not good enough yet" are different problems with the same visual budget (D-85 allows the tile three things). | Phase 1, surfaces in Phase 7 | Distinct reason ids from the start; the tile's mark and the inspection panel must both name which. |
| 6 | **Engine tests pinned to shipped content.** Phase 9 of the playmat roadmap lost an hour to this at 23 Tokens. | Phase 3 | Believed mitigated by `src/tests/fixtures/testTokens.js` (commit `261d06b`). **Phase 0 verifies it rather than trusting it.** |
| 7 | **`occult` and `science` keep their ids but change meaning.** Any content still referencing them silently means something new. | Phase 1 | Saves are wiped (D-253) and content is re-keyed in Phase 3. Grep both ids before closing Phase 3. |

---

## 7. What This Roadmap Does Not Cover

* **Skill milestone perks** — deferred (D-204).
* **Minions** — they interact with the list (D-210/D-212) but are a separate
  feature.
* **The combat engine's internals** — the 7-stat model, statuses and the RPS
  triangle are untouched. Only *which skill* feeds them changes.
* **Advanced-job art** — 12 of the 19 sprites are deliberately out of scope
  (D-265).
* **The colour-pie supply web** (`skill_color_pie_concept.md` §4, §6, §7) — that
  is content authoring for the Maps that follow, and risk 1 is how it gets
  staged.
* **The CMS.** ~12 files import the skill list and the sub-skill editor
  (`SubskillEditor.jsx`, `SubskillManager.jsx`) is orphaned by the funnel's
  removal. **Not scheduled here** — the CMS has its own rework
  ([`cms_rework_roadmap_v1.md`](cms_rework_roadmap_v1.md)) and folding this into
  it is cheaper than doing it twice. ⚠️ The CMS will be broken against the new
  registry until then.
