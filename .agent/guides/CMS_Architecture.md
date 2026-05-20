# Fantasy Guild CMS — Architecture Reference

> **Location:** `fantasy_guild_v2/cms/` — standalone Vite/React app, completely separate from the game.  
> **Dev server:** `npm run dev` → `localhost:5175`  
> **Design Document:** [CMS_Design_Document.md](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/.agent/guides/CMS_Design_Document.md)

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite |
| Styling | TailwindCSS v4 + custom CSS tokens (dark mode only) |
| State | Zustand with `persist` middleware → LocalStorage |
| Graph | `@xyflow/react` (ReactFlow v12) |
| Icons | `lucide-react` |
| AI Generation | `@google/generative-ai` (Gemini 2.5 Flash) |

---

## 2. Directory Structure

```
cms/src/
├── App.jsx                          # Root: AppShell wrapper + EditorRouter
├── main.jsx                         # Vite entry point
├── index.css                        # TailwindCSS + design token definitions
│
├── stores/                          # Zustand state management
│   ├── useEntityStore.js            # All entity CRUD (items, tasks, enemies, areas, quests, subskills, effects)
│   ├── useGlobalStore.js            # Simulation constants, API key, style guide
│   └── useSimulationStore.js        # Audit results, sim progress, last-run timestamp
│
├── engine/                          # Pure-logic simulation (zero React dependencies)
│   ├── valuePropagator.js           # Root→downstream value chain propagation
│   ├── evCalculator.js              # Task EV: Total Cost / Total Reward
│   ├── xpPrescriber.js              # Duration-normalized XP curve
│   ├── mockBattle.js                # Deterministic combat simulation
│   ├── connectivityAuditor.js       # Orphans, dead-ends, skill gaps, cycles
│   ├── contentGenerator.js          # Gemini-powered AI entity generation
│   └── runSimulation.js             # Orchestrator: runs all engines in sequence
│
├── components/
│   ├── layout/
│   │   ├── AppShell.jsx             # 3-panel layout + GenerateModal state
│   │   ├── TopBar.jsx               # Run Sim button, Generate button, audit badge
│   │   └── Sidebar.jsx              # Entity type tabs + scrollable entity list + create
│   │
│   ├── editors/                     # Entity form editors
│   │   ├── ItemEditor.jsx           # Dual-value display (trueCost / sellPrice)
│   │   ├── TaskEditor.jsx           # targetEV, inputs/outputs, isPrimarySource toggle
│   │   ├── EnemyEditor.jsx          # Mock Battle Readout panel + combat stats
│   │   ├── AreaEditor.jsx           # Pack pool management + cost diagnostics
│   │   ├── QuestEditor.jsx          # Lock/key quest linking
│   │   ├── SubskillManager.jsx      # Add/remove subskills per skill
│   │   └── EffectEditor.jsx         # Defines buffs, debuffs, and resource drains
│   │
│   ├── graph/
│   │   ├── MasterWeb.jsx            # ReactFlow canvas wrapper
│   │   ├── EntityNode.jsx           # Custom node (color-coded by entity type)
│   │   ├── GraphFilters.jsx         # Area, skill, supply chain, level range filters
│   │   └── graphTransformer.js      # entities → ReactFlow nodes/edges
│   │
│   ├── audit/
│   │   └── AuditPanel.jsx           # Sortable/filterable issue table + "Fill Gap" AI button
│   │
│   └── shared/
│       ├── EntitySelect.jsx         # Autocomplete dropdown with Ghost Creation
│       ├── GenerateModal.jsx        # AI content generator modal (Gemini)
│       └── FileManagerModal.jsx     # Save, load, and create workspaces (LocalStorage persistence)
│
└── utils/
    ├── constants.js                 # Skills, item types, default globals, enemy tiers
    └── idGenerator.js               # nanoid-based unique ID generation
```

---

## 3. State Architecture

### 3.1 useEntityStore (persisted)

The central store for all game entities. Each collection is an `{ [id]: entity }` object.

