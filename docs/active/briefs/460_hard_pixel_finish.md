# Brief 460 — Detail pass: the last soft glows and shadows go to hard pixel

*Written 2026-11-04 by the planning agent. Owner's ruling, 2026-11-04: "All to hard pixel" (T-013; detail pass,
section 13). This closes T-013.*

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/UI_STYLE.md` (frames, hard shadow, the outlines),
[docs/active/research](../research/) `pixel_frames` for how the last audit was shown.

Code to start from (verify): `src/tailwind.css`, `src/ui/components/board/TokenBadges.jsx`, `ProblemMark.jsx`,
`src/ui/components/nav/BubbleMenu.jsx`, `src/ui/dnd/DragGhost.jsx`, `src/ui/components/dock/DockHeroFigure.jsx`,
`DockEquipmentGrid.jsx`.

⚠️ **T-013's counts are old.** A search on 2026-11-04 found about 25 lines of `drop-shadow`, 9 of `text-shadow`, 5 of
`box-shadow` and 29 of `blur`, in about 20 files. **Not every hit is soft**: `.gi-text-outline` and other zero-blur shadows
are already hard, and some are dev pages. Count again and judge by what is drawn.

## Phases

| Phase | What | Tier |
|---|---|---|
| P1 | **The list and a look** (no game code). Every soft glow, text shadow, drop shadow and blur in the game: where, what it draws, its proposed hard version. A sheet from the real game, before and after, for the main ones: alert icons, state badges, the −1 number, labels on the mat, nav bubbles, the drag ghost. Mark anything where the soft version may be doing a job, above all text legibility on the busy mat; show a hard outline there. Dev pages are out of scope. Saved under `docs/active/research/hard_pixel/`. | builder |
| P2 | **The change**, after the owner has looked. All to hard pixel: hard outlines and hard shadows from what `UI_STYLE.md` already has, with no new art and no new kind of frame. Nothing may lose legibility. Anything the owner asked to keep stays, and is listed. Remove what a change leaves unused. | builder |

## Done when

- Gate green (`TESTING.md`). Engine work **same**.
- In the running game, named as verified: each kind on the list, at 1366 and 1920, on a busy mat and in the panels.
- A search of `src/ui` and `src/tailwind.css` shows only hard shadows, plus the listed exceptions and dev pages.
- `bench:draw --compare` once for the eye-check batch; soft shadows take a drawing layer, so report any gain.
- `UI_STYLE.md` says what's the rule now; T-013 closes.
- **Eye-checks**: the sheet after P1 (no game change); a short look after P2.

## Not in this brief

The tutorial's gold outline ([concept_tutorial_npc.md](../concept_tutorial_npc.md)). Art. Other briefs' new work follows
the same rule as it lands; whichever of these runs later keeps it.

## Owner to-do

Look at the sheet and say what to keep, if anything. No CMS work and no new art.
