# Skill & Class Rework — Brief

**Status: REVIEWED — 18 decisions locked 2026-08-11.** This is the plain-language
summary of what the rework is and what it is for. **The skill list and the class
tree's shape are now settled** (§4, §5). What it does *not* contain is the
per-job skill sheets, the Token authoring, or an implementation plan — those come
next, in the roadmap.

⚠️ **§8's decisions are provisionally numbered D-248…D-265 here.** They should be
promoted into [`playmat_decisions.md`](playmat_decisions.md) (the canonical
registry, which ends at **D-247**) when Pass 1 lands. Until then this file is
their only home.

> *Renumbered 2026-08-12.* These were first written as D-237…D-254, against a
> registry that ended at D-236. Merging `token-object` into `main` brought the
> R-1…R-4 refinement decisions **D-237…D-247** with it, so every id here shifted
> up by 11. Nothing else changed.

⚠️ **This brief supersedes [`skill_color_pie_concept.md`](skill_color_pie_concept.md)
wherever the two disagree.** The source doc contradicts itself in six places
(§7); all six are resolved here, and the source doc has not been edited.

**Sources this compresses:**
[`skill_color_pie_concept.md`](skill_color_pie_concept.md) (the new vision),
[`playmat_skills_concept.md`](playmat_skills_concept.md) (already-locked rules
about what a skill *is*), [`playmat_hero_concept.md`](playmat_hero_concept.md)
§3.2a–3.3 (already-locked rules about promotion), and the actual code as it
stands today.

---

## 1. Where We Are Today (verified against the code)

| Thing | Today's reality | File |
| :--- | :--- | :--- |
| **Skill count** | **15 parent skills** in 4 categories, plus ~40 sub-skill *tags* that funnel their XP into a parent (`mining` → `labor`). | [`skillRegistry.js`](src/config/registries/skillRegistry.js) |
| **Who holds them** | **Every hero holds all 15**, each levelling independently. Nobody is ever locked out of anything. | [`HeroGenerator.js:64`](src/systems/hero/HeroGenerator.js:64) |
| **What a skill does** | Speed, Access (a Token's minimum level), Efficiency. | [`BoardRunner.js:79`](src/systems/board/BoardRunner.js:79) |
| **The gate** | **Level only.** A Token asks "is your Nature ≥ 4?" It never asks "do you *have* Nature?" — because everyone does. | [`BoardRunner.js:79`](src/systems/board/BoardRunner.js:79) |
| **Classes** | **9 classes, rolled randomly at generation, entirely cosmetic.** The code comment says so outright. Their `bonusSkills` name `industry`, `nautical`, `culinary` — **ids that no longer exist**, so even if the bonuses were switched on they couldn't resolve. | [`classRegistry.js`](src/config/registries/classRegistry.js), [`HeroGenerator.js:119`](src/systems/hero/HeroGenerator.js:119) |
| **Traits** | 9 traits, same story — rolled, cosmetic, inert. Already marked for deletion by D-73. | [`traitRegistry.js`](src/config/registries/traitRegistry.js) |
| **Hero Level** | Average of the 4 combat skills (Melee, Ranged, Magic, **Defense**). | [`HeroGenerator.js:239`](src/systems/hero/HeroGenerator.js:239) |
| **Content exposure** | **38 Tokens, of which only ~20 demand a skill at all — across just 6 distinct skills** (nature ×8, labor ×4, forge ×3, social ×2, alchemy ×2, aquatic ×1). | [`tokenRegistry.js`](src/config/registries/tokenRegistry.js) |

**The single most important line in that table is the last one.** The content
that would have to be re-keyed onto a new skill list is *tiny*. This rework is
cheap to do now and gets steadily more expensive every month we author content
against the 15-skill list.

**The second most important:** classes are already dead weight. We are not
replacing a working system — we are giving an inert one a job for the first time.

---

## 2. The Three Headline Changes

### Change 1 — A hero holds *some* skills, not all of them
A hero's sheet becomes a **fixed-width rotation of 6 skills**, not a list of
everything. The other ~20 skills in the world are things that hero simply
**cannot do**, at any level.

This turns the skill system from a set of progress bars into a set of **keys**.
It also introduces a gate the engine does not currently have: **possession**.
Today a Token asks how high your skill is; after this it asks *whether you have
it* first.

### Change 2 — Class becomes the thing that sets the rotation
Class stops being a cosmetic label rolled at recruitment and becomes the
**player's choice of what a hero can do**. Promoting a hero swaps skills out of
their rotation and new ones in. The class tree *is* the skill unlock tree — a
specialist skill enters your guild because you promoted someone into it, not
because you found a Token or reached a Map.

```
RECRUIT                6 foundation skills · no combat skill · cannot fight
   │  promote           −2 foundation      +1 combat  +1 specialist
   ▼
BASE CLASS             4 foundation · 1 combat · 1 specialist
   │  promote           −2 foundation      +2 specialist
   ▼
ADVANCED JOB           2 foundation · 1 combat · 3 specialist   ← one is unique to that job
```

Width never changes. Six, always. That is what makes promotion read as
*becoming a different person* rather than *filling in a bigger sheet* — you give
something up to gain something.

**Promotion is reversible and removed skills are banked at their level**
(D-71), so this is a reconfiguration, never a gamble.

### Change 3 — The skill list grows and re-cuts along the economy
15 skills become roughly 25–30, and — more importantly — they are cut
differently. Today's skills are broad buckets (`labor` covers all mining and
digging; `nature` covers farming, logging, hunting and foraging). The new list
splits those buckets into things a hero can hold *one of but not the other*:
Mining and Logging become separate skills, not sub-skill tags on one parent.

