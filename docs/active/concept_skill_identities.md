Status: briefed (approved 2026-11-22; brief 810)

# Five skills: what each one is for

*From the Systems Audit, A19 to A25 ([card](audit/A19_A25_specialist_skills.md)),
owner interview 2026-11-21. For the planning agent to finish with the owner,
skill by skill, then brief. Fletching (T-572), Enchanting (T-577) and Tailor
(T-578, T-304) already have approved plans and are being built.*

## No more "specialist" skills

Owner, 2026-11-21: "'specialist' skills no longer exist as every hero has
access to every skill. There are just skills." Every hero holds every skill
from level 1; a skill with no content yet still shows on the hero sheet
(ruling D7 stands). Tickets: T-643.

## Faith: blessing buildings

Shrines, altars and wards that give nearby boosts, like supports, but Faith's
own skill and materials. To design: what Faith gathers or makes, how its
blessings differ from supports and Hall stars, its levels.


**Settled 2026-11-21:** a shrine's blessing is strong but holds only while a
Faith hero tends it with offerings; untended, it fades. Support buildings stay
passive and weaker. Offerings (candles from wax or tallow, incense from herbs,
flower garlands from Farming) are made by Faith at an altar from other skills'
goods: no new nodes.

## Summoning: Summoned workers

**Deep dive 2026-11-22 (owner).** Calling bosses is dropped (bosses come from
camps, T-547). Summoning makes **Summoned tokens**: temporary workers.

- **A Summoned token** is a recolour of an enemy (an Earth Golem, a Sprite). It
  is ordered to a task like a hero, but has **only its own skill or skills, at
  fixed levels** (every Earth Golem has, say, Mining 60), **never gains XP**,
  and has **one trait of its own** (a Golem never rests, a Sprite grows crops
  faster), written by the content agent.
- **Charges.** Working spends its charges; at none it disappears.
- **The Summoning Circle.** A Summoning hero works the Circle with its chosen
  summon (picked on the card like a recipe); each cycle adds charges to that
  summon, spending **drops from the enemy it copies plus magic supplies such
  as Motes**.
- **One summon per Circle.** Changing a Circle's summon warns that the old one
  will be dismissed.
- **Work only, never fight.**
- **Summoning level decides which summons a hero can call** (each kind unlocks
  at a level, like a recipe) **and how many charges a Circle cycle adds**.

To design with the content agent: the summons (which enemy, skills and levels,
trait, cost), the Circle's levels; in code, a Summoned token taking orders.

## Crime: stealing instead of fighting

**Deep dive 2026-11-22 (owner).** The Mansion-to-rob direction is dropped: it
was gathering under another name. Crime's one mechanic is **stealing from enemy
camps instead of fighting them**, for a different set of goods.

- **The Hideout.** A building with a reach. A Crime hero is ordered to the
  Hideout and works there; each cycle they steal from a camp in its reach,
  the one the player picks on the Hideout's card (like choosing a recipe).
  This is what puts a hero to Crime.
- **Camps only.** Regular enemy camps; bosses are fought, never robbed.
- **Its own drops, per enemy.** Every camp has a fight table and a **steal
  table**, written per enemy by the content agent: the alternate drops a
  player may prefer. Owner's example: fight the Cows for Bones, Meat and
  Leather, or steal from their pasture for Seeds, Wheat and Milk.
- **A theft leaves the enemy in place**: thieves and fighters can share a
  camp.
- **Caught odds: Crime level against the camp.** Each camp has a Crime level;
  below it a thief is caught often, above it rarely.
- **Caught means a fight.** A catch spawns an enemy on top of the camp (it may
  go past the camp's cap) that stays there. The thief fights it, or flees and
  leaves it for another hero. **Until it is defeated the camp can't be robbed
  again.**
- **Stealing only.** Crime makes nothing else.

To design with the content agent: the Hideout's levels and variants, each
camp's Crime level and steal table, Crime's level climb.

## Taming: cut

**Cut 2026-11-22 (owner):** Taming leaves the game. Its pasture idea (wild animals
tamed into a Pasture) and its helpers that work Tokens without a hero are dropped with it. Wool, which
Tailor's tier 2 needs, now drops from a Sheep enemy (owner, 2026-11-22; pack `2026-11-22-sheep-wool`).

## Science: mastery of nodes

**Deep dive 2026-11-22 (owner).** Bulk transmuting is dropped. Science works
gathering nodes another way, as Crime does camps: it **studies them for
mastery**, permanent buffs that build up.

- **The Laboratory.** A building with a reach. A Science hero works it and
  studies a node in its reach (trees, veins, bushes, Fields, water), picked on
  the card like the Hideout's camp. Laboratory variants reach higher-level
  nodes; support buildings (a University) speed Science up.
- **Studying spends the node's charges, as gathering does, and gives no goods:
  only mastery.** Goods now, or buffs for good.
- **Mastery belongs to the node kind, guild-wide.** Studying any Oak Tree
  raises Oak mastery; every Oak Tree, now and later, gets its buffs.
- **A set track per kind.** Each mastery rank gives the next buff on a fixed
  track the content agent writes, varied per kind (more yield, faster work,
  more charges, a rare find...), as milestone perks are.
- **Science level decides which nodes can be studied.** Once a kind is
  unlocked, it can reach full mastery.
- **No risk.**
- **Balance: mastery takes a share of the boost budget** (BALANCE_RULES
  section 5): stars, buildings or perks give a little less so an optimised
  guild stays on pace.

To design with the content agent: mastery ranks and tracks per node kind, the
study cycle, the Laboratory's variants and support buildings, the budget share.

## Open questions (for the planning agent)

- Each skill's level climb, its station or nodes, and its place in the
  content chains (concept_content_roadmap.md).
- Order of building: after the core chains (owner, 2026-11-02, again 2026-11-21).
- Crime, Summoning and Science: settled in a deep dive with the owner
  (2026-11-22); on approval, then this doc is finished and
  approved, the hero sheet lines are rewritten (T-644 with T-569's form), and
  each skill gets a content plan with the content agent.
