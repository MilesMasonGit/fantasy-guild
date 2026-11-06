# The Foundations pack (brief 410 S1)

The pack itself is `src/tests/fixtures/packs/2026-11-06-foundations-s1.json`: one committed copy,
which `src/tests/FoundationsPack.test.js` applies to a copy of today's content. Copy it into
`cms/incoming/` on `main` for the owner's review.

- `mkpack_s1.mjs`: builds it from a worktree's `data/` and `cms/plan/plan.json`
  (`node mkpack_s1.mjs <worktree> <out-file>`, then `node cms/changePackTool.mjs stamp`, `check`, `gate`).
- `gate.txt`: the gate's verdict against `data/` at c49cdf54 (PASS).

29 entries: the Wood, Stone and Farmland Foundations get their place in the list and skill icons;
two new Foundations, Excavation and Battlefield (stand-in sprites, Oak Wood placeholder prices);
Coast and Goblin Camp leave the Shop; the Copper Mine, Coal Mine and Quarry build on an Excavation;
the 18 enemy spawners built from a banner build on a Battlefield; the Mining Camp builds on Wood.
