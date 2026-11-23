Status: draft (interviewed 2026-11-21: Faith settled; 2026-11-22: Taming cut, Crime settled in a deep dive; Summoning and Science next)

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

## Summoning: calling bosses to fight

Summoning works the Summoning Circle (a station type that already exists in
code): spend summon items to call a boss to fight, for better loot. Its
current line ("thralls and spirits that fight in a hero's place") is
rewritten. Bosses otherwise come from camps only (A32, T-547). To design:
summon items, which bosses, levels, how it sits beside boss camps.


**Interview 2026-11-21 (direction, not final; the owner is not fully satisfied
and will revisit):** summon items are rare finds anywhere, from gathering and
fights, and Summoning's level decides which a hero can use. A summoned boss is
a convenience (the same boss and loot, where and when you want), and it can
give access to a boss whose camp the player has not found yet.

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
Tailor's tier 2 needs, still has no source: a content question (T-658).

## Science: bulk conversion, late game

Laboratories that turn many cheap goods into rarer materials at scale, a sink
for surplus, unlocked late. To design: what converts into what, how it
differs from Alchemy, its unlock.


**Interview 2026-11-21 (direction, not final; the owner will revisit):** a
Laboratory takes big batches of common goods and slowly makes rare materials,
a sink for surplus, and can turn materials into very different things (the
owner's example: Oak Wood into Diamonds). Alchemy makes consumables, crafting
makes things, Science transforms materials. Unlocked late.

## Open questions (for the planning agent)

- Each skill's level climb, its station or nodes, and its place in the
  content chains (concept_content_roadmap.md).
- Order of building: after the core chains (owner, 2026-11-02, again 2026-11-21).
- Crime, Summoning and Science: a deep dive with the owner, one at a time
  (2026-11-22); then this doc is finished and
  approved, the hero sheet lines are rewritten (T-644 with T-569's form), and
  each skill gets a content plan with the content agent.
