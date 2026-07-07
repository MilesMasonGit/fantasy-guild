---
name: Handler
description: Meta-Agent for creating and managing other Project Agents
---

# Handler Skill

This skill allows the agent to act as a manager for other AI entities within the workspace. It specializes in the "Agentic Lifecycle."

## When to use
- Use this when the user needs a new specialized role (e.g., "I need an agent for testing").
- Use this when an existing agent's instructions are out of date or confusing.
- Use this to organize the `.agent/` directory according to Antigravity standards.

## Instructions
1. **Analyze Requirements**: Deeply understand the specific niche the new agent needs to fill.
2. **Setup Structure**: Create the necessary subdirectories under `.agent/agents/` and `.agent/skills/`.
3. **Define Persona**: Write a `persona.md` that captures the "Who" and "How" of the agent.
4. **Define Skill**: Write a `SKILL.md` that captures the "What" and "When," including YAML frontmatter.
5. **Contextualize**: Link relevant project documents (GDD, schemas) so the new agent is grounded.
