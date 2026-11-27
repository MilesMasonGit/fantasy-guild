import { GoogleGenerativeAI } from '@google/generative-ai';
import { SKILLS } from '../utils/constants.js';

/**
 * AI Content Generator — Gemini-powered entity generation.
 *
 * Builds a system prompt that teaches the LLM the full economic model,
 * then asks it to generate balanced entities to fill a specific gap.
 */

/** The skill the generator falls back to when neither the designer nor the model names one. */
export const DEFAULT_GENERATOR_SKILL = SKILLS[0].id;

/** The prompt's skill vocabulary, read from the game so it can never name a skill the game has dropped. */
export function generatorSkillList() {
  return SKILLS.map((s) => s.id).join(', ');
}

export function buildSystemPrompt(globals, existingItems, existingEffects) {
  const itemList = Object.values(existingItems)
    .filter((i) => i.trueCost > 0)
    .map((i) => `  - ${i.name} (${i.type}, trueCost: ${i.trueCost} GP, id: ${i.id})`)
    .join('\n');

  const effectList = Object.values(existingEffects || {})
    .map((e) => `  - ${e.name} (Type: ${e.type}, Target: ${e.targetCategory}, Mag: ${e.magnitude})`)
    .join('\n');

  const styleGuide = globals.generatorStyleGuide || '';

  const isExponential = globals.laborScalingType === 'exponential';
  const laborFormula = isExponential
    ? `(baseTickTime / 10000) × GPT × (1 + ${globals.skillMultiplierRate})^skillLevel`
    : `(baseTickTime / 10000) × GPT × (1 + skillLevel × ${globals.skillMultiplierRate})`;
  const laborDesc = isExponential
    ? `compounding exponentially at +${(globals.skillMultiplierRate * 100).toFixed(1)}% per skill level`
    : `scaling linearly at +${(globals.skillMultiplierRate * 100).toFixed(1)}% per skill level`;

  return `You are a game economy balancing engine for "Tabletop Guild", an idle RPG with 99 skill levels.

## YOUR ROLE
Generate structurally sound, economically balanced game entities (Items and Tasks) as JSON.

${styleGuide}

## ECONOMIC MODEL
- **Gold Per Tick (GPT):** ${globals.gpt} GP per 10 seconds of Level 1 labor
- **Labor Scaling:** ${laborDesc} (Formula: ${laborFormula})
- **Energy Cost:** 1 Energy = ${globals.energyGpValue} GP
- **Health Cost:** 1 Health = ${globals.healthGpValue} GP
- **XP-to-Gold Ratio:** ${globals.xpToGoldRatio} (${Math.round(1 / globals.xpToGoldRatio)} XP = 1 Gold)
- **Loot / Liquidity Target EV:** ${globals.defaultTargetEV || 1.05} (GP/item yields)
- **XP / Progression Target EV:** ${globals.defaultTargetProgressionEV || 0.50} (XP yields)

## EV FORMULA & BALANCING
The engine balances Loot and Progression independently to prevent zero-sum trade-offs:
- Loot EV = Loot Output Reward / Total Cost  (Targets ~${globals.defaultTargetEV || 1.05})
- XP EV = XP Reward / Total Cost  (Targets ~${globals.defaultTargetProgressionEV || 0.50})
- Total Cost = Material Cost + Labor Cost + Energy Cost + Tool Depreciation
- Labor Cost = ${laborFormula}
- Material Cost = Sum of (input item trueCost × quantity)
- Energy Cost = energyCost × ${globals.energyGpValue}
- Tool Depreciation = (tool.trueCost / tool.durability) * task.durabilityCost (if tool required)

## SELL PRICE MODIFIERS (by item type)
${Object.entries(globals.sellModifiers).map(([type, mod]) => `- ${type}: ${mod >= 0 ? '+' : ''}${(mod * 100).toFixed(0)}%`).join('\n')}

## RULES
1. Set trueCost to the intended GP value of an item based on its level/rarity.
2. Downstream crafted/refined items get their trueCost calculated by the simulation (totalCost × targetEV). Set trueCost: 0 for these.
3. Weapons and Armor will dynamically receive Combat/Defence Level Gating requirements calculated from their trueCost during propagation. Do NOT add levelRequirement to Weapon/Armor items, as they are derived automatically.
4. Food, Drink, and other specialized consumables must NEVER have skill or level requirements, allowing low-level heroes to consume them.
5. Every non-root output MUST have isPrimarySource: true on exactly one task or recipe.
6. Gathering Tasks have NO inputs (they are "something from nothing").
7. Recipes consume 1+ items and produce higher-value items.
8. Specify \`levelRequirement\` on Recipes and \`skillRequirement\` on Tasks.
9. Gathering and production tasks can specify an \`acceptedToolType\` (e.g. 'Pickaxe', 'Axe', 'Sickle') and a \`minToolTier\`. Running the task consumes durability of that tool, which adds a tool depreciation tax to the task cost.
10. Stations do not have inputs/outputs. They just define a "skill" and "skillCap" that determines what recipes can be crafted there.
11. baseTickTime should be 5000-30000ms (5-30 seconds). Higher level = can be longer.
12. Tasks and Recipes should form chains: Gather (Task) → Process (Task) → Craft (Recipe). Each tier adds value.
13. You can optionally create "effects" (modifiers like THORNS_REFLECT, SPEED, DAMAGE) and assign their names to Items (assignedEffectName).
14. You can generate "areas" (biomes) and assign tasks and stations to them using "areaName".
15. Do not generate enemies or encounters: enemies are Tokens, authored in the Token editor.

## EXISTING ITEMS (reference these as inputs when appropriate)
${itemList || '  (none yet)'}

## EXISTING EFFECTS (reference these if you assign effects)
${effectList || '  (none yet)'}

## SKILLS
${generatorSkillList()}

## OUTPUT FORMAT
Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "areas": [
    {
      "name": "string",
      "icon": "emoji_or_omit",
      "totalFragments": 3,
      "packBaseGoldCost": 100,
      "packCostScaling": 1.05
    }
  ],
  "items": [
    {
      "name": "string",
      "icon": "emoji",
      "type": "Material|Ingredient|Tool|Weapon|Food|Drink|Consumable|Treasure",
      "description": "string",
      "trueCost": number_or_0,
      "tags": [],
      "stackable": true,
      "maxStack": 99,
      "assignedEffectName": "string_or_omit"
    }
  ],
  "effects": [
    {
      "name": "string",
      "type": "SPEED|DAMAGE|DEFENSE|XP_BONUS|LOOT_MULT|FAIL_CHANCE|HP_REGEN|THORNS_REFLECT|STAT_BONUS",
      "targetCategory": "ALL|COMBAT|MELEE|MINING|INDUSTRY|NATURE|CRAFTING",
      "magnitude": 1,
      "drainTrigger": "NONE|ON_HIT_TAKEN|ON_DAMAGE_DEALT|ON_TICK_COMPLETE|ON_KILL",
      "estimatedGpValue": 50,
      "description": "string"
    }
  ],
  "recipes": [
    {
      "name": "string",
      "skill": "skill_id",
      "levelRequirement": 1,
      "baseTickTime": 10000,
      "energyCost": 1,
      "targetEV": 1.05,
      "xpAwarded": 10,
      "inputs": [{ "itemName": "string", "quantity": 1 }],
      "outputs": [{ "itemName": "string", "quantity": 1, "chance": 1.0, "isPrimarySource": true }]
    }
  ],
  "tasks": [
    {
      "name": "string",
      "areaName": "string_or_omit",
      "baseTickTime": 10000,
      "skillRequirement": 1,
      "skill": "skill_id",
      "targetEV": 1.05,
      "energyCost": 1,
      "xpAwarded": 10,
      "inputs": [],
      "outputs": [{ "itemName": "string", "quantity": 1, "chance": 1.0, "isPrimarySource": true }]
    }
  ],
  "stations": [
    {
      "name": "string",
      "areaName": "string_or_omit",
      "skill": "skill_id",
      "skillCap": 10
    }
  ]
}

IMPORTANT: In inputs/outputs/assignedEffectName/targetIdName/mapFragmentTargetName/idName, use names NOT IDs. The system will resolve names to IDs after import.`;
}

