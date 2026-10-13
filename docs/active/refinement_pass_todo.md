# Refinement Pass — To-Do List

> **Mode:** Non-coding review and refinement intake.  
> **Status:** Fully triaged by the planning session on 2026-10-13: every item has moved on (see the arrows). Items marked [x] have moved on to the ticket shown in [TICKETS](../reference/TICKETS.md); the rest wait for their design interview, starting with the UI style guide (§5). Already decided elsewhere: the Starter Camp can't be abandoned (atlas A7) and map-written nodes can't be demolished (atlas D-6).

---

## 1. Potential Bugs & Rendering Issues

- [x] **Token Map Twitch / Flicker & Sharpness Loss** → **T-145**
  - **Symptom:** Every ~20–30 seconds, tokens on the mat twitch/flicker and momentarily (or intermittently) lose their pixel sharpness.
  - **Likely Area:** Sub-pixel positioning, nearest-neighbor canvas/CSS rendering, periodic re-render/interval cycle, or camera/viewport transform rounding.
  - **Goal:** Identify trigger (timer/gc/state cycle), preserve pixel-crisp nearest-neighbor rendering, eliminate periodic twitching.

- [x] **Animated Sprite Outline Clipping / Edge Cropping** → **T-146**
  - **Symptom:** When outlines are displayed on animated sprites, the outline gets cut off/clipped at the frame edges (e.g., top edge of a hero's bow, bottom edge of hero's feet).
  - **Cause:** Sprite pixels extend to the exact boundary of the animation frame/container, leaving no margin for the outline stroke.
  - **Proposed Fix / Direction:** Investigate expanding the frame padding slightly (e.g., 1px margin around animated frames) so outline shaders/strokes render cleanly without truncation.

---

## 2. Section Overhauls

- [x] **Top Bar: Token & Upkeep Summaries** → **[concept_map_tools.md](concept_map_tools.md)** ("The top bar around the modes"), T-170 (interview 2026-10-13)
  - **Need:** Full visual overhaul to match the latest aesthetic style.
  - **Goal:** Bring into alignment with current UI styles and strip down to clear, essential key information only (avoid visual clutter).

- [x] **Information Architecture: Bubbles vs. Hover vs. Inspection** → **[concept_info_layers.md](concept_info_layers.md)** (interview 2026-10-13)
  - **Need:** Comprehensive experimentation and cleanup on world/work bubbles and data distribution:
    - **Optimization & Efficiency:** Ensure rendering/tick performance is lightweight.
    - **World Mat / Bubbles:** Radically declutter default view.
    - **Hover:** Keep minimal essential indicators only (e.g., charges).
    - **Inspect Panel (Click):** Move deep information here (e.g., exact timers, detailed stats).
  - **Inspect Panel Content:** Needs dedicated copy/layout polish so information presented is tight, punchy, and concise.

- [x] **Cartography Atlas & Regions Viewport Overhaul** → **[concept_atlas_tome.md](concept_atlas_tome.md)**, T-172 to T-174 (interview 2026-10-13)
  - **Need:** Move away from the current modal / "popup window" look toward an immersive world view integrated with vertical camera transitions (pan up to Guild Hall constellation, pan down to Atlas).
  - **Theming & Frame:** Themed art framing (e.g., stylized as one giant tome / open book).
  - **Layout & Structure:**
    - **Regions:** Contained cleanly in its own dedicated sub-section/tab.
    - **Cartography:** Main hero/feature view displayed in a much larger canvas/size.
    - **Slots:** Add dedicated art, styling, and visual weight to slots.
  - **Gameplay Rule / Invariant:**
    - **Starting Camp cannot be abandoned:** Disallow abandoning the Starter Camp region. It houses endgame content and must remain a permanent fallback/rebuilding safety net for the player if they screw up other regions.

- [x] **Work Rules Menu & Hero Bar Integration Overhaul** → **[concept_work_permissions.md](concept_work_permissions.md)**, T-164 (interview 2026-10-13)
  - **Drawer Presentation:**
    - Transform into a sliding drawer from the bottom.
    - Sized to match the full width of the playmat.
    - Sits above or cleanly docks with the horizontal hero bar (keep heroes visible in the bar).
  - **Launcher Button Placement & Labeling:**
    - Integrate the gear/work rules button into the bottom hero bar layout with its own dedicated space (instead of floating disconnected on the left).
    - Add clear title/label copy next to the gear indicating it controls "Work Permissions" / rules.
  - **Grid & Content Polish:**
    - **Single Combat Column:** Consolidate combat permissions into one unified "Combat" column per hero (since each hero has one combat skill) to toggle combat on/off.
    - **Skill Header Tooltips:** Update tooltips to explain what the skill is actually used for in gameplay (primary purpose), rather than repetitive generic "click to allow/disallow" instructions.

