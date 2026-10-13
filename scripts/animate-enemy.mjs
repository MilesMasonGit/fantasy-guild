import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

// Load .env for RD_API_KEY
let apiKey = process.env.RD_API_KEY;
if (!apiKey && fs.existsSync('.env')) {
  const envText = fs.readFileSync('.env', 'utf-8');
  const m = envText.match(/^RD_API_KEY=(.*)$/m);
  if (m) apiKey = m[1].trim();
}

if (!apiKey) {
  console.error('[RD] Error: RD_API_KEY not found in process.env or .env file.');
  process.exit(1);
}

// Parse args
const args = process.argv.slice(2);
function getArg(flag, defaultVal) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return defaultVal;
}

const inputPath = getArg('--input');
const cycle = getArg('--cycle', 'idle').toLowerCase(); // 'idle' or 'attack'
const prompt = getArg('--prompt');
const seed = getArg('--seed') ? parseInt(getArg('--seed'), 10) : undefined;
const customStyle = getArg('--style');
const approveRun = getArg('--approve'); // run path or run ID to mark as approved
const doAssemble = args.includes('--assemble');

if (!inputPath && !approveRun && !doAssemble) {
  console.log(`
Usage: node scripts/animate-enemy.mjs --input <path_to_sprite> [options]

Options:
  --input <path>       Path to static base enemy sprite (e.g. public/assets/enemies/slime/e_slime_green_smol.png)
  --cycle <string>     Animation cycle to generate: 'idle' or 'attack' (default: idle)
  --prompt <string>    Prompt describing motion (required for generation)
  --seed <number>      Optional random seed
  --approve <run_dir>  Mark a run's output as the approved loop for this cycle
  --assemble           Assemble approved idle and attack cycles into the final 4x4 raw sheet
`);
  process.exit(1);
}

// Determine enemy category, name, and staging directory
function resolveEnemyPaths(baseSpritePath) {
  const fullPath = path.resolve(baseSpritePath);
  const parts = fullPath.split(path.sep);
  const enemiesIdx = parts.findIndex(p => p.toLowerCase() === 'enemies');

  let category = 'custom';
  if (enemiesIdx !== -1 && enemiesIdx + 1 < parts.length - 1) {
    category = parts[enemiesIdx + 1];
  }

  const rawFileName = path.basename(fullPath, path.extname(fullPath));
  // Standardize name: e_slime_green_smol -> slime_green_smol
  const cleanName = rawFileName.replace(/^e_/, '');

  const stagingDir = path.resolve('raw_assets', 'animations', 'enemies', category, cleanName);
  return { category, cleanName, rawFileName, fullPath, stagingDir };
}

