# Brief 30 — Hero bar, hero panel, work rules and the flag

Runs **after brief 20** (class rework v2): the panel shows the new skill list.

**Source of truth:** `ui_rework_list.md` sections "Hero bar and hero panel",
"Hero work rules and the flag", and the owner's "Hero bar", "Hero flag" and
"Level Up Notifications" items; **[`UI_STYLE.md`](../../reference/UI_STYLE.md)
is the heart of this brief**: the owner's complaint is the presentation
(thick borders, dead space, "LVL 03"), not the positions.

**Branch:** `crunch/hero-ui`. **Eye-check:** H1–H2 together, H3–H4 together.
Cost log line per phase.

## H1 — The hero bar (builder)

- Horizontal at the bottom, spaced for **8 heroes**, compact and clean (no
  dead space). Each hero: **figure or portrait + name, HP bar, level-up
  bubbles**.
- **Level-up bubbles persist until cleared** ("Leveled up Mining to 25!
  (+4)"), so after an AFK session the player scans the bar; clicking a bubble
  (or the hero) clears it *(director default)*. Same text as the mat bubble
  (brief 10 U3).
- Today: `BottomHeroDock.jsx`, `DockHeroFigure.jsx`; dead code to remove:
  `HeroDockCard.jsx`, `DockSkillsGrid.jsx` (T-044), `dockConstants.js` remnants.
- Keep every drag route working (deploy, recall, equip, reorder): run
  `bench:drag`.

## H2 — The hero panel (builder)

- A **full-height side panel**, in the same place whether or not the Bank is
  open (today's Bank-side panel, `BankHeroPanel.jsx`, becomes the only one;
  `HeroInspectionSheet.jsx` stops rising from the dock).
- Content per UI_STYLE: name, job, HP bar; loadout grid; skills as
  `[icon] Forestry 25/99` with a thin XP bar (number on hover); the 9 Starting
  skills in a **collapsible section**, class skills on top (concept §2); banked
  skills; Edit (rename, portrait, flag colour, Change Job planner).
- ⚠️ Ticket T-104's lesson: a closed panel must not keep drop targets
  registered.

## H3 — Work rules move to the hero bar (builder)

- Hovering a hero in the bar shows a **gear**; clicking opens the rules in a
  **side panel** over the mat (same side as the notification sidebar), open
  until closed (Esc or X), naming the hero and showing their flag colour.
- **Copy rules to…**: a list of the other heroes with checkboxes and Copy;
  skills a target doesn't hold are skipped.
- Today: `FlagRulesPanel.jsx`, `FlagRules.js`, `Flags.setRule`.

## H4 — The flag (builder)

- No gear on the flag; the **"…" idle chip removed** (the "No work in range."
  speech line stays). Hover: highlight, hero name, reach ring. Otherwise just
  something to drag. Today: `FlagLayer.jsx`.

**Done when:** each phase seen in the game in the owner's save and on S2;
`bench:drag` hero and flag drags no worse than the baseline; T-044 closed.