- [x] **Guild Hall Upgrades Constellation View Overhaul** → **[concept_guild_hall.md](concept_guild_hall.md)** ("The look of the sky"), T-171 (interview 2026-10-13)
  - **Need:** Showing upgrade sprite icons directly on the constellation nodes causes heavy visual clutter.
  - **Constellation Aesthetic:**
    - Keep nodes styled purely as luminous stars connected in constellations (preserving the celestial aesthetic).
    - Lightweight tags/labels on or beside stars showing the upgrade name and rank at a glance (e.g. `[Name] [Current/Max Rank]`).
  - **Inspection / Hover:**
    - The actual upgrade sprite/icon, detailed descriptions, prerequisites, and resource costs are displayed cleanly in the inspection panel upon hover/select.

- [x] **Notification System Overhaul (Sidebar $\rightarrow$ Top-Right Log & Popout Toasts)** → **[concept_notifications.md](concept_notifications.md)**, T-168 (interview 2026-10-13)
  - **Need:** Replace the current long, permanent sidebar along the screen edge with a clean, unobtrusive system.
  - **Form Factor & Placement:**
    - Place a top-right notepad/log icon button.
    - Clicking the icon toggles open the full notification feed/history all at once.
  - **Behavior & Visibility:**
    - By default, notifications are tucked away/hidden so they don't occlude gameplay.
    - **Live Event Popouts:** As events happen, individual notifications pop out, hang briefly (for a second or two), and slide cleanly back away.
    - Hovering an individual notification provides expanded information.

- [x] **Map Controls Overhaul: Disallow Mode & Demolition Mode** → **[concept_map_tools.md](concept_map_tools.md)**, T-165, T-166 (interview 2026-10-13)
  - **Need:** Current flow requires inspecting an individual token to mark it for demolition or disallow, which is clunky and slow.
  - **Direct Tool Modes:**
    - Dedicated interactive map modes for **Disallow** and **Demolition** to click directly on tokens across the mat.
  - **Player Communication & Safety:**
    - Clear plain-text status/banner (e.g. on the top bar) explaining the active mode and its effect.
    - Demolition Mode safety: prominent warning/confirmation explaining that tokens will be destroyed.
  - **Demolition Scope & Invariants (Safe Deconstruction):**
    - Formally define demolishable vs non-demolishable tokens.
    - **Protected Nodes:** Naturally generated resource nodes and essential Starter Camp nodes must be protected/disallowed from demolition to prevent players from permanently depleting critical resources.
  - **Batch Controls:**
    - Include bulk actions like **"Allow All"** directly inside the Disallow mode menu to quickly reset permissions.

- [x] **Item Collection Automation: Warehouses & Guild Hall Collector** → **[concept_collectors.md](concept_collectors.md)**, T-175 (interview 2026-10-13)
  - **Concept:** Automated logistics buildings with an operational radius that sweep and collect dropped items directly into the player's bank.
  - **Specialized Warehouses:** Category/type-specific collection buildings (e.g., *Fish Warehouse* collects all fish dropped within its radius).
  - **Guild Hall Universal Collector:** The Guild Hall itself functions as a universal collector, automatically gathering all item types dropped within its area.

- [x] **256px Background & Card Art Integration: Area Banners & Inspect Backdrops** → area banners: **[concept_atlas_tome.md](concept_atlas_tome.md)**; inspect backdrops: **[concept_info_layers.md](concept_info_layers.md)**
  - **Assets:** Rich, detailed 256px illustration pieces previously used as card art.
  - **Area / Region Banners:** Use environmental pieces as thematic background banners for areas/regions (dynamically mapped based on the active map configuration) to add world flavor and immersion.
  - **Inspect Panel Backdrops:** Use skill- and trade-oriented pieces as environmental backdrop art in the inspection panels, grounding each token in its specific activity/setting.

