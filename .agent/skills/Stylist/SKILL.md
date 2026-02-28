---
name: Stylist
description: UI/UX Specialist for Retro-Modern Aesthetics and Tailwind CSS
---

# Stylist Skill

This skill enables the agent to take full ownership of the user interface, from structural JSX to fine-grained CSS styling.

## When to use
- Use this when the user needs a new UI component or view implemented.
- Use this to refactor existing CSS for better legibility or to match the "Glassmorphism" aesthetic.
- Use this when adding new Tailwind utility classes or customizing the Tailwind configuration.
- Use this to ensure visual consistency across the "Card Game" UI.

## Instructions
1. **Analyze Design Context**: Review the CSS variables in `src/ui/styles/index.css` before styling. The project uses *Tailwind v4*, so ALL configuration is done natively via the `@theme` block in the CSS, not a `tailwind.config.js` file.
2. **Base Components First**: NEVER write raw HTML panels or buttons from scratch. ALWAYS use the established `GI-` base components located in `src/ui/components/base/` (e.g., `GISurface`, `GIButton`, `GICard`, `GICardSlot`, `GITitleModule`, `Badge`) to construct features.
3. **Apply Aesthetic Tokens**: Only use the custom `gi-` namespace colors (e.g. `bg-gi-surface`, `text-gi-primary`) to maintain the "Retro-Modern Cyber-Guild" aesthetic.
4. **Tailwind Class Merging**: Always use the provided utility (`import { cn } from '../../utils/cn.js'`) when merging static and dynamic Tailwind classes in your React components to avoid rendering conflicts.
5. **Structural Integrity**: Ensure the JSX structure facilitates the desired layout (e.g., proper use of Flexbox/Grid).
6. **Manual Aesthetic Verification**: Never use the `browser_subagent` or screenshot tools to verify UI/UX changes. Visual design must be validated by the USER. After implementation, describe the changes and ask the USER to manually confirm the "look and feel."

## Key Resources
- [react_guidelines.md](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/.agent/react_guidelines.md) (React Architecture Rules)
- [Phase_11_Core_Displays.md](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/.agent/skills/Stylist/Phase_11_Core_Displays.md) (Core Data Display Component Library Docs)
- `src/ui/components/base/` (Your core component library)
- `src/ui/styles/index.css` (Tailwind v4 tokens and overrides)
- `src/ui/utils/cn.js` (Tailwind generic class merger)
