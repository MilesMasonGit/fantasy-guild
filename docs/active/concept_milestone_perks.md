Status: briefed (approved 2026-11-21; brief 800 for the new rules and the flash; T-522 for the tables, content agent)

# Milestone perks: what each level gives

*From the Systems Audit, A27 Milestone perks
([card](audit/A27_milestone_perks.md)), owner interview 2026-11-20. For the
planning agent to finish with the owner (signature perks, skill by skill),
then the content agent to author. Tickets already filed: T-522 (perk tables,
content agent), T-523 (CMS defaults), T-524 (the level-up moment), T-516 (one
effect from several sources adds in full) and T-519 (no reach on carried
effects).*

## What the owner decided

- **Small early, signature late.** The major milestones stay at **10, 25, 50,
  75 and 99**. Early ones give small bonuses like today's; later ones give a
  **signature perk** that changes how the skill plays (examples only: a
  Forester fells a whole grove at once, a Miner finds gems).
- **Smaller milestones every 5 levels** between the majors (5, 15, 20, 30,
  35…). They sit in the same perk table and are **not marked minor**: they
  are **small, repeatable improvements**, the same effect again (Steady Pick
  at 5, 15, 20…), each adding to the last. This needs T-516 (the same effect
  adds in full, no cap of 5).
- **Every skill that can be levelled gets a table**, the combat skills too
  (Melee, Ranged, Magic, Stealth), with the same rules: their perks reach the
  hero's fights (Crit, Dodge, a style's damage type, Swing Speed).
- **Levelling up is an event.** Every milestone, small or major, is shown the
  same way: the level-up float names the perk in gold and the hero bar gives
  it its own alert. The moment also lists the **recipes (and Tokens and gear)
  the level unlocks**, and, once there are more animations, **something
  flashy** (owner: "I want levelling up to be more of an event").
- **No choices, nothing stored**: every hero at the level holds the perk, as
  today. No banner; perks belong to one hero.

## The framework (owner, 2026-11-21)

- **Perks take a bigger share of the boost budget**: about 15 % speed by the
  last tier (Hall stars drop from 15 % to 5 %, so the total stays as ruled)
  and a share of yield; the content agent rebalances the stars and perks with
  the ledger ([BALANCE_RULES.md](../reference/BALANCE_RULES.md) section 5).
- **The small steps alternate two effects per skill** (e.g. Mining: Speed at
  5, 15, 30 ...; Yield at 20, 35 ...), about 0.5 to 1 % a step; the content
  agent picks the pair.
- **Combat skills' steps repeat the style's signature**: Melee resistances and
  Accuracy, Ranged arrow Preservation, Magic Type Damage, Stealth crit chance
  (toward the 75 % ceiling) and Dodge ([concept_combat_styles.md](concept_combat_styles.md)).
- **The majors at 10 and 25** are small bonuses like today's perks.
- **The flash**: on a level-up the animated ring from brief 720 bursts out in
  gold from the hero with a few pixel sparkles; a major milestone gets a
  bigger burst. Picked from screenshots before it is built.

## The signature perks (owner, 2026-11-21)

NEW marks a perk that needs a new game rule (brief 800); the others use
effects that exist. Names are working names; the content agent may polish.

| Skill | 50 | 75 | 99 |
|---|---|---|---|
| Mining | Prospector: veins sometimes drop a gem (Lucky) | Deep Seam: a cycle sometimes uses no charge (Refresh) | Motherlode: a vein this hero works never rests (NEW) |
| Forestry | Clean Cuts (Refresh) | Nest Finder: more Bird Nests and rare finds (Lucky) | Grove Feller: a falling tree also fells the trees beside it, all paid (NEW) |
| Fishing | Bait Saver (Preservation of bait) | Big Catch: sometimes two fish (Double Loot) | Master Angler: a catch is sometimes the next tier's fish (NEW) |
| Farming | Green Fingers (Growth) | Bumper Crop (Giant Harvest) | Evergreen: a harvested field replants itself, no seed spent (NEW) |
| Smithing | Thrifty Smith (Preservation) | Masterwork (Double Item) | a bigger Double Item |
| Crafting | Thrifty Hands (Preservation) | Batch Work (Double Item) | Many Hands: works two recipes at once at its station (NEW) |
| Cooking | No Waste (Preservation) | Second Helping+ (Double Item) | a bigger Double Item |
| Alchemy | Careful Measure (Preservation) | Double Brew (Double Item) | Potent Brews: its potions last more cycles (Long-lasting Brews) |
| Construction | Quick Builder+ (Speed) | Salvage: demolishing returns more of the price (NEW) | Master Builder: Foundations and building upgrades cost less (NEW) |
| Fletching | Thrifty Fletcher (Preservation) | Bundle (Double Item) | a bigger Double Item |
| Enchanting | Steady Focus (Preservation) | Twin Motes (Double Item) | a bigger Double Item |
| Tailor | Thrifty Needle (Preservation) | Two Bolts (Double Item) | a bigger Double Item |
| Melee | Shield Wall: resistances up | Second Wind: heals a little on each kill (NEW) | Unbreakable: once a fight, survives a defeating blow at 1 health (NEW) |
| Ranged | Quiver Saver (Preservation of arrows) | Piercing Shot: shots sometimes Sunder | Twin Shot: sometimes shoots twice, one arrow spent (NEW) |
| Magic | Elementalist: Type Damage up | Mote Saver (Preservation of Motes) | Double Cast: sometimes casts twice, one Mote spent (NEW, as Twin Shot) |
| Stealth | Keen Edge: crit chance up | Evasion: Dodge up | Shadowstep: after a dodge the next hit is a sure crit (NEW) |

**No "Fine" crafted items** (owner, 2026-11-21): the 99s that made crafted
things come out better (Heirloom, Deep Attunement, Fine Stitching, Fine
Fletching, a hearty Feast) are dropped; those skills get a bigger Double Item
instead. Every item of one kind stays identical and stacks.

**Faith, Summoning, Crime, Taming and Science** get their tables once their
identities are settled ([concept_skill_identities.md](concept_skill_identities.md)).

## Today (for reference)

Nine perks, one per work skill, all at level 10: Steady Pick (Mining, 5%
faster), Clean Felling (Forestry, Double Loot 5%), Patient Line (Fishing, +10%
XP), Even Heat (Smithing, +10% XP), Nimble Fingers (Crafting, 5% faster),
Second Helping (Cooking, Double Loot 5%), Green Thumb (Farming, +10% Yield),
Steady Hand (Alchemy, +10% XP), Quick Builder (Construction, 5% faster).
