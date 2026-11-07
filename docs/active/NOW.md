# NOW — start here

*Updated 2026-11-06, late evening. One screen: what is next and where the project
stands. A director resumes from [HANDOFF.md](HANDOFF.md); the living table and
summaries are [STATUS.md](STATUS.md); the queue is the order table in
[briefs/README.md](briefs/README.md); finished work lives in git, the
changelog and `docs/archive/`.*

## Where the project is

- **Version** 0.8.x on `main`. **Tests:** about 7,880 in 632 files, green
  except T-334 (one test pinned content the owner has since Synced).
- **The crunch's feature briefs are merged** (combat look, rivers and ground,
  world map, Guild Hall sky, notifications, settings, save files, new game,
  Shop, Foundations, tools that break). The engine is feature-complete for
  now; the owner's minor look notes wait for the next pass.
- **Next big thing: the code review and optimisation pass, round 4**
  ([concept_code_review_2026.md](concept_code_review_2026.md), approved
  2026-11-06). Prepared today: [ARCHITECTURE.md](../reference/ARCHITECTURE.md)
  (the code as it is), the doc audit, knip and dependency-cruiser, the Chrome
  DevTools MCP, the memory soak bench, the `/reviewer` skill and the findings
  process in [review/](review/README.md); the CMS keeps its workspace on disk
  and has a command line (eye-check waiting).

## Next

1. **Owner**: eye-check the CMS on disk
   ([eyecheck/2026-11-06_cms_disk_workspace.md](eyecheck/2026-11-06_cms_disk_workspace.md));
   approve the project MCP server when the app asks; answer its two questions.
2. **Director**, first quiet window: the baselines on `main` (engine, draw,
   calibrate, then the 30-minute `bench:soak --save-baseline`); merge `prep/cm`
   after the look; T-334.
3. **Reviewer** (`/reviewer`): session R0 (the map), then R1 onward; the
   planning agent triages each area's findings with the owner and writes the
   fix briefs; the director fixes.
