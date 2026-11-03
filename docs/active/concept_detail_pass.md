Status: draft (section 3, hero bar and sheet: approved 2026-11-02, briefed: brief 340)

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
| 3 | Hero bar and hero sheet | **approved and briefed 2026-11-02** ([brief 340](briefs/340_hero_bar_detail.md)) | `design_pass_notes.md`: the owner held back "lots of little tweaks"; ask for that list |
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

**The list** (owner, 2026-11-02; the tags are the planning agent's draft, for the
owner to correct)

| # | The owner's wish | Tags |
|---|---|---|
| 1 | **HP shows as numbers on a stylized bar**, on the hero bar and the sheet: "a more stylized bar, with the numbers overtop of it. It should match our pixel style." | must, design (a look to pick) |
| 2 | **The status moves to hover, as a speech bubble, and names the task**: "being specific about the task they are on", not just Busy. Replaces the status word under the name. | must, tweak |
| 3 | **Alert marks beside the hero, where the flag is now**: yellow for idle, red for wounded. They show without hovering. The red one replaces the text cross. | must, tweak |
| 4 | **The flag moves to the other side of the hero**, and on the sheet goes behind the hero. | must, tweak |
| 5 | **The Bank's vertical hero column**: "The vertical bar needs work": larger portraits. | must, tweak |
| 6 | **The same column: the name shown "in a more stylized way"**. | nice, design (a look to pick) |
| 7 | **The sheet's skills fit two side by side**: each box shows icon, level and XP bar. The name moves to the hover tip, with what the skill is for and its perks. | must, tweak |
| 8 | **The sheet scrolls with our arrow buttons at top and bottom**, not a scroll bar. | must, tweak |
| 9 | **Close and edit move to the side space beside the sheet**, where the hero column stands, in the same spot whether the Bank is open or closed. | must, tweak |
| 10 | **Loadout: drag an item from one slot to another** on the same hero. | must, tweak |
| 11 | **Loadout: drag an item from one hero to another.** | must, tweak |
| 12 | **Dragging a hero from the bar starts the same flag drag as moving a hero on the mat**: only the flag is carried, not the large hero picture. | must, tweak |
| 13 | **The bottom bar's heroes "slightly more spaced out".** | must, tweak |
| 14 | **The bottom bar's hero names "a little bit larger".** | must, tweak |

**Planning agent's defaults** (simplest choice, owner may change):
- Item 11: drop onto the other hero in the column or the bar; it lands in their
  first empty slot; a full loadout refuses with a reason and the item stays.
- Item 7: clicking a skill still opens its exact numbers, across both columns.
- Item 12: the Bank's hero column and the sheet's large figure send a hero out the
  same way; dragging one hero onto another on the bar still reorders them.
- Items 1 and 6: the builder shows two or three looks on the running game for the
  owner to pick (owner directs the art).

**Looked at, no change** (owner, 2026-11-02): level-up bubbles; the edit window. It will need the hero recolouring system in time
([concept_living_game.md](concept_living_game.md)), not part of this section.
