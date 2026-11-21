# A19 to A25: The specialist skills
*Read at tag audit-build (1c04f5f6), 2026-11-21. One card for the seven identity sessions (A19 Fletching, A20 Faith, A21 Summoning, A22 Enchanting, A23 Crime, A24 Taming, A25 Science), plus Tailor.*

## In one paragraph

Seven skills are placeholders: a name, an icon and one line of text, shown
on every hero sheet at level 1 "so players see what is coming" (your ruling
D7). No recipe, Token, perk, star or effect names any of them, so no hero
can earn XP in them. Two already have approved plans and were settled this
session: **Fletching** makes bows and arrows (T-572), **Enchanting** makes
wands, staffs and tomes and works Leylines for Motes (T-577, T-579). Tailor
has an approved plan (T-578) but isn't a skill yet (T-304). The other five
(Faith, Summoning, Crime, Taming, Science) have nothing but their line.

## Each skill today

| Skill | Its line | Content | Plan | Overlaps |
|---|---|---|---|---|
| Fletching | "Arrows, bows and hunting gear, made and tuned by hand." | none (Smithing makes bows) | content_fletching.md, approved; build now (T-572) | Smithing, Tailor's String |
| Faith | "Shrines, altars and wards that bless the heroes and Tokens around them." | only a Faith icon on the Stone Foundation | none | auras: Hall stars, supports' nearby effects |
| Summoning | "Raising thralls and spirits that fight in a hero's place." | none; a Summoning Circle station type in code makes a boss enemy | none | the Circle summons foes, the line allies |
| Enchanting | "Binding gems and dust into gear to make it more than it was." | none | content_enchanting.md, approved; build now, amended (T-577) | Magic, Crafting's jewellery, Tailor's gear |
| Crime | "Locks, contraband and the things other people would rather keep." | none; a skill picture and crowbar art | none | Stealth |
| Taming | "Beasts of burden that harvest, haul and graze unattended." | none | Tailor's Wool "with Taming later" | enemies (the Cow), Farming's pastures, camps |
| Science | "Laboratories that convert goods in bulk into other materials." | none | none | Alchemy, any station |
| Tailor | (not a skill yet) | none | content_tailor.md, approved; build now (T-578); T-304 adds the skill | Magic and Stealth armour |

## What really happens underneath

- **Every hero holds every skill at level 1**; the specialists are listed
  last on their own colour.
- **No XP** in any of the seven, except the QA panel raising all skills.
- **The roadmap** (concept_content_roadmap.md, draft): the specialists are
  designed after the core chains and may still be added or cut (owner,
  2026-11-02).

## Owner feedback (2026-11-21)

- **Faith**: keep; builds blessing buildings.
- **Summoning**: summons bosses to fight (the Summoning Circle).
- **Crime**: keep; locks, chests and contraband.
- **Taming**: keep; animals and pastures.
- **Science**: bulk conversion, late game.
- **Tailor**: add it now with its plan.
- **"Specialist"**: "'specialist' skills no longer exist as every hero has
  access to every skill. There are just skills." They keep showing.
- Fletching and Enchanting were settled in A16 and A17.

## What it became

- **concept_skill_identities.md** (draft): the five identities.
- **T-643** (director; planning agent): no more specialist skills, just skills.
- **T-644** (planning agent): the five skills get identities.
- **T-645** (planning agent): GDD §4 Skills.
- T-304 (Tailor) now says add it now with T-578.
- Fine as is: skills with no content still show at level 1.

All three tickets blocked on the group, which is ready to brief.

## Evidence

- Registry, texts → `src/config/registries/skillRegistry.js:15-21, 127-163`, `src/i18n/en.json:705-711`
- Hero sheet order → `src/ui/components/dock/heroPanelSkills.js:6, 18-31`
- No content names them → `data/tokenRecipes.json`, `data/tokens.json`, `data/skillPerks.json`, `data/hallStars.json`, `data/effects.json`; Faith icon → `data/tokens.json:3148-3151`
- Summoning Circle → `src/config/registries/tokenConstants.js:143, 164`, `docs/reference/GDD.md:1199-1207`
- Tailor not a skill → `docs/reference/TICKETS.md` (T-304)
- Plans → `docs/active/content_fletching.md`, `docs/active/content_enchanting.md`, `docs/active/content_tailor.md`, `docs/active/concept_content_roadmap.md:38, 78, 94-95`
- GDD → `docs/reference/GDD.md:625-628`
