# Brief 390 — Detail pass: the Guild Hall

*Written 2026-11-03 by the planning agent from the owner's walkthrough of the same day.
Concept: [concept_detail_pass.md](../concept_detail_pass.md), "6. Guild Hall": read its list
first; the item numbers below are that list's, and the owner's wish is what counts. "Overall
it looks cluttered."*

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/UI_STYLE.md`,
[concept_guild_hall.md](../concept_guild_hall.md), GDD §8 and §14. Star prices are **not** in
this brief: they wait for the Hall balance pass (owner, 2026-11-02).

Code to start from (verify; the captures in `research/hall_h1` are from 30 October):
`src/ui/components/board/GuildHallBoard.jsx`, `HallSky.jsx`, `HallCamera.jsx`,
`GuildHallDetails.jsx`, `GuildHallEffectsPopover.jsx`,
`src/ui/components/drawer/GuildUpgradeInspection.jsx`,
`src/systems/progression/hallStarText.js`, `hallModifiers.js`, `src/config/hallStars.js`,
`src/systems/board/PassiveProduction.js`, `tokenConstants.js`, `UpkeepSummary.js`.

## Needs

- G1 needs nothing and may run now.
- G3 uses the Token card's header and stat block: after brief 350 T2.
- Brief 380 M4 adds ring stars to the sky: whichever runs second keeps them readable under
  the spacing and titles here.

## Phases

| Phase | What | Tier |
|---|---|---|
| G1 | **Mock-ups** (no game code; items 2, 7). Picture mock-ups from the real art: outlines of item sprites over the stars, so stars look distinct from each other ("I wonder if"), in two or three treatments, beside today's plain star; the panel with its own purple borders ("maybe"), beside the standard frame. Include a whole sky with every constellation at the new spacing, so clutter can be judged. Saved under `docs/active/research/hall_look/`. **G2 and G3's looks start once the owner has picked**; the owner may decline either idea. | builder |
| G2 | **The sky** (items 1, 2, 3, 4, 5). No rank numbers by default: they show on hover. The picked star look. Stars more spaced out. Titles always underneath the star. The sky runs full-screen under everything: behind the nav bubbles and the panel, with no hard stop at the edges. Star places are content (`hallStars.json`): if spacing needs new places, that's a CMS change pack, never `data/`; prefer a scale in code if that does it. | builder |
| G3 | **The panel and Hall effects** (items 7, 8, 9, 11, 12). **Panel**: the picked borders; the Token card's header and stat block style; a clear sentence at the top saying what the star does, then brief numbers: now, next, and a line for the max rank; the price in our item style; a clear Upgrade button. ⚠️ Every star kind needs a short now-and-next: build it from the rules (`hallStarText.js`), and list any kind that won't read rather than hand-writing per star. **Hall effects**: no time on each item entry; the lap's time listed as a boost; "Modifiers" reads "boosts" for the player (`en.json` "Boosts & Modifiers"; code names stay). | builder |
| G4 | **Upgrade ceremony** (item 6). The star bursts in hard pixels with a chime; light runs along its links to what it just opened; finishing a whole constellation gets a bigger moment (its drawn picture comes later, as art). Plays only while the sky is open, once, and never on load. | builder |
| G5 | **The drop lap** (item 10). Drops run on one lap: **10 minutes by default, reduced to 5 by Guild Hall upgrades**; the lap's time shows as a boost (G3). ⚠️ `PASSIVE_PRODUCTION_MS` has other readers (`UpkeepSummary.js`, and check Token lines, `Flags.js`, `TimedChanges.js`, `Demolition.js`): say which should follow the new lap and which stay. The first rule says one timer for all (`ui_rework_list.md`, T-099), so stop and report if splitting it looks necessary. Offline catch-up must agree. The star(s) come as a **CMS change pack** (brief 200) for the owner to review: suggest ranks 10, 8, 6, 5 and the Hall's own constellation, priced by the algorithm. ⚠️ **Expect WORK CHANGED**, and a pacing change: Starter Camp Water and early Hall drops halve until the star is bought. The ledger must count the lap and the star; report the stage budgets before and after, and any stage turned red (±25 %). | engineer |

G2, G3 and G4 may run in order on one branch; G5 alone, after them or before, and not beside
another WORK CHANGED.

## Done when

- Gate green (`TESTING.md`). G1 to G4: engine work **same**. G5's WORK CHANGED accepted by the
  director, the budgets shown to the owner with the look.
- In the running game, named as verified: no rank numbers until hover, every title under its
  star; the sky behind the bubbles and panel; a one-rank star, a many-rank star and each star kind
  read in the panel; a purchase's burst, a link lighting, a finished constellation; the lap at 10,
  bought down to 5, the same after an offline stretch.
- `bench:draw --compare` once per eye-check batch; the sky's ambient drift stays within its cost
  with the full-screen sky.
- GDD §8, `UI_STYLE.md` and `concept_guild_hall.md` updated.
- **Eye-checks**: the mock-ups' pick after G1 (no game change); one look after G2 to G4; one
  after G5, with its pacing numbers.

## Not in this brief

Item 13, more possible upgrades: a separate review and interview, then a star pack from the
content roadmap. Star prices: the Hall balance pass. Star pictures: owner art when ready.

## Owner to-do

Pick from the mock-ups; review the lap star's pack in the CMS, then Sync on `main`.
