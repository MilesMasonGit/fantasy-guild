# Brief 820 — The game is called Tabletop Guild

*Written 2026-11-22 by the planning agent from the owner's request and the follow-up interview the same
day. Independent of the other briefs: it may run any time, alone.*

**What the player gets.** The game's name is **Tabletop Guild** everywhere they see it: the title screen,
the window, the loading screen, the program and its installer. "Fantasy Guild" was the working title.

## The rulings (owner, 2026-11-22)

- **Everything the player sees, and the app's hidden ID.** The ID `com.fantasyguild.game` becomes
  `com.tabletopguild.game`. ⚠️ Windows keeps saves and settings by that ID, so **the game starts with no
  saves or settings** after this lands (the old ones stay on disk, unseen). Accepted: saves aren't
  protected before 1.0.
- **Docs and agent instructions** say Tabletop Guild: `CLAUDE.md`, the live docs, READMEs, the agents'
  and skills' instructions. Archived docs (`docs/archive/`) and old changelog entries stay as written.
- **Code comments drop the name**: the many files that open with a "Fantasy Guild —" line lose those
  words (comments keep only a why; the rest of the line stays if it says something).
- **Not renamed**: the GitHub repository and the project folder on the owner's PC (renaming the folder
  breaks every worktree and the agents' memory).

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`. Find every use with
`git grep -n -i -I "fantasy.guild\|fantasyguild\|fantasy_guild"` (read 2026-11-22 at `e885d8a3`; the
code wins).

## Phases

| Phase | Ticket | What | Tier |
|---|---|---|---|
| N1 | T-664 | **The game.** The title screen's name (`en.json` `titleScreen.gameName`); `index.html` (the window title and the loading screen's text); `src-tauri/tauri.conf.json` (`productName`, `mainBinaryName`, the window `title`, `identifier` to `com.tabletopguild.game`); `package.json` and `package-lock.json` (`name`: `tabletop-guild`, both lock fields); the CMS page title (`cms/index.html`); `public/pixel_forge.html`; the start-up log line (`main.jsx`). The game's browser storage keys (`fantasy_guild_*` in `SaveManager.js`, `SaveSlotHelper.js`, `SettingsManager.js`, `matTuning.js`, `playmatTuning.js`, `TestDashboard.jsx`, `stressScenarios.js`) become `tabletop_guild_*`, matching the fresh start. ⚠️ **Keep unchanged**: the CMS's own workspace key (`fantasy-guild-cms-v2`, renaming it would empty the owner's CMS workspace), the change-pack and plan `format` tags and the schema `$id`s (staged packs in `cms/incoming/` carry the old tag and must still apply), and anything under `data/` (CMS only). Then a desktop build: the program is `Tabletop Guild.exe` and its window says Tabletop Guild. | builder |
| N2 | T-664 | **Docs, agents and comments.** `CLAUDE.md`, `README` files, `docs/active/` and `docs/reference/` (not `docs/archive/`), `.claude/agents/`, `.claude/skills/`, `.agent/`: "Fantasy Guild" becomes "Tabletop Guild" (the folder name `fantasy_guild_v2` in paths stays). Code comments in `src/`, `cms/`, `bench/`, `scripts/`: drop the "Fantasy Guild —" / "Fantasy Guild -" prefix; the bench's printed headers say Tabletop Guild. Update `TESTING.md` where it names the storage keys. Purely mechanical. | runner |

**Order and parallel work.** N1 first, then N2 (N2 touches the docs that name N1's keys). Neither
changes how the game plays.

## Done when

- Gate green; bench work check **same work** (nothing in the engine changes).
- `git grep -i "fantasy.guild\|fantasy_guild"` finds only: the kept keys and tags above, `data/`,
  `docs/archive/`, old `CHANGELOG.md` entries, and paths containing the folder name.
- Seen in a desktop build: the title screen, the window title and the loading screen say Tabletop
  Guild; the program is `Tabletop Guild.exe`; a new game starts and saves, and reloads after a restart.
- A `CHANGELOG.md` entry; the ticket closed into `docs/archive/tickets_done.md`.

**Eye-check: no** (wording). One line in STATUS so the owner knows it landed, **saying the next desktop
build starts with no saves or settings**.

## Owner to-do

None. If you'd like the title screen to show a drawn logo instead of the name in text, save it as
`public/assets/ui/u_title_logo.png`: the title screen already shows that file in place of the text when it
exists.
