# Token Lifecycle — owner feedback v1

*Written 2026-09-26 from the owner's first playtest of the Token Lifecycle build
([`token_lifecycle_playtest_pack.md`](token_lifecycle_playtest_pack.md)). The first build's
record is [`token_lifecycle_roadmap_v1.md`](token_lifecycle_roadmap_v1.md); its decisions
(TL-1…TL-11, §2) stand unless a TL- decision below replaces them.*

**Status: organised and interviewed 2026-09-26; plan APPROVED by the owner 2026-09-26. Quick wins Q1–Q9 in progress (§4.1).**

**Kinds:** 🐞 bug · 🔢 number tweak · 🔧 small change (a session or less) · 🏗️ larger rework
(needs a brief and its own agent).

---

## 1. The list, by area

### A. Layering on the mat

| Id | Kind | Item |
|---|---|---|
| FB-1 | 🔧 | Hero flags follow the same layering (z-order) rules as other Tokens instead of always drawing on top. |
| FB-2 | 🔧 | While a Token is being worked, that Token and its hero always draw on top. |

### B. Token UI on the mat (TL-4's "Token UI rework later" arrives)

| Id | Kind | Item |
|---|---|---|
| FB-3 | 🏗️ | Circular ring badges for things like cycle time and charges: a ring that fills or empties, with the number inside. |
| FB-4 | 🏗️ | The badges sit in one uniform row **underneath the hero and the Token together**, replacing today's progress bar, which sits under the Token alone. |
| FB-5 | 🔧 | Spawners show their capacity on the mat (e.g. 3 / 5). |
| FB-6 | 🔧 | Remove the **plus** badge that marks a Token as workable. |
| FB-7 | 🔧 | Use the existing gear sprite (`public/assets/ui/ui_gear.png`) as the button for choosing a recipe, shown in the Token's **top-left corner**. |

### C. Alert badges

| Id | Kind | Item |
|---|---|---|
| FB-8 | 🔧 | Alerts (the red *exhausted* one and the yellow *needs items / Tokens* one) sit at the **centre** of the Token. |
| FB-9 | 🔧 | ~~Alerts fade out on their own after about 10 seconds.~~ Refined in the interview (TL-14): **problem** alerts stay until fixed; only green notices fade. |
| FB-48 | 🔧 | *(added in the interview)* A **green notice** alert (`ui_alert_green.png`) for things that aren't problems but may want attention, such as a new Token spawning in. Fades after about 10 seconds. |

### D. Action animations

| Id | Kind | Item |
|---|---|---|
| FB-10 | 🔧 | A basic "hit" animation on the Token each time the hero strikes it, per skill: Forestry = side-to-side shake, Mining = shake in all directions, Fishing = slow bob up and down; others to be agreed. More complex animations come later. |
| FB-11 | 🔧 | A bright, glowy **transform** animation when work completes and a Token changes. |
| FB-49 | 🔧 | *(added after Q4)* In combat the hero **idles until it attacks**, then plays the attack animation **once** per real attack (not a looping swing). |
| FB-50 | 🔧 | *(added after Q4)* A hero stuck on a Token (the Token has an alert) plays **idle**, not the swing. |
| FB-51 | 🔧 | *(added after Q4)* A Token that appears in another's place (`EffectActions.spawn` "here", e.g. a stump) gets the transform glow. |

### E. Token behaviour

| Id | Kind | Item |
|---|---|---|
| FB-12 | 🐞 | Spawned Tokens (e.g. the Oak Sapling) can't be moved. They should drag like any other Token. |
| FB-13 | 🔧 | Stations and Foundations can sit with **no recipe selected**, so a hero doesn't start working a station the moment it's built. |

### F. Tokens that transform on their own

| Id | Kind | Item |
|---|---|---|
| FB-14 | 🔧 | Show a timer on Tokens that transform on their own (e.g. the Coast). |
| FB-15 | 🔧 | New standard for self-transforming Tokens: a **1-minute cycle with a 30% chance** to transform, both ways (Coast → Shrimp Coast and back), so it flips roughly every three minutes. Replaces the fixed 2 min / 1 min timer (SP-17, SP-50). Engine + CMS field. |

### G. Loot flight

| Id | Kind | Item |
|---|---|---|
| FB-16 | 🔧 | Collected items fly to the **Guild Hall Token**, not the Bank tab. |
| FB-17 | 🔧 | Item sprites stay at their normal full size while flying. |

### H. Token sizes

| Id | Kind | Item |
|---|---|---|
| FB-18 | 🏗️ | A **small** Token size: 32 px sprite shown at 64 px (half the standard 64 px sprite shown at 128 px). Mainly for saplings and similar. Touches drawing, hit areas, spacing and the CMS. |

