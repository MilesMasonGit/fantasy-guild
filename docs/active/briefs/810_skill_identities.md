# Brief 810 — Four skills get their mechanics: Faith, Crime, Summoning, Science

*Written 2026-11-22 by the planning agent from [concept_skill_identities.md](../concept_skill_identities.md)
(approved by the owner 2026-11-22). **Runs after the core chains** (owner, 2026-11-02 and 2026-11-21):
after the Systems Audit briefs (730 to 795) and brief 800.*

**What the player gets.** Four skills that do something no other skill does. **Faith**: a shrine whose
strong blessing holds only while a Faith hero keeps it supplied with offerings. **Crime**: a hero in a
Hideout steals a different set of goods from a nearby enemy camp, and a theft that goes wrong puts a
guard on the camp. **Summoning**: a Summoning Circle charges a Summoned worker, a recoloured enemy with
fixed skills that works until its charges run out. **Science**: a Laboratory studies nearby nodes to
build up permanent mastery of each kind of node. And **Taming is gone** from the skill list.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (Tokens and their work
cycle, reach, stations and recipe choice, camps and spawning, orders and heroes, effects, the save),
the concept doc above (each skill's section is the ruling), `docs/reference/BALANCE_RULES.md`
section 5 (the boost budget). **This brief builds the rules; the content (steal tables, the summons,
the mastery tracks, the offerings and the buildings' prices) is the content agent's packs** (T-663),
so each phase is tested with fixture Tokens and items, never `data/`, and is **same work** on the
bench until a pack lands. Where a ruling below leaves the behaviour open, **stop and report** rather
than choose.

## Phases

| Phase | Ticket | What | Tier |
|---|---|---|---|
| K1 | T-658 | **Taming leaves the skill list.** `skillRegistry.js`, its texts in `en.json`, the tests that count skills. A save holding Taming XP still loads (the XP is dropped quietly). | builder-lite |
| K2 | T-644 | **The hero sheet's lines** for Faith, Crime, Summoning and Science say what each now does (the concept doc), in the form brief 750 S5 gives the combat styles. Wording only. | builder-lite |
| K3 | T-659 | **Faith: tended blessings.** A shrine Token gives its blessing (a CMS effect on Tokens in its reach; amended 2026-11-25: **effects no building gives**, five new ones in T-705, blessings add up, [content_faith.md](../content_faith.md)) only while it holds offerings; a Faith hero working it spends offerings to keep it lit, and with none left the blessing fades (a timer, shown on the shrine's bar and card: no plates on the mat, brief 830 §15). Offerings are ordinary items made at an altar station by recipe (content). Stop and report how "fades" reads in the engine (a stock of offerings counting down, or a lit timer topped up). | builder |
| K4 | T-660 | **Crime: the Hideout.** A station kind with a reach whose card picks one enemy camp in reach (like a recipe choice). Each cycle its hero steals from that camp: a roll on the enemy's **steal table** (a new CMS field beside its drops; it **can hold coins** once brief 870 C1 has them, owner 2026-11-25, more in a coin building's reach), leaving the enemy in place. **Caught odds**: Crime level against the camp's Crime level (a CMS field); below it often, above it rarely (the curve a CMS setting). **A catch spawns a guard** on top of the camp, past its cap, who stays until defeated; the thief fights it or flees and leaves it for another hero; **while it stands the camp can't be robbed**. Bosses are never robbed. Named in the fight log, the Hideout's card and a speech bubble over it (no plates, brief 830 §15). | engineer |
| K5 | T-661 | **Summoning: Summoned workers.** A Summoned token is ordered like a hero (the flag, the hero bar, the order rules) but has only its own skills at fixed levels, never gains XP, has one trait (a CMS effect), and **works only, never fights** (no combat orders). Working spends its charges; at none it leaves the mat. **The Summoning Circle** (the station kind exists) picks one summon on its card; each cycle of its Summoning hero adds charges to that summon, spending the enemy's drops and magic supplies by recipe; the number of charges grows with Summoning level (a CMS setting). **One summon per Circle**: changing the choice warns that the old summon will be dismissed. Summoning level decides which summons a hero can call. Touches orders, the hero bar, the save: stop and report if a non-hero worker can't take orders without a second hero model. | engineer |
| K6 | T-662 | **Science: mastery of nodes.** A Laboratory station kind with a reach whose card picks a node in reach (trees, veins, bushes, Fields, Fishing Spots: brief 850 F1; a spot kind is a node kind, and studying one counts as a catch for its chance to leave). Its hero's cycles **wear the node as gathering does (its chance to end, brief 860 R1) and give no goods**, only mastery points for that **node kind, guild-wide** (saved). Each kind has a **track**: ranks at point thresholds, each rank a CMS effect on every Token of that kind (content writes the tracks). Science level decides which kinds can be studied (the node's own gathering level); Laboratory variants reach higher-level nodes; a support building (a University) speeds Science like other supports. No risk. The Encyclopedia's node page shows the kind's mastery rank and its next buff; the node's card shows its mastery badges. | engineer |

**Amended 2026-11-25 (planning agent, from rulings made since 22 Nov; no owner question).** Plates
are gone from the mat (brief 830 §15), nodes end by chance rather than a count (brief 860 R1), and water
is worked through Fishing Spots (brief 850 F1); K3, K4 and K6 above read accordingly. **K6 needs 860 R1
and 850 F1 merged.** Nothing else in the concept changed: the owner's skills planning is settled.

**Order and parallel work.** K1 and K2 first, together (small). K3 any time after them. K4 and K6 share
the "a station picks a Token in reach" piece: build it once in K4 and reuse it in K6 (K6 after K4).
K5 alone (orders and the hero bar). At most two code agents at once; K4 and K5 may run side by side if
they don't touch the same files.

## Done when

- Gate green; bench work check **same work** for every phase (no shipped content holds the new kinds
  until the packs).
- Each mechanic has tests with fixture content and is seen in the running game with the QA panel
  placing the fixture Tokens: a shrine lit, then fading; a Hideout stealing, a catch, the guard
  blocking the camp until beaten; a Circle charging a summon, the summon working until it leaves, the
  dismiss warning; a Laboratory studying an Oak, the Oak kind's rank rising and every Oak getting the
  buff.
- The new CMS fields (steal table, a camp's Crime level, summon skills and trait, mastery tracks) are
  in the CMS with plain descriptions for the content agent.
- Tickets closed into `docs/archive/tickets_done.md`; the content agent is told which rules exist
  (T-663).

**Eye-check: yes**: one look per skill as it lands (K3, K4, K5, K6), each with the content agent's first
small pack for it if ready, else fixtures.

## Owner to-do

Review and Sync the content agent's packs for each skill (T-663) as they come.
