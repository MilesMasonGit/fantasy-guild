# Brief 320 — Guild Hall upgrades as a main driver

*Written 2026-10-30 by the planning agent from the owner's interviews of
2026-10-29 and 2026-10-30 (requested by the director for the owner).
Concept: [concept_guild_hall.md](../concept_guild_hall.md), "Upgrades as a
main driver" (read it whole; where it differs from the older sections, it
wins). Pacing: [concept_progression_ledger.md](../concept_progression_ledger.md)
("Pathing and a rate calculator", the profiles, payback).*

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/UI_STYLE.md`, the
concept section, the ledger concept's rate-calculator section, GDD §8 (the
Hall), §7 (the Rules grammar the boosts are written in), §14.

Code to start from (verify): `src/config/guildUpgrades.js` (constellations,
stars, ranks, prices), `src/systems/progression/GuildUpgradeManager.js`,
`src/ui/components/board/GuildHallBoard.jsx`, `GuildHallDetails.jsx`,
`GuildHallEffectsPopover.jsx`, the effect system the boosts apply through
(rules, `TileModifiers.js` for Grow Time-style aimed effects), the ledger
engine `src/systems/progression/ledger/` (`rates.js`, `profiles.js`,
`pace.js`, `checks.js`) and its CMS tab, the CMS change-pack gate.

⚠️ **Owner rulings that bind this brief**
- The Hall is **a main driver**: per-skill **XP, yield and work-speed** boosts
  are **essentially necessary for late-game levels**; the ledger's **Typical**
  profile assumes a sensible investor buys them.
- **Gates unchanged**: a star opens when a neighbouring star is lit; later
  ranks cost later-tier materials.
- **Prices are set by the algorithm** from the owner's tier per rank; **one
  rank per tier** the skill spans (about 7). Every rank must **pay off** in
  reasonable time (the ledger's payback check).
- **Retired**: the Token Cap star (the cap is fixed), the Cartography Table,
  the Notice Board, and with them **the Compass** constellation. (Scouting
  Flags and Bank Slots are already gone.)
- Saves made before this brief need no conversion (owner, 2026-10-30: old
  saves are abandoned; new games only).

## Phases

| Phase | What | Tier |
|---|---|---|
| H1 | **The machinery.** A **constellation per skill**, linked to the pole star and opening from the Hall (its first star buyable at once). Star kinds: **XP boost**, **yield boost** (more items per cycle, through the existing yield / double-item rules), **work-speed boost** (cycle time), each ranked and aimed at one skill; **Token upgrades** aimed at a Token kind or tag (vein respawn time, regrow time, a camp's reach); **the Well's basic outputs** (a passive line per basic item, e.g. Oak Wood, Copper Ore, Coal, each ranked for more, beside the Wishing Well's water); the **Hearth's Infirmary** (shorter wound time) and **loadout slots** (an extra trinket, more consumable room, a second food slot). All effects go through the Rules grammar where it reaches; anything it can't express is added as a library effect, not hard-coded per star. Retire the Compass, Token Cap star, Cartography Table and Notice Board (the fixed Token cap stays its current value). The sky lays out the extra constellations readably (positions in data). | engineer |
| H2 | **The ledger knows the Hall.** The rate calculator reads every Hall star as a factor (switchable, in the profiles: Bare has none, Typical buys by payback, Maxed has all); a **payback-time check per rank** (time saved against the time to gather its price, at Typical); the per-skill rate-source breakdown shows the Hall's share; the ledger can set each rank's **tier** (owner) and price it. | engineer |
| H3 | **The first star list** as a CMS change pack (through the ledger gate): for every skill with content, XP, yield and speed boosts at one rank per tier, Token upgrades for its Tokens (vein respawn, regrowth, camp reach where camps exist), the Well's basic outputs, the Hearth's stars; each rank's tier set, prices proposed by the ledger (a preview until the owner has seen the calculator agree with real play, per brief 290's rule). | builder |

## Done when

- Gate green each phase (`TESTING.md`); the engine bench's work changes when
  the pack is synced (accepted as content).
- In the running game: the sky shows a Mining constellation whose first XP
  star can be bought; buying it raises Mining XP per cycle by its rank; a
  vein-respawn star shortens a Copper Vein's rest; a Well line of Copper Ore
  pays into the Bank with no hero; the Infirmary shortens a wound; the
  Compass and its stars are gone.
- In the CMS Ledger tab: Mining's breakdown shows the Hall's share at Typical
  and Maxed; every rank shows its payback time; a rank that doesn't pay off is
  red.
- Eye-checks: H1 (the sky, one look); H3's pack reviewed by the owner.

## Owner to-do

- Review H3's star-list pack in the CMS (tiers per rank; names); Sync on
  `main`.
- Art for new star kinds and the extra constellations' pictures, when ready
  (code-drawn stars stand in).