export function buildUserPrompt(request, areas) {
  const parts = [];

  if (request.areaId && areas) {
    const area = Object.values(areas).find((a) => a.id === request.areaId);
    if (area) {
      parts.push(`Target Area: "${area.name}" (id: ${area.id})`);
      parts.push(`All generated tasks belong to this area.`);
    }
  }

  if (request.type === 'fill_skill_gap') {
    parts.push(`Generate content to fill a skill progression gap.`);
    parts.push(`Skill: ${request.skill}`);
    parts.push(`Level range to fill: ${request.levelMin} to ${request.levelMax}`);
    parts.push(`Generate 2-3 gathering tasks and 1-2 processing chains for this range.`);
    parts.push(`Include all raw materials and processed items needed.`);
  } else if (request.type === 'generate_area') {
    parts.push(`Generate a complete area's content.`);
    parts.push(`Primary skills: ${request.skills?.join(', ') || DEFAULT_GENERATOR_SKILL}`);
    parts.push(`Skill level range: ${request.levelMin || 1} to ${request.levelMax || 15}`);
    parts.push(`Generate 3-5 gathering tasks, 2-3 processing chains, and all items needed.`);
    parts.push(`Chains should be 2-3 tiers deep (gather → process → craft).`);
  } else if (request.type === 'generate_single') {
    parts.push(`Generate details for EXACTLY ONE entity of type "${request.entityType}".`);
    parts.push(`Entity Name: "${request.name}"`);
    if (request.skill) parts.push(`Associated Skill: ${request.skill}`);
    if (request.levelRequirement) parts.push(`Level/Skill Requirement: ${request.levelRequirement}`);
    if (request.prompt) parts.push(`User request / Theme / Details: ${request.prompt}`);
    parts.push(`Please fill out all basic configurations: skill, level requirement, energy cost, inputs, and outputs.`);
    parts.push(`IMPORTANT: Check the list of EXISTING ITEMS. Do NOT generate new items if you can reuse existing items for inputs/outputs. Only generate new items if absolutely necessary for the theme of this single entity.`);
  } else if (request.type === 'custom') {
    parts.push(request.prompt);
  }

  if (request.additionalContext) {
    parts.push(`\nAdditional context: ${request.additionalContext}`);
  }

  parts.push(`\nRemember: Return ONLY valid JSON. No markdown fences, no explanations.`);

  return parts.join('\n');
}

export async function generateContent(apiKey, globals, existingItems, request, areas, existingEffects) {
  if (!apiKey) {
    throw new Error('Gemini API key not configured. Add it in the Settings panel.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.7,
    },
  });

  const systemPrompt = buildSystemPrompt(globals, existingItems, existingEffects);
  const userPrompt = buildUserPrompt(request, areas);

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
  });

  const text = result.response.text();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      parsed = JSON.parse(match[1].trim());
    } else {
      throw new Error('Failed to parse AI response as JSON. Raw response: ' + text.slice(0, 500));
    }
  }

  return parsed;
}
