import { CALIBRATED_FILES, fileHashes, calibrationState, calibrationFinding } from '../../../src/systems/progression/ledger/calibration.js';

/**
 * Whether the rate calculator's calibration (`bench/calibration/stamp.json`, written by
 * `npm run bench:calibrate`) still stands for the code as the CMS was built from it: the files it
 * checked are bundled as text and hashed here, then compared with the stamp's hashes.
 * ⚠️ The glob lists the files by hand (Vite reads it before the code runs); `CMSLedgerPace.test.js`
 * checks it covers `CALIBRATED_FILES` exactly.
 */
const SOURCES = import.meta.glob([
  '../../../src/systems/progression/ledger/rates.js',
  '../../../src/systems/effects/ModifierAggregator.js',
  '../../../src/systems/effects/statements.js',
  '../../../src/systems/effects/effectLibrary.js',
  '../../../src/systems/board/workTime.js',
  '../../../src/systems/board/cycleCharges.js',
  '../../../src/systems/hero/xpBonus.js',
  '../../../src/systems/hero/perkTable.js',
  '../../../src/systems/atlas/regionModifiers.js',
  '../../../src/systems/core/consumableRule.js',
  '../../../src/systems/core/wearRule.js',
  '../../../src/config/registries/tokenConstants.js',
  '../../../src/config/registries/filterRegistry.js',
  '../../../src/config/registries/reachRegistry.js',
  '../../../src/config/registries/toolKinds.js',
  '../../../src/config/registries/catchPools.js',
  '../../../src/config/guildUpgrades.js',
  '../../../src/systems/board/BoardRunner.js',
  '../../../src/systems/board/TileModifiers.js',
  '../../../src/systems/board/TimedChanges.js',
  '../../../src/systems/board/Respawn.js',
  '../../../src/systems/board/Growth.js',
  '../../../src/systems/board/Fields.js',
  '../../../src/systems/board/Fishing.js',
  '../../../src/systems/board/OutputRules.js',
  '../../../src/systems/board/PassiveProduction.js',
  '../../../src/systems/board/SpawnerSystem.js',
  '../../../src/systems/board/Camps.js',
  '../../../src/systems/board/Flags.js',
  '../../../src/systems/hero/HeroEffects.js',
  '../../../src/systems/effects/LiveEffects.js',
  '../../../src/systems/core/CatchUp.js',
  '../../../bench/calibration/setups.mjs',
  '../../../bench/calibration/engine.mjs',
], { eager: true, query: '?raw', import: 'default' });

const STAMPS = import.meta.glob('../../../bench/calibration/stamp.json', { eager: true, import: 'default' });

/** The bundled texts by project path (`src/…`, `bench/…`). */
export function bundledSources() {
  const out = {};
  for (const [file, text] of Object.entries(SOURCES)) out[file.replace(/^(\.\.\/)+/, '')] = text;
  return out;
}

let status = null;

/** The calibration's state now: `{ state: 'ok' | 'stale' | 'failed' | 'none', changed, stamp }`. */
export function calibrationStatus() {
  if (!status) status = calibrationState(Object.values(STAMPS)[0] ?? null, fileHashes(bundledSources()));
  return status;
}

/** The ledger finding for a calibration that does not stand, or none. */
export function calibrationFindings() {
  const f = calibrationFinding(calibrationStatus());
  return f ? [f] : [];
}

export { CALIBRATED_FILES };
