# Credits register

Every piece of the game that someone else made, its licence, and the credit
it asks for. **Whoever adds an outside asset adds its row here, in the same
change.** Art the owner draws is not listed. An in-game Credits screen (in
Settings) comes before release; it is built from this file.

Checked against the files on 2026-10-20.

## Sound effects (`public/assets/audio/sfx/`)

| Pack | Folder | Author | Licence (file in the folder) | Credit wording | Where the game uses it |
|---|---|---|---|---|---|
| RPG Audio | `kenney_rpg-audio/` (51 sounds in `Audio/`) | Kenney Vleugels, [kenney.nl](https://www.kenney.nl) | Creative Commons Zero (CC0), `License.txt` | Not required; the licence says credit "would be nice": `Sound effects by Kenney (www.kenney.nl)` The clip map in `src/systems/core/AudioSystem.js` (`_getSfxPath`) points these at it: drag and drop (Tokens, cards, heroes), equipping and assigning items, tools and blueprints, unassigning, level-up, invasion, combat hit, victory, defeat, task done |
| Calculator buttons | `zapsplat_pack_calculator_buttons_mp3/` (10 sounds) | ZapSplat | ZapSplat Standard Licence, `ZapSplat-License-Agreement.pdf` (points to zapsplat.com/license-type/standard-license) | **Required**: `Sound effects obtained from https://www.zapsplat.com` Mapped to button and UI clicks and dock pin and unpin |
| Handling coins | `zapsplat_pack_handling_coins_mp3/` (90 sounds) | ZapSplat | ZapSplat Standard Licence, `ZapSplat-EULA-Standard-License.pdf` | **Required**: as above Mapped to claiming a quest (4 of the 90 sounds) |
| Playing cards | `zapsplat_pack_playing_cards_mp3/` (85 sounds) | ZapSplat | ZapSplat Standard Licence, `ZapSplat-License-Agreement.pdf` | **Required**: as above | Nothing today: no code names them |

ZapSplat's terms, in short: credit is required on a free account and must sit
in the game itself (a credits page counts), on every platform the game ships
on; the sounds may be used in a commercial game but must not be shared or
redistributed outside it. One credit line covers all three ZapSplat packs.

## Music (`public/assets/audio/bgm/`)

| Tracks | Author | Licence | Where the game uses it |
|---|---|---|---|
| Gentle Pause, Guitar Hearth, Hearthside, Piano Hearth, Quiet Trail, Tide and Timber, Warm Cedar, Woolen Keys | **Not recorded** (no licence or source file in the folder) | **Not recorded** | The background music playlist (`BGM_PLAYLIST` in `AudioSystem.js`) |
| `maybe/`: Cozy Fantasy Solo Piano, The_Unlit_Gallery | **Not recorded** | **Not recorded** | Nothing (not in the playlist) |

⚠️ These are placeholders until the soundtrack a friend is writing arrives
(`docs/active/concept_tone_and_world.md`, Sound). Before release, either
record where each kept track came from and its licence here, or remove it.

## Fonts (`public/fonts/`)

All five come from Google Fonts by way of the `@fontsource` npm packages
(the files in `public/fonts/` are byte-identical to the packages' copies).
All are under the **SIL Open Font Licence 1.1**: free to use, bundle and ship,
including in a sold game; the copyright notice and the licence text must travel
with the font files, and the fonts must not be sold on their own. No on-screen
credit is required.

| Font | Copyright (from its `LICENSE`) | Where the game uses it |
|---|---|---|
| Inter | 2016 The Inter Project Authors (github.com/rsms/inter) Settings, Font Preference: Modern Sans (`src/styles/main.css`, `SettingsModal.jsx`) |
| Pixelify Sans | 2021 The Pixelify Sans Project Authors (github.com/eifetx/Pixelify-Sans) The letters of `SilkPixel`, the default font; Settings: Pixelify Sans |
| Silkscreen | 2001 The Silkscreen Project Authors (github.com/googlefonts/silkscreen) The numbers of `SilkPixel`; Settings: Silkscreen; the loading message (`index.html`) |
| DotGothic16 | 2020 The DotGothic16 Project Authors (github.com/fontworks-fonts/DotGothic16) Settings: DotGothic 16 |
| Micro 5 | 2023 The Soft Type Project Authors (github.com/scfried/soft-type-micro) Loaded and styled (`body[data-font="micro5"]`), but Settings does not offer it today |

Before release: ship the OFL text (each package's `LICENSE` in
`node_modules/@fontsource/<font>/`) with the game.