### I. Pacing

| Id | Kind | Item |
|---|---|---|
| FB-19 | 🔢 | Early gathering fast (~3 s cycles, few charges); processing a little longer (5–7 s); long cycles kept for late-game power tasks and for building on Foundations or Farmland. Owner expects to tune this in the CMS. |

### J. Speech bubbles

| Id | Kind | Item |
|---|---|---|
| FB-20 | 🐞 | Bubbles sit too low and cover the top of the hero's head. |
| FB-21 | 🔧 | Drop everyday lines like "I'm working on Oak Tree". Bubbles are for unusual events only. |
| FB-22 | 🔧 | Give the owner a list of **every line a bubble can show**, so they can audit it and say what to add or remove. |

### K. Enemies

| Id | Kind | Item |
|---|---|---|
| FB-23 | 🏗️ | Enemies move again, and some are hostile. Each uses its **spawner as its flag**: idles around it, walks over if the spawner is moved, walks back if the enemy is moved away. |

### L. Shop

| Id | Kind | Item |
|---|---|---|
| FB-24 | 🔧 | The Shop no longer needs an inspect panel. |
| FB-25 | 🏗️ | Shop Tokens listed on the left and **dragged onto the mat to buy**, as Maps used to be. |
| FB-26 | 🔧 | Prices shown in the standard item-bar format. |
| FB-27 | 🏗️ | The Shop drawer takes about a third of the screen and slides mostly away while a Token is being dragged, so the player can see where to drop it. (Goes with FB-25.) |

### M. Top bar above the playmat

| Id | Kind | Item |
|---|---|---|
| FB-28 | 🏗️ | A new thin bar above the playmat for mat controls. |
| FB-29 | 🔧* | Upkeep becomes a hoverable badge in that bar (out of the Item Bank). |
| FB-30 | 🔧 | Trickle income shows when hovering over the Guild Hall. |
| FB-31 | 🔧* | The Token cap shows in the bar; hovering it gives a summary of every Token on the mat. |
| FB-32 | 🔧* | Simple controls in the bar for disallowing / allowing Tokens. |
| FB-33 | 🔧 | The existing disallowed sprite (`public/assets/ui/ui_disallow_red.png`) in a disallowed Token's **top-right corner**. |

\* small once the bar (FB-28) exists.

### N. Discarding Tokens

| Id | Kind | Item |
|---|---|---|
| FB-34 | 🏗️ | A **recycling bin**: drag Tokens into it (up to nine), then one confirm button discards them all. |
| FB-35 | 🔧 | Refunds (**replaces TL-1**): Tokens with value such as spawners return **half** their price in items; consumable Tokens such as Anvils return their price × the share of charges left, **halved, rounded down**. |

### O. QA tools

| Id | Kind | Item |
|---|---|---|
| FB-36 | 🐞 | The QA panel is taller than the screen. |
| FB-37 | 🔧 | Remove the *banner card width* slider from it. |

### P. Guild Hall screen

| Id | Kind | Item |
|---|---|---|
| FB-38 | 🏗️ | The screen is messy. The Effects list goes to the **left** of the upgrade tree. |
| FB-39 | 🏗️ | Switch to a conventional tree: nodes connected by lines. |
| FB-40 | 🐞 | Upgrade sprites aren't showing. |

### Q. Quests

| Id | Kind | Item |
|---|---|---|
| FB-41 | 🏗️ | Quests move from the sidebar to **Tokens on the mat**, spawned slowly by the Guild Hall up to an upgradable cap. |
| FB-42 | 🏗️ | Tutorial quests start on the mat; a new one spawns as the last is completed (a hidden cap). |
| FB-43 | 🏗️ | Non-tutorial quests can be discarded to free the cap for new ones. |

### R. Flags

| Id | Kind | Item |
|---|---|---|
| FB-44 | 🔧 | Flags have **no hitbox**: they don't block or push Tokens. |
| FB-45 | 🏗️ | A flag can be dropped **onto a Token**, meaning "work only this one". When that Token is exhausted, the flag takes its spot and the hero moves on to other work. (Also answers the playtest pack's known issue: heroes can't be steered within one skill.) |

### S. Horizontal hero dock

| Id | Kind | Item |
|---|---|---|
| FB-46 | 🏗️ | Rework the horizontal hero dock; today it looks like a squashed copy of the vertical dock shown with the Bank. |
| FB-47 | 🔧 | Don't show the dock on the Guild Hall upgrade page. |

---