async function assembleSheet(stagingDir, category, cleanName, cellW, cellH) {
  const idlePath = path.join(stagingDir, 'approved_idle.png');
  const attackPath = path.join(stagingDir, 'approved_attack.png');

  if (!fs.existsSync(idlePath) || !fs.existsSync(attackPath)) {
    console.warn(`[Assemble] Cannot assemble: missing approved cycles.`);
    if (!fs.existsSync(idlePath)) console.warn(`  - Missing: ${idlePath}`);
    if (!fs.existsSync(attackPath)) console.warn(`  - Missing: ${attackPath}`);
    return null;
  }

  console.log(`[Assemble] Assembling 4x4 sheet for ${cleanName} (${cellW * 4}x${cellH * 4}px)...`);

  // Both approved images are 8-frame horizontal strips (8 * cellW x cellH)
  const idleMeta = await sharp(idlePath).metadata();
  const attackMeta = await sharp(attackPath).metadata();

  const idleFrames = [];
  for (let i = 0; i < 8; i++) {
    const f = await sharp(idlePath)
      .extract({ left: i * cellW, top: 0, width: cellW, height: cellH })
      .png()
      .toBuffer();
    idleFrames.push(f);
  }

  const attackFrames = [];
  for (let i = 0; i < 8; i++) {
    const f = await sharp(attackPath)
      .extract({ left: i * cellW, top: 0, width: cellW, height: cellH })
      .png()
      .toBuffer();
    attackFrames.push(f);
  }

  // Final sheet is 4 columns x 4 rows
  // Row 0: Idle 0..3
  // Row 1: Idle 4..7
  // Row 2: Attack 0..3
  // Row 3: Attack 4..7
  const composites = [];
  // Row 0
  for (let c = 0; c < 4; c++) composites.push({ input: idleFrames[c], left: c * cellW, top: 0 });
  // Row 1
  for (let c = 0; c < 4; c++) composites.push({ input: idleFrames[c + 4], left: c * cellW, top: 1 * cellH });
  // Row 2
  for (let c = 0; c < 4; c++) composites.push({ input: attackFrames[c], left: c * cellW, top: 2 * cellH });
  // Row 3
  for (let c = 0; c < 4; c++) composites.push({ input: attackFrames[c + 4], left: c * cellW, top: 3 * cellH });

  const finalSheetPath = path.join(stagingDir, `ani_${cleanName}_raw.png`);
  const finalSheetBuf = await sharp({
    create: {
      width: cellW * 4,
      height: cellH * 4,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite(composites)
    .png()
    .toBuffer();

  fs.writeFileSync(finalSheetPath, finalSheetBuf);
  console.log(`[Assemble] Saved raw staging sheet: ${finalSheetPath}`);

  // Save directly to public/assets/enemies/<category>/ folder for convenient cleanup & game referencing
  const assetsEnemyDir = path.resolve('public', 'assets', 'enemies', category);
  if (fs.existsSync(assetsEnemyDir)) {
    const assetsSheetPath = path.join(assetsEnemyDir, `ani_${cleanName}_raw.png`);
    fs.writeFileSync(assetsSheetPath, finalSheetBuf);
    console.log(`[Assemble] Saved raw sheet in assets folder: ${assetsSheetPath}`);
  }

  return finalSheetPath;
}

async function run() {
  const { category, cleanName, rawFileName, fullPath, stagingDir } = resolveEnemyPaths(inputPath || approveRun);
  fs.mkdirSync(stagingDir, { recursive: true });

  const inputMeta = await sharp(fullPath).metadata();
  const cellW = inputMeta.width;
  const cellH = inputMeta.height;

  if (approveRun) {
    const runDir = path.isAbsolute(approveRun) ? approveRun : path.resolve(approveRun);
    const stripSource = path.join(runDir, 'strip_8f.png');
    if (!fs.existsSync(stripSource)) {
      console.error(`[Approve] Error: Could not find strip_8f.png in ${runDir}`);
      process.exit(1);
    }
    const targetFile = cycle === 'attack' ? 'approved_attack.png' : 'approved_idle.png';
    const destPath = path.join(stagingDir, targetFile);
    fs.copyFileSync(stripSource, destPath);
    console.log(`[Approve] Marked run as ${targetFile}: ${destPath}`);

    if (doAssemble || (fs.existsSync(path.join(stagingDir, 'approved_idle.png')) && fs.existsSync(path.join(stagingDir, 'approved_attack.png')))) {
      await assembleSheet(stagingDir, category, cleanName, cellW, cellH);
    }
    return;
  }

  if (doAssemble) {
    await assembleSheet(stagingDir, category, cleanName, cellW, cellH);
    return;
  }

  if (!prompt) {
    console.error('[RD] Error: --prompt is required for animation generation.');
    process.exit(1);
  }

  console.log(`[RD] Target: ${cleanName} (${category})`);
  console.log(`[RD] Base sprite: ${inputPath} (${cellW}x${cellH}px)`);
  console.log(`[RD] Cycle: ${cycle.toUpperCase()}`);
  console.log(`[RD] Prompt: "${prompt}"`);

  // Read input base sprite and encode as raw base64
  const inputBuffer = await sharp(fullPath).png().toBuffer();
  const inputBase64 = inputBuffer.toString('base64');

  // Prepare run directory
  const runId = `run_${Date.now()}_${cycle}`;
  const runDir = path.join(stagingDir, 'runs', runId);
  fs.mkdirSync(runDir, { recursive: true });

  // Save base sprite copy in runDir for easy side-by-side inspection
  const staticBaseCopy = path.join(runDir, 'static_base.png');
  fs.writeFileSync(staticBaseCopy, inputBuffer);

  const promptStyle = customStyle || (cycle === 'attack' ? 'rd_advanced_animation__attack' : 'rd_advanced_animation__idle');

  const payload = {
    input_image: inputBase64,
    prompt,
    prompt_style: promptStyle,
    width: cellW,
    height: cellH,
    num_images: 1,
    frames_duration: 8,
    return_spritesheet: true,
    remove_bg: true
  };
  if (seed !== undefined) payload.seed = seed;

  const url = 'https://api.retrodiffusion.ai/v2/inferences';
  console.log(`[RD] Submitting task to ${url} (style: ${promptStyle})...`);

  const idempotencyKey = crypto.randomUUID();
  const submitRes = await fetch(url, {
    method: 'POST',
    headers: {
      'X-RD-Token': apiKey,
      'Idempotency-Key': idempotencyKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const accepted = await submitRes.json();
  if (!accepted.task_id) {
    console.error('[RD] Error submitting task:', JSON.stringify(accepted, null, 2));
    process.exit(1);
  }

  const taskId = accepted.task_id;
  console.log(`[RD] Task accepted (${taskId}). Polling...`);

  let result = null;
  while (true) {
    await new Promise(r => setTimeout(r, 2000));
    const pollRes = await fetch(`${url}/tasks/${taskId}`, {
      headers: { 'X-RD-Token': apiKey }
    });
    const task = await pollRes.json();
    if (task.status === 'succeeded') {
      result = task.result;
      break;
    } else if (task.status === 'failed') {
      console.error('[RD] Task failed:', task.error);
      process.exit(1);
    }
  }

  console.log(`[RD] Succeeded! Cost: $${result.balance_cost} (Remaining: $${result.remaining_balance})`);

  let masterBuf = null;
  if (result.base64_images && result.base64_images.length > 0) {
    masterBuf = Buffer.from(result.base64_images[0], 'base64');
  } else if (result.output_urls && result.output_urls.length > 0) {
    const imgRes = await fetch(result.output_urls[0]);
    masterBuf = Buffer.from(await imgRes.arrayBuffer());
  } else {
    console.error('[RD] No image returned in result.');
    process.exit(1);
  }

  // Save raw API result
  const rawSheetPath = path.join(runDir, 'raw_api_sheet.png');
  fs.writeFileSync(rawSheetPath, masterBuf);

  // Extract individual frames from sheet
  const rawMeta = await sharp(masterBuf).metadata();
  console.log(`[RD] Raw result dimensions: ${rawMeta.width}x${rawMeta.height}px`);

  const cols = Math.round(rawMeta.width / cellW);
  const rows = Math.round(rawMeta.height / cellH);
  const totalFrames = cols * rows;

  const frameBuffers = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (frameBuffers.length >= 8) break;
      const buf = await sharp(masterBuf)
        .extract({ left: c * cellW, top: r * cellH, width: cellW, height: cellH })
        .png()
        .toBuffer();
      frameBuffers.push(buf);
    }
  }

  // Save 8-frame horizontal strip
  const stripComposites = frameBuffers.map((buf, i) => ({
    input: buf,
    left: i * cellW,
    top: 0
  }));
  const stripPath = path.join(runDir, 'strip_8f.png');
  await sharp({
    create: {
      width: 8 * cellW,
      height: cellH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite(stripComposites)
    .png()
    .toFile(stripPath);
  console.log(`[RD] Saved 8-frame horizontal strip: ${stripPath}`);

  // Create 8 fps animated GIF (125ms delay)
  const vertBuf = await sharp({
    create: {
      width: cellW,
      height: 8 * cellH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite(frameBuffers.map((buf, i) => ({
      input: buf,
      left: 0,
      top: i * cellH
    })))
    .png()
    .toBuffer();

  const gifPath = path.join(runDir, 'preview_8f.gif');
  await sharp(vertBuf, { animated: true, pageHeight: cellH })
    .gif({ delay: 125, loop: 0 })
    .toFile(gifPath);
  console.log(`[RD] Saved 8 fps animated GIF: ${gifPath}`);

  // Output run summary
  const summary = {
    runId,
    runDir,
    staticBaseCopy,
    stripPath,
    gifPath,
    cost: result.balance_cost,
    remainingBalance: result.remaining_balance,
    seed: result.seed || seed,
    prompt,
    cycle
  };

  fs.writeFileSync(path.join(runDir, 'meta.json'), JSON.stringify(summary, null, 2));

  console.log('\n=== RUN SUMMARY ===');
  console.log(`Run ID: ${runId}`);
  console.log(`Static Base: ${staticBaseCopy}`);
  console.log(`Animated GIF (8fps): ${gifPath}`);
  console.log(`Horizontal Strip: ${stripPath}`);
  console.log(`Cost: $${result.balance_cost}`);
  console.log(`Seed: ${result.seed || seed}`);
  console.log('===================\n');
}

run().catch(err => {
  console.error('[RD] Fatal error:', err);
  process.exit(1);
});
