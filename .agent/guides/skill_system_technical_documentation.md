# Technical Documentation: Skill System

This document provides a technical overview of the Skill System in Fantasy Guild Idle, intended for future agents modifying or extending the system.

## Core Concepts

### 1. Parent vs. Sub-Skills
- **Parent Skills**: The 11 core skills defined in [skillRegistry.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/config/registries/skillRegistry.js) (e.g., `industry`, `nature`, `melee`).
- **Sub-Skills**: Specific task tags (e.g., `mining`, `logging`) that funnel XP into a parent skill.
- **Mapping**: `SUB_SKILL_TO_PARENT` in [skillRegistry.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/config/registries/skillRegistry.js) defines this relationship. Every sub-skill must map to exactly one parent.
- **Logic**: When XP is added to a sub-skill (e.g., `mining`), `SkillSystem.addXP` resolves it to the parent (`industry`) and updates the parent's XP/level.

### 2. Hero Specialization (The "Rule of 9")
- Each hero has **9 active skills**:
    - **1 Combat Specialization**: Determined by their class (e.g., a Wizard has `magic`, but not `melee` or `ranged`).
    - **8 Non-Combat Parent Skills**: Common to all heroes (Industry, Nature, Nautical, Culinary, Social, Crime, Occult, Science).
- **Hero Level**: Calculated as [sum(9 skill levels) / 9](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/equipment/ConsumableSystem.js#101-135).

## Key Files & Responsibilities

### [SkillSystem.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/hero/SkillSystem.js)
The primary controller for skill mutations.
- [addXP(heroId, skillId, amount)](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/hero/SkillSystem.js#97-159): The main entry point. Resolves sub-skills to parents and updates state.
- [getEffectiveLevel(heroId, skillId)](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/hero/SkillSystem.js#81-96): (WIP) Intended to return base level + modifiers from [ModifierAggregator](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/effects/ModifierAggregator.js#7-178).

### [skillRegistry.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/config/registries/skillRegistry.js)
The static data source for all skills.
- `SKILLS`: Metadata (names, icons, categories).
- `SUB_SKILL_TO_PARENT`: The funneling map.

### [XPCurve.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/utils/XPCurve.js)
Mathematical utilities for progression.
- [xpForLevel(level)](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/utils/XPCurve.js#10-25): Uses a polynomial curve.
- [getXpProgress(xp)](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/utils/XPCurve.js#42-69): Returns `{ level, currentXp, nextLevelXp, progress }`.
- **Note**: [progress](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/state/GameState.js#183-185) is a normalized float (0.0 to 1.0).

## Event Flow & UI Integration

### Events
- `hero_leveled`: Published when a skill level increases. Used by the `NotificationSystem`.
- `heroes_updated`: Published on **every XP gain**. This is the primary trigger for UI re-renders.

### UI Implementation: [HeroIdentityStrip.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/HeroIdentityStrip.jsx)
- **State Subscription**: Uses [useGameState](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/hooks/useGameState.js#5-112) to listen for `heroes_updated`.
- **Display**: Renders a vertical list of the 9 skills. Output logic: `Math.floor(progress * 100) + '%'`.
- **Performance**: The component is wrapped in `React.memo` and the state subscription uses a memoized events list to prevent redundant renders.

## Common Modification Tasks

| Goal | Required Change |
| :--- | :--- |
| **Add a new Sub-skill** | Add entry to `SUB_SKILL_TO_PARENT` in [skillRegistry.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/config/registries/skillRegistry.js). |
| **Add a new Parent skill** | Update `SKILLS` and increment `HERO_TOTAL_SKILLS` (if non-combat). |
| **Change Leveling Speed** | Modify [xpForLevel](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/utils/XPCurve.js#10-25) formula in [XPCurve.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/utils/XPCurve.js). |
| **Modify UI Layout** | Update the skill mapping block in [HeroIdentityStrip.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/HeroIdentityStrip.jsx). |

## Known Gotchas
- **Casing**: Aura/Modifier targets should generally be lowercase (e.g., `'industry'`) to match [ModifierAggregator](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/effects/ModifierAggregator.js#7-178) expected keys.
- **Legacy Formats**: Some older save data might store skills as a number ([level](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/utils/XPCurve.js#26-41)) instead of an object (`{ level, xp }`). Defensive checks are implemented in [HeroIdentityStrip.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/HeroIdentityStrip.jsx).
- **Max Level**: Progress returns `1.0` if `level >= 99` to prevent divide-by-zero errors.
