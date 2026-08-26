# Phase 11: Core Data Displays Reference

Documentation for the React components ported and built during Phase 11 of the architecture transition. The Stylist Agent should refer to these primitives and modules when constructing complex layouts like Cards or Panels.

## Base Primitives (`src/ui/components/base/`)

- **`ProgressBar.jsx`**: A unified progress bar supporting both discrete percentage fills (e.g., HP/Energy) via `max` and `current` props, and continuous CSS-driven transition animations (e.g., Task Timers) via a `durationSec` prop. Includes an `isPaused` boolean prop that turns the bar into a pulsing red state.
- **`Toast.jsx` & `ToastContainer.jsx`**: Global notification components. `ToastContainer` sits near the application root and automatically tracks events emitted by the legacy `EventBus` ('notification_added', 'notification_updated', 'notification_dismissed'). `Toast` is the visual, Framer Motion animated pop-up itself.
- **`Badge.jsx`**: _(Formerly GIIconBadge)_. A small, standardized graphical pill used largely in card corners or headers for resource costs, level indicators, or status effects. Supports `variant` props (`success`, `danger`, `warning`, `info`, `neutral`).

## Card Modules (`src/ui/components/card-modules/`)

- **`MetadataModule.jsx`**: A subtle typography module rendering the card's `type` and an array of `tags` separated by a stylistic dot.
- **`LootModule.jsx`**: Renders tables/lists of `guaranteedDrops` and `potentialDrops`. Distinctly styles the text based on drop configurations via the `AssetManager`.
- **`SkillRequirementsModule.jsx`**: Displays a row of required skills for a task using `lucide-react` or game icons. Dynamically compares requirements against a provided `currentSkills` prop, highlighting fulfilled requirements in green and unfulfilled in red.
- **`InfoModule.jsx`**: A standardized text block for displaying narrative flavor text or dense mechanical descriptions. Accepts `title`, `content`, and a `variant` ('lore' | 'mechanic'). Due to legacy engine architecture, the `content` prop supports safe `dangerouslySetInnerHTML` rendering to support raw `<br>` or `<b>` tags passing from vanilla Javascript definitions.
- **`AreaDeckBadge.jsx`**: A floating, highly stylized absolute-positioned overlay (`top-2 right-2`) exclusively used for Area BaseCards. It displays `currentDepth` / `maxDepth` and a local `threatLevel` percentage. Features a built-in alarm pulse if threat exceeds 75%.

## Hero Components (`src/ui/components/hero/`)

- **`EquipmentGrid.jsx`**: A fixed 2x3 grid displaying the equipped items on a Hero. Renders distinct "empty slot" visual states when an index is null.