Every entry has to earn its place against the rules already locked in
[`playmat_skills_concept.md`](playmat_skills_concept.md):

> **Two skills should be separate if, and only if, you want a hero to be able to
> do one but not the other.** (§1)
>
> **A skill with no Token to work cannot exist.** It could never level, so it
> could never gate, so it would be a word rather than a mechanic. (D-193)

---

## 3. What This Is Trying to Achieve

| # | Goal | How this rework delivers it |
| :--- | :--- | :--- |
| **G1** | **Make heroes matter as *people*, not as numbers.** | Right now any hero can be dropped on any Token; the only question is whose bar is higher. After this, "who works this tile" has a real answer and a real cost. |
| **G2** | **Give the class system a purpose.** | It goes from a cosmetic label to the primary long-term decision the player makes about a hero. |
| **G3** | **Add a second progression axis alongside Maps.** | Map progression is content-driven (buy the thing, unlock the thing). Promotion is **player-driven** — you decide which half of the world's skills your guild can even touch. |
| **G4** | **Make the board resist reorganisation.** | Skills are how the workforce becomes rigid. A miner can work any mine, but pointing them at a forge starts from zero. This is what gives the board *memory* and makes a good layout worth keeping. |
| **G5** | **Make combat a matchup problem instead of a weapon-swap.** | The rock-paper-scissors triangle between Melee/Ranged/Magic already exists in the engine and is currently near-decorative because every hero holds all three. One style per hero turns it on. |
| **G6** | **Give the crafting economy a reason to be deep.** | Skills key off *recipes*, not just stations, so one Forge can host many crafting skills. Depth costs recipes rather than new Token types. |

### The tension to watch
G4 (rigidity) and the game's AFK/idle promise pull against each other. If the
workforce is too rigid, the player is punished for experimenting; too fluid and
none of this means anything. The stated setting is **moderate — "heroes have a
lane"**: redeployable within a family, not across one.

**D-248 sets that dial to the rigid end** — there is no free re-slotting, so the
*cost of re-training* is the only thing standing between "meaningfully
specialised" and "punished for experimenting". That cost is the single most
important balance number this rework produces, and it will need play-testing
rather than being derived on paper.

---

## 4. The Shape of the Skill List

Four layers, **27 skills** (D-255). Nothing else can be in the list.