- [x] **Recipe Presentation & Inspection Overhaul** → **[concept_recipe_list.md](concept_recipe_list.md)**, T-169 (interview 2026-10-13)
  - **Need:** Current recipe list presentation needs a ground-up rework for clarity, density, and usability.
  - **Structure & Ordering:**
    - Sort recipes strictly by required skill level.
    - Compact, efficient vertical layout utilizing available vertical screen space without clipping.
  - **Decluttering:**
    - Remove extraneous/verbose helper text (e.g., the big yellow `"a more skilled guild member can run this"` banner).
    - Eliminate redundant labeling (e.g., avoid tautologies like `"Apple Juice makes 1 Apple Juice"` since recipe name matches primary output).
  - **Inputs & Outputs Clarity:**
    - Clean, un-truncated display of all required inputs and outputs.
    - Support secondary / rare / byproduct outputs cleanly alongside the primary product.
  - **Hero Qualification Indicators:**
    - Display compact hero avatar/icon markers alongside recipe tiers to show at a glance which recipes your current heroes qualify to work.
  - **Search & Filter:**
    - Add a fast search input allowing players to filter recipes by input ingredients or output products.

- [x] **Settings Menu: "Quick Settings" Landing Surface** → **T-157**
  - **Need:** Players opening settings usually want immediate access to common toggles without drilling through multiple sub-menus.
  - **Quick Settings View:** Add a prominent "Quick Settings" panel/landing tab bundling the most common adjustments:
    - Master Volume slider
    - Background Music slider
    - Sound Effects slider
    - Core display/performance toggles
  - **Mirroring:** Keep these controls present in their respective deep tabs (e.g. Audio tab) so the menu structure remains complete.

---

## 3. Simple Tweaks & Interaction Polish

- [x] **Token Hover State: Replace Bob with Sharp Outline** → **T-147**
  - **Need:** The floating/bob animation on hover feels visually noisy and loose when sweeping the cursor across the mat.
  - **Goal:** Replace the bob animation with a clean, sharp pixel outline on hovered tokens to keep the map grounded and legible.

- [x] **Horizontal Hero Bar: Mouse Wheel Scroll & Smooth Transitions for Level-Up Alerts** → **T-149**
  - **Need:** Enable native mouse-wheel scrolling across queued level-up notifications.
  - **Goal:** 
    - Support smooth slide/transition animation between notifications.
    - Keep existing clickable chevron/arrow buttons intact alongside wheel support.

- [x] **Hero Flag Sprite: 32px Sizing Experiment** → **T-150**
  - **Need:** Current flags are too large and occupy excessive playmat screen space.
  - **Goal:** Experiment with the new 32px flag sprite for heroes. Since players will primarily click and drag on the hero directly to position the flag, the flag itself can be significantly smaller and less intrusive.

- [x] **Drawer Coordination: Mutual Exclusivity (Item Bank, Shop, Work Rules)** → **T-152**
  - **Need:** Drawers currently fight for screen real estate and state when opened concurrently.
  - **Goal:** Enforce mutual exclusivity—opening any drawer (Item Bank, Shop, Work Rules) automatically closes other open drawers; closing the active drawer cleanly returns directly to the normal playmat view.

- [x] **Hero Level-Up Speech Bubble: Compact Copy Format** → **T-149 (hero bar alert)**
  - **Need:** Current text is verbose and cluttered (e.g., `"Level up, 50 Stealth + 49"`).
  - **Goal:** Simplify to just `[Level] [Skill]!` (e.g., `"50 Stealth!"`). Punchy and instantly readable.

- [x] **Station & Foundation Gear Alerts: Remove Resize/Pulsing Glow** → **T-153**
  - **Art Direction Violation:** The gear alert icon on stations/foundations currently pulses, scales/resizes, and glows, distorting pixel art.
  - **Rule:** Sprites must maintain strict 1:1 pixel sizing without scaling, stretching, or fuzzy CSS glows.
  - **Goal:**
    - Replace the resizing pulse and glow with the standardized sharp pixel outline.
    - If attention pulsing is needed, experiment strictly with outline color shifting/pulsing (geometry remains static).
    - Plan and add test coverage before implementation.

- [x] **Tooltip Behavior: Cursor-Tracking (Follow Mouse)** → **T-030**
  - **Need:** Tooltips currently anchor statically or sprout out of the underlying UI element being inspected, which can feel rigid or disconnected.
  - **Goal:** Make tooltips dynamically follow / attach to the cursor as the mouse moves across elements for a smoother, more responsive feel.

