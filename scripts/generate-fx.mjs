/**
 * ⚠️ REWORK FLAGGED: Hero & Enemy Sprite Animation Pipeline
 * 
 * Lessons Learned (2026-10-10):
 * Pure text-to-VFX without a base input image is not suitable for micro-pixel overlays.
 * This pipeline is slated for rework into an Image-to-Animation tool for Heroes & Enemies.
 * 
 * Planned Architecture:
 * - Input: Existing static sprite base image (e.g. hero/enemy token in neutral pose).
 * - Models: Retro Diffusion Advanced Animation models (`rd_advanced_animation__walking`,
 *           `rd_advanced_animation__idle`, `rd_advanced_animation__attack`,
 *           `rd_advanced_animation__jump`, `rd_advanced_animation__rotate`).
 * - Parameters: `input_image` (base64 PNG), `frames_duration: 8`, `return_spritesheet: true`.
 * - Output: 8-frame horizontal sprite sheet strip and animated preview GIF.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

// Load .env
let apiKey = process.env.RD_API_KEY;
if (!apiKey && fs.existsSync('.env')) {
  const envText = fs.readFileSync('.env', 'utf-8');
  const m = envText.match(/^RD_API_KEY=(.*)$/m);
  if (m) apiKey = m[1].trim();
}

if (!apiKey) {
  console.error("Error: RD_API_KEY not found in process.env or .env file.");
  process.exit(1);
}

// Parse args
const args = process.argv.slice(2);
function getArg(flag, defaultVal) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return defaultVal;
}

const prompt = getArg('--prompt');
const name = getArg('--name', 'effect_' + Date.now());
const targetFrames = parseInt(getArg('--frames', '8'), 10);
const seed = getArg('--seed') ? parseInt(getArg('--seed'), 10) : undefined;
const outDir = getArg('--out', 'raw_assets/vfx');

if (!prompt) {
  console.log(`
Usage: node scripts/generate-fx.mjs --prompt "<prompt>" [options]

Options:
  --prompt <string>    The prompt to generate (required)
  --name <string>      Base name for output files (default: effect_<timestamp>)
  --frames <number>    Number of frames for the final strip (default: 6)
  --seed <number>      Optional random seed
  --out <dir>          Output directory (default: raw_assets/vfx)
`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

async function generate() {
  const url = 'https://api.retrodiffusion.ai/v2/inferences';
  const idempotencyKey = crypto.randomUUID();

  console.log(`[RD] Generating effect: "${name}"`);
  console.log(`[RD] Prompt: ${prompt}`);
  if (seed !== undefined) console.log(`[RD] Seed: ${seed}`);

  const bypassExpansion = args.includes('--bypass');
  if (bypassExpansion) console.log(`[RD] Bypassing automatic prompt expansion`);

  const payload = {
    prompt,
    prompt_style: 'rd_animation__vfx',
    width: 64,
    height: 64,
    num_images: 1,
    remove_bg: true,
    return_spritesheet: true,
  };
  if (seed !== undefined) payload.seed = seed;
  if (bypassExpansion) payload.bypass_prompt_expansion = true;

  let result = null;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const idempotencyKey = crypto.randomUUID();
    console.log(`[RD] Submitting task (attempt ${attempt}/${maxAttempts})...`);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-RD-Token': apiKey,
        'Idempotency-Key': idempotencyKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const accepted = await res.json();
    if (!accepted.task_id) {
      console.error("[RD] Error submitting task:", accepted);
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      process.exit(1);
    }

    const taskId = accepted.task_id;
    console.log(`[RD] Task accepted (${taskId}). Polling...`);

    let failed = false;
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
        console.warn(`[RD] Task attempt ${attempt} failed:`, task.error);
        failed = true;
        break;
      }
    }

    if (!failed && result) {
      break;
    }

    if (attempt < maxAttempts) {
      console.log(`[RD] Retrying in 4 seconds...`);
      await new Promise(r => setTimeout(r, 4000));
    } else {
      console.error("[RD] All attempts failed.");
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
    console.error("[RD] No image returned in result.");
    process.exit(1);
  }

  // Save the master 4x4 grid (256x256)
  const masterPath = path.join(outDir, `${name}_master_4x4.png`);
  fs.writeFileSync(masterPath, masterBuf);
  console.log(`[RD] Saved master 4x4 sheet: ${masterPath}`);

  // Slice the 16 frames (4x4, 64x64 each)
  const meta = await sharp(masterBuf).metadata();
  const cellW = 64;
  const cellH = 64;
  const cols = meta.width / cellW;
  const rows = meta.height / cellH;
  const totalFrames = cols * rows;

  const frameBuffers = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const buf = await sharp(masterBuf)
        .extract({ left: c * cellW, top: r * cellH, width: cellW, height: cellH })
        .png()
        .toBuffer();
      frameBuffers.push(buf);
    }
  }

  // 1. Create a 16-frame horizontal strip (1024x64)
  const strip16Composites = frameBuffers.map((buf, i) => ({
    input: buf,
    left: i * cellW,
    top: 0
  }));
  const strip16Path = path.join(outDir, `${name}_strip_16f.png`);
  await sharp({
    create: {
      width: totalFrames * cellW,
      height: cellH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite(strip16Composites)
    .png()
    .toFile(strip16Path);
  console.log(`[RD] Saved 16-frame horizontal strip: ${strip16Path}`);

  // 2. Sample or trim to targetFrames (default 8)
  const sampledIndices = [];
  if (totalFrames === 16 && targetFrames === 8) {
    for (let i = 0; i < 8; i++) sampledIndices.push(i * 2);
  } else {
    for (let i = 0; i < targetFrames; i++) {
      const idx = Math.min(totalFrames - 1, Math.round((i / (targetFrames - 1)) * (totalFrames - 1)));
      sampledIndices.push(idx);
    }
  }
  console.log(`[RD] Sampling frames for ${targetFrames}-frame strip: [${sampledIndices.join(', ')}]`);

  const stripTargetComposites = sampledIndices.map((frameIdx, outIdx) => ({
    input: frameBuffers[frameIdx],
    left: outIdx * cellW,
    top: 0
  }));

  const stripTargetPath = path.join(outDir, `${name}_strip_${targetFrames}f.png`);
  await sharp({
    create: {
      width: targetFrames * cellW,
      height: cellH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite(stripTargetComposites)
    .png()
    .toFile(stripTargetPath);
  console.log(`[RD] Saved ${targetFrames}-frame horizontal strip: ${stripTargetPath}`);

  // 3. Create animated GIF at 8 fps (125ms per frame)
  try {
    const vertBuf = await sharp({
      create: {
        width: cellW,
        height: targetFrames * cellH,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite(sampledIndices.map((frameIdx, outIdx) => ({
        input: frameBuffers[frameIdx],
        left: 0,
        top: outIdx * cellH
      })))
      .png()
      .toBuffer();

    const gifPath = path.join(outDir, `${name}_${targetFrames}f.gif`);
    await sharp(vertBuf, { animated: true, pageHeight: cellH })
      .gif({ delay: 125, loop: 0 })
      .toFile(gifPath);
    console.log(`[RD] Saved animated GIF (8 fps): ${gifPath}`);
  } catch (err) {
    console.warn(`[RD] Could not create GIF: ${err.message}`);
  }
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});