| Layer | Count | The entries | How you get it |
| :--- | :--- | :--- | :--- |
| **Foundation** | **6** | Mining, Logging, Fishing, Smithing, Crafting, Cooking | The starting state — every Recruit |
| **Combat** | **3** | Melee, Ranged, Magic | First promotion; exactly one per hero |
| **Shared Specialist** | **6** | Leadership, Faith, Nature, Crime, Enchanting, Alchemy | Promotion |
| **Signature** | **12** | Armory, Construction, Occult, Inscription, Beastmaster, Survival, Commerce, Brewing, Summoning, Astrology, Science, Engineering | Second promotion; **exclusive to one job** (D-257) |

**The structure is tighter than it first looks:** the 6 shared specialists are
*exactly* the 6 base classes' starting specialists, one each. That 1:1 is what
makes the layer count work, and it is why growing the shared pool was rejected.

**Two rules that fall out of this and constrain all content authoring:**

1. **The Foundation six are the complete vocabulary of the opening game.**
   Nothing on the first Map may demand a seventh skill (D-200). A Recruit is
   wide and shallow — able to do a little of everything badly.
2. **A fully-promoted hero keeps only 2 of the 6 Foundation skills.** So the job
   tree must be designed such that a fully-promoted guild still *collectively*
   covers all six. This is the largest authoring constraint the rework creates.

**Three things that go away:**

* **Defense stops being a skill.** A hero's one combat skill supplies both
  attack and defence — Melee 30 attacks at 30 and defends at 30 (D-197).
  Defensive building moves entirely to equipment. Three reads in
  `CombatFormulas.js` repoint at the single combat skill (D-260).
* **Social stops being a skill.** Its heir is Commerce, which is the Merchant's
  exclusive signature (D-259). This is a *promotion*, not a rename — see §8's
  D-259/D-263 for what it does to the early economy.
* **Sub-skill tags go away as a levelling mechanism.** Where today `mining` is a
  tag funnelling into `labor`, tomorrow Mining is a skill. Some names may
  survive as pure content labels.

**Four names from the taxonomy fold into neighbours** rather than becoming
skills (D-256): Foraging → Nature, Agriculture → Nature, Fletching → Crafting,
Runecraft → Enchanting. The supply chains in the concept doc's §4 and §7 still
resolve — just under different skill names.

---

## 5. The Shape of the Class Tree

```
                        RECRUIT  (cannot fight)
                             │
        ┌──────────┬─────────┼─────────┬──────────┬──────────┐
     Fighter    Cleric    Ranger     Rogue     Wizard    Alchemist      ← 6 base classes
        │          │         │          │          │          │           each = 1 combat
     ┌──┴──┐    ┌──┴──┐   ┌──┴──┐    ┌──┴──┐    ┌──┴──┐    ┌──┴──┐        + 1 specialist
     ▼     ▼    ▼     ▼   ▼     ▼    ▼     ▼    ▼     ▼    ▼     ▼
   Knight Warlord …                                                   ← 12 advanced jobs
                                                                        each = 1 exclusive
                                                                          signature skill
```

* **19 job entries** (Recruit + 6 + 12), against 9 cosmetic classes today.
* **Each advanced job owns one signature skill nobody else can hold** (D-257).
  That is what makes the second promotion feel like gaining access to something
  new rather than nudging a number.
* **The 9 existing classes do not map across cleanly** (D-258). Paladin and
  Engineer **demote** to advanced jobs; **Bard is cut entirely.** Nothing of
  value is lost — all 9 are cosmetic and inert today.
* **Jobs are how heroes are drawn** (D-75), but the art lands in stages
  (D-265): 7 sprites first — Recruit plus the 6 base classes — with advanced
  jobs reusing their parent's sprite until authored.
* **Promotion is gated on the skills the job carries forward, plus a resource
  cost** (D-262). To become a Knight you need the Mining and Smithing a Knight
  keeps, at a threshold. The hero you trained toward a job is the one who can
  take it.

