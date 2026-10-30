# Eye-check 2026-10-30: Milestone perks and the Bank at scale (brief 270 K4, brief 310 B1+B2)

**Branches:** two branches, one look each. Tell the director when you're ready;
the director switches your folder, starts the game at http://localhost:5173 and
switches back to `main` straight after. ⚠️ **Don't Sync the CMS** until you're
back on `main`.

**Save slot:** a **New Game in an empty slot** on each branch. Some QA buttons
below rewrite the open slot.

Shots (sent by phone too): `docs/active/research/classless_k4/`,
`docs/active/research/bank_310/`.

## Milestone perks (`feat/classless-k4`)

1. **A perk on level-up.** QA panel → Milestone perks → "Hero reaches Forestry
   10". A woodcutter one XP short fells an Oak. You should see the gold perk name
   ("Clean Felling") under the "10" over their head, and on the hero bar "10
   Forestry!" then "Perk: Clean Felling".
   Verdict: **ok** (owner 2026-10-30: "Checks look good")
2. **The sheet.** Click the woodcutter in the hero bar. Hover the Forestry row:
   perks held and "Next perk". Click the row: each held perk with what it does
   ("×2 loot 5 % (Forestry)").
   Verdict: **ok** (owner 2026-10-30: "Checks look good")
3. **An older hero.** QA → "Load a forester at Forestry 30" (saves the slot).
   Open QA Old Forester's sheet: both perks listed, no alert.
   Verdict: **ok** (owner 2026-10-30: "Checks look good")
4. **The CMS.** In a CMS on this branch: Changes to review →
   `2026-10-29-example-skill-perks` (one perk per Starting skill at level 10:
   Steady Pick, Clean Felling, Patient Line, Even Heat, Nimble Fingers, Second
   Helping, Green Thumb, Steady Hand, Quick Builder), then the new Skill Perks
   page. Look only; accept it on `main` after the merge.
   Verdict: **ok** (owner 2026-10-30: "Checks look good")

## The Bank at scale (`feat/bank-b1`)

5. **64 per tab.** QA panel → Bank tabs → "Bank Tabs rank 2", then "One of every
   item". Open the Bank: 3 tabs, the first two full at 64/64, the third with the
   rest. The count turns red on a full tab.
   Verdict: **ok** (owner 2026-10-30: "Checks look good")
6. **Bank Slots gone.** Guild Hall: no Bank Slots star; Bank Tabs sits beside the
   Hall, buyable from a new game.
   Verdict: **ok** (owner 2026-10-30: "Checks look good")
7. **A full tab refuses.** Drag an item onto a full tab: "That tab is full",
   nothing moves.
   Verdict: **ok** (owner 2026-10-30: "Checks look good")
8. **Search.** Type "Weapon" (every weapon across tabs), "Hand" (hand items),
   "Copper Dagger" (the dagger).
   Verdict: **ok** (owner 2026-10-30: "Checks look good")
9. **Sort.** The small Sort button beside Select → "This tab": the tab orders by
   type, tier, name; other tabs untouched. → "Entire Bank": every tab ordered,
   nothing changes tab.
   Verdict: **ok** (owner 2026-10-30: "Checks look good")
10. **An old save.** QA → "Old save: Bank Slots ranks, every item in tab 1"
    (rewrites the slot): every item is there; the extra spill into tabs with
    room, what finds none stays (tab shown over 64 in red) until moved.
    Verdict: **ok** (owner 2026-10-30: "Checks look good")

## Questions (recommendation first) — **owner 2026-10-30: all recommended (A); f and g become T-268, T-269; b becomes T-270**

a. A collapsed skill row with perks: (A) shown on hover and when opened, rows
   stay one line (built); (B) a small gold mark on the row; (C) perk names
   always under the row.
b. Carried rules read "Makes every nearby Token have a 5% chance of double
   loot" and don't name their skill: (A) a ticket for a wording pass
   (recommended); (B) leave it.
c. Two perks naming the same effect: (A) they add, capped at 5, as items do
   (built); (B) the later replaces the earlier.
d. A perk's work bonus: (A) does what its effect says, the audits warn when it
   isn't narrowed to its skill (built); (B) narrowed to its own skill
   automatically.
e. Bank Tabs on the Hall web: (A) beside the Hall, open from a new game
   (built); (B) behind another star, as Bank Slots was.
f. Tools sort by name (Adamantium, Darkmetal, Fine Fishing Rod, Iron Pickaxe…):
   (A) use the tool's tier when the item has none of its own (recommended, not
   built); (B) leave it until the ledger gives items a game tier.
g. Search "Ore" also finds "Forest Map": (A) match from the start of a word
   (recommended, not built); (B) keep matching anywhere, as before.
h. Type order in a sort: (A) A to Z by type name (built); (B) a fixed order you
   pick, e.g. weapons, armour, tools first.

## Your CMS steps after the merge (on `main`)

- Accept the example perks pack (the director copies it into `cms/incoming/`
  after the merge), then perks for the other skills when you like.
- Optional: more item tags; search finds more by group.