## 2. Interview answers (owner, 2026-09-26)

| Item | Answer |
|---|---|
| FB-9 alert fade | **Problem alerts stay** until the problem is fixed. Things that aren't problems but may want attention (e.g. a new Token spawning) use the **green** alert and fade after ~10 s. → FB-48, TL-14. |
| FB-10 hit animations | **One per skill now**, approved as proposed: Logging side-to-side shake · Mining jitter in all directions · Fishing slow bob · Farming sway from the base, like wind · Smithing sharp downward squash (hammer blow) · Crafting small hop · Cooking quick double pulse (bubbling) · Construction drop and settle (a thump) · Explore slow rustle/tilt · Combat (Melee, Ranged, Magic) knocked back away from the hero with a brief red flash. |
| FB-15 transforms | **Per Token, set in the CMS**, default 1 min / 30%, both directions. The timer (FB-14) counts down to the next roll. → TL-12. |
| FB-13 no recipe | **All stations** start with no recipe, however they arrive; once picked, a recipe stays. → TL-15. |
| FB-35 built refund | **Half of everything**: half the Foundation price plus half the build cost, rounded down (Workbench: 7 + 2 = 9 Oak Wood). → TL-13. |
| FB-34 what can be binned | **Spawned Tokens too, for no refund**; the spawner just makes another. The Guild Hall never. → TL-13. |
| FB-34 where the bin lives | **At the bottom of the notification column, where quests are now.** |
| FB-45 pinned flag | When the pinned Token is exhausted, the flag **becomes a normal area flag** at that spot; it is not re-pinned automatically. → TL-17. |
| FB-23 hostile | A hostile enemy **attacks heroes that come within range** of its spawner; others fight only when attacked. Per enemy, in the CMS. → TL-16. |
| FB-32 disallow controls | A **disallow mode** toggle in the top bar: while on, clicking a Token flips allowed/disallowed; plus *Allow all*. Uses the existing per-Token disallow (FP-35), so no new decision. |
| FB-41 quest Tokens | **Noticeboard, click to claim**: hover to read, it tracks itself, glows when done, click to claim, then it vanishes. No hero involved. → TL-18. |
| FB-19 pacing | **The agent does a first pass** in the CMS (gathering 3 s with fewer charges, processing 6 s, Foundation/Farmland builds 30 s); the owner fine-tunes. |
| FB-18 small size | A **CMS size field** (standard / small); saplings and sprouts start small; small Tokens get a smaller hit area and spacing. → TL-19. |
| FB-12 retest (after Q1) | "Probably just a misclick on my end, it seems to be working fine now." Q1's hold-while-carried fix stays. |
| Unset station look (after Q1) | **Just the gear, no alert**: a station or Foundation with nothing chosen shows only the gear (FB-7), perhaps gently pulsing; it is waiting, not broken. Replaces Q1's red "Choose a recipe" and 6.1's red "Choose what to build" alerts. Done in Q2. |
| Exhausted alert (after Q2) | The red alert left where a used-up Token stood **fades after 10 s** like a notice (it can't be fixed; the spawner's own alert covers real problems). Done with Q3. |
| Notices during catch-up (after Q2) | **No notices while the game replays time away** (time bank): you come back to a calm mat. Done with Q3. |
| Notice text (after Q2) | "New Oak Sapling", hover "Spawned by Oak Forest": **keep**. |
| Test save slot (after Q2) | Slot 3 deleted with the owner's OK; agents use **slot 3** for fresh test games and never touch slots 1–2. |
| Combat knockback (after Q4) | **Only on real hits.** Owner: *"I'll want to update the animation cycle for combat to have the hero idling until they attack, where it will play the attack animation once."* → FB-49. |
| Stuck hero (after Q4) | **The hero idles when stuck** (its Token has an alert), instead of swinging at nothing. → FB-50. |
| Spawn glow (after Q4) | **Yes:** a Token that appears in another's place (e.g. a stump, via `EffectActions.spawn`) glows like a transform. → FB-51. |
| FB-46 hero dock | The **owner describes the general idea first**, then the agent makes mockups. |
| FB-39 Hall tree | **Mockups first**; the sprite bug (FB-40) is fixed earlier as a quick win. |

## 3. New decisions

