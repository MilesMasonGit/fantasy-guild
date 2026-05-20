import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * AI Content Generator — Gemini-powered entity generation.
 *
 * Builds a system prompt that teaches the LLM the full economic model,
 * then asks it to generate balanced entities to fill a specific gap.
 */

/**
 * Build the system prompt that teaches Gemini the economic model.
 */
function buildSystemPrompt(globals, existingItems, existingEffects) {
  const itemList = Object.values(existingItems)
    .filter((i) => i.trueCost > 0)
    .map((i) => `  - ${i.name} (${i.type}, trueCost: ${i.trueCost} GP, id: ${i.id})`)
    .join('\n');

  const effectList = Object.values(existingEffects || {})
    .map((e) => `  - ${e.name} (Type: ${e.type}, Target: ${e.targetCategory}, Mag: ${e.magnitude})`)
    .join('\n');

  const styleGuide = globals.generatorStyleGuide || '';

  return `You are a game economy balancing engine for "Fantasy Guild", an idle RPG with 99 skill levels.

## YOUR ROLE
Generate structurally sound, economically balanced game entities (Items and Tasks) as JSON.

${styleGuide}

## ECONOMIC MODEL
- **Gold Per Tick (GPT):** ${globals.gpt} GP per 10 seconds of Level 1 labor
- **Skill Multiplier:** +${(globals.skillMultiplierRate * 100).toFixed(1)}% per skill level
- **Energy Cost:** 1 Energy = ${globals.energyGpValue} GP
- **Health Cost:** 1 Health = ${globals.healthGpValue} GP
- **XP-to-Gold Ratio:** ${globals.xpToGoldRatio} (${Math.round(1 / globals.xpToGoldRatio)} XP = 1 Gold)
- **Default Target EV:** ${globals.defaultTargetEV}

## EV FORMULA
EV = Total Reward / Total Cost
- Total Cost = Material Cost + Labor Cost + Energy Cost
- Labor Cost = (baseTickTime / 10000) × GPT × (1 + skillLevel × ${globals.skillMultiplierRate})
- Material Cost = Sum of (input item trueCost × quantity)
- Energy Cost = energyCost × ${globals.energyGpValue}
- Total Reward = Sum of (output item trueCost × chance × quantity) + (xpAwarded × ${globals.xpToGoldRatio})

## SELL PRICE MODIFIERS (by item type)
${Object.entries(globals.sellModifiers).map(([type, mod]) => `- ${type}: ${mod >= 0 ? '+' : ''}${(mod * 100).toFixed(0)}%`).join('\n')}

## RULES
1. Set trueCost to the intended GP value of an item based on its level/rarity.
2. Downstream items get their trueCost calculated by the simulation (totalCost × targetEV). Set trueCost: 0 for these.
3. Every non-root output MUST have isPrimarySource: true on exactly one task or recipe.
4. Gathering Tasks have NO inputs (they are "something from nothing").
5. Recipes consume 1+ items and produce higher-value items.
6. Encounters MUST NOT have inputs, outputs. Instead, they MUST have an "assignedEnemies" array whose "spawnChance" values sum to exactly 1.0.
7. Enemies hold the actual loot in their "drops" array, not the Encounter.
8. Workstations do not have inputs/outputs. They just define a "subskillId" and "skillCap" that determines what recipes can be crafted there.
9. baseTickTime should be 5000-30000ms (5-30 seconds). Higher level = can be longer.
10. Tasks and Recipes should form chains: Gather (Task) → Process (Task) → Craft (Recipe). Each tier adds value.
11. targetEV should be ${globals.defaultTargetEV} for most tasks and recipes. Slightly higher for endgame.
12. skillRequirement (for Tasks) and levelRequirement (for Recipes) must be within the requested range.
13. You can optionally create "effects" (modifiers like THORNS_REFLECT, SPEED, DAMAGE) and assign their names to Items (assignedEffectName) or Enemies (assignedEffectNames).
14. You can generate "areas" (biomes) and assign tasks, enemies, encounters, workstations, and quests to them using "areaName".
15. Quests are Gateway/Exploration cards placed in an Area that require a specific action (e.g. collecting a locally-available Item or defeating a local Enemy) to unlock exploration map fragments for a downstream Area (mapFragmentTargetName).

## EXISTING ITEMS (reference these as inputs when appropriate)
${itemList || '  (none yet)'}

## EXISTING EFFECTS (reference these if you assign effects)
${effectList || '  (none yet)'}

## SKILLS
nature, industry, culinary, occult, crime, social, nautical, science

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
  "enemies": [
    {
      "name": "string",
      "areaName": "string_or_omit",
      "tier": 1,
      "combatType": "Melee|Ranged|Magic",
      "combatStat": 1,
      "hp": 10,
      "attackSpeed": 2000,
      "xpAwarded": 10,
      "assignedEffectNames": ["string_or_omit"],
      "drops": [{ "itemName": "string", "minQty": 1, "maxQty": 2, "chance": 1.0 }]
    }
  ],
  "recipes": [
    {
      "name": "string",
      "subskillId": "subskill_id",
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
      "subskill": "",
      "targetEV": 1.05,
      "energyCost": 1,
      "xpAwarded": 10,
      "inputs": [],
      "outputs": [{ "itemName": "string", "quantity": 1, "chance": 1.0, "isPrimarySource": true }]
    }
  ],
  "encounters": [
    {
      "name": "string",
      "areaName": "string_or_omit",
      "assignedEnemies": [{ "enemyName": "string", "spawnChance": 0.5 }]
    }
  ],
  "workstations": [
    {
      "name": "string",
      "areaName": "string_or_omit",
      "subskillId": "subskill_id",
      "skillCap": 10
    }
  ],
  "quests": [
    {
      "name": "string",
      "description": "string",
      "icon": "emoji",
      "areaName": "string_or_omit",
      "targetEvent": "ON_ITEM_GAINED|ON_ENEMY_KILLED",
      "targetIdName": "string",
      "maxProgress": 10,
      "mapFragmentTargetName": "string_or_omit",
      "fragmentIcon": "emoji_or_omit",
      "rewards": [
        { "type": "CURRENCY|ITEM", "idName": "gold|itemName", "amount": 100 }
      ]
    }
  ]
}

IMPORTANT: In inputs/outputs/drops/assignedEnemies/assignedEffectName/targetIdName/mapFragmentTargetName/idName, use names NOT IDs. The system will resolve names to IDs after import.`;
}

