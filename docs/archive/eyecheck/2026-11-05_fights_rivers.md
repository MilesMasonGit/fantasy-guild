# Eye-check: crowded fights step apart, and rivers and ground (5 Nov)

**Closed 5 Nov evening: the owner approved everything as built** (every verdict below is ok or A) **and retired the Terrain buttons again**, so the QA commit on the look branch (af600b38) is not merged.

**Branch:** `eyecheck/fights-rivers`, already switched in your folder by the director. It holds the
combat look (fight windows, the mat with no plate, no shadow on the fight button), crowded fights
stepping apart (360 C4), the rivers (370 R1) and the water and ground drawing (370 R2). To switch
yourself: `git switch eyecheck/fights-rivers`; back afterwards: `git switch main`.

**Save:** a New Game in any empty slot. Restart your dev game first if it was already running.

## Crowded fights

1. QA panel (the QA button, bottom right) → Combat screen → **A crowd of fights**. Watch as each
   hero reaches their enemy: the fights that would cover another fight or a standing hero walk a
   short way apart, then fight. A lone fight stays where it starts. The Wolf Alpha at the bottom
   edge has no room within one step, so it stays crowded.
   Verdict: ok
2. **How far a fight may step:** A. about one board step, 160 u (built); B. half again, 240 u,
   more fights find room, walks up to about 3 s.
   Verdict: A
3. **The crowd test:** A. keep it (built: 24–32 u steps and one fight with no room); B. pack it
   tighter for bigger steps.
   Verdict: A

## Rivers, water and ground

The QA panel's **Terrain** section is back for this look: each button settles a dev Region for
free and takes the guild there. **Reroll it** gives a new seed; **Back to the Starter Camp** goes home.

4. **River across**, then **Reroll it** three or four times: the river bends, widens in its bends
   and runs somewhere different each time.
   Verdict: ok
5. **Mountain river** and **Forest river**, a reroll or two each: rivers differ on each ground.
   Verdict: ok
6. **Lake and river**, **Lake**, **Split river**: deeper water in the middle in bands, a clean
   shallow edge, the bank outside it. The split's side channel joins the main river sensibly.
   Verdict: ok
7. **The river bank:** A. wide, with pale sand bars on the inside of bends (built); B. thin, as
   before; C. in between. The picture `docs/active/research/terrain_round/built_r1/bank_A_vs_C.png`
   shows A thin against C wide on the same maps.
   Verdict: A
8. **Sea**, and **Forest + Mountain** / **Forest + Coast** in the biome buttons: the borders between
   grounds are ragged, not straight cell lines; dirt patches look settled into the grass. The ground
   measured 5–8 % busier; you did not pick calmer grass, so it is unchanged.
   Verdict: ok
9. Travel between two water views: no broken pieces of the last place's water stay on the map.
   Verdict: ok

## After the look

The director merges what passed. Keep the Terrain section in the QA panel, or retire it again
after this look? Verdict: retire

No CMS steps for this look.
