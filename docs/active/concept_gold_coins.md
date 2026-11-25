Status: briefed 2026-11-25 (approved 2026-11-25; [brief 870](briefs/870_gold_coins.md))

# Gold Coins: selling, and a second cost

*Owner interview 2026-11-25 (planning agent), from the idea "Selling items instead of discarding"
([ideas.md](ideas.md), T-306) and the owner's Gold Coins idea of 2026-11-24. Gold left the game in
October (slice 2.1, "Guild Hall upgrades cost items, not gold"); this brings coins back with a new job.*

## What coins are for (owner)

> "Coins are a cost alongside items. This is our main economy sink. Coin costs increase with higher
> ranks and further out areas. The purpose of the item costs is to act as a gate, to ensure that the
> player is able to produce certain items in large quantities. The coins are more of a broad skill
> gate - to see if they're able to efficiently produce items overall to turn a profit." (owner)

1. **Items gate, coins measure profit.** An item cost asks "can you make *this*, in bulk?"; a coin
   cost asks "does your guild make more than it uses?". Prices carry both.
2. **What costs coins**, alongside its items:
   - **Shop Tokens and Foundations** (and what Foundations build);
   - **Guild Hall stars**, rising with the rank;
   - **settling new places** on the world map, more the further out.
   - Recipes and tasks: possibly a few, likely none (owner). The CMS can give a recipe a coin cost;
     none is planned.
3. **Coin costs rise with rank and with distance** from the Starter Camp: a Shop Token in a far
   Region costs more coins than the same Token at home.

## Where coins come from

4. **Selling items**, at their **worth from the ledger** (owner): each item's coin value comes from
   the CMS ledger's valuation (the time it takes to make), so later goods sell for more by
   themselves. The content agent may override an item's value.
5. **Enemies drop some coins** too (owner): a coin drop per enemy, set by the ledger like a sale,
   and editable in the CMS (planning agent's reading).
6. **The ledger sets every coin cost** (owner) from the coins a guild can earn by that point in play,
   rising with rank and distance; the content agent tunes the curve. Coins join the ledger's pace
   checks, so a guild played well stays on pace.

## Selling

7. **Sell replaces Discard** (owner): the item drawer's Discard button becomes **Sell**, with the
   same amounts, and pays the stack's worth. Brief 780 J2's rules carry over: only the Bank's stack
   is sold, never worn gear.
8. **Selling always confirms** (owner), showing what it pays.
9. **Selling many at once comes back** (owner): the Bank's select mode (today it picks stacks to move
   between tabs) gains **Sell selected**, one confirm with the total. It existed before gold left
   (the old bulk sell in `BankTab.jsx`).

## Stars and buildings (owner 2026-11-25)

11. **No coin stars**: no Hall star raises sale prices, coin drops or lowers coin costs. Coins stay a
    clean measure of profit.
12. **One coin building** (the content agent names it, a Counting House or similar): **enemies
    defeated in its reach drop more coins, and a Hideout in its reach steals more coins**. One building
    effect, big and in reach like the others.
13. **Crime steals coins too**: a camp's steal table (brief 810 K4) can hold coins beside goods.

## Seeing coins

10. **A coin count in the top bar** (owner), with a coin icon, in the space the Token count and Upkeep
    left (brief 830 §8). Every price that asks coins shows them beside its items.

## Notes for the director

- Coins are a number on the guild, in the save; not an item in the Bank (owner's pick).
- A wallet with too few coins blocks a purchase as too few items do, and says so the same way.
- This is a balance change across the game: the content agent's pack sets the ledger's coin
  values, enemy drops and the coin cost curve before any coin cost is switched on.