/**
 * Build the user prompt for a specific generation request.
 */
function buildUserPrompt(request, areas) {
  const parts = [];

  // Area context
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
    parts.push(`Primary skills: ${request.skills?.join(', ') || 'nature, industry'}`);
    parts.push(`Skill level range: ${request.levelMin || 1} to ${request.levelMax || 15}`);
    parts.push(`Generate 3-5 gathering tasks, 2-3 processing chains, and all items needed.`);
    parts.push(`Chains should be 2-3 tiers deep (gather → process → craft).`);
  } else if (request.type === 'generate_combat') {
    parts.push(`Generate combat encounters for an area.`);
    parts.push(`Enemy Tier: ${request.tier || 1}`);
    parts.push(`Generate 3-5 distinct Enemies that fit the area theme, and 1-3 Combat Cards that act as encounter decks using these enemies.`);
    parts.push(`Include any new items dropped by these enemies.`);
  } else if (request.type === 'custom') {
    parts.push(request.prompt);
  }

  if (request.additionalContext) {
    parts.push(`\nAdditional context: ${request.additionalContext}`);
  }

  parts.push(`\nRemember: Return ONLY valid JSON. No markdown fences, no explanations.`);

  return parts.join('\n');
}

/**
 * Call Gemini to generate content.
 */
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

  // Parse JSON response
  let parsed;
  try {
    // Try direct parse first
    parsed = JSON.parse(text);
  } catch {
    // Try extracting from markdown code fences
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      parsed = JSON.parse(match[1].trim());
    } else {
      throw new Error('Failed to parse AI response as JSON. Raw response: ' + text.slice(0, 500));
    }
  }

  return parsed;
}

/**
 * Resolve itemNames in the generated content to actual item IDs.
 * Creates new items for names that don't exist, links existing ones.
 */