| Id | Decision | Replaces |
|---|---|---|
| **TL-12** | **Self-transforming Tokens roll a chance.** Each has a cycle length and a chance in the CMS (default 1 min, 30%), used in **both** directions, so a Coast flips to a Shrimp Coast and back about every three minutes. The Token shows a countdown to its next roll. A catch in progress when it turns back is still lost (SP-51). | The fixed timings of SP-17 / SP-50 (and the Coast's 120 s / 60 s) |
| **TL-13** | **Discarding refunds.** A bought Token returns **half its price**; a consumable (e.g. an Anvil) returns its price × the share of charges left, **halved**; a station built on a Foundation returns half the Foundation price **plus** half the build cost. All rounded down, per item. Spawned Tokens can be discarded for nothing; the Guild Hall never. Discarding goes through a **bin of up to nine Tokens with one confirm button**, at the bottom of the notification column. | **TL-1** (no refunds) and 5.2's inline Remove |
| **TL-14** | **Two kinds of alert.** Problem alerts (red, yellow) sit at the **centre** of the Token and **stay until fixed**. Notices (green, e.g. a new spawn) fade after ~10 s. | 8.3's alert placement |
| **TL-15** | **Stations start with no recipe.** Every station, however it arrives, is idle until the player picks a recipe with the gear (FB-7); heroes don't work it until then. A picked recipe stays. | Default recipes (`defaultRecipeFor`) |
| **TL-16** | **Enemies move again.** Each is tethered to its spawner as a hero is to a flag: idles near it, follows it if moved, walks back if carried away. **Hostile** enemies (a CMS setting) attack heroes that come within range. | Static enemy Tokens since the enemy-Tokens merge |
| **TL-17** | **Flags have no hitbox and can be pinned.** A flag never blocks or pushes Tokens. Dropped onto a Token, it means "work only this one"; when that Token is exhausted the flag stays at the spot as a normal area flag. | Whatever FP rule gives flags a footprint (the brief checks) |
| **TL-18** | **Quests are Tokens.** The Guild Hall spawns them slowly up to an upgradable cap; tutorial quests start on the mat and chain under a hidden cap; non-tutorial quests can be discarded. Noticeboard, click to claim. | The quest sidebar |
| **TL-19** | **Two Token sizes.** A CMS field: standard (64 px art at 128 px) or small (32 px art at 64 px), with a matching hit area and spacing. | One size for all |

## 4. Plan (approved 2026-09-26)

### 4.1 Quick wins, this session

Each line is one small slice: built, tested, played and committed separately.

| # | Slice | Items |
|---|---|---|
| Q1 | **Behaviour fixes** — ✅ done 2026-09-26 | FB-12 spawned Tokens can be dragged · FB-13 / TL-15 stations start with no recipe. *FB-12: no rule blocked spawned drags; the one reproducible failure was a Token that grew or turned while carried (it became a new Token and the move was lost). A Token in the hand now holds any grow/turn until it is put down. ⚠️ Owner to retest: if saplings still won't move, say when it happens. FB-13: `defaultRecipeFor` removed; a station with nothing picked says "Choose a recipe" (red, like Foundations) and flags skip it; a deleted recipe id becomes no recipe. Tests: baseline 10, no new failures.* |
| Q2 | **Corner and centre badges** — ✅ done 2026-09-26 (plus badge gone; gear top-left, pulsing until chosen, opens the picker; red disallow sprite top-right; one centred alert mark; problems stay, green notices fade after 10 s via `TokenNotices.js`; spawner `n/cap` bottom-left. Director verified live: gear pulse, `5/5`→`4/5`, disallow badge, yellow alert centred and still up at 25 s, cleared by seeds, green notice on the new sapling gone at ~10 s. Tests: baseline 10) | FB-6 remove the plus · FB-7 gear top-left (opens the recipe picker) · FB-33 disallow badge top-right · FB-8 / FB-48 / TL-14 alerts centred, problems stay, green notices fade · FB-5 spawner count as a simple badge (becomes a ring in B1) |
| Q3 | **Layering** — ✅ done 2026-09-26 (flags sort with Tokens by y in one band; worked Tokens + their hero in a band above; the hovered Token frontmost; flags now sit under loot. Q2 follow-ups: exhausted / refused-drop alerts fade after 10 s; no spawn notices during time-bank replay. Director verified live: a flag above the Forest drew behind it (z 10 vs 16); a worked Oak Tree drew above the Token below it (37 vs 34). Tests: baseline 10) | FB-1 flags layer like other Tokens · FB-2 a worked Token and its hero on top |
| Q4 | **Animations** — ✅ built 2026-09-26, ⭐ owner to watch them play (a hit = the hero's 1 s swing loop, synced to its strike frame 5 from one shared clock; combat knocks back on each real landed hit, ~2.5 s; table in `hitAnimations.js`; glow on every `transformInstance` via `TokenGlows.js`, skipped during catch-up. Verified by probes, not by eye: the agent's browser pane was hidden, so animations were confirmed running and timed but not watched. Tests: baseline 10) | FB-10 the ten hit animations · FB-11 transform glow |
| Q5 | **Loot and the Hall** — ✅ done 2026-09-27 (loot aims at the Hall's on-screen art at collect time, falling back to the Bank bubble if the Hall is missing/carried/off-screen; flight size = floor size × mat scale; the Hall brightens briefly as loot lands; Hall hover title lists trickle income with "next in". Agent traced a real flight landing on the Hall's centre at a constant 64 px; director verified the hover text live. ⭐ Owner to watch the arc by eye. Tests: baseline 10) | FB-16 items fly to the Guild Hall · FB-17 full-size in flight · FB-30 trickle income on Hall hover |
| Q6 | **Speech bubbles and hero animation** | FB-20 raise them · FB-21 drop everyday lines · FB-22 a list of every line for the owner's audit · FB-49 combat: idle, attack once per real attack · FB-50 stuck hero idles · FB-51 spawn-in-place glow |
| Q7 | **Panels** | FB-36 QA panel fits the screen · FB-37 drop the banner slider · FB-40 Hall upgrade sprites · FB-47 no dock on the Hall upgrade page · FB-24 no Shop inspect panel · FB-26 Shop prices in the item-bar format |
| Q8 | **Chance transforms** | FB-14 countdown · FB-15 / TL-12 engine + CMS field, then the Coast through the CMS |
| Q9 | **Pacing first pass** | FB-19 through the CMS (content-only commit) |

### 4.2 Briefs for later agents

Short on purpose: each agent reads this document, the roadmap's §0.5 and the named decisions,
then plans with the owner. Suggested order in brackets.

**B1 Token badges (1st).** FB-3, FB-4 (and FB-5 as a ring). Ring badges that fill or empty with a
number inside (cycle time, charges, spawner count), in one uniform row **under the hero and the
Token together**, replacing today's progress bar. Builds on Q2's corner badges. Show the owner a
mockup of the row before building.

**B2 Top bar (2nd).** FB-28, FB-29, FB-31, FB-32. A thin bar above the playmat: Upkeep as a
hoverable badge (moves 8.2's Upkeep Summary out of the Item Bank), the Token cap with a hover
summary of everything on the mat, and a disallow mode plus *Allow all* (FP-35's per-Token disallow;
Q2 draws the badge). Leave room for more mat controls.

**B3 Discard bin and refunds (3rd).** FB-34, FB-35, **TL-13**. A bin of up to nine Tokens at the
bottom of the notification column, a refund total and one *Discard all* button; replaces 5.2's
inline Remove. Refund maths per TL-13 (a built station must remember its Foundation and build cost).
Refunds go through `InventoryManager` (D-138). Coordinate with B6, which removes quests from that
column.

**B4 Shop drag-to-buy (4th).** FB-25, FB-27. Tokens listed on the left, dragged onto the mat to buy
(pay on drop; refuse cleanly when the mat cap or the Bank says no). The drawer takes about a third of
the screen and slides mostly away during a drag. Uses the dnd-kit drag system.

**B5 Flags (5th).** FB-44, FB-45, **TL-17**. Flags lose their hitbox (check which FP decisions
this touches); a flag dropped on a Token pins to it; when the Token is exhausted, the flag becomes a
normal area flag at that spot. Closes the playtest pack's "heroes can't be steered within a skill".

**B6 Quests as Tokens (6th).** FB-41–FB-43, **TL-18**. Quest Tokens spawned by the Guild Hall to
an upgradable cap (a new Hall track), tutorial chain under a hidden cap, discard for non-tutorial
quests (through B3's bin), noticeboard behaviour. The sidebar goes. Quest cooldowns currently run on
the real clock and must move to the tick's `delta`.

**B7 Enemies that move (7th).** FB-23, **TL-16**. Enemies tethered to their spawner like a hero to a
flag; hostile enemies (CMS field) attack heroes within range. Reuse hero movement
(`docs/hero_movement_roadmap_v1.md`) and the existing combat. The CMS must model the new field
before any content uses it.

**B8 Small Tokens (8th).** FB-18, **TL-19**. A CMS size field; drawing, hit area, spacing and
pushing honour it; saplings and sprouts set to small through the CMS.

**B9 Guild Hall screen (9th).** FB-38, FB-39. Mockups first: Effects list on the left, a node-and-line
tree. ⚠️ Hall upgrade tile indices are not interchangeable with the playmat's.

**B10 Horizontal hero dock (10th).** FB-46. The owner describes the general idea first; then the
agent makes mockups; then builds.