```
items:      { id, name, icon, type, trueCost, sellPrice, isRoot, tags, stackable, ... }
tasks:      { id, name, cardType, areaId, baseTickTime, skill, skillRequirement, targetEV,
              inputs: [{ itemId, quantity }],
              outputs: [{ itemId, quantity, chance, isPrimarySource }],
              calculatedEV, goldPerMinute, xpPerMinute, prescribedXP }
enemies:    { id, name, tier, combatStat, hp, attackSpeed, combatType, biomeId,
              drops: [{ itemId, minQty, maxQty, chance }],
              calculatedEV, timeToKill, expectedDamageTaken, heroDps, enemyDps, ... }
areas:      { id, name, icon, totalFragments, packBaseGoldCost, cardPool,
              expectedPackValue, estimatedTimeToPurchase }
quests:     { id, name, targetEvent, targetId, maxProgress, mapFragmentTarget, rewards }
subskills:  { id, name, parentSkill }
effects:    { id, name, type, targetCategory, magnitude, drainTrigger, estimatedGpValue, description }
```

**Key patterns:**
- `addItem(data)` returns the generated ID
- `updateItem(id, patch)` does a shallow merge
- `setActiveEntity(id, type)` drives editor routing
- `getAllEntitiesFlat()` returns all entities with a `_type` field for cross-entity search
- Persisted to `localStorage` key: `fantasy-guild-cms-entities`

### 3.2 useGlobalStore (persisted)

Simulation tuning knobs. Key fields:

| Field | Default | Purpose |
|---|---|---|
| `gpt` | 10 | Gold Per Tick (value of 10s of Level 1 labor) |
| `energyGpValue` | 0.25 | 1 Energy = 0.25 GP |
| `healthGpValue` | 0.50 | 1 Health = 0.50 GP |
| `xpToGoldRatio` | 0.1 | 10 XP = 1 Gold |
| `skillMultiplierRate` | 0.002 | +0.2% per skill level |
| `defaultTargetEV` | 1.05 | Default profitability target |
| `sellModifiers` | `{ Material: -0.30, Tool: -0.50, ... }` | Type → sell price modifier |
| `heroProfiles` | `{ 1: { combatStat: 5, derivedHp: 30 }, ... }` | Standard hero per tier (1-5) |
| `geminiApiKey` | `''` | Stored locally, sent only to Google API |
| `generatorStyleGuide` | *(see below)* | Persistent rules injected into AI prompts |

Persisted to `localStorage` key: `fantasy-guild-cms-globals`

### 3.3 useSimulationStore (not persisted)

Transient simulation state:

```
auditResults: []         // Array of { entityId, entityName, entityType, issueType, severity, details }
isRunning: false         // True during simulation
progress: 0              // 0-100
progressLabel: ''        // e.g., "Propagating values..."
lastRunTimestamp: null    // Date.now() after last run
```

---

## 4. Simulation Pipeline

Triggered by the **"Run Simulation"** button in TopBar. Runs asynchronously with progress callbacks.

```
┌─────────────────────────────────────────────────────┐
│ runSimulation(entities, globals, onProgress)         │
│                                                     │
│ Step 1 (10%): Value Propagation                     │
│   → Walk graph from Root Items through primary-     │
│     source tasks. Calculate trueCost + sellPrice.    │
│                                                     │
│ Step 2 (25%): XP Prescription                       │
│   → xpCurve(skillLevel) × (duration / 10000)        │
│                                                     │
│ Step 3 (40%): Task EV Calculation                   │
│   → For each task:                                  │
│     Cost  = materialCost + laborCost + energyCost   │
│     Reward = weightedOutputValue + xpValue          │
│     EV = Reward / Cost                              │
│                                                     │
│ Step 4 (60%): Combat Simulation                     │
│   → For each enemy:                                 │
│     Mock battle using heroProfiles[enemy.tier]      │
│     → TTK, damageTaken, healthCostGP                │
│     → Combat EV = lootReward / (healthCost + energy)│
│                                                     │
│ Step 5 (85%): Connectivity Audit                    │
│   → Orphans, dead-ends, skill gaps, incomplete      │
│     chains, circular references                     │
│                                                     │
│ Returns: { itemUpdates, taskUpdates, enemyUpdates,  │
│            auditResults, propagation }              │
└─────────────────────────────────────────────────────┘
```

**After simulation**, TopBar writes results back to the entity store:
- `itemUpdates` → `updateItem(id, { trueCost, sellPrice })`
- `taskUpdates` → `updateTask(id, { calculatedEV, goldPerMinute, xpPerMinute, prescribedXP })`
- `enemyUpdates` → `updateEnemy(id, { calculatedEV, timeToKill, expectedDamageTaken, heroDps, ... })`
- `auditResults` → `useSimulationStore.setAuditResults()`

---

## 5. Engine Modules (Pure Logic)