**Resolved — the roster rises to 12** (D-251). Twelve advanced jobs against a
cap of 8 would have meant at least 4 signature skills were never seen in a given
playthrough; at 12 a fully-built guild can hold all twelve. The trade-offs this
costs elsewhere are recorded under D-251 — they're real, and the UI consequence
in particular compounds with D-250.

---

## 6. What Actually Changes in the Build

Rough shape of the work, so the size is visible before we plan it:

| Area | Change | Size |
| :--- | :--- | :--- |
| `skillRegistry.js` | New list, new categories, sub-skill map retired | Small |
| `classRegistry.js` | Replaced with a job tree: prerequisites, costs, skill grants/removals, perks | Medium — this is the new heart of the system |
| `HeroGenerator.js` | Heroes start as Recruits with 6 skills, not 15. No random class or trait roll. | Small |
| `SkillSystem.js` | Add a **possession** check alongside the level check; add skill banking | Small |
| `BoardRunner.js` | `heroMeetsRequirement` must fail on "hero doesn't have this skill", with its own alert reason | Small |
| Combat | Repoint the three `defense` reads at the hero's single combat skill; split Hero Level from the combat number (D-260) | Small but load-bearing |
| Economy | Markets re-key `social` → Commerce; the Woodland Market leaves Map 1 (D-259/D-263) | Small in code, **a real balance change** |
| Art | 7 base-class sprites (D-265), advanced jobs deferred | Own track, follows the passes |
| **Promotion & re-training** | **Does not exist.** Requirements, costs, reversal, banked-skill restore — and re-training as a first-class action (D-248), since it's the only respec the player has. | **Large — this is the bulk of the job** |
| Content | Re-key ~20 Tokens onto new skill ids; author the job tree's perks | Small for Tokens, **unknown for perks — this is original authoring, not a migration** |
| Roster cap | `guildUpgrades.js` `roster_size` `maxRank: 5 → 7` (D-251) | One line — but a real balance change |
| **UI** | **Reworked, not patched** (D-250). The Dock card's skills grid is hardcoded to 15 in a 5×3; the inspection modal must show held *and* banked skills, the class tree and the re-training action. 12 heroes × 6 skills = 72 values to lay out. | **Medium–large, and its own pass** |
| CMS | ~12 files import the skill list, including the sub-skill editor | Medium |
| Saves | No migration — new save required (D-253). Schema version bumps. | Small |

---

## 7. Contradictions in the Source Doc — All Resolved

`skill_color_pie_concept.md` said two different things in six places. Each is
now settled; the decision that settles it is in §8.

| # | The contradiction | Resolution |
| :--- | :--- | :--- |
| 1 | **Two different skill lists.** §2's tree names **22**; §3–§5's job tree describes **27**; the union is **31 distinct names.** | **The job tree's 27 wins** (D-255). §2 is thematic grouping with no structural weight. |
| 2 | **Four orphans** — Foraging, Agriculture, Fletching, Runecraft appear in §2 and in the supply-web diagrams, but no job grants them. | **Folded into neighbours** (D-256), so the chains still resolve. |
| 3 | **Occult, Summoning, Astrology, Engineering and Commerce** each appear as a general skill in §2 *and* as a job-exclusive signature in §5D. | **Strictly exclusive** (D-257). §2's listing carries no weight. |
| 4 | **Nature** is a "Management" skill in §2 and a gathering/make specialist in §5C. | Dissolved by D-255 — Nature is a **shared specialist**, Ranger's starting one. |
| 5 | **6 base classes in §3 vs. 9 classes in the game.** Bard is absent; Paladin and Engineer appear as advanced jobs. | **Intended** (D-258). Bard is cut, Paladin and Engineer demote. |
| 6 | **Section numbering repeats** (two §5s, two §6s); Smithing, Crafting and Cooking are each written up twice with differing text. | Cosmetic. The doc can't be read as a checklist — this brief and the roadmap supersede it for authoring. |

**Two further contradictions surfaced against the code**, which the source doc
could not have known about:

