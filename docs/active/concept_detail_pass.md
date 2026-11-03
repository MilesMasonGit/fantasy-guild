Status: draft

# The detail pass: UI and UX, section by section

*Opened 2026-11-02 (owner). A long list of specific improvements to how the
game looks and plays, gathered one screen at a time.*

## How it runs (owner, 2026-11-02)

1. **Section zero first**: rules that apply on every screen, so they aren't
   decided again per section.
2. **One section per sitting.** The planning agent brings a one-page sheet:
   what is on that screen today (checked in the current game) and the old notes
   already filed for it. The owner plays and talks; the ideas are the owner's.
3. **Each item is written as the owner's wish**, in the owner's words. No guessed
   file paths or causes: the builder checks the code (brief 210's intake needed
   a warning about exactly this).
4. **Each item gets two tags**: **must** or **nice**; **tweak** (a ticket's
   size) or **design** (needs its own short interview or concept).
5. **A finished section goes to the director** as one brief with a row in the
   queue, built in a small batch with an eye-check. The owner's next ideas can
   then build on what they just saw.

**Scope**: the player's game. CMS annoyances become tickets, not sections.

## Section zero: rules across every screen

- **The icon rule: decided 2026-11-02**, in `UI_STYLE.md` ("The icon rule").
  Swaps it calls for (T-293 to brief):
  - Top bar Disallow and Demolish buttons: the cursor's pixel art.
  - Start screen: all Lucide for now (the emoji stats go); a pixel set may come
    near release.
  - Skill icons: T-292. Farming uses `s_farming.png`; Alchemy and Construction
    are on the owner art list, using `s_flask` and `s_industry` until then if
    they suit; specialist skills share a plain pixel placeholder.
  - The rest of the audit is checked section by section (unknown item, locks,
    hearts, gear slot icons).
- *(more to gather from the owner)*

## Sections

| # | Section | State | Old notes to bring |
|---|---|---|---|
| 0 | Rules across every screen | icon rule done; more as they come up | above; `UI_STYLE.md` |
| 1 | The mat and Tokens | not started | `design_pass_notes.md`; T-013, T-162 |
| 2 | Top bar | not started | `ui_rework_list.md` |
| 3 | Hero bar and hero sheet | **walking now** | `design_pass_notes.md`: the owner held back "lots of little tweaks"; ask for that list |
| 4 | Bank | not started | |
| 5 | Shop | not started | |
| 6 | Guild Hall | not started | |
| 7 | World map | not started | |
| 8 | Combat | not started | |
| 9 | Encyclopedia | not started | the owner's "this will work for now", 2026-11-01 |
| 10 | Notifications | not started | |
| 11 | Settings and the start screen | not started | nine "coming soon" controls; T-039 |
| 12 | While-you-were-away summary | not started | |
| 13 | Tutorial and highlights | not started | `design_pass_notes.md`: the glow and assist rings |

The sheet for each section is checked against the running game before the
sitting: this table's notes are pointers, not facts about today's screen.

## The list

*(Items go under their section as the sittings happen.)*

### 3. Hero bar and hero sheet

**The sheet (2026-11-02). Read from the code, not yet seen in the running game:
the game would not load during the check, so where this disagrees with the
screen, the screen wins.**

**The hero bar, one hero**
- A standing figure with their flag; drag it onto the mat to give an order.
- Name (gold when selected, red with a text cross when wounded).
- A status word: Idle, Busy or Hurt; or Needs a job, with a yellow mark.
- An HP bar, the exact number on hover.
- Level-up alerts in speech bubbles, three at a time with arrows to page, kept
  until clicked; a perk reached gets its own bubble.
- Hover lights the hero and their job; click opens the sheet.

**The hero sheet**
- Top: the figure at twice mat size with its flag (drag it to send them out),
  name, HP bar, an edit quill (a placeholder) and the red close X.
- Loadout: nine slots in a 3 by 3 grid; any item in any slot; drag to equip,
  right-click to unequip.
- Skills: one row per skill: icon, name, level out of 99, a thin XP bar. Hover
  gives what the skill is for, XP and perks; a click opens exact XP, XP per hour,
  time to next level and what each perk does.
- Edit window: name, portrait, flag colour.

**Already filed, no need to repeat**
- Skill icons in emoji: T-292.
- The wounded text cross: a heart is pixel under the icon rule. The gear slot
  marks are pixel today; the icon rule moves them to Lucide.
- Bubbles cost the most drawing time per hero: T-198.
- Locked 2026-10-07: the bar stays horizontal at the bottom, spaced for 8 heroes;
  the sheet is a full-height side panel in the same place with the Bank open or
  closed.
- Never seen by an agent: HP bar thickness, colour, and its height over the sprite.

**Open**
- The owner's "lots of little tweaks" held back since 2026-10-08.

**The list**

*(The owner's items go here.)*