- [x] **Token Drag Initiation: Smooth Pickup Transition (No Instant Teleport)** → **T-154**
  - **Need:** Currently, clicking to drag a token causes it to instantly jump/teleport to center directly under the cursor.
  - **Goal:** Keep the centering behavior, but animate it as a very fast, smooth pickup transition (e.g. rapid lift-off/fly into cursor center over ~50–100ms) so tokens never visibly pop/teleport into the cursor.

- [x] **Quest Billboard Token: Sprite Layering, Signboard Persistence & Status Icons** → **[concept_quests_tutorial.md](concept_quests_tutorial.md)** ("Quest boards"), T-176 (interview 2026-10-13)
  - **Persistent Signboard Lifecycle:** On quest completion, do not despawn/destroy the signboard and spawn a replacement token. Keep the existing physical sign on the playmat, pay out rewards, and deliver the subsequent quest poster onto that same board.
  - **Layered Drag Sprite:** When dragging a questboard token displaying an item poster on its front, maintain the composite/layered sprite during the drag so the item does not disappear while carried.
  - **Hunt / Enemy Quests:** Display enemy/monster sprites on the billboard face (currently shows nothing for hunt quests).
  - **Tutorial / Itemless Quests:** Display an alert badge (yellow alert icon during progress, turning green once requirements are met/ready to turn in).

- [x] **Token Mobility: Restore Guild Hall Movability & Add Movable Feedback** → **T-148 (feedback: atlas A10 marker)**
  - **Guild Hall Movability:** Re-enable dragging/moving the Guild Hall. The recent static-token changeover accidentally locked it in place; moving key guild structures is core fun and player agency.
  - **Mobility Feedback:** Provide clear visual feedback/cues distinguishing which tokens are player-movable versus static/immobile.

- [x] **Token Spawning: Universal Origin Pop-Out Animation (Match Guild Hall)** → **T-155**
  - **Issue:** Tokens popping out of the Guild Hall play a smooth emergence animation, but world spawners (e.g., a Forest spawning a new Tree) pop in abruptly without an origin animation.
  - **Goal:** Standardize generator spawns so new tokens smoothly pop out from their parent/origin token before landing on the mat.

- [x] **Hero Inspect Panel: Locked Skill Tooltips, Button Cleanup & "X" Scale** → **T-156**
  - **Locked Skill Tooltips:** Tooltips on locked skills must explicitly indicate the required Class needed to unlock them (e.g. `"Requires [Class Name]"`).
  - **Remove Redundant Work Rules Button:** Drop the Work Rules button from the individual hero inspect panel (it is now centralized with its own labeled slot on the bottom hero bar).
  - **"X" (Close) Button Sizing & Pixel Integrity:** Fix the "X" button currently rendering too small and distorted. Enforce the canonical sprite dimensions so pixels remain crisp and undistorted.

---

## 4. Animation, VFX & Art Asset Experiments

- [x] **Token & UI "Shine Sweep" Effect** → **[concept_level_up.md](concept_level_up.md)** (interview 2026-10-13)
  - **Concept:** A subtle diagonal/linear shine sweep across the face of a token or UI button.
  - **Use Case:** Trigger when something special occurs on a token (e.g., milestone, rare trigger, upgrade) or on interactive UI buttons.
  - **Visual Rule:** Must not blot out or mask the underlying pixel artwork—just a fast, crisp sweep of light/sheen across the surface.
  - **Status:** Queued for future animation prototyping and sandbox testing.

- [x] **Hero Playmat Level-Up: Celebratory Animation & Splashy Speech Bubble** → **[concept_level_up.md](concept_level_up.md)** (interview 2026-10-13)
  - **Context:** The horizontal hero bar notification remains subtle and persistent, but the on-mat hero moment needs high excitement and celebratory juice.
  - **Hero Sprite Animation:** Flashy celebratory FX on the hero token itself (e.g. sparkle, radiant burst, or level-up aura).
  - **Splashy World Speech Bubble:**
    - Appears over the hero on the playmat.
    - Copy & Layout: Celebratory line (e.g. `"I leveled up Fishing!"` or similar callout).
    - Features large skill icon and the new level number in a prominent, large font size so progression feels impactful and immediately clear.

