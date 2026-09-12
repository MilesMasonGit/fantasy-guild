import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const backupsDir = path.join(rootDir, 'cms', 'backups');

export function buildWorkspaceFromGameData() {
  const items = JSON.parse(fs.readFileSync(path.join(dataDir, 'items.json'), 'utf8'));
  const tokens = JSON.parse(fs.readFileSync(path.join(dataDir, 'tokens.json'), 'utf8'));
  const maps = JSON.parse(fs.readFileSync(path.join(dataDir, 'maps.json'), 'utf8'));
  const effects = fs.existsSync(path.join(dataDir, 'effects.json'))
    ? JSON.parse(fs.readFileSync(path.join(dataDir, 'effects.json'), 'utf8'))
    : {};
  const tokenRecipes = fs.existsSync(path.join(dataDir, 'tokenRecipes.json'))
    ? JSON.parse(fs.readFileSync(path.join(dataDir, 'tokenRecipes.json'), 'utf8'))
    : [];

  const recipePools = {};
  for (const recipe of tokenRecipes) {
    const skill = recipe.skill || 'general';
    if (!recipePools[skill]) recipePools[skill] = [];
    recipePools[skill].push(recipe);
  }

  return {
    items,
    tokens,
    maps,
    effects,
    recipePools,
  };
}

export function restoreGameDataToCmsBackups() {
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const workspace = buildWorkspaceFromGameData();
  const outputPath = path.join(backupsDir, 'Restored_From_Game_Data.json');
  fs.writeFileSync(outputPath, JSON.stringify(workspace, null, 2), 'utf8');

  console.log('✅ Successfully backported game data to CMS workspace backup:');
  console.log(`   File: ${outputPath}`);
  console.log(`   - Items:        ${Object.keys(workspace.items).length}`);
  console.log(`   - Tokens:       ${Object.keys(workspace.tokens).length}`);
  console.log(`   - Maps:         ${Object.keys(workspace.maps).length}`);
  console.log(`   - Effects:      ${Object.keys(workspace.effects).length}`);
  console.log(`   - Recipe Pools: ${Object.keys(workspace.recipePools).map(k => `${k} (${workspace.recipePools[k].length})`).join(', ')}`);
  
  return workspace;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  restoreGameDataToCmsBackups();
}