### 5.1 valuePropagator.js
- Starts from items where `isRoot === true` (manually set `trueCost`)
- Walks forward through tasks where an output has `isPrimarySource: true`
- Sets `trueCost = totalCost × targetEV` for downstream items
- Sets `sellPrice = Math.round(trueCost × (1 + sellModifiers[item.type]))` (integer)
- Iterates until no new items can be valued (handles multi-tier chains)

### 5.2 evCalculator.js
- `calculateTotalCost(task, items, globals)` → materialCost + laborCost + energyCost
- `calculateTotalReward(task, items, globals)` → weighted output values + XP-to-gold
- `calculateTaskEV(task, items, globals)` → `{ calculatedEV, goldPerMinute, xpPerMinute }`
- Labor cost formula: `(baseTickTime / 10000) × GPT × (1 + skillLevel × skillMultiplierRate)`

### 5.3 xpPrescriber.js
- XP curve: `5 + (level - 1) × 0.5 + (level / 20)²`
- Duration-normalized: `baseXP × (taskDuration / 10000)`
- Ensures same-level tasks give equal XP/minute regardless of duration

### 5.4 mockBattle.js
- **Deterministic** — uses expected values instead of dice rolls
- Mirrors game's `FormulaRegistry.js` formulas exactly:
  - Hit chance: `50 + (atkSkill - defSkill) × 2`, clamped [5, 95]
  - Defence: `min(skill × 0.5, 50) / 100`
  - Attack speed: `3000ms / (1 + level × 0.005)`, floor 500ms
- **Derived stats from `combatStat`:**
  - `minDamage = floor(combatStat × 0.8)`, `maxDamage = ceil(combatStat × 1.2)`
  - `attackSkill = combatStat`, `defenceSkill = floor(combatStat × 0.8)`
  - Hero weapon: `min = floor(combatStat × 1.0)`, `max = ceil(combatStat × 1.4)`
- **Neutral RPS** — hero uses same combat style as enemy (baseline balance)
- Returns: `{ timeToKill, expectedDamageTaken, healthCostGp, heroDps, enemyDps, canHeroSurvive }`
- `calculateCombatEV()` — cost = healthCost + energyCost, reward = loot + XP

### 5.5 connectivityAuditor.js
Detects structural issues:
- **Orphan Items**: used as task input but no task produces them
- **Dead-End Items**: produced but never consumed
- **Skill Gaps**: level ranges with no tasks for a skill
- **Incomplete Chains**: tasks with unresolvable inputs
- **Missing Primary Source**: non-root items with no `isPrimarySource` task

### 5.6 contentGenerator.js (AI)
- Builds a system prompt teaching Gemini the full economic model
- Injects `generatorStyleGuide` from GlobalStore
- Supports 3 modes: Generate Area, Fill Skill Gap, Custom Prompt
- Aware of the `effects` registry: can invent new Effects and bind them to generated Items or Enemies
- `generateContent()` → calls Gemini API → returns `{ items: [...], tasks: [...], enemies: [...] }`
- `resolveAndImport()` → resolves itemNames/effectNames to IDs, creates entities, assigns areaId

---

## 6. UI Architecture

### 6.1 Layout
```
┌──────────────────────────────────────────────────────────┐
│ TopBar (56px)                                            │
│ [Logo] [Editor | Graph | Audit tabs]  [Generate] [RunSim]│
├──────────┬───────────────────────────────────────────────┤
│ Sidebar  │ Main Panel (flex)                             │
│ (280px)  │                                               │
│ ┌──────┐ │ EditorRouter / MasterWeb / AuditPanel         │
│ │Tabs  │ │                                               │
│ │Items │ │                                               │
│ │Tasks │ │                                               │
│ │Enemy │ │                                               │
│ │Areas │ │                                               │
│ │Quest │ │                                               │
│ ├──────┤ │                                               │
│ │Entity│ │                                               │
│ │List  │ │                                               │
│ │(scrl)│ │                                               │
│ └──────┘ │                                               │
└──────────┴───────────────────────────────────────────────┘
```

### 6.2 Routing
AppShell manages a `currentView` state (`'editor' | 'graph' | 'audit'`). TopBar switches views via `onViewChange`. The main panel renders:
- `editor` → `EditorRouter` → looks up `activeEntityType` → renders the correct editor
- `graph` → `MasterWeb` (ReactFlow)
- `audit` → `AuditPanel`