- [x] **Token Sprite Vibrancy & Contrast Lift Exploration (Asset Pass)** → **T-180** (interview 2026-10-13)
  - **Observation:** During drag states, tokens receive a temporary brightness/contrast boost that looks rich, vibrant, and "gamey", making default mat tokens look somewhat washed out by comparison.
  - **Exploration Goal:** Investigate permanently boosting brightness/contrast across the token sprite library to make world visuals pop.
  - **Source Art Rule (No Engine Filters):** Update the source pixel sprites directly rather than applying runtime CSS/canvas filters in engine code.
  - **Strict Safeguards & Verification:**
    - **Backup:** Create a full archive backup of all existing source sprites and raw assets before running any batch processing.
    - **Palette & Material Consistency Review:** Ensure connected materials maintain palette identity across types (e.g. Oak Wood item color must strictly match the bark on the Oak Tree token; Stone items match Stone veins).
    - **Prototype First:** Test with a small batch before touching the entire library.

---

## 5. Systemic Guidelines & Design Standards (For Planning Agent)

- [x] **Establish Comprehensive UI Style Guideline & Component Pattern Reference** → **[UI_STYLE.md](../reference/UI_STYLE.md)** (interview 2026-10-13), T-159 to T-162, T-036
  - **Problem:** When building new UI features, builders often invent ad-hoc styles or mix inconsistent UI patterns instead of adhering to the design system.
  - **Goal:** Work with the planning agent to document and codify clear, canonical reference patterns that all feature implementations must follow.
  - **Key Examples to Standardize First:**
    - **Item Representation (Non-Physical / Reference):** How items are displayed when referenced abstractly (e.g., in drop tables, shop prices, upgrade costs, recipes) vs. physical inventory items. Keep consistent with the proven format already working well.
    - **Badge & Pill Standards:** Reuse established pills/compact chips (e.g. icon-and-count) instead of inventing new row variants.
    - **Action Sprites & Close ("X") Buttons:** Establish explicit 1:1 pixel sizing rules for modal/panel headers, close buttons ("X"), and control icons so builders stop squishing or shrinking sprites to fit containers.
  - **Outcome:** A locked reference guide so future builders don't guess or diverge.

---

## 6. Future Systems & Opening Experience

- [x] **Title Screen: Live Autonomous Background Diorama ("Mini-Game" Simulation)** → parked in **[concept_release.md](concept_release.md)** (interview 2026-10-13)
  - **Horizon:** Longer-term milestone (when proper splash, new game, and load game menus are built).
  - **Concept:** Behind the title menu options, render a live, autonomous mini-mat simulation.
  - **Behavior:**
    - Generates a compact randomized map with varied resource nodes.
    - Spawns a handful of autonomous heroes puttering around—gathering, crafting, and fighting in the background.
    - Seeds exciting endgame vignettes (e.g., heroes battling a fierce dragon) to give new players an immediate taste of high-level adventure and tease progression possibilities.

---

## 7. Workflow & Agent Collaboration Protocols

- [x] **Dual-Agent Workflow Integration (Planning vs Director)** → the roles are in CLAUDE.md; "new art is routine" added to CLAUDE.md 2026-10-13
  - **Planning Agent Role:** Conducts interviews with the owner, author/updates concept documentation (`docs/active/concept_*.md`), refines design requirements, and prepares structured briefs for upcoming passes.
  - **Director Agent Role:** Focuses purely on execution and implementation, coordinating subagents (runners, builders, engineers) to ship verified code against locked briefs.
  - **Owner's Active Surfaces:** The owner frequently and independently updates two specific areas:
    1. **Concept Documentation:** (`docs/active/` - concept files, ideas list, roadmaps, `owner_art_list.md`).
    2. **Art Assets & Sprites:** New and revised pixel art files dropped into asset folders.
  - **Agent Expectation & Ground Rule:** Agents must never be "surprised" by new or updated art assets in the repository or by owner requests to quickly swap old sprites for newly created ones. Treat art additions as standard, regular owner activities and accommodate asset migrations smoothly.

---

## 8. CMS & Internal Tooling Architecture (Studio Splitting)

- [x] **Decouple Recolor Studio into a Dedicated Standalone Tool / Surface** → **T-179** (interview 2026-10-13)
  - **Need / Context:** Recolor is heavily and constantly used by the owner for asset creation, material variations, and palette swaps. Housing it inside the unified CMS causes friction, sluggishness, and mutual interference with heavy CMS processes (entity store cache mutations, background recalculations, or data syncing).
  - **Goal:** Extract the Recolor Editor (`cms/src/components/editors/RecolorEditor.jsx`) into an independent, lightweight standalone tool or dedicated workspace surface.
  - **Requirements & Scope:**
    - Isolate recolor workflows completely from game entity state (`useEntityStore`, `useGlobalStore`).
    - Retain full pixel processing capabilities: color picking/sampling, tolerance sliders, target material swaps, palette snapping, and direct asset saving (`/api/save-recolored-asset`).
    - Provide a fast-launching, non-blocking UI with zero risk of accidental game JSON overrides during sprite recoloring runs.