| # | Found in the code | Resolution |
| :--- | :--- | :--- |
| 7 | **Markets are keyed to `social`**, a skill the new list deletes — and its heir Commerce is a Tier-2 exclusive. Meanwhile the Woodland kit ships a Lumber Market at `skillRequired: 1` and D-139 says every Map kit contains a Market. | Markets **do** demand Commerce (D-259). **Map 1 ships no Market** and raw selling carries early gold (D-263). |
| 8 | **Hero Level averages 4 combat skills including Defense** ([`HeroGenerator.js:239`](src/systems/hero/HeroGenerator.js:239)) — but Defense is being folded away and heroes will hold one combat skill, while D-182 says the level derives from all six. | **Two separate numbers** (D-260). |

**One item stays open and is not a contradiction:** the **~27 skills vs D-185's
"~20"** count. D-185 is a target, not a law, but the count sets how much content
each skill needs — every skill must key at least one Token or by D-193 it cannot
exist. **27 skills is a real authoring bill** and should be sized during the
roadmap, not now.

---

## 8. Locked Decisions

Answered 2026-08-11. Numbers are provisional pending promotion into
[`playmat_decisions.md`](playmat_decisions.md).

### 8.1 Structure and scope (D-248…D-254)

**✅ D-248 — A hero's skill rotation changes only through re-training into a
class. There is no free re-slotting and no partial respec.**
The class *is* the rotation. Re-training a hero into a different class is how
you change what they can do, and it pays the promotion cost each time.
*Why:* keeps class as the meaningful decision and preserves G4's rigidity — a
hero pointed at the wrong work is a real problem with a real price.
*Consequence:* re-training must be a first-class action in the promotion system,
not an afterthought — it's the only respec route the player has. Its cost is the
main dial controlling how rigid the workforce actually feels.

**✅ D-249 — Recruits hold no combat skill and cannot fight at all.**
Confirms D-196 unchanged. The first promotion is what makes a hero a combatant.

**✅ D-250 — Banked skills are visible and greyed on the hero inspection modal,
and hidden on the hero card's quick reference.**
*Why:* the modal is where a re-training decision is actually made, so that's
where the player needs to see what a class change would restore. The card is a
glance surface and must stay readable.
*Consequence, and it is not small:* **this pulls a hero-display UI rework into
the project.** Both the Dock card and the inspection modal need reworking — the
card because 6 live skills replace a fixed 15-cell grid, the modal because it
now has to show two tiers of skill (held vs banked) plus the class tree and the
re-training action, none of which it does today.

