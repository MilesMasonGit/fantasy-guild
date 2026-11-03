# Eye-check 2026-11-02: the encyclopedia's world places, even fights, rule wording

**Branch:** `look/2026-11-02` (the director switched your folder and restarted
the game at http://localhost:5173). ⚠️ **Don't Sync the CMS** on this branch.
Gate: 7,355 tests, cycles, build; the bench's results are the same.

**Save:** any save, or a New Game.

1. **Where things come from.** Open the book, search `iron ore vein`. Its way in
   reads "Ores ring 2 / settled on the world map", with the Mining icon and 15
   on the line. No map item is a way in anywhere.
   Verdict: **ok** (owner 2026-11-02); note: the Wolf Den showed an old map item as a modifier: old map items retire, seed items become "<Token> Map" (seed maps pack)
2. **Camps.** Search `wolf den`: "Ring 1 / settled on the world map" (a place
   several wedges may hold names no wedge and shows no skill on its line). Search
   `goblin camp` (the Token, second in the list): "Ring 1 / in some worlds",
   beside its Foundation recipe.
   Verdict: **ok** (owner 2026-11-02); same note
3. **Even start after a kill.** Fight a camp's goblins: after a kill, the next
   goblin no longer lands a free first hit; both sides start their swing together.
   Verdict: **ok** (owner 2026-11-02)
4. **Weapon tooltip.** Hover a weapon in the Bank: an Iron Cleaver adds "Slow
   swing, every 4 s"; a Copper Greatsword also says "Takes both hands".
   Verdict: **changed** as the owner asked to a stat block (DMG, Type, Skill, Speed, Hands); screenshot checked by the director; merged
5. **Rule wording (optional, CMS).** Item and perk rules now read as the hero's
   and name their skill ("Gives the hero a 5% chance of double loot at Forestry").
   Shipped perks keep their short tags, as you okayed on 30 October, so this shows
   mostly in the CMS. Also: "hold 1 more harvest", singular.
   Verdict: **ok** (owner 2026-11-02)

Builder's calls to judge: "in some worlds" shows once, at the first such ring;
an origin listed at several rings shows each ring; retired map items still have
book entries (searching "Goblin Camp" lists the old map item first) and enemies
still show them as drops: removing those would be a new ticket.

Note for the director: the bench read the same work although the even start
changes fights (its fights do not reach that path); the test and the live check
show it working.