- [x] **Decouple Animation Studio into Standalone Motion & Sprite Viewer** → **T-179** (interview 2026-10-13)
  - **Need / Context:** The Animation Editor (`cms/src/components/editors/AnimationEditor.jsx`) serves a purely visual review and motion testing purpose for hero and enemy sprite sheets (frame grids, playback speeds, outline clipping checks). It serves a distinct purpose from game balance and database editing.
  - **Goal:** Separate the Animation Studio from the CMS into an independent viewer utility.
  - **Requirements & Scope:**
    - Dedicated studio layout for animators and artists to quickly load, slice, and preview animation sheets (e.g., 8x3 hero cycles, 4x4 enemy sheets).
    - Maintain sprite inspection controls (FPS slider, frame-stepping, scale toggle, checkerboard backdrop) without loading CMS database stores or entity datasets.

- [x] **Streamline Core CMS Navigation & Workflow Isolation** → **T-179** (interview 2026-10-13)
  - **Need:** The CMS top bar currently bundles disparate domains (game data, economic balance, sprite editing, motion review).
  - **Goal:** Clean up `cms/src/components/layout/TopBar.jsx` and `cms/src/App.jsx` to focus the CMS purely on data authoring and validation:
    - Items, Tokens, Recipes, Maps, Effects, Progression, Starter Camp, and Economy/Sprite Audits.
    - Remove the `recolor` and `animation` views/tabs from the primary CMS once standalone alternatives are in place.
    - Prevent asset-heavy processing from interfering with core database sync (`syncToGame`) and backport operations.

- [x] **Tooling Architecture & Launch Configuration (Dev Scripts & API Endpoints)** → **T-179** (interview 2026-10-13)
  - **Architecture Plan:** Determine the hosting/execution model for decoupled studios (e.g., separate Vite sub-apps, dedicated multi-page routes, or dedicated npm scripts like `npm run studio:recolor` / `npm run studio:animation`).
  - **Asset API Endpoints:** Ensure asset I/O endpoints (like `/api/save-recolored-asset` and asset directory serving) are clean, robust, and cleanly routed without CMS state entanglements.

---

## 9. Cross-Reference & Overlap Notes
- *Director & Planning Workflow:* Directly matches the workflow outlined in [CLAUDE.md](file:///c:/Users/16048/Projects/fantasy_guild_v2/CLAUDE.md#L14-L60) (§ "How work runs: director mode" & "Planning sessions").
- *Owner Art Tracking:* Connects with [owner_art_list.md](file:///c:/Users/16048/Projects/fantasy_guild_v2/docs/active/owner_art_list.md).
- *UI Standardization & Pricing Format:* Directly connects with `docs/reference/TICKETS.md` (T-009) regarding shop price format vs. Hall upgrade button pills.
- *Notifications Sidebar:* Directly updates and supersedes the earlier sidebar notes in `docs/active/design_pass_notes.md` (§ "Notifications sidebar").
- *Bubbles & Inspection:* Aligns with open note in `docs/active/design_pass_notes.md` (§ "Bubbles and framerate") regarding bubble redesign and inspection popup tuning.
- *Speech Bubbles:* Connects with speech bubble audit item in `docs/reference/TICKETS.md` (T-010).
- *Hero Bar:* Complements pending hero bar touch-ups noted in Brief 30.
- *Hero Flag:* Relates to flag art notes in `docs/reference/TICKETS.md` (T-008).
- *Quest Billboard Overlays:* Addresses the open item from `docs/active/design_pass_notes.md` (§ "Open from brief 10") stating hunt quests currently show nothing on the billboard.
- *Glow vs. Hard Outline:* Directly related to backlog ticket `docs/reference/TICKETS.md` (T-013) on retiring remaining alert-icon glows in favor of the hard-pixel style.
- *CMS & Studio Decoupling:* Relates to asset processing tools in [process_art.cjs](file:///c:/Users/16048/Projects/fantasy_guild_v2/scripts/process_art.cjs) and Vite API handlers in [vite-plugin-cms-api.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/cms/vite-plugin-cms-api.js).
