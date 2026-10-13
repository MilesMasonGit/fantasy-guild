---
name: Animator
description: Lead VFX & Animation Prompt Engineer for Fantasy Guild Idle pixel art animations and sprite sheets.
---

# Animator Skill Guide

This skill guides the pixel art animation pipeline for **Fantasy Guild Idle**.

## 1. Quick Workflow Summary

1. **Sprite Input**: Locate the static enemy base sprite in `public/assets/enemies/<category>/<file>.png` (32×32 or 64×64).
2. **Decoupled Iteration**:
   - Generate and refine the **Idle cycle** (`--cycle idle`) first.
   - Present run for review in CMS (`http://localhost:5174`).
   - **MANDATORY**: Wait for explicit user confirmation in chat before proceeding.
   - Generate and refine the **Attack cycle** (`--cycle attack`).
3. **Approval & Assembly**:
   - Approve runs with `--approve <run_dir>`.
   - Assemble the 16-frame 4×4 raw spritesheet (`ani_<name>_raw.png`, 128×128 or 256×256 px) in `raw_assets/animations/enemies/<category>/<name>/`.
4. **Handoff**:
   - User performs manual cleanup in Aseprite / Pixelorama on `ani_<name>_raw.png`.
   - Cleaned sheet is deployed to `public/assets/enemies/<category>/anim/ani_<name>.png`.

## 2. Command Cheatsheet

```bash
# Generate Idle cycle
npm run animate -- --input public/assets/enemies/<cat>/e_<name>.png --cycle idle --prompt "<motion_prompt>"

# Generate with specific style override (e.g. ambient subtle motion)
npm run animate -- --input public/assets/enemies/<cat>/e_<name>.png --cycle idle --style rd_advanced_animation__subtle_motion --prompt "<motion_prompt>"

# Generate Attack cycle
npm run animate -- --input public/assets/enemies/<cat>/e_<name>.png --cycle attack --prompt "<motion_prompt>"

# Approve a run for a cycle
npm run animate -- --input public/assets/enemies/<cat>/e_<name>.png --cycle <idle|attack> --approve <path_to_run_dir>

# Assemble final 4x4 sheet once both cycles are approved
npm run animate -- --input public/assets/enemies/<cat>/e_<name>.png --assemble
```

## 3. Review in CMS
- Dev server: `http://localhost:5174` (`npm --prefix cms run dev`)
- Select candidate run from **AI Animation Runs** list or top dropdown.
- Use zoom up to **16×**, arrow keys for frame stepping, onion skinning, and floor baseline guides.

See full architectural and prompting documentation in [.agent/agents/Animator/persona.md](../../agents/Animator/persona.md).
