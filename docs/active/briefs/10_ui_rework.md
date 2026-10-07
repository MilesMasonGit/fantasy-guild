# Brief 10 — UI rework (everything but the hero bar and panel)

**Source of truth:** [`ui_rework_list.md`](../ui_rework_list.md): its locked
sections (bubbles, Shop groups and Foundation tiers, Token Summary) and the
owner's own list below them. **Style:**
[`UI_STYLE.md`](../../reference/UI_STYLE.md) for every panel and tooltip.

**Not here:** the hero bar, hero panel, hero work rules and flag cleanup
(brief 30, after class rework v2: the panel shows the new skill list); the
drag deep-dive (brief 50); the bin beyond a straight port (the Atlas replaces
it).

**Branch:** `crunch/ui-rework`, one or more commits per phase. **Eye-check
batches:** A = U1–U3, B = U4–U5, C = U6–U8 (see the README's batch rule).
**Cost log:** `bench:draw -- --compare` before and after every phase; one line
per phase in `PERFORMANCE.md`.

---

## U1 — Bubbles (builder; engineer if the visibility rules fight the render path)

Rebuild the Token bubbles to the locked design in `ui_rework_list.md`
("Bubble design"):
- **Positions inside the Token's box**: top-left timer (turns and the **new
  growth timer** for grows), middle row (gear, spawner count, disallow mark,
  side by side), bottom-left work cycle, bottom-centre quest progress,
  bottom-right charges. Small Tokens use the same corners and may overhang.
- **Visibility**: work cycle live while worked; charges, quest and spawner
  count ~2 s on change and on hover; timers on hover and in their last ~10 s;
  gear always while a choice is needed, otherwise on hover; disallow always
  while disallowed.
- **Glide** on every count bubble's number jump.
- **Tooltips** on every bubble (draft wording; the owner reviews it at the
  eye-check); pressing a bubble still grabs the Token.
- **Name label** above the Token's box on hover.
- Today's code: `TokenBadgeRow.jsx`, `RingBadge.jsx`, `TurnRing.jsx`,
  `ringRow.js`, `TokenBadges.jsx` (`StationGearBadge`, `DisallowBadge`,
  `TokenNameBadge`), `MatToken.jsx`. Keep the `rings` draw switch working
  (rename or split switches if the structure changes; update
  `drawSwitches.js` and its test).
- ⚠️ Rings were **58 % of the realistic mat's drawing cost** at 4×. Hover-only
  visibility should cut that; record it in the cost log, don't tune further.

**Done when:** tests for positions, visibility timing and glide; the RenderGolden
snapshot updated with its diff read; in the game on `?stress=realistic` and
in the owner's slot-3 save: every bubble kind seen in its spot, visibility
rules observed, tooltips readable, nothing cut off at the mat's edges.

## U2 — Combat health bars (builder)

Health bars **above the hero and the enemy**, shown during a fight or while
the enemy is hovered (replacing the enemy-HP ring). Bars follow UI_STYLE (a
thin bar, exact number on hover). Today's fight state: `BoardCombat.js`,
`TokenBadgeRow.jsx` (`hp`). Hero HP outside fights stays in the hero bar.

**Done when:** a fight on S2 shows both bars and they leave when it ends;
hovering an enemy shows its bar; tests for show/hide.

## U3 — Callouts instead of alerts (builder)

- **Remove the alert marks on Tokens** (`TokenCentreAlert`, `TokenEventAlert.jsx`,
  `MatPointAlerts.jsx`, `centreAlert.js`): no floating exclamation marks.
- **One quick popup style** (speech-bubble shape, appears and fades) for:
  spawns ("! Spawned Oak Tree", from the spawner), effect callouts (e.g. a
  bonus drop; replaces `EffectProcText`), and depletion, which the hero who
  exhausted it says as a speech bubble ("Oak Tree Depleted").
- The "-1" / "+50" stays a small number rising from the charges bubble.
- **Level-ups on the mat**: the hero says "Leveled up Mining to 25! (+4)"
  (the +N is levels gained since the last bubble). The persistent hero-bar
  copy is brief 30.
- **"Hero went elsewhere"** (`Flags.js` ~line 408) stops being a notification;
  the hero says it as a speech line instead *(director default)*.
- Problems the alerts used to show must still be discoverable: the hero's
  speech bubbles (blocked lines) and the Token Summary (U6) carry them.
- Speech code: `heroSpeech.js`, `heroBubbles.js`, `HeroBubbleLayer.jsx`;
  update `docs/reference/speech_bubble_lines.md` with every new line.

**Done when:** no alert marks on the mat; each popup kind seen in the game;
the speech-lines doc updated; draw switches `alerts`/`speech` still meaningful
(repurpose `alerts` for the popups).

## U4 — Notifications and bin as pop-out sidebars (builder)

The notification column and the bin become **sidebars that pop out on hover
over the playmat**, and the **playmat grows** into the freed width.
Notifications keep today's behaviour (aggregation, collapse, clear all); the
bin is a straight port (no new bin features; the Atlas replaces it).
Today's code: the `NotificationColumn` in `ReactRoot.jsx`,
`ToastContainer.jsx`, `Toast.jsx`, `DiscardBinPanel.jsx`.
⚠️ Dragging a Token to the bin must still work: the bin sidebar must pop out
when a dragged Token approaches its edge.