export function resolveAndImport(generated, entityStore, areaId) {
  const storeActions = entityStore.getState();
  const addItem = storeActions.addItem;
  const addTask = storeActions.addTask;
  const addEnemy = storeActions.addEnemy;
  const addRecipe = storeActions.addRecipe;
  const addEncounter = storeActions.addEncounter || storeActions.addQuest;
  const addWorkstation = storeActions.addWorkstation;
  const addEffect = storeActions.addEffect;
  const addArea = storeActions.addArea;
  const addQuest = storeActions.addQuest;
  
  const existingItems = entityStore.getState().items;
  const existingEffects = entityStore.getState().effects;
  const existingAreas = entityStore.getState().areas;

  // Build Area name → id lookup
  const areaNameToId = {};
  for (const a of Object.values(existingAreas || {})) {
    areaNameToId[a.name.toLowerCase()] = a.id;
  }

  // Pre-pre-pass: Create generated Areas
  const newAreaIds = {};
  for (const a of (generated.areas || [])) {
    const existingId = areaNameToId[a.name.toLowerCase()];
    if (existingId) {
      newAreaIds[a.name] = existingId;
    } else {
      const id = addArea({
        name: a.name,
        icon: a.icon || '🗺️',
        totalFragments: a.totalFragments || 3,
        packBaseGoldCost: a.packBaseGoldCost || 100,
        packCostScaling: a.packCostScaling || 1.05,
      });
      newAreaIds[a.name] = id;
      areaNameToId[a.name.toLowerCase()] = id;
    }
  }

  // Build item name → id lookup
  const nameToId = {};
  for (const item of Object.values(existingItems)) {
    nameToId[item.name.toLowerCase()] = item.id;
  }
  
  const effectNameToId = {};
  for (const eff of Object.values(existingEffects || {})) {
    effectNameToId[eff.name.toLowerCase()] = eff.id;
  }

  // Pre-pass: Create generated effects
  for (const eff of (generated.effects || [])) {
    if (!effectNameToId[eff.name.toLowerCase()]) {
      const id = addEffect({
        name: eff.name,
        type: eff.type || 'STAT_BONUS',
        targetCategory: eff.targetCategory || 'ALL',
        magnitude: eff.magnitude || 1,
        drainTrigger: eff.drainTrigger || 'NONE',
        estimatedGpValue: eff.estimatedGpValue || 0,
        description: eff.description || '',
      });
      effectNameToId[eff.name.toLowerCase()] = id;
    }
  }

  // First pass: create all generated items
  const newItemIds = {};
  for (const item of (generated.items || [])) {
    const assignedEffectId = effectNameToId[item.assignedEffectName?.toLowerCase()] || '';
    // Check if item already exists by name
    const existingId = nameToId[item.name.toLowerCase()];
    if (existingId) {
      newItemIds[item.name] = existingId;
      // Update existing item if it was a ghost (no trueCost)
      const existing = existingItems[existingId];
      if (existing && !existing.trueCost && item.trueCost) {
        entityStore.getState().updateItem(existingId, {
          type: item.type || existing.type,
          trueCost: item.trueCost || existing.trueCost,
          icon: item.icon || existing.icon,
          tags: item.tags || existing.tags,
          assignedEffect: assignedEffectId || existing.assignedEffect,
        });
      }
    } else {
      const id = addItem({
        name: item.name,
        icon: item.icon || '📦',
        type: item.type || 'Material',
        description: item.description || '',
        trueCost: item.trueCost || 0,
        tags: item.tags || [],
        stackable: item.stackable ?? true,
        maxStack: item.maxStack || 99,
        assignedEffect: assignedEffectId || '',
      });
      newItemIds[item.name] = id;
      nameToId[item.name.toLowerCase()] = id;
    }
  }

  // Second pass: create all generated enemies
  const newEnemyIds = {};
  const enemyNameToId = {};
  for (const enemy of (generated.enemies || [])) {
    const resolvedDrops = (enemy.drops || []).map((drop) => ({
      itemId: nameToId[drop.itemName?.toLowerCase()] || '',
      minQty: drop.minQty || 1,
      maxQty: drop.maxQty || 1,
      chance: drop.chance ?? 1,
    })).filter((drop) => drop.itemId);
    
    const resolvedEffects = (enemy.assignedEffectNames || [])
      .map(name => effectNameToId[name?.toLowerCase()])
      .filter(id => id);

    const resolvedAreaId = areaNameToId[enemy.areaName?.toLowerCase()] || areaNameToId[enemy.biomeName?.toLowerCase()] || areaId || '';

    const id = addEnemy({
      name: enemy.name,
      biomeId: resolvedAreaId,
      tier: enemy.tier || 1,
      combatType: enemy.combatType || 'Melee',
      combatStat: enemy.combatStat || 1,
      hp: enemy.hp || 10,
      attackSpeed: enemy.attackSpeed || 2000,
      xpAwarded: enemy.xpAwarded || 0,
      drops: resolvedDrops,
      assignedEffects: resolvedEffects,
    });
    newEnemyIds[enemy.name] = id;
    enemyNameToId[enemy.name.toLowerCase()] = id;
  }

  // Third pass: Tasks, Recipes, Encounters, Workstations, Quests
  const newTaskIds = [];
  const newRecipeIds = [];
  const newEncounterIds = [];
  const newWorkstationIds = [];
  const newQuestIds = [];

  for (const task of (generated.tasks || [])) {
    const resolvedInputs = (task.inputs || []).map((inp) => ({
      itemId: nameToId[inp.itemName?.toLowerCase()] || '',
      quantity: inp.quantity || 1,
    })).filter((inp) => inp.itemId);

    const resolvedOutputs = (task.outputs || []).map((out) => ({
      itemId: nameToId[out.itemName?.toLowerCase()] || '',
      quantity: out.quantity || 1,
      chance: out.chance ?? 1,
      isPrimarySource: out.isPrimarySource || false,
    })).filter((out) => out.itemId);

    const resolvedAreaId = areaNameToId[task.areaName?.toLowerCase()] || areaNameToId[task.area?.toLowerCase()] || areaNameToId[task.biome?.toLowerCase()] || areaId || '';

    const id = addTask({
      name: task.name,
      areaId: resolvedAreaId,
      baseTickTime: task.baseTickTime || 10000,
      skillRequirement: task.skillRequirement || 1,
      skill: task.skill || 'nature',
      subskill: task.subskill || '',
      targetEV: task.targetEV || 1.05,
      energyCost: task.energyCost || 1,
      inputs: resolvedInputs,
      outputs: resolvedOutputs,
      xpAwarded: task.xpAwarded || 0,
    });
    newTaskIds.push(id);
  }

  for (const recipe of (generated.recipes || [])) {
    const resolvedInputs = (recipe.inputs || []).map((inp) => ({
      itemId: nameToId[inp.itemName?.toLowerCase()] || '',
      quantity: inp.quantity || 1,
    })).filter((inp) => inp.itemId);

    const resolvedOutputs = (recipe.outputs || []).map((out) => ({
      itemId: nameToId[out.itemName?.toLowerCase()] || '',
      quantity: out.quantity || 1,
      chance: out.chance ?? 1,
      isPrimarySource: out.isPrimarySource || false,
    })).filter((out) => out.itemId);

    const id = addRecipe({
      name: recipe.name,
      subskillId: recipe.subskillId || '',
      levelRequirement: recipe.levelRequirement || 1,
      baseTickTime: recipe.baseTickTime || 10000,
      energyCost: recipe.energyCost || 1,
      targetEV: recipe.targetEV || 1.05,
      inputs: resolvedInputs,
      outputs: resolvedOutputs,
      xpAwarded: recipe.xpAwarded || 0,
    });
    newRecipeIds.push(id);
  }

  for (const enc of (generated.encounters || [])) {
    const resolvedAssignedEnemies = (enc.assignedEnemies || []).map((e) => ({
      enemyId: enemyNameToId[e.enemyName?.toLowerCase()] || '',
      spawnChance: e.spawnChance || 1,
    })).filter((e) => e.enemyId);

    const resolvedAreaId = areaNameToId[enc.areaName?.toLowerCase()] || areaNameToId[enc.area?.toLowerCase()] || areaId || '';

    const id = addEncounter({
      name: enc.name,
      areaId: resolvedAreaId,
      assignedEnemies: resolvedAssignedEnemies,
    });
    newEncounterIds.push(id);
  }

  for (const ws of (generated.workstations || [])) {
    const resolvedAreaId = areaNameToId[ws.areaName?.toLowerCase()] || areaNameToId[ws.area?.toLowerCase()] || areaId || '';

    const id = addWorkstation({
      name: ws.name,
      areaId: resolvedAreaId,
      subskillId: ws.subskillId || '',
      skillCap: ws.skillCap || 10,
    });
    newWorkstationIds.push(id);
  }

  for (const q of (generated.quests || [])) {
    const resolvedAreaId = areaNameToId[q.areaName?.toLowerCase()] || areaNameToId[q.area?.toLowerCase()] || areaId || '';
    
    // Resolve the targetId based on targetEvent
    const targetName = q.targetIdName || q.targetId || q.target;
    let resolvedTargetId = '';
    if (q.targetEvent === 'ON_ENEMY_KILLED') {
      resolvedTargetId = enemyNameToId[targetName?.toLowerCase()] || '';
    } else {
      resolvedTargetId = nameToId[targetName?.toLowerCase()] || '';
    }
    
    // Resolve mapFragmentTarget
    const targetAreaName = q.mapFragmentTargetName || q.mapFragmentTarget || q.fragmentTarget;
    const resolvedMapFragmentTarget = areaNameToId[targetAreaName?.toLowerCase()] || '';
    
    // Resolve rewards
    let resolvedRewards = (q.rewards || []).map((r) => {
      const rewardIdName = r.idName || r.id || r.itemName;
      if (r.type === 'ITEM') {
        return {
          type: 'ITEM',
          id: nameToId[rewardIdName?.toLowerCase()] || '',
          amount: r.amount || r.quantity || 1,
        };
      } else {
        return {
          type: 'CURRENCY',
          id: 'gold',
          amount: r.amount || r.quantity || 1,
        };
      }
    }).filter(r => r.type === 'CURRENCY' || r.id);

    // Fail-safe: Proportional Gold reward calculation if rewards are empty
    if (resolvedRewards.length === 0) {
      let requirementValue = 50; // Default minimum gold reward
      if (resolvedTargetId) {
        const targetItem = Object.values(existingItems).find(i => i.id === resolvedTargetId);
        if (targetItem && targetItem.trueCost) {
          requirementValue = targetItem.trueCost * (q.maxProgress || q.quantity || 1);
        }
      }
      // Proportional and greater than requirements (1.5x multiplier)
      const calculatedGoldReward = Math.ceil(requirementValue * 1.5);
      resolvedRewards = [
        {
          type: 'CURRENCY',
          id: 'gold',
          amount: calculatedGoldReward,
        }
      ];
    }

    const id = addQuest({
      name: q.name,
      description: q.description || q.desc || '',
      areaId: resolvedAreaId,
      targetEvent: q.targetEvent || 'ON_ITEM_GAINED',
      targetId: resolvedTargetId,
      maxProgress: q.maxProgress || q.quantity || 1,
      mapFragmentTarget: resolvedMapFragmentTarget,
      fragmentIcon: q.fragmentIcon || '🗺️',
      rewards: resolvedRewards,
      icon: q.icon || '📜',
    });
    newQuestIds.push(id);
  }

  return {
    areasCreated: Object.keys(newAreaIds).length,
    itemsCreated: Object.keys(newItemIds).length,
    enemiesCreated: Object.keys(newEnemyIds).length,
    tasksCreated: newTaskIds.length,
    recipesCreated: newRecipeIds.length,
    encountersCreated: newEncounterIds.length,
    workstationsCreated: newWorkstationIds.length,
    questsCreated: newQuestIds.length,
    areaIds: newAreaIds,
    itemIds: newItemIds,
    enemyIds: newEnemyIds,
    taskIds: newTaskIds,
    questIds: newQuestIds,
  };
}