### 6.3 Entity Selection Flow
1. User clicks entity in Sidebar → `setActiveEntity(id, type)`
2. `EditorRouter` reads `activeEntityType` → renders `ItemEditor` / `TaskEditor` / etc.
3. Editor reads entity from `useEntityStore(s => s.items[activeId])`
4. Every field change calls `updateItem(id, { field: newValue })` → persists immediately

### 6.4 EntitySelect (Ghost Creation)
Used in Task inputs/outputs and Enemy loot tables. Behavior:
- Searchable dropdown of all items
- If typed name doesn't match → shows "Create [Name]" option
- Selecting it creates a **ghost item** (stub: id + name only) and links it

### 6.5 GenerateModal
Managed by `AppShell` via `generateOpen` / `generatePrefill` state.
- Opened from: TopBar "Generate" button, or AuditPanel "Fill Gap" button (with prefill)
- Shows mode selection → config fields → generates → preview → import
- Preview shows all items/tasks before committing
- Import calls `resolveAndImport()` which creates entities in the store

---

## 7. Design System

### CSS Tokens (defined in `index.css` via `@theme`)

| Token | Value | Usage |
|---|---|---|
| `--color-bg-deep` | `#0a0c12` | Page background |
| `--color-bg-base` | `#0f1117` | Input backgrounds, inner containers |
| `--color-bg-surface` | `#1a1d27` | Card/panel backgrounds |
| `--color-bg-elevated` | `#222638` | Editor sections |
| `--color-bg-hover` | `#2a2f45` | Hover states |
| `--color-accent` | `#6366f1` | Primary interactive (indigo) |
| `--color-accent-hover` | `#818cf8` | Accent hover |
| `--color-item` | `#60a5fa` | Item entity color (blue) |
| `--color-task` | `#34d399` | Task entity color (green) |
| `--color-enemy` | `#f87171` | Enemy entity color (red) |
| `--color-area` | `#c084fc` | Area entity color (purple) |
| `--color-quest` | `#fbbf24` | Quest entity color (gold) |
| `--color-effect` | `#f472b6` | Effect entity color (pink) |

### Button Classes
- `.btn-primary` — Filled accent button
- `.btn-ghost` — Outlined/transparent button

### Typography
- Font: Inter (via Google Fonts, loaded in `index.html`)
- Base size: 13px for inputs/buttons

---

## 8. Data Flow Summary

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ useGlobalStore   │    │ useEntityStore   │    │ useSimStore      │
│ (tuning knobs)   │    │ (all entities)   │    │ (audit/progress) │
│                  │    │                  │    │                  │
│ gpt, energyGpVal │    │ items, tasks,    │    │ auditResults,    │
│ sellModifiers,   │    │ enemies, areas,  │    │ isRunning,       │
│ heroProfiles     │    │ quests, subskills│    │ lastRunTimestamp  │
└────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘
         │                       │                       │
         ▼                       ▼                       │
    ┌──────────────────────────────────┐                  │
    │ runSimulation()                  │                  │
    │  → valuePropagator              │                  │
    │  → xpPrescriber                 │                  │
    │  → evCalculator                 │                  │
    │  → mockBattle                   │                  │
    │  → connectivityAuditor          │                  │
    └──────────┬───────────────────────┘                  │
               │                                         │
               ▼                                         ▼
    ┌──────────────────────────────────────────────────────┐
    │ TopBar.handleRunSimulation()                         │
    │  writes itemUpdates → useEntityStore.updateItem()    │
    │  writes taskUpdates → useEntityStore.updateTask()    │
    │  writes enemyUpdates → useEntityStore.updateEnemy()  │
    │  writes auditResults → useSimulationStore            │
    └──────────────────────────────────────────────────────┘
```

---

## 9. What's NOT Built Yet

| Feature | CMSDD Section | Status |
|---|---|---|
| Pack Balancer | §6.5 | Not started |
| Tool Depreciation | §4.1 | Stubbed (`= 0` in evCalculator) |
| Efficiency/Buff Modifiers | §4.3 | Built (Effects System) |
| Multi-Source Diagnostics | §4.2 | Primary Source works, no abundance penalty |
| Global Constants Editor Panel | §7/Step 3.3 | No UI — values editable only via code/localStorage |
| Export Package Builder | §7.2 | Not started |
| Reachability Simulator | Step 3.2 | Not started |
| CommandPalette (Cmd+K) | §5.2 | Not started |
| Delta Visualization | §5.3 | Not started |
| Enemy Modifiers (Thorns, etc.) | §6.3 | Built (Effects System) |
