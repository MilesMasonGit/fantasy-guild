# Brief 120 — The mat, hover and the Token card

**Source of truth:** [`concept_info_layers.md`](../concept_info_layers.md)
(approved 2026-10-14). Its "Build order and notes for the director" is the
phase list; this brief adds tiers and done-bars.

**Needs:** brief 100 (style kit), brief 110 (Disallow and Demolish leave the
card there); T-146 and T-147 merged (wave 2).

**Branch:** `crunch/info-layers`. **Eye-check:** yes, two batches: after C2
(mat and hover) and after C3 (card).

## C1 — The mat layer (engineer)

- **Change:** thin progress bar on worked Tokens; one problem mark, yellow
  (waiting) or red (can't), whose hover says exactly what; floaters stay; the
  charges, quest and spawner rings stop showing by themselves; health bars
  only when hurt, fighting or hovered; heroes stop speaking about blocks (mark
  those lines retired in `docs/reference/speech_bubble_lines.md`). This
  replaces most of `TokenBubbles.jsx`.
- **Measure:** `bench:draw --compare` before and after; the mat should draw
  cheaper. Prove it in the cost log. If it draws dearer, stop and report.
- **Done when:** a busy save shows bars and marks and nothing else at rest.

## C2 — Hover (builder)

- **Change:** outline at once; after ~150 ms the name and charges ring; heroes
  and enemies add the HP bar. Sweeping the cursor shows outlines only.

## C3 — The Token card (builder)

- **Change:** the full-art card on the existing `TokenInspectPopup` anchor;
  the blocks top to bottom as the concept lists; the enemy card; one card at
  a time. A CMS field for the per-Token art override (CMS code; the owner sets
  pictures). Art by activity by default; a Token with none gets a plain card.
- New icons (clock, charges, regrow, spawn, grow, problem mark): placeholder
  sprites plus lines on [`owner_art_list.md`](../owner_art_list.md).
- **Done when:** a gathering node, a station, a spawner and an enemy each
  opened in the running game; screenshots in the report.

## Owner to-do

- Eye-checks after C2 and C3.
- After C3 Syncs: set art overrides where the activity art is wrong; draw the
  missing activity scenes on the art list.