**✅ D-251 — The roster cap rises to 12 heroes.** *(Amends D-181's ~8.)*
*Why:* twelve advanced jobs, each owning an exclusive signature skill, need a
roster that can hold enough of them for exclusivity to read as variety rather
than as content the player never sees. Twelve heroes against twelve jobs means
a fully-built guild can, in principle, see all of them.
*What it costs, honestly:*
* **D-181's stated benefits weaken proportionally.** Chain depth was "sharper at
  8" because a five-step chain cost 60% of the guild; at 12 it costs 42%.
  Recruitment as a *milestone* softens toward being a transaction again.
* **The colony-sim tension D-179 resolved comes partly back.** Eight named
  people is a cast; twelve is closer to staff.
* **Information cost rises from 48 skill values to 72** — which lands directly
  on the UI rework D-250 already requires. The two should be designed together.
* **It relieves D-1's pressure**, though: at 8 heroes only 17% of tiles were
  worked and D-181 warned the board needed ~3 support Tokens per worked one. At
  12 that ratio is easier to hit.
* ⚠️ **The shipped cap is already 10, not 8** — [`guildUpgrades.js:64`](src/config/guildUpgrades.js:64)
  is base 5 plus 5 ranks. So this is `maxRank: 5 → 7`, a one-line change, and a
  smaller move than D-181's text implies.

**✅ D-252 — The Foundation six become Mining, Logging, Fishing, Smithing,
Crafting, Cooking.**
The broad buckets (`labor`, `nature`) are split. ~20 Tokens re-key onto the new
ids; the sub-skill funnel map retires.

**✅ D-253 — Existing saves are not migrated. The rework requires a new save.**
Heroes change shape too fundamentally for a migration to produce anything but
nonsense heroes. Save schema version bumps.

**✅ D-254 — The work lands in staged passes, not one drop.** Two build passes
plus UI passes afterwards:

| Pass | Contents | Why this boundary |
| :--- | :--- | :--- |
| **1 — The list** | New skill registry, possession gate, `defense` fold-in, Hero Level redefinition, Token re-key, roster cap to 12 | Self-contained and immediately verifiable: the game still runs, heroes just hold 6 skills and some Tokens refuse them |
| **2 — The tree** | Job tree registry, promotion + re-training system, skill banking, perks | The large one. Needs pass 1's foundations to exist first |
| **3+ — UI** | Dock card, inspection modal, promotion/re-training screens (D-250) | Deliberately after the mechanics settle, so we're not redesigning against a moving target |

Each pass ends on a commit and a tag, per the repo's small-slices rule.

---

### 8.2 The list and the tree (D-255…D-258)

**✅ D-255 — The job tree's 27-skill list is canonical. §2's 22-name taxonomy is
thematic grouping with no structural weight.**
6 foundation + 3 combat + 6 shared + 12 signature. *Why:* it is the list the
class system actually depends on, and it is internally clean — the 6 shared
specialists are exactly the 6 base classes' starting specialists, 1:1.
⚠️ *Accepted cost:* 27 exceeds D-185's "~20" target, and every skill needs at
least one Token (D-193). The authoring bill is real and gets sized in the
roadmap.

**✅ D-256 — The four orphaned names fold into neighbours rather than becoming
skills.**
Foraging → **Nature**, Agriculture → **Nature**, Fletching → **Crafting**,
Runecraft → **Enchanting**. The supply chains in the concept doc's §4 and §7
still resolve under the new names; the diagrams need relabelling, not rewriting.

**✅ D-257 — The 12 signature skills are strictly exclusive. One job, one
signature, no exceptions.**
Overrides §2's listing of Occult, Summoning, Astrology, Engineering and Commerce
as general skills. *Why:* it is what makes the second promotion feel like
gaining access rather than nudging a number — and D-251's roster of 12 is what
makes covering all twelve possible.

**✅ D-258 — Six base classes (Fighter, Cleric, Ranger, Rogue, Wizard,
Alchemist) and twelve advanced jobs. Bard is cut; Paladin and Engineer demote to
advanced jobs.**
*Why:* the 6/12 shape is what produces the 1:1 between base classes and the
shared-specialist pool. *Cost:* none in practice — all 9 existing classes are
cosmetic and inert, so nothing of value is being deleted.

---

### 8.3 Mechanics and the economy (D-259…D-262)

**✅ D-259 — Markets demand Commerce, the Merchant's exclusive signature.**
Social is deleted as a skill; Commerce is its heir, but as a Tier-2 capstone
rather than a like-for-like rename.
*Why:* it gives the Merchant genuine economic identity — a job that changes what
your guild's economy can do, not one that makes a number bigger.
⚠️ *This is the most consequential decision in this section*, because it puts
the game's premium gold path behind two promotions. D-263 handles the gap.

**✅ D-260 — Hero Level and the combat number are two separate things.**
* **Hero Level** = the average of the hero's **6 held skills**. Honours D-182
  literally; a master smith reads as a high-level hero. Used for roster sorting,
  comparison, and gates not tied to one skill.
* **The combat engine** reads the hero's **single combat skill** for everything
  it currently takes from Melee/Ranged/Magic *and* from Defense — max HP, block
  chance, and both halves of every hit roll.

*Why two numbers:* if the engine read Hero Level, a hero would gain max HP by
mining. Three reads in `CombatFormulas.js` and `calculateHeroLevel` in
`HeroGenerator.js` change together.

**✅ D-261 — The first Map demands only the Foundation six, strictly.**
No Token on Map 1 may require a specialist skill. Recruits can work everything
they can see — the opening game has no locked doors.
*Migration, and it's mostly natural:* the `nature` Tokens are largely trees —
Oakwood Grove, Yew Copse, Yew Stand, Heartwood, Windfall Timber — and re-key to
**Logging**. The genuinely foraging ones (Bramble Patch, Glowcap Hollow) and the
`alchemy` stations (Woodland Still, Riverside Alembic) **move to later Maps.**

**✅ D-262 — Promotion and re-training gate on a level threshold in the skills
the job carries forward, plus a resource cost.**
To become a Knight you need the Mining and Smithing a Knight keeps, at a
threshold. *Why:* promotion becomes the payoff for work already done, and the
hero you trained toward a job is naturally the one who can take it. Rejected: a
Hero Level gate (simpler, but what a hero actually *did* stops mattering) and a
resources-only gate (a fresh Recruit could be bought straight into a capstone).

---

### 8.4 Pacing and presentation (D-263…D-265)

**✅ D-263 — Map 1 ships no Market. Raw selling carries the opening economy.**
`CommerceSystem.sellItem` already sells from the bank at base value with no
hero, no Token and no skill — it exists and works today. Markets become a real
mid-game upgrade paying a premium over it (10 Oak Wood sells raw for 20g; the
Lumber Market pays 34).
⚠️ *Cost:* D-139's "every Map kit includes a Market" becomes **"every kit from
Map 2 onward."** Map 1's gold income is noticeably thinner than today's, which
is a balance change that needs watching in play, not just on paper.

**✅ D-264 — Markets are a mid-game milestone. Commerce stays two promotions
deep (Recruit → Rogue → Merchant).**
*Why:* it gives the opening stretch a clear goal to aim a hero at, and makes the
first Merchant an economic turning point. Rejected: swapping Rogue's starting
specialist to Commerce (inverts the Rogue's identity and orphans Crime), and
giving a second job Commerce (breaks D-257 one round after locking it).

**✅ D-265 — Job art lands in stages: the 7 base sprites first, advanced jobs
after.**
Recruit plus the 6 base classes get their own sprite; the 12 advanced jobs reuse
their parent's until authored. *Why:* the board stays readable at the tier that
matters earliest, and the art budget follows the build passes rather than
front-loading 19 pieces against a tree whose contents may still move.

---

## 9. Explicitly Not in This Rework

Listing these so they don't quietly creep in:

* **Skill milestone perks** — deferred by D-204, and skill *acquisition* is
  already doing the identity work.
* **Minions** — they interact with the skill list (D-210/D-212) but are their
  own feature.
* **The combat engine itself** — the 7-stat model, statuses and the RPS
  triangle are unchanged. We only change *which skill* feeds them.
* **Traits** — already slated for deletion (D-73). We'll remove the registry as
  part of this since it's tangled with class generation, but that's cleanup,
  not design.
* **The full supply-web / colour-pie economy** in `skill_color_pie_concept.md`
  §4, §6 and §7 — that's content authoring for later, and it can't be settled
  until the list is final.
* **Advanced-job art** — only the 7 base sprites are in scope (D-265).

---

## 10. Still Open — for the Roadmap

Small enough that I can carry them, but they need an answer before code lands:

1. **The 27-skill authoring bill.** Every skill needs at least one Token
   (D-193). Sizing this is the roadmap's first job, and it may argue for
   authoring skills in waves rather than all at once.
2. **Combat XP.** With one combat skill and no Defense, all combat XP goes to
   that one skill — `CombatResolutionProcessor`'s `DEFENSE_XP_SHARE` split
   disappears. Straightforward, but the award size may need re-tuning since a
   hero now levels one combat skill instead of two.
3. **Villagers.** `HeroGenerator` gives them 2 random non-combat skills from the
   old pool. Presumably 2 random Foundation skills, no class, cannot promote —
   but it needs stating.
4. **The CMS's sub-skill editor** (`SubskillEditor.jsx`, `SubskillManager.jsx`)
   is orphaned when the sub-skill funnel retires. Delete or repurpose.
5. **The re-training price.** D-248 makes it the load-bearing balance dial and
   D-262 fixes its *shape*, but not its size. This needs play-testing, not
   paper.
