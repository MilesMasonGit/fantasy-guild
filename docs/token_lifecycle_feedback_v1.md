# Token Lifecycle — owner feedback v1

*Written 2026-09-26 from the owner's first playtest of the Token Lifecycle build
([`token_lifecycle_playtest_pack.md`](token_lifecycle_playtest_pack.md)). The first build's
record is [`token_lifecycle_roadmap_v1.md`](token_lifecycle_roadmap_v1.md); its decisions
(TL-1…TL-11, §2) stand unless a TL- decision below replaces them.*

**Status: quick wins Q1–Q9 (plus Q5b) ALL DONE and merged 2026-09-27. Larger reworks B1–B10 (§4.2) wait for later agents. Open owner questions: §5.**
**B2 (top bar) DONE 2026-09-27, B2.1–B2.3 merged (answers: §2 B2 rows). B1 (ring badges) DONE 2026-09-27, slices B1.1–B1.3 merged; ⭐ owner to look by eye (ring size, row in front of the hero, hover bubble height):** owner answers in §2 (B1 rows), decision TL-22, slices in §4.2 under B1.

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
| FB-52 | 🔧 | *(added after Q5)* The Guild Hall hover becomes a game-styled **live** tooltip (trickle income with a ticking "next in"). |
| FB-53 | 🔧 | *(added after Q5)* Guild Hall trickle payouts **drop as floating loot** beside the Hall, like any other item, instead of going straight into the Bank. |
| FB-54 | 🐞 | *(found in Q6)* A bubble for a Token that names no skill reads "My the right level is too low…" / "I don't have the the right skill…". |
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
| Hall tooltip (after Q5) | **A styled live tooltip now** (game-styled like the flag tooltip, ticking "next in"), not the browser's plain title. → FB-52, slice Q5b. |
| Trickle payouts (after Q5) | **Drop as floating loot like any other item** (collected on hover, TL-9), instead of going straight into the Bank. → FB-53, slice Q5b. |
| Mid-flight Hall moves (after Q5) | Fine as is: an item lands where the Hall was when the flight started. |
| After Q6 | "No work in range." **kept** · a stunned hero plays **no** attack · knockback timing (625 ms, on the strike frame) **kept** · the "My the right level…" wording bug is fixed in **Q7** (→ FB-54). The owner audits `speech_bubble_lines.md` later. |
| Floor seeds (after Q5b) | **Spawner upkeep also takes floor loot**: with trickle payouts lying on the mat (FB-53), spawners may pay upkeep from matching loot on the mat as well as the Bank, so idle play keeps running and the Hall trickle stays the backstop (SP-66). → TL-20. |
| Hall tooltip width (after Q5b) | **Widen it to fit** each trickle line on one row. |
| Pacing detail (before Q9) | The 3 s target sits below the tempo bands (Fast 8–12 s) and D-164's 10–30 s check → **add a Quick band** (TL-21). Early gathering Tokens get **5 charges** (Apple Tree 3, Ripe Wheat stays 3). **Spawners untouched**: the owner tunes them in play. Answer to Q7's "item-bar format" and Flag Radius art questions still open. |
| Snap-to-middle (during Q9) | Every CMS sync snaps a tagged producer's cycle time to its band's middle. Owner chose **narrow Quick to 2–4 s** (middle 3 s), **widen Fast down to 4 s** to close the gap (so 4–12 s, middle 8 s), **accept 8 s** for the calculator-tuned processing recipes, and **tag** Charcoal, Torch, Copper Nails and the builds anyway (Fast / Heavy). TL-21 rewritten accordingly. |
| FB-46 hero dock | The **owner describes the general idea first**, then the agent makes mockups. |
| FB-39 Hall tree | **Mockups first**; the sprite bug (FB-40) is fixed earlier as a quick win. |
| B1 layout (2026-09-27, from the mockup) | **Bare rings, centred** under the pair (option A): each ring has its own dark backing, no tray. With no hero the row centres under the Token alone. Heroes stand on either side (`HeroMotion.standingSpot`), so the row follows the pair. → TL-22. |
| B1 visibility | **Mixed**: standing facts (spawner `n/cap`, turn countdown) always show; cycle, charges and enemy HP show while a hero works the Token; hovering any Token shows its charges ring, replacing the bottom-right hover charge chip. |
| B1 rings and order | **Fixed order**: cycle, then charges, then the Token's own ring (spawner count, turn countdown or enemy HP). The cycle ring shows **seconds left**; unlimited charges draw no charges ring. Colours as the mockup: white cycle (fills), gold charges (empties), green spawner (fills to cap), sky turn (empties), red HP (empties). |
| B2 bar style (2026-09-27, from the mockup) | **A slim wooden strip** across the top of the board area, styled like the mat's brown frame: info on the left (Token cap, Upkeep), controls on the right (disallow mode, *Allow all*, Time Bank), room in the middle for future mat controls. The mat shrinks slightly to fit. |
| B2 Upkeep badge | **Total items per minute, always neutral** (`Upkeep 2/min`, every item added up; never coloured — spawners' own centre alerts do the warning). Hover opens the full Upkeep Summary (8.2). The Bank drawer's Upkeep toggle is **removed** (FB-29). |
| B2 Token cap | `Tokens 7/12` (placed, SP-67). Hover lists **placed Tokens by type with counts**, with a short red note where some are blocked or disallowed, then one line of spawned Tokens marked "not counted". |
| B2 disallow mode | **A toggle**: on, the mat gets a red dashed edge and a hint line; each click on a Token flips allowed / disallowed (FP-35); dragging pauses; Esc or the button ends it. **Allow all** acts at once, no confirm. |
| B2 drag pause (at B2.3's merge) | **Mat only**: in disallow mode, Tokens, heroes and flags on the mat can't be dragged; the dock and the Bank still drag. |
| B2 Time Bank | The Time Bank widget **moves into the bar** (right end). It is switched off in code today (`SHOW_TIME_BANK = false` in `ReactRoot.jsx`), so it moves behind the same switch and stays hidden until the owner turns it on. |
| B3 bin holding (2026-09-27, up-front interview) | A Token dragged into the bin **leaves the mat**: heroes stop working it and its spot frees. It **still counts toward the Token cap** until discarded (the bin can't dodge the cap), and the bin is **saved with the game**. |
| B3 bin look | **A grid of nine slots, each showing the binned Token's own icon** (its sprite); **any Token can be dragged back out** onto the mat. Refund total above the button. |
| B3 confirm | **"Discard all (n)" is the confirm**: one press discards everything and pays the refund shown; no second dialog. |
| B4 Shop drawer | **Slides in from the left edge**, about a third of the screen wide, Tokens listed by section; the bottom drawer keeps the Bank only. During a drag it slides away to a thin lip (FB-27). |
| B4 unaffordable | Rows you can't afford, or that won't fit under the cap, are **dimmed, show what's missing in red, and can't be picked up**: nothing is dropped and then refused. |
| B5 bad pin | A flag dropped on a Token its hero **can't work** (skill or level) **plants as a normal area flag** at that spot, and the hero's bubble says why. |
| B5 spawner pin | **Spawners can't be pinned**: a flag dropped on one is a normal area flag. Pins only go on Tokens a hero can work. |
| B5 pin follows | A pinned Token **carries its flag** when you move it; the hero walks to the new spot. |
| B6 quest spots | Quest Tokens appear **near the Guild Hall** and count as **spawned** (the Hall makes them): **not counted** toward the Token cap; draggable like any Token. |
| B6 rewards | Claiming **drops the reward as floating loot** beside the quest, collected on hover (as FB-53), never straight into the Bank. |
| B6 pace | **Cap 2**, a new Guild Hall track (**Notice Board**) adds **+1 per rank to 5**; below the cap a new quest arrives **every 3 min of game time**. Numbers in the Mat Tuner. |
| B6 + B8 displays | A quest shows its **progress as a ring** (B1 style, e.g. `3/10`). **Small Tokens keep full-size rings** (readable) though their art is half size. |
| B7 ambushed | A hero attacked by a hostile enemy **always fights back**, whatever its flag rules say, then returns to work. → TL-24. |
| B7 hostiles | First content pass: **Goblin and Goblin Chief hostile**; Cow and Thorn Elemental fight only when attacked. Set per enemy in the CMS (the CMS must model the field first). |
| B7 range | Enemies **potter within about one Token's width** of their spawner (like idle heroes by a flag); a hostile one **attacks heroes inside the live flag radius** of its spawner. Both in the Mat Tuner. |
| B9 Hall layout | **The Hall in the centre, a web of upgrades spreading out from it**, joined by lines; the Effects list on the left (FB-38). Nodes placed freely, not on squares. → TL-23. |
| B9 web unlock | An upgrade opens when **any upgrade linked to it is bought** (or it links straight to the Hall). Links set in code now, CMS later. → TL-23. |
| B10 idea (owner's description) | Heroes shown **full size and idling** in the dock, **probably just the top half**; **name and health bar above their heads**; heroes out on the mat are **darkened and lowered**. |
| B10 frame | **A dark strip, no ledge.** A deployed hero's art is darkened and lowered, but its **name and health bar stay at the same height** (they don't sink). |
| B10 actions | **Hover lifts** the hero a little; click / double-click / drag onto the mat **as today**. The hero and its name / HP bar **may overlap the playmat** above the dock. |
| B10 Bank dock | The vertical hero panel beside the Bank is **left as it is** for now. |
| B1 alert labels | The progress bar's red/yellow labels (Need Items, Wrong Skill, Level Too Low…) **become the centre alert mark** (TL-14), with the same hint and missing-requirements list on hover. The cycle ring greys out while blocked. |

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
| **TL-20** | **Upkeep can be paid from floor loot.** A spawner's per-spawn upkeep (SP-70) takes matching item loot lying on the mat as well as items in the Bank, through the existing `consumeFromSprites` path. The Upkeep Summary and needs-item alerts count both. | SP-70's implicit "paid from the Bank" (roadmap v1 slice 3.3) |
| **TL-21** | **A fifth tempo band, Quick, 2–4 s at level 1** (middle 3 s), and **Fast widened to 4–12 s** (middle 8 s) so the bands join up; Medium, Slow and Heavy unchanged; all scale with level as before. Because every CMS sync snaps a tuned producer to its band's middle, gathering (tagged Quick) runs at 3 s and the calculator-tuned processing recipes (Copper Ingot, Shrimp, Apple Juice, tagged Fast) at 8 s; untuned recipes (Charcoal, Torch, Copper Nails, Copper Pickaxe) are tagged Fast and keep a typed 6 s; builds and plantings are tagged Heavy at 30 s. XP per cycle and item values re-derive from the new times (accepted). | The tempo table's four bands (economic simulator plan §13.3): Fast was 8–12 s |
| **TL-22** | **Ring badges replace the progress bar.** A Token's live numbers are ring badges (a ring that fills or empties, the number inside) in one row centred **under the hero and the Token together** (under the Token alone with no hero): cycle (seconds left), charges, then the Token's own ring (spawner count, turn countdown, enemy HP). A worked Token's problems move to the centre alert mark (TL-14). | TP-2 / TP-4 (the progress bar in the gap under the Token), the corner spawner count and turn countdown (Q2, Q8), and the hover charge chip |
| **TL-23** | **The Guild Hall upgrades are a web around the Hall.** The Hall sits in the centre of its screen; upgrades are nodes placed freely around it, joined by lines; an upgrade can be bought once **any** node linked to it is bought (or it links to the Hall directly). The Effects list sits on the left. | The Hall's separate 7×7 upgrade grid and its cardinal-neighbour unlock (`isTileAccessible`, the "Playmat 6x6 + Split Upgrade Board" 7×7) |
| **TL-24** | **Attacked heroes always fight back.** A hero attacked by a hostile enemy fights it whatever its flag rules say (the Fight rule governs only whether a hero *seeks* fights), then returns to its work. | The Fight rule as the only gate on a hero fighting (FlagRules `FIGHT`) |
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
| Q5b | **Hall follow-ups** — ✅ done 2026-09-27 (styled live tooltip, `TrickleTooltip.jsx`, sized to its longest line; trickle payouts drop through `SpriteLayer.addSprite` and merge into piles in bulk; TL-20 spawner upkeep via `InputAllocator`, Bank first then mat-wide floor loot; rule upkeep stays Bank-only. Agent verified live; tests baseline 10) | FB-52 styled live Hall tooltip · FB-53 trickle payouts drop as loot |
| Q6 | **Speech bubbles and hero animation** — ✅ done 2026-09-27 (bubble tail 2 u above the art at any scale; routine "Working at" and both unset-station lines dropped; catalogue [`speech_bubble_lines.md`](speech_bubble_lines.md) for the owner's audit; combat: idle, one attack play-through per real attack, knockback delayed 625 ms to the strike frame; stuck hero idles via the shared `strikesLive`; spawn-here glows (tests only: no shipped Token uses it). Agent measured all of it live; tests baseline 10) | FB-20 raise them · FB-21 drop everyday lines · FB-22 a list of every line for the owner's audit · FB-49 combat: idle, attack once per real attack · FB-50 stuck hero idles · FB-51 spawn-in-place glow |
| Q7 | **Panels** — ✅ done 2026-09-27 (QA panel capped to the window with one scroll body, banner slider gone — `cardSizeStore` kept, the drag ghost still reads it; Hall upgrade sprites repointed to the moved art, Flag Radius borrows the hero flag; no dock on the Guild Hall page; Shop has no inspect column, prices as `EntityRibbon` rows; FB-54 wording fixed. Agent verified QA panel, Hall images, dock, a purchase live; ⭐ Shop drawer not seen live (drawers don't open with the pane hidden) — owner to glance. Tests: baseline 10) | FB-36 QA panel fits the screen · FB-37 drop the banner slider · FB-40 Hall upgrade sprites · FB-47 no dock on the Hall upgrade page · FB-24 no Shop inspect panel · FB-26 Shop prices in the item-bar format · FB-54 bubble wording bug |
| Q8 | **Chance transforms** — ✅ done 2026-09-27 (`turns: { into, everyMs, chance }`, chance a PERCENT like every other content chance, defaults 60000 ms / 30 in `tokenConstants.js`; turn-back reads the original's numbers; `lastsMs` retired (audit warns); a failed roll is one clock lap, so big ticks equal many small ones; a won-but-blocked roll is kept (`clocks.turnWon`); sky-blue `m:ss` countdown badge bottom-left + inspection lines; CMS Turns block edits both fields. Content: Coast re-authored through the CMS (`fabb252`, 2 lines). Agent verified live: 49 flips in 180 simulated minutes (~27%), badge counting down both ways. Tests: baseline 10) | FB-14 countdown · FB-15 / TL-12 engine + CMS field, then the Coast through the CMS |
| Q9 | **Pacing first pass** — ✅ done 2026-09-27 (TL-21 bands in `tempoBands.js`; content `ace6e1a` through the CMS: gathering 3 s tagged Quick with 5 uses (Apple Tree 3, Ripe Wheat 3) — ⚠️ **Coal Vein landed at 4 s** (tagged for gold, the calculator slowed it); Copper Ingot / Shrimp / Apple Juice 8 s Fast; Charcoal, Torch, Copper Nails, Copper Pickaxe 6 s Fast; builds and plantings 30 s Heavy; XP per cycle 2 → 1 and 12 item values fell (coal 4 → 1, seeds to 1–2, ingots slightly). Agent timed live: Oak Tree every 3.00 s, gone after 5; Workbench build ~30 s; Charcoal every 6.00 s. Tests: baseline 10) | FB-19 through the CMS (content-only commit) |

### 4.2 Briefs for later agents

Short on purpose: each agent reads this document, the roadmap's §0.5 and the named decisions,
then plans with the owner. Suggested order in brackets.

**B1 Token badges (1st).** FB-3, FB-4 (and FB-5 as a ring). Ring badges that fill or empty with a
number inside (cycle time, charges, spawner count), in one uniform row **under the hero and the
Token together**, replacing today's progress bar. Builds on Q2's corner badges. Show the owner a
mockup of the row before building.

| # | B1 slice | Status |
|---|---|---|
| B1.1 | **Centre alerts**: a worked Token's problems become the centre mark (TL-14) with the hint and missing list on Token hover; the bar stops drawing alerts | ✅ 2026-09-27. Director verified live on a Furnace (slot 3): one Copper Ingot cycle with the bar, then ore ran out → yellow centre mark, bar hidden; Token hover shows "Need Items", the hint and "Copper Ore" in a 220 px bubble. Director fixed two things found live: the missing list read MatToken's slim token (no `selectedRecipeId`), so a station's inputs were never listed (the old bar had the same flaw), and the bubble was one 552 px line. A gear-only alert (nothing chosen) now draws nothing at all. Tests: baseline 10 |
| B1.2 | **Ring row**: ring badge + row centred under the pair; cycle (seconds left), charges, enemy HP; delete the bar and the hover charge chip | ✅ 2026-09-27. `RingBadge.jsx`, `TokenBadgeRow.jsx`, `ringRow.js`; rings 42 mat units (≈21 px at the default zoom); `TokenProgressBar.jsx` and `TokenChargeBadge` deleted; the −1 floater sits above the charges ring (corner when there is none); counts ≥ 1000 shortened (`1.2k`). Director verified live (slot 3): Oak Tree with the hero on its right — cycle `3s→2s→1s` filling, charges `5→4` emptying, row centre 413 px vs the pair's midpoint 414 px; Cow in combat — HP ring only, `32→0→32`; blocked Furnace — grey cycle ring, no number, no charges ring (unlimited), yellow centre mark; unworked Copper Vein — charges ring on hover only. Tests: baseline 10. ⭐ Owner to look by eye: ring size, and the row in front of the hero |
| B1.3 | **Standing rings**: spawner `n/cap` and turn countdown move from the corner into the row | ✅ 2026-09-27. `TurnRing.jsx` polls the roll clock itself (only it re-renders); the interval comes from `TimedChanges.turnTimingOf` (the original's numbers on a turned Token, TL-12); corner `SpawnerCountBadge` / `TurnCountdownBadge` deleted; probes read `[data-ring="spawner"]` / `[data-ring="turn"]`. Director verified live (slot 3), no hero, no hover: Oak Forest green ring `0/5`, centred under the Forest, going `1/5` when a sapling spawned; Coast sky ring `1:00→0:55`, emptying (0.988→0.900); no corner badges left. Tests: baseline 10 |

**B2 Top bar (2nd).** FB-28, FB-29, FB-31, FB-32. A thin bar above the playmat: Upkeep as a
hoverable badge (moves 8.2's Upkeep Summary out of the Item Bank), the Token cap with a hover
summary of everything on the mat, and a disallow mode plus *Allow all* (FP-35's per-Token disallow;
Q2 draws the badge). Leave room for more mat controls.

| # | B2 slice | Status |
|---|---|---|
| B2.1 | **The bar and the Token cap**: wooden strip above the mat; `Tokens n/cap` with the by-type hover summary; the Time Bank widget moved in (still switched off) | ✅ 2026-09-27. `MatTopBar.jsx` (30 px, left/right slots, not on the Guild Hall view), `MatCapBadge.jsx`, pure `MatSummary.js`; refreshed by `TILE_CHANGED`/`TOKEN_PLACED`/`TOKEN_DEPLETED`/`state_changed`/`game_loaded` and Mat Tuner changes, no polling; groups sorted most copies first, then name. "Blocked" = a non-gear engine alert or a spawner's live alert, worked or not. Director verified live (slot 3): bar 0–28 px, mat below it from 55 px (not covered, rescaled); `Tokens 2/40` on a new game → `5/40` after placing three; real hover showed "Placed 5 of 40 · Furnace ×2 (1 off) · Oak Forest ×2 (2 blocked, no seeds) · Copper Mine ×1 · Spawned 4 (not counted)". Tests: baseline 10 |
| B2.2 | **Upkeep badge**: `Upkeep n/min`, hover = the Upkeep Summary; the Bank drawer's Upkeep toggle removed | ✅ 2026-09-27. `MatUpkeepBadge.jsx`: total = sum of `perMinute` over the summary's item rows, one decimal with `.0` dropped (`<0.1` for tiny costs); refreshed on the panel's and cap badge's events plus the panel's 2 s poll; popover 300 px, max `min(420px, 70vh)`, scrolls, stays open while the pointer is over it (closes 150 ms after leaving); `UpkeepSummaryPanel` reused (gained `className`). Bank toggle gone. Director verified live (slot 3): `Upkeep 6/min` (two Forests), neutral classes; placing a third Forest → `9/min`, removing it → `6/min`; real hover showed the full summary (Oak Seed needed, Bank 0, both Forests waiting unpaid, trickle income). Tests: baseline 10 |
| B2.3 | **Disallow mode**: toggle, click-to-flip, red dashed mat edge + hint, Esc ends, dragging paused; *Allow all* | ✅ 2026-09-27. Mode store `src/ui/hooks/useDisallowMode.js`; controls `MatDisallowControls.jsx`; `Flags.allowAll()`; MatBoard passes the mode to Tokens as props (no new subscriptions). Only hero-workable Tokens flip (`Flags.isHeroWorkable`, same as the inspection panel's switch), so the Guild Hall and spawners do nothing; *Allow all* clears every disallowed Token. ⭐ Owner, at merge: **dragging pauses on the mat only** — Tokens, heroes, flags (inside `data-board-origin`); the dock and the Bank still drag. Director verified live (slot 3): toggle → "Disallow mode: on", `data-disallow-mode`, hint shown and click-through (`pointer-events: none`); a real click on the Guild Hall did nothing and opened no inspection; clicks on a Copper Vein flipped it off/on/off with `Allow all (1)→(2)`; Esc ended the mode; a real click on *Allow all (2)* cleared both, no red marks left. ⚠️ Coordinate clicks in the hidden pane land off-target; clicks by ref or dispatched on the Token were used. Tests: baseline 10 |

**B3 Discard bin and refunds (3rd).** FB-34, FB-35, **TL-13**. A bin of up to nine Tokens at the
bottom of the notification column, a refund total and one *Discard all* button; replaces 5.2's
inline Remove. Refund maths per TL-13 (a built station must remember its Foundation and build cost).
Refunds go through `InventoryManager` (D-138). Coordinate with B6, which removes quests from that
column.

| # | B3 slice | Status |
|---|---|---|
| B3.1 | **Bin engine + refunds** (`DiscardBin.js`): bin of 9 saved in `state.board.bin`, binned placed Tokens still count toward the cap, `unbinToken` puts one back unchanged, TL-13 refunds, `discardAll` pays through `InventoryManager`; built stations remember `builtFrom` (Foundation + paid build cost) | ✅ 2026-09-27. Consumable refund = ⌊price × left / (starting × 2)⌋ per item (Anvil 30/60 of 10 → 2); built = ⌊Foundation/2⌋ + ⌊build/2⌋ (Workbench 9); old-save built station without `builtFrom` → half the Foundation price only. ⚠️ `builtFrom` is lost if the built Token later transforms. Engine only, verified by 20 tests; live check with B3.2. Tests: baseline 10 |
| B3.2 | **Bin UI**: grid of nine icon slots at the bottom of the notification column, drag in / drag back out, refund total, *Discard all (n)*; the inspection panel's Remove goes | ✅ 2026-09-27. `DiscardBinPanel.jsx` (drop id `discard-bin`; slots drag out with `from.binnedId` through `dropOnMat`); refused drops spring back with a warning; cap hover adds "In the bin n (counted until discarded)". Director fixes found live: on a 720 px window the bin sat entirely below the screen (3×3 of 64 px slots under fixed-height Quests) → **grid is two rows of five with 32 px icons**, and the Quests section may shrink and scroll. Director verified live (slot 3, own port): Oak Forest dropped in → off the mat, own icon in a slot, cap stays `3/40`, refund `Oak Wood ×5`; Guild Hall refused; taken back out and re-binned; a real click on *Discard all (1)* → Oak Wood 10 → 15, bin empty, cap `2/40`. ⭐ Owner to try a real drag in and out by eye (the pane can't drag). Tests: baseline 10 |

**B4 Shop drag-to-buy (4th).** FB-25, FB-27. Tokens listed on the left, dragged onto the mat to buy
(pay on drop; refuse cleanly when the mat cap or the Bank says no). The drawer takes about a third of
the screen and slides mostly away during a drag. Uses the dnd-kit drag system.

| # | B4 slice | Status |
|---|---|---|
| B4 | **Shop drag-to-buy drawer**: from the left, a third wide; drag a row onto the mat to buy, pay on drop at the drop point; lip while dragging; unaffordable / over-cap rows dimmed, missing in red, not draggable; the bottom drawer keeps the Bank only | ✅ 2026-09-27. `ShopDrawer.jsx` (renamed from `CartographerTab.jsx`), `Shop.buyAt(typeId, point)` (places with `noRestock`, a refused placement charges nothing, off-mat = silent cancel), `dropOnMat` route `from.shop`, lip 28 px, drawer not a droppable (Board checks its live box at drop). Director verified live (slot 3): opened by the drawer event, 11 rows with affordability (Oak Forest / Coast / Farmland affordable at 10 Oak Wood; others dimmed, "Need 10× Stone"…); `buyAt` an Oak Forest at (1500, 300) → placed exactly there, Oak Wood 10 → 0, the row turned unaffordable; off-mat refused with no charge. ⚠️ With the agent's pane hidden, animation frames are frozen: the nav *Shop* button (which opens on the next frame, like the Bank's) and the slide could not be seen. ⭐ Owner by eye: the nav button opens the drawer, the slide, a real drag with the lip. A dropped Token never restocks a copy it lands on (director default). Tests: baseline 10 |

**B5 Flags (5th).** FB-44, FB-45, **TL-17**. Flags lose their hitbox (check which FP decisions
this touches); a flag dropped on a Token pins to it; when the Token is exhausted, the flag becomes a
normal area flag at that spot. Closes the playtest pack's "heroes can't be steered within a skill".

| # | B5 slice | Status |
|---|---|---|
| B5 | **Flags: no hitbox (FB-44) + pinned flags (FB-45, TL-17)** | ✅ 2026-09-27. The engine never gave flags a footprint; the **pointer** did: a flag's 128 px round button caught hovers/clicks meant for a Token behind it (a 2026-09-21 owner ruling, now reversed by FB-44/TL-17). Now a Token under the pointer wins and flags yield. Pins: `board.flags[heroId].pinnedTo` (instance id); only the player's flag drop pins (`plantFlagAt(…, { pin: true })`); a pinned hero's only candidate is its Token; the flag follows the Token when moved; `Flags.lapsePins` turns it into an area flag at the spot when the Token is gone (used up, removed, binned, or transformed — a transform makes a new instance, so it is not re-pinned); refused pins (skill not held, level too low) plant an area flag and the hero says the existing stuck-hero line; spawners, the Guild Hall and Promotion Tokens stay area flags silently. Director verified live (slot 3): pinned a flag to the farther of two Oak Trees → the hero worked only it; moved the Tree to (900, 500) → flag followed, still pinned; the Tree ran out → flag stayed there unpinned, hero idle (nothing in range); a drop on the Copper Mine → area flag, no pin. **Director defaults for the owner to overrule:** a pinned Token that is later disallowed or whose skill rule is switched off stays pinned and the hero waits (no override of the rule); disallowed / rule-off refusals get no bubble (no existing wording); Guild Hall and Promotion Tokens keep their old under-the-flag behaviour. Tests: baseline 10 |

**B6 Quests as Tokens (6th).** FB-41–FB-43, **TL-18**. Quest Tokens spawned by the Guild Hall to
an upgradable cap (a new Hall track), tutorial chain under a hidden cap, discard for non-tutorial
quests (through B3's bin), noticeboard behaviour. The sidebar goes. Quest cooldowns currently run on
the real clock and must move to the tick's `delta`.

| # | B6 slice | Status |
|---|---|---|
| B6.1 | **Quest Token engine**: `token_quest` (engine-owned, registered in code, not content), quests on the Token (`instance.quest`), Hall spawns, cap 2 + Notice Board, 3 min on game `delta`, tutorial chain, claim → loot, bin rules, old sidebar quests converted | ✅ 2026-09-27. `QuestTokens.js` (`window.Game.QuestTokens`), Mat Tuner group *Quests* (`questCap` 2, `questCapMax` 5, `questEverySec` 180). **Notice Board has 3 ranks** (2 + 3 reaches the owner's max of 5; a 4th would buy nothing), tile 25, placeholder prices. **Director defaults:** bounties run alongside the tutorial; when the cap is reached, leftover clock time is dropped (a freed place gets its next quest one full interval later). Tutorial quests can't be binned. Director verified live (fresh slot 3): the first tutorial quest was on the mat at once; +3 min → a bounty, +9 min → 2 bounties (cap), the tutorial not counted, `Tokens 2/40` unchanged; claiming an unfinished quest refused; claiming a done bounty and the done tutorial step dropped their Oak Wood as loot and removed the Tokens, and the next step "Plant a Flag" appeared. Tests: baseline 10 |
| B6.2 | **Quest Token UI**: hover to read, progress ring, glow when done, click to claim; the quest sidebar goes; the tutorial highlight reads quest Tokens | ✅ 2026-09-27. `QuestTooltip.jsx`; standing parchment ring (`RING_COLOUR.quest`, `questRing`); `.gi-quest-ready` breathing gold glow; a done quest claims on click (disallow mode never claims; a just-dropped drag never claims); the Quests section and `QuestColumn.jsx` are gone; `TutorialAideOverlay` reads the tutorial quest Token (its beacon lights on hovering that Token). No new per-Token subscriptions. Director verified live (slot 3): two quest Tokens with rings `0/1`, `0/3`; the column has no Quests; hover tooltip "Collect 3 Copper Ingot · 0/3 Copper Ingot · Reward 10"; adding 3 Copper Ingot → ring `3/3`, `data-quest-done`, glow on; a click claimed it — ingots handed in (3 → 0), a loot pile dropped, the Token gone. ⭐ Owner by eye: the glow and tooltip look. Tests: baseline 10 |

**B7 Enemies that move (7th).** FB-23, **TL-16**. Enemies tethered to their spawner like a hero to a
flag; hostile enemies (CMS field) attack heroes within range. Reuse hero movement
(`docs/hero_movement_roadmap_v1.md`) and the existing combat. The CMS must model the new field
before any content uses it.

| # | B7 slice | Status |
|---|---|---|
| B7.1 | **Enemies move, tethered to their spawner** (TL-16): potter near it, follow it, walk back, still while fighting | ✅ 2026-09-27. `EnemyMotion.js` (`window.Game.EnemyMotion`), shared step helper `walking.js` (HeroMotion uses it too); `instance.tether` set at spawn, old saves attach once to the nearest family spawner; Mat Tuner group *Enemies* (`enemyWalkSpeed` 90 u/s, `enemyPotterRadius` 128 u beyond the spawner's edge); strolls at half speed; also still while a hero is walking up to it or it is in the hand; a step publishes only `ENEMIES_WALKED` (one `ADJACENCY_DIRTY` when a walk ends). Enemy sheets have no walk cycle: idle plays while gliding. Only the Goblin Camp spawns enemies today (Cow, Thorn Elemental have no spawner and stay put). Director verified live (slot 3): a Goblin Camp's 3 Goblins all wandered (max 188 u from the camp); moving the camp across the mat → all three around it again (81–113 u) within 12 s; one dropped 1038 u away walked back to 75 u in 12 s. Tests: baseline 10 |
| B7.2 | **Hostility + fight-back** (TL-16, TL-24): CMS `hostile` field, hostile enemies attack heroes inside the flag radius of their spawner, attacked heroes always fight back | ✅ 2026-09-27. `isHostileEnemy(def)` (`enemy.hostile === true`); CMS Token editor *Hostile* checkbox in the Enemy section (written only when ticked; a control sync of the real data is byte-identical, tested); `Hostiles.js` (`window.Game.Hostiles`) looks every 250 ms of game time: each hostile enemy not already engaged takes the nearest hero inside `Flags.flagRadius()` of its spawner (one enemy per hero) through `Flags.ambush`, the normal claim + walk-up + fight path; while fighting back, the hero's Fight rule and pin can't release the claim; after the kill it returns to its work / pin. **Director defaults for the owner to overrule:** heroes with no combat skill are never attacked (they couldn't fight back); a disallowed hostile enemy attacks nobody; a many-charge hostile (Goblin Chief, 2) attacks again after each kill. Director verified live (slot 3, Goblin made hostile in the running game only): a hero with Fight OFF, pinned to an Oak Tree 110 u from a Goblin Camp, was ambushed every few seconds (5 Goblins), fought back each time and returned to its Tree, still pinned. ⚠️ Next to a hostile camp a hero gets little work done — by design, but worth watching in play. Tests: baseline 10 |
| B7.3 | **Content through the CMS**: Goblin and Goblin Chief hostile | — |

**B8 Small Tokens (8th).** FB-18, **TL-19**. A CMS size field; drawing, hit area, spacing and
pushing honour it; saplings and sprouts set to small through the CMS.

**B9 Guild Hall screen (9th).** FB-38, FB-39. Mockups first: Effects list on the left, a node-and-line
tree. ⚠️ Hall upgrade tile indices are not interchangeable with the playmat's.

**B10 Horizontal hero dock (10th).** FB-46. The owner describes the general idea first; then the
agent makes mockups; then builds.

## 5. Open questions for the owner (end of the quick-win session, 2026-09-27)

1. **Coal Vein at 4 s** (Q9): accept, re-tag its purpose from gold to items (likely 3 s, different value), or leave for the simulator rework.
2. **Flag Radius upgrade art** (Q7): it borrows the plain hero flag; keep until B9, or use the red banner art.
3. **"Item-bar format"** (Q7): Shop prices use the full `EntityRibbon` row (icon, name, have/need); or the compact icon-and-number pills of the Hall's Upgrade button.
4. **Rule upkeep and floor loot** (Q5b): TL-20 covers spawner upkeep only; rule (`BlockUpkeep`) upkeep still pays from the Bank alone.
5. **The bubble audit**: [`speech_bubble_lines.md`](speech_bubble_lines.md) awaits the owner's add/remove list.
6. **Watch by eye** (never seen on screen by an agent, whose browser pane was hidden): Q4 hit animations and transform glow, Q5 loot flight to the Hall, Q7 Shop drawer, Q8 countdown badge.

Noticed in passing, not fixed (out of scope): a freshly recruited hero's class reads "Adventurer", not "Recruit" (Q9 agent); `cardSizeStore` is half dead (Q7); the Guild Hall Map's loot pool names a missing `token_fallen_oak_tree`; unreachable Shop branches in `InspectionPanel.jsx`; the Settings toggle still says "between cards and inventory".
