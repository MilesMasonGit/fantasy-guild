# Task ring look pick (brief 720, R3, T-595)

These are real game screenshots from the dev build, 1920 x 1080. Each one is a new game with six
heroes, each working one Token: a strawberry bush, a blueberry bush, a peach tree, a cherry tree,
and a lemon tree and an orange tree side by side at the bottom so their rings overlap. The rings
and the dimmed ground are a throwaway overlay drawn on the real mat. It was not committed and is
not game code. Every ring is drawn the way the gold reach ring is (`pixelRing.js`): one art pixel
wide, whole art pixels only, with a black copy one art pixel down and right. All rings share **one**
dim layer, made from the outline of all the rings together, so **the ground never dims twice where
rings overlap** (see any `*_zoom.png`).

Start with **`side_by_side.png`**. It shows the overlapping pair 2x (nearest-neighbour) for today
and for each design. `*_full.png` is the whole mat and `*_zoom.png` is the pair at 2x.
`today_*.png` is the game as it is now, with no ring.

| Design | Ring colour | Radius | Ground dim (brightness / saturation) | Green work outline |
|---|---|---|---|---|
| **A** | gold, as the reach ring | fitted round the Token and hero | medium (0.72 / 0.55) | kept |
| **B** | the hero's flag colour | fitted | medium (0.72 / 0.55) | dropped |
| **C** | the work green (#09b554) | fitted | light (0.84 / 0.70) | dropped |
| **D** | gold | fixed, 60 art px, centred on the Token | strong (0.58 / 0.35) | dropped |

- **A**: gold fitted ring, medium dim, green outline kept.
- **B**: a ring in the hero's own flag colour, fitted, medium dim, no outline.
- **C**: a ring in the work green, fitted, light dim, no outline.
- **D**: gold fixed-size ring, strong dim, no outline.

**Fitted** means the circle round the box of the Token and its hero(es), plus 10% and 2 art px.
On a one-cell Token that comes to 48 art px. **Fixed** means one size for every job, centred on
the Token. In all four designs the ring sits on the ground, under the Tokens and heroes (just
above the dim), so a hero standing on the edge covers it. The reach ring is drawn over the Tokens
instead.

## What the shots show

- **Colour.** Gold (A, D) reads the most strongly, but it is already the reach ring and the
  "picked" outline. A reach ring hovered near working Tokens would show gold rings of two
  meanings at once. The flag colours (B) tie the job to its hero, which helps now that flags show
  only on hover (R2). But the dark red and the pale blue get lost on the dimmed ground, and a
  Token with two heroes has two colours, so the ring has to pick one. Green (C) already means
  "working" in the game (the outline, the status text), so the ring can take over from the
  outline. On grass it is the quietest of the three, though the black shadow keeps it readable.
- **Dim.** Light (C) is enough to lift the hero and the Token off the ground and keeps the mat
  lively with six jobs running. Strong (D) makes jobs jump out but turns a busy mat patchy and
  dark.
- **Radius.** Fitted rings stay off their neighbours. Fixed rings (D) cover about 1.6 times the
  area, overlap far more, and leave the hero near the edge, because the ring centres on the Token.
- **Outline.** With the ring and the dim saying "working", the green outline (kept in A) adds
  noise to every working sprite. Dropping it (B, C, D) looks cleaner.

## Recommendation

**C**: a work-green ring, fitted, light dim, outline dropped. Green keeps its one meaning
(working) and gold stays for reach and selection. The fitted ring keeps a busy mat readable, the
light dim makes the action pop without darkening the mat, and the ring takes over the outline's
job. If the owner wants the ring itself to read more strongly, the fallback is C in gold (A's
colour without the outline). The dim strength is one constant and can be tuned at R4's look.

**Not decided here (for R4):** where two rings cross, both arcs are drawn inside the shared dim
(visible in every zoom). R4 could draw only the outer edge of the merged shape instead. The
screenshots do not show a Token with two heroes, because these Tokens take one worker each. The
fitted radius grows to frame both heroes.
