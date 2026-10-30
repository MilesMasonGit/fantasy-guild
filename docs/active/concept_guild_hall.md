Status: briefed 2026-10-14 for Transitions and The look of the sky (brief 160); the rest approved 2026-10-09; **draft amendment 2026-10-29: upgrades as a main driver** (below)

# The Guild Hall: constellation screen, upgrades, transitions

*D6 of the post-crunch plan ([ideas.md](ideas.md)). Owner interview,
2026-10-09. **Done** (owner closed it 2026-10-09). Today's upgrade web is in GDD §8. Pacing context:
[concept_progression.md](concept_progression.md) (Hall upgrades are a surplus
sink, not a main chase; 2–3 heroes on the first day, the rest over the first
couple of weeks).*

> ⚠️ **Draft amendment, 2026-10-29 (owner interview): "Upgrades as a main
> driver" below changes the role, the list and the pricing of the sky.** Where
> it differs from the sections after it, the amendment wins. Status of the
> amendment: draft; the star list comes with the content work.

## Upgrades as a main driver (owner, 2026-10-29; draft)

- **Hall upgrades are a main driver of progression** (owner), no longer a
  surplus sink. **Guild upgrades to XP rates, drop rates and work rates are
  essentially necessary for the late-game levels** (owner): the pace curve
  (the progression ledger, brief 290) assumes the player has them. This
  replaces "global boosts: few and felt".
- **What runs through the Hall** (owner): guild size, the per-skill rate
  boosts, hero capability, passive production, storage. **Not** the Token cap
  (fixed, no star), world-map reach (cell requirements are enough), building
  tiers, or quests.
- **Gates** (owner, unchanged): a star opens when a neighbouring star is lit;
  later stars and ranks cost materials from later tiers, so they wait
  naturally for fir, iron, gold.
- **Prices are set by the algorithm** (owner): the owner decides which tier
  each star rank belongs to; the ledger's automatic balancing picks the
  amounts and materials for each rank's place on the pace curve.

### The sky

- **A constellation per skill** (owner), linked to the pole star like the
  others and opening from the Hall at once (its first star buyable, the rest by
  the neighbour rule). Each holds that skill's:
  - **rate boosts, per skill** (owner): XP, yield (drops) and work speed, each
    ranked, **large at the top, earned over the whole run** (e.g. +100 % XP,
    +50 % yield, −40 % cycle time; the algorithm sets the real numbers);
  - **Token upgrades** for that skill's Tokens (owner): shorter ore-vein
    respawn, faster tree regrowth, a wider camp range, and so on.
- **The Hearth** (heroes): **Bunk Beds** (re-priced so a second hero comes
  early, brief 260), an **Infirmary** (shorter wound time after a defeat),
  **loadout slots** (an extra trinket, more consumable room, a second food
  slot) (owner).
- **The Vault** (storage): **Bank Tabs only** (owner): 15 ranks to 16 tabs of
  64 kinds (brief 310); sorting and search are free.
- **The Well** (passive production): **a diverse selection of basic outputs**,
  each upgradable for more (owner): oak wood, copper ore, coal and so on,
  beside the Wishing Well's water, so a guild's basics never run dry.
- **Retired** (owner): **Scouting Flags** (brief 260), **Bank Slots** (brief
  310), **the Token Cap star** (fixed cap), **the Cartography Table** (every
  world-map cell's contents are visible, so "see further" has nothing to
  reveal), **the Notice Board** (bounty slots), and with them **the Compass**
  constellation.

### Open

- The star list per skill (how many ranks of each boost, which Token
  upgrades), the Hearth's and the Well's ranks: content, priced by the ledger,
  settled with the content work.
- The engine side (per-skill constellations, the boost effects, Token
  upgrades, the Well's outputs, the retirements) is briefed once the list's
  shape is clear.

## The sky

- **The upgrade screen is a night sky of themed constellations.** Lighting a
  star extends its constellation; finishing one completes its picture.
- **Starting constellations**:
  - **The Hearth** (heroes): Bunk Beds (more heroes), an Infirmary (faster
    recovery after a knockout), food and drink slots;
  - **The Vault** (storage): Bank Slots, Bank Tabs, sorting;
  - **The Compass** (reach): Scouting Flags (radius), Token cap, Cartography
    slots, Notice Board (quests);
  - **The Well** (production): Wishing Well water, seed income, other passive
    lines.
- **Stars have ranks** (as today: Bank Slots has 10).
- **Gates**: a star opens when a **neighbouring star is lit**, and later
  stars' prices use **materials from further along the chains**, so they wait
  naturally for Fir, Iron and so on (implicit tiers, D2). Nothing else gates
  them.
- **Kinds**: guild size, storage and Atlas, passive production, and **global
  boosts: few and felt** (each a noticeable difference, not many +1 % stars).
- **The list**: many upgrades will be needed. A basic list comes first,
  **written later, with the content work**.

- **The Hall looks the same on the mat**; the sky is the record of progress.
- **The sky is calm**: the cartographer doesn't appear there (he lives in the
  tutorial, quests and the Atlas's map table).

## Transitions

- **A camera move**: the view tilts up from the mat into the night sky for the
  Hall, and down onto the cartographer's map table for the Atlas. Quick (under
  a second), skippable, with a reduce-motion setting.

## The look of the sky

*Owner interview, 2026-10-13 (refinement pass §2, "Guild Hall Upgrades
Constellation View"); **done**. Build ticket **T-171**. Replaces drawing each
upgrade's sprite on its node (`GuildHallBoard.jsx`): the icons cluttered the
sky.*

- **Stars, not icons.** Every upgrade is a pixel star. Its state shows by
  **brightness and size steps**: **locked** a faint 1-pixel dot; **buyable** a
  small star that twinkles (two stepped frames, no blur); **bought** a bigger,
  brighter star; **maxed** a full gold star. Whole-pixel scales only.
  **The owner draws the star sprites** for each state so they read apart
  from the backdrop's painted stars (owner, 2026-10-15); the steps above are
  the brief for that art, and code-drawn stars stand in until it exists.
- **Every star carries a tag** beside it: `Bank Slots 3/10` (name and rank),
  locked ones included.
- **Lines**: 1 art pixel; **faint between unlit stars, bright white-gold once
  both ends are lit**. A finished constellation's picture glows briefly and
  stays bright.
- **Constellation names** (Hearth, Vault, Compass, Well): a faint label near
  each group that **brightens when the constellation is finished**.
- **The centre is the Hall as a bright pole star**, labelled Guild Hall, that
  every constellation starts from. No Hall sprite in the sky.
- **The sky** (owner, 2026-10-15): two layers of the owner's art in
  `public/assets/playmat/screens/`, both 512 × 512 and seamless:
  - **`bg_nightsky_1.png`**, the star field, **tiled at 2×** over the whole
    screen;
  - **`bg_nightsky_cloud_layer.png`** (see-through), **tiled at 2× on top at
    about 25 % opacity**.
  - **Both drift**, in **whole art pixels with stepped timing** (one art pixel
    about every half-second, never a smooth glide), **very slowly** and in
    **different directions**: the stars cross one tile in about 10 minutes,
    the clouds in about 5, so the clouds feel nearer.
  - The drift stops under the **reduce-motion setting**. Drift only while the
    Hall screen is open; nothing runs on the mat.
- **Panels**: the **Effects list stays docked on the left** (what the
  upgrades give now); a **details panel docked on the right** shows the
  hovered star (the upgrade's sprite icon, description, prerequisites, price
  as pills with have/need, the Upgrade button) and **a click pins it** so the
  button can be reached. The sprite icon appears only there.