**Done when:** the mat is wider; both sidebars open on hover and close on
leave; a drag to the bin works; `bench:drag` Token → bin and bin → mat still
100 %.

## U5 — Shop layout, groups and Foundation tiers (builder for UI; engineer for the engine half)

**Layout** (owner's list): arrow buttons at top and bottom instead of a
scrollbar; the sprite **128 px on the right** (taking it out of the Shop onto
the map); the rest of the row no taller than the sprite; every row the same
size; costs in a **2 × 2 grid**.

**Groups** (locked): a CMS field marks shop Tokens as one group; the Shop
shows one row with a dropdown; the chosen entry's sprite and price show;
everything selectable, price the only gate. Today: `ShopDrawer.jsx`,
`Shop.js`; CMS `TokenEditor.jsx` (shop block).

**Foundation tiers** (locked): Foundations get a tier; building recipes get a
**minimum Foundation tier**; a higher tier builds everything a lower one can
(the same rule as `requiresContext.minTier`). Today: `tokenConstants.js`
(`FOUNDATION_KINDS`), `recipePoolRegistry.js` (`recipesForFoundation`),
`StationRecipeModal.jsx`, CMS `RecipeEditor.jsx`. Tests for the tier rule
(engine, picker, CMS round trip).

**Owner CMS to-do** after this phase: group the Wood Foundations (Oak, Maple,
Ebony), Stone Foundations (Stone, Marble, Basalt) and Anvils (Copper → Darkmetal);
author the new Foundation Tokens, Marble and Basalt items and sources, anvil
tiers, and each building's minimum tier. ⚠️ Maple and Ebony Foundations have
no art yet.

**Done when:** the Shop matches the layout on S2 and in the owner's save; a
test-fixture group shows as one row with a working dropdown and buys the
chosen entry; a tier-2 recipe is refused on a tier-1 Foundation and offered on
tier 2 and 3.

## U6 — Top bar, Token Summary, Upkeep and Passive Production (builder; engineer for T-102)

- **Token Summary** (locked): opens by **clicking** the Token counter; one row
  per type with status counts; hovering a row highlights that type's Tokens;
  missing-items problems pinned at the top, then by skill section; a plain
  "In the bin ×N" line. Today: `MatCapBadge.jsx`, `MatSummary.js`.
- **T-102**: Token cap **80**, and **spawned Tokens count too**. *Director
  default for the open interaction:* spawner family caps stay; a spawner also
  waits (at cap) when the mat's cap is full. Move the cap out of the dev
  tuner into a game value as part of this (half of T-097).
- **Upkeep panel** shows only what consumes: no passive production lines.
  Today: `UpkeepSummary.js`, `UpkeepSummaryPanel.jsx`, `MatUpkeepBadge.jsx`.
- **T-099 Passive Production**: rename "trickle" everywhere a player reads
  it; all Guild Hall passive income on **one 5-minute timer**; the **Wishing
  Well joins it** (about 10 Water per 5 min, scaling with rank; no hero on the
  Hall). Today: `SpawnerSystem.advanceTrickle`, `TrickleTooltip.jsx`,
  `GuildUpgradeManager.js` (the Wishing Well rewrites the Hall's def; that
  goes). Engine bench work will change: accept with the ticket.
- **Clean tooltips** on the top bar's badges (UI_STYLE).

**Done when:** the summary works as specified on S2; the cap reads /80 and
counts spawned Tokens; a full mat stops spawners; Passive Production pays
on one timer in the game; Upkeep lists no income.

## U7 — Token inspection (builder)

Owner's list: charges, time and XP shown **as bubbles** that update while the
Token is worked; skill icons **sharp** (whole-pixel scale); the popup's tail
and shape like the speech bubbles; "Heroes may work this" becomes a
**Disallow** switch. The "Origin (dev)" line stays dev/Debug-only (T-097 hides
Debug Mode). Today: `TokenInspectPopup.jsx`, `TokenInspection.jsx`,
`lifecycleLines.js`.

**Done when:** inspecting a worked Token shows live bubbles; icons crisp at
1× and 2×; the switch disallows.

## U8 — Motion and small polish (builder)

- **Spawn pop-out**: a spawned Token pops out of its spawner and slides a
  little to its spot. Add a draw switch `spawnMotion`.
- **Item flight** duration scales with distance (short hops are quick).
  Today: `ParticleOverlay.jsx`.
- **Quests**: the target item's sprite drawn centred on the quest billboard.
  Today: `MatToken.jsx` (quest Token), `QuestTokens.js`.
- **Bank drag shadow**: dragging an item in the Bank uses the new hard pixel
  shadow, not the old soft one. Today: `BankTab.jsx`, `spriteFx.js`.

**Done when:** each seen in the game; `spawnMotion` in the draw-switch test.

---

At the end: close T-099, T-101 (if not done in brief 00), T-102 and the
UI-list items done; update NOW.md; the cost log has a line per phase.
