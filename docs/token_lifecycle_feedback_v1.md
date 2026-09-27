# Token Lifecycle — owner feedback v1

*Written 2026-09-26 from the owner's first playtest of the Token Lifecycle build
([`token_lifecycle_playtest_pack.md`](token_lifecycle_playtest_pack.md)). The first build's
record is [`token_lifecycle_roadmap_v1.md`](token_lifecycle_roadmap_v1.md); its decisions
(TL-1…TL-11, §2) stand unless a TL- decision below replaces them.*

**Status: organised, interview pending, no code changed.**

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
| FB-9 | 🔧 | Alerts fade out on their own after about 10 seconds. |

### D. Action animations

| Id | Kind | Item |
|---|---|---|
| FB-10 | 🔧 | A basic "hit" animation on the Token each time the hero strikes it, per skill: Forestry = side-to-side shake, Mining = shake in all directions, Fishing = slow bob up and down; others to be agreed. More complex animations come later. |
| FB-11 | 🔧 | A bright, glowy **transform** animation when work completes and a Token changes. |

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

## 2. Interview answers

*(filled in during the 2026-09-26 session)*

## 3. New decisions

*(TL-12 onward, added as answers change existing decisions)*

## 4. Priorities

*(quick wins for this session; briefs for later agents)*
