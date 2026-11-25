# Brief 870 — Gold Coins: selling, and a second cost

*Written 2026-11-25 by the planning agent from the owner's interview the same day
([concept_gold_coins.md](../concept_gold_coins.md), approved 2026-11-25). The concept holds every
ruling. Closes T-306.*

**What the player gets.** A coin count in the top bar. Anything in the Bank can be sold, one stack or
many at once, for what it is worth; enemies drop a few coins. Shop Tokens, Foundations, Guild Hall
stars and settling new places cost coins beside their items, more at higher ranks and further out,
so coins show whether the guild makes more than it uses.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (the save, the content
boundary, the ledger), `docs/reference/BALANCE_RULES.md`, the concept whole. Code read 2026-11-25
(the code wins): `src/ui/components/board/MatTopBar.jsx`, `src/ui/components/drawer/BankTab.jsx`
(select mode), the item drawer's Discard (brief 780 J2, `ItemDrawer.jsx`), enemy drops, the Shop's
and the Guild Hall's price checks, `src/systems/atlas/` for settling, and the CMS ledger
(`cms/src/engine/ledger/pace.js`). Gold was removed in October ("Guild Hall upgrades cost items, not
gold", slice 2.1; "gold removed from play", SP-65): its old code is history to read, not to restore.
Every phase may **stop and report rather than guess**.

## Phases

| Phase | Ticket | What | Tier | Needs |
|---|---|---|---|---|
| C1 | T-700 | **Coins and selling** (concept 4, 7–10). Coins are a number on the guild, in the save (an old save starts at 0). A **coin count in the top bar** with a coin icon, in the space brief 830 §8 freed. Every item has a **coin worth**: read from the CMS (a field the ledger fills from its valuation, overridable per item; the CMS shows it). **Sell replaces Discard** in the item drawer, same amounts, always confirms with what it pays; only the Bank's stack, never worn gear (780 J2's rules). **Select mode gains Sell selected**: one confirm with the total. | builder | — |
| C2 | T-701 | **Coins as a cost** (concept 2, 3, 5). A price can ask coins beside its items: Shop Tokens, Foundations and what they build, Guild Hall star ranks, settling a place on the world map; a recipe may ask coins (a CMS field, none authored). Too few coins blocks a purchase as too few items do, and says so the same way; prices show coins beside items. **Enemies drop coins** (a CMS field per enemy), collected like loot into the count. **All coin costs and drops are 0 until the content pack** (same work). | builder | C1 |
| C3 | T-702 | **The ledger prices coins** (concept 6). The CMS ledger fills each item's coin worth from its valuation and each enemy's coin drop, works out the coins a guild earns by each point of play, and sets coin costs from that, **rising with rank and with distance from the Starter Camp** (a curve the content agent tunes). Coins join the pace checks. | engineer | C2 |

**Order and parallel work.** C1 → C2 → C3. C1's top bar sits beside brief 830's layout (built). C3 is
CMS-only and may run beside other game work. **After C3**: the content agent's coin pack (T-703): the
curve, item overrides, enemy drops, which prices ask coins; the owner reviews and Syncs; that pack is
the balance change.

## Done when

- Gate green each phase; **same work** in C1 to C3 (every coin cost 0); the pack is the change, with a
  work check after the owner's Sync.
- Seen in the running game: the count in the top bar; selling one stack and many (each confirmed,
  the count rising by the total); a worn item not sold; an enemy dropping coins; with a fixture coin
  cost, a Shop Token and a Hall star refused for too few coins, then bought; settling refused, then
  allowed.
- `CHANGELOG.md` entries; T-306 and T-700 to T-702 closed.

**Eye-check: yes**, after C2 (the top bar count, Sell and Sell selected, coin prices).

## Owner to-do

No CMS work in the code phases. After C3, review and Sync the content agent's coin pack. Art when you
like: a coin icon for the top bar and prices.
