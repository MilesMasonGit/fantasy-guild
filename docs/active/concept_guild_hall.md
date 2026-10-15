Status: briefed 2026-10-14 for Transitions and The look of the sky (brief 160); the rest approved 2026-10-09, brief after the crunch

# The Guild Hall: constellation screen, upgrades, transitions

*D6 of the post-crunch plan ([ideas.md](ideas.md)). Owner interview,
2026-10-09. **Done** (owner closed it 2026-10-09). Today's upgrade web is in GDD §8. Pacing context:
[concept_progression.md](concept_progression.md) (Hall upgrades are a surplus
sink, not a main chase; 2–3 heroes on the first day, the rest over the first
couple of weeks).*

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

