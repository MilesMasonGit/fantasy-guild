# Owner feedback intake

*The owner writes here what they notice while playing, eye-checking or making
art: one line per item, newest at the bottom, dated. The planning agent
triages the list each cycle into tickets (`docs/reference/TICKETS.md`), concept
docs or `design_pass_notes.md`, and removes the lines it has placed. Nothing
here is a decision; directors don't act on this page.*

## Open

- 2026-10-29 (owner, via the director): **icon rule** — pure pixels for the in-game world; Lucide (the nav bubbles' icon set) allowed for meta elements, on the mat too, e.g. the hero's job flag and the equipment gear slot icons. Be very specific about where. Wants to plan the icon swaps before any batch: the director's audit is [research/icon_audit_2026-10-29.md](research/icon_audit_2026-10-29.md) (UI_STYLE line 149 says pixel only today, so the rule changes). Audit side findings worth tickets: Farming, Alchemy and Construction skill icons fall back to emoji (unmapped in `AssetManager.js` SKILL_MAP; `s_farming.png` exists); the missing-item placeholder is a hand-copied Lucide SVG.
- 2026-10-30 (owner, via the director): **no style character abilities** — brief 280 V4 (Melee re-engage, Stealth sneak strike and big crits, Magic's lower base damage, Motes, Throwing Daggers) is not wanted; drop V4 from the brief and the concept. V5 (the content pack) goes ahead without it.
- 2026-11-01 (owner, via the director): **built nodes run at the same speed as wild ones** ("it is essentially the same node, except built ones can be demolished and wild ones cannot"). This replaces "a built node is weaker" in `concept_world_map.md` ("Building nodes anywhere") and brief 330 W4/W6. W4's "Built copies slower by %" (`builtSlowerPct`) is now unused: T-283 removes it.
- 2026-11-01 (owner, via the director): **the Starter Camp gets a small patch of Stone ground, and its first mine recipe needs no prospecting map** (so the Starter Camp can still build a mine once mines need Stone). Folds into the world pack (W6) with the held mines pack: T-284.
- 2026-11-01 (owner, via the director): **every Live thing must have a guaranteed place in every world.** "Any enemy that can be fought must have a spawn location. Otherwise a player may be denied key drops or gameplay content, possibly even softlock themselves." Each enemy is guaranteed in the **inner ring matching its tier** (wild rings add extra copies, never the only one), and the same holds for everything gatherable (veins, trees, crops, fishing spots, sources). The ledger's checks F coverage is the test: W6 aims at 100 of 100 worlds.

