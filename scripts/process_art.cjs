const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * process_art.cjs
 * Usage: node scripts/process_art.cjs <input_path> <category> [output_name] --tile x,y --grid WxH
 * Example: node scripts/process_art.cjs raw_assets/sheet.png resources wood_round --tile 1,2 --grid 4x4
 */

const args = process.argv.slice(2);
const inputPath = args[0];
const category = args[1];
const outputNameRaw = args[2] && !args[2].startsWith('--') ? args[2] : null;
const outputName = outputNameRaw ? outputNameRaw.replace(/\.png$/i, '') : null;

// Parse optional grid/tile arguments
const tileArg = args.find(a => a.startsWith('--tile')) ? args[args.indexOf('--tile') + 1] : null;
const gridArg = args.find(a => a.startsWith('--grid')) ? args[args.indexOf('--grid') + 1] : null;
const offsetArg = args.find(a => a.startsWith('--offset')) ? args[args.indexOf('--offset') + 1] : null; // x,y
const smoothArg = args.includes('--smooth');
const pulseArg = args.includes('--pulse');
const superArg = args.includes('--super');
const nofillArg = args.includes('--nofill');
const sharpenArg = args.includes('--sharpen');
const hardenArg = args.includes('--harden');
const thresholdArg = args.find(a => a.startsWith('--threshold')) ? Number(args[args.indexOf('--threshold') + 1]) : null;
const quantizeArg = args.find(a => a.startsWith('--quantize')) ? Number(args[args.indexOf('--quantize') + 1]) : null;
const prequantArg = args.includes('--prequant');
const postfillArg = args.includes('--postfill');
const medianArg = args.find(a => a.startsWith('--median')) ? Number(args[args.indexOf('--median') + 1]) : null;
const snapArg = args.find(a => a.startsWith('--snap')) ? args[args.indexOf('--snap') + 1] : null;
const recolorArg = args.find(a => a.startsWith('--recolor')) ? args[args.indexOf('--recolor') + 1] : null;
const sizeArg = args.find(a => a.startsWith('--size')) ? Number(args[args.indexOf('--size') + 1]) : 64; // Default to 64 for legacy
const maskSwapArg = args.find(a => a.startsWith('--mask-swap')) ? args[args.indexOf('--mask-swap') + 1] : null; // sourceTag=targetTag

if (!inputPath || !category) {
    console.error('Usage: node scripts/process_art.cjs <input_path> <category> [output_name] --tile x,y --grid WxH [--smooth] [--pulse] [--super] [--offset x,y] [--nofill] [--sharpen] [--harden] [--threshold N] [--quantize N] [--postfill] [--median N] [--snap palette_name] [--recolor material_name] [--mask-swap src=target] [--size N]');
    process.exit(1);
}

// Ensure we don't double up on extensions
let cleanName = outputName || path.basename(inputPath, path.extname(inputPath));
cleanName = cleanName.replace(/\.png$/i, ''); // Strip trailing .png if present

const outputDir = path.join(__dirname, '..', 'public', 'assets', 'icons', category);
const outputPath = path.join(outputDir, `${cleanName}.png`);

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// -------------------------------------------------------------------------
// Color Math: Oklab Conversion
// -------------------------------------------------------------------------
function sRGB_to_linear(c) {
    return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
}

function rgbToOklab(r, g, b) {
    const lR = sRGB_to_linear(r / 255);
    const lG = sRGB_to_linear(g / 255);
    const lB = sRGB_to_linear(b / 255);

    const l = 0.4122214708 * lR + 0.5363325363 * lG + 0.0514459929 * lB;
    const m = 0.2119034982 * lR + 0.6806995451 * lG + 0.1073969566 * lB;
    const s = 0.0883024619 * lR + 0.2817188376 * lG + 0.6299787005 * lB;

    const l_ = Math.cbrt(Math.max(0, l));
    const m_ = Math.cbrt(Math.max(0, m));
    const s_ = Math.cbrt(Math.max(0, s));

    return {
        L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720403 * s_,
        a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757673 * s_
    };
}

// -------------------------------------------------------------------------
// Palette Locking Helper (Modular & Perceptual)
// -------------------------------------------------------------------------
let palette = [];
let materialsLibrary = null;

const libPath = path.join(__dirname, '..', 'data', 'palettes', 'materials_library.json');
if (fs.existsSync(libPath)) {
    materialsLibrary = JSON.parse(fs.readFileSync(libPath, 'utf8'));
}

if (snapArg) {
    const tags = snapArg.split(',');
    console.log(`Loading Modular Palette for tags: ${tags.join(', ')}`);

    for (const tag of tags) {
        // 1. Check if tag is a direct palette file
        const palettePath = path.join(__dirname, '..', 'data', 'palettes', `${tag}.json`);
        const altPalettePath = path.join(__dirname, '..', 'data', 'palettes', `${tag}_palette.json`);

        let colors = [];
        if (fs.existsSync(palettePath)) {
            colors = JSON.parse(fs.readFileSync(palettePath, 'utf8')).colors;
        } else if (fs.existsSync(altPalettePath)) {
            colors = JSON.parse(fs.readFileSync(altPalettePath, 'utf8')).colors;
        }

        // 2. Check if tag is a material in the library
        else if (materialsLibrary && materialsLibrary.materials[tag]) {
            colors = materialsLibrary.materials[tag];
            console.log(`  Added material ramp: ${tag}`);
        } else {
            console.warn(`  Warning: Could not find palette or material for tag: ${tag}`);
        }

        // Process hex to RGB and Oklab
        for (const hex of colors) {
            const r = parseInt(hex.substring(1, 3), 16);
            const g = parseInt(hex.substring(3, 5), 16);
            const b = parseInt(hex.substring(5, 7), 16);
            palette.push({ r, g, b, lab: rgbToOklab(r, g, b), hex, tag }); // Keep track of material origin
        }
    }
    console.log(`Final snapshot palette contains ${palette.length} unique color targets.`);
}

/**
 * Finds the nearest color in the modular palette using perceptual Oklab distance.
 * Returns the full palette entry (including its source tag).
 */
function getNearestPaletteEntry(r, g, b) {
    if (palette.length === 0) return null;

    const targetLab = rgbToOklab(r, g, b);
    let bestDist = Infinity;
    let bestEntry = palette[0];

    for (const entry of palette) {
        const dL = targetLab.L - entry.lab.L;
        const da = targetLab.a - entry.lab.a;
        const db = targetLab.b - entry.lab.b;
        const dist = dL * dL + da * da + db * db;

        if (dist < bestDist) {
            bestDist = dist;
            bestEntry = entry;
        }
    }
    return bestEntry;
}

function getNearestColor(r, g, b) {
    const entry = getNearestPaletteEntry(r, g, b);
    return entry || { r, g, b };
}

function getRecoloredPixel(r, g, b, materialName) {
    if (!materialsLibrary || !materialsLibrary.materials[materialName]) return { r, g, b };
    const ramp = materialsLibrary.materials[materialName].map(hex => {
        return {
            r: parseInt(hex.substring(1, 3), 16),
            g: parseInt(hex.substring(3, 5), 16),
            b: parseInt(hex.substring(5, 7), 16)
        };
    });

    // Calculate luminance/grayscale index (0.299R + 0.587G + 0.114B)
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Map lum (0-1) to ramp index
    if (lum > 0.98) return { r, g, b }; // Threshold for background/white
    if (lum < 0.02) return ramp[0]; // Pure black -> Deepest shadow

    const index = Math.min(ramp.length - 1, Math.floor(lum * ramp.length));
    return ramp[index];
}

/**
 * Partial Masked Recoloring:
 * Uses the loaded SNAP palette to identify if a pixel belongs to 'sourceTag'.
 * If it matches, it's swapped to 'targetTag' via luminance mapping.
 */
function getMaskedRecoloredPixel(r, g, b, sourceTag, targetTag) {
    if (!materialsLibrary || !materialsLibrary.materials[targetTag]) return { r, g, b };

    const entry = getNearestPaletteEntry(r, g, b);
    if (entry && entry.tag === sourceTag) {
        return getRecoloredPixel(r, g, b, targetTag);
    }

    return { r, g, b };
}

async function processImage() {
    console.log(`Processing: ${inputPath} -> ${outputPath}`);

    try {
        let image = sharp(inputPath);
        const metadata = await image.metadata();

        // 1. Optional Grid Cropping
        if (tileArg && gridArg) {
            const [tx, ty] = tileArg.split(',').map(Number);
            const [gw, gh] = gridArg.toLowerCase().split('x').map(Number);

            // Validate tile and grid values
            if (isNaN(tx) || isNaN(ty) || tx < 1 || ty < 1) {
                console.error('Error: --tile x,y must be positive integers.');
                process.exit(1);
            }
            if (isNaN(gw) || isNaN(gh) || gw < 1 || gh < 1) {
                console.error('Error: --grid WxH must be positive integers.');
                process.exit(1);
            }

            const tileW = Math.floor(metadata.width / gw);
            const tileH = Math.floor(metadata.height / gh);

            // CENTER-PULSE / MANUAL OFFSET
            let offsetX = 0;
            let offsetY = 0;

            if (offsetArg) {
                const parts = offsetArg.split(',').map(Number);
                offsetX = parts[0] || 0;
                offsetY = parts[1] || parts[0] || 0;
            } else if (pulseArg) {
                // Pulse Offset for 1024px canvas:
                // For 32x32 complexity (32px blocks): Offset 16px targets center of first block.
                // For 64x64 complexity (16px blocks): Offset 8px targets center of first block.
                const blockSize = 1024 / (metadata.width / (tileW || metadata.width)); // Approximate logical density
                // If the user is calling --pulse, we assume the intention is standard grid align.
                // We'll use 16px as the new standard for 32x32 drawing complexity.
                offsetX = 16;
                offsetY = 16;
            }

            // 1-indexed to 0-indexed + Offset
            const left = (tx - 1) * tileW + offsetX;
            const top = (ty - 1) * tileH + offsetY;

            // SAFETY: Subtract offset from W/H to stay within bounds
            const finalW = tileW - offsetX;
            const finalH = tileH - offsetY;

            console.log(`Cropping Tile: [${tx},${ty}] with Offset (+${offsetX},${offsetY}px). Rect: ${left},${top},${finalW},${finalH}`);
            image = image.extract({ left, top, width: finalW, height: finalH });
        }

        // 2. High-Res Masking (Flood Fill)
        if (!nofillArg) {
            const rawBuffer = await image
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });

            const { data, info } = rawBuffer;
            const { width: imgWidth, height: imgHeight } = info;

            const visited = new Uint8Array(imgWidth * imgHeight);
            const SEED_OFFSET = 2;
            const queue = [
                [SEED_OFFSET, SEED_OFFSET],
                [imgWidth - SEED_OFFSET - 1, SEED_OFFSET],
                [SEED_OFFSET, imgHeight - SEED_OFFSET - 1],
                [imgWidth - SEED_OFFSET - 1, imgHeight - SEED_OFFSET - 1]
            ];

            const isBackground = (r, g, b) => r > 240 && g > 240 && b > 240;
            let clearedCount = 0;

            while (queue.length > 0) {
                const [x, y] = queue.shift();
                const idx = (y * imgWidth + x);
                if (x < 0 || x >= imgWidth || y < 0 || y >= imgHeight || visited[idx]) continue;
                visited[idx] = 1;

                const p = idx * 4;
                if (isBackground(data[p], data[p + 1], data[p + 2])) {
                    data[p + 3] = 0;
                    clearedCount++;
                    if (x + 1 < imgWidth) queue.push([x + 1, y]);
                    if (x - 1 >= 0) queue.push([x - 1, y]);
                    if (y + 1 < imgHeight) queue.push([x, y + 1]);
                    if (y - 1 >= 0) queue.push([x, y - 1]);
                }
            }

            console.log(`Flood Fill Complete. Cleared ${clearedCount} background pixels.`);

            // 3. Final steps: Multi-Stage Resizing & Filtering
            let sharpChain = sharp(data, { raw: info });

            if (medianArg) {
                console.log(`Applying Mega-Median Filter (Size ${medianArg})...`);
                sharpChain = sharpChain.median(medianArg);
            } else if (smoothArg) {
                console.log('Applying Cartoony Sweep (Median 2)...');
                sharpChain = sharpChain.median(2);
            }

            if (sharpenArg) {
                console.log('Applying High-Res Sharpening...');
                sharpChain = sharpChain.sharpen();
            }

            if (thresholdArg !== null) {
                console.log(`Applying Luminance Threshold: ${thresholdArg}...`);
                sharpChain = sharpChain.threshold(thresholdArg);
            }

            if (hardenArg) {
                console.log('Applying Color Hardening (Aggressive Contrast)...');
                sharpChain = sharpChain.linear(2.0, -100);
            }

            if (superArg) {
                console.log('Applying Super-Sample Wash (Lanczos -> Nearest)...');
                sharpChain = sharpChain.resize(256, 256, { kernel: sharp.kernel.lanczos3, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
            }

            // ---------------------------------------------------------------------
            // THE TAIL: Uniform Output Chain (Resize -> Snap -> Output)
            // ---------------------------------------------------------------------
            const pngOptions = { compressionLevel: 9, quality: 100, palette: quantizeArg ? true : false };
            if (quantizeArg) pngOptions.colors = quantizeArg;

            console.log(`Resizing to final output: ${sizeArg}x${sizeArg}...`);
            let finalOutput = sharpChain
                .resize(sizeArg, sizeArg, { kernel: sharp.kernel.nearest, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });

            // Apply snapping and/or recoloring to the result
            if (palette.length > 0 || recolorArg) {
                console.log(`Processing pixels (Recolor: ${recolorArg || 'None'}, Snap: ${snapArg || 'None'})...`);
                const { data: finalData, info: finalInfo } = await finalOutput.raw().toBuffer({ resolveWithObject: true });
                for (let i = 0; i < finalData.length; i += finalInfo.channels) {
                    let r = finalData[i];
                    let g = finalData[i + 1];
                    let b = finalData[i + 2];

                    if (recolorArg) {
                        const recolored = getRecoloredPixel(r, g, b, recolorArg);
                        r = recolored.r;
                        g = recolored.g;
                        b = recolored.b;
                    }

                    if (palette.length > 0) {
                        const snapped = getNearestColor(r, g, b);
                        r = snapped.r;
                        g = snapped.g;
                        b = snapped.b;
                    }

                    finalData[i] = r;
                    finalData[i + 1] = g;
                    finalData[i + 2] = b;

                    // Binary Alpha (0 or 255) for crisp edges
                    if (finalInfo.channels === 4) {
                        finalData[i + 3] = finalData[i + 3] > 127 ? 255 : 0;
                    }
                }
                finalOutput = sharp(finalData, { raw: finalInfo });
            }

            await finalOutput
                .png(pngOptions)
                .toFile(outputPath);

        } else if (postfillArg) {
            console.log(`Applying Post-Fill Strategy (Downsample to ${sizeArg}px -> Flood Fill)...`);

            // 1. Downsample the white-background high-res crop to target size first
            const midBuffer = await image
                .resize(sizeArg, sizeArg, { kernel: sharp.kernel.nearest, fit: 'contain' })
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });

            const { data, info } = midBuffer;
            const { width: imgWidth, height: imgHeight } = info;

            // 2. Flood Fill at 64px
            const visited = new Uint8Array(imgWidth * imgHeight);
            const SEED_OFFSET = 1; // Small seed for small image
            const queue = [
                [0, 0],
                [imgWidth - 1, 0],
                [0, imgHeight - 1],
                [imgWidth - 1, imgHeight - 1]
            ];

            const isBackground = (r, g, b) => r > 240 && g > 240 && b > 240;
            let clearedCount = 0;

            while (queue.length > 0) {
                const [x, y] = queue.shift();
                const idx = (y * imgWidth + x);
                if (x < 0 || x >= imgWidth || y < 0 || y >= imgHeight || visited[idx]) continue;
                visited[idx] = 1;

                const p = idx * 4;
                if (isBackground(data[p], data[p + 1], data[p + 2])) {
                    data[p + 3] = 0;
                    clearedCount++;
                    if (x + 1 < imgWidth) queue.push([x + 1, y]);
                    if (x - 1 >= 0) queue.push([x - 1, y]);
                    if (y + 1 < imgHeight) queue.push([x, y + 1]);
                    if (y - 1 >= 0) queue.push([x, y - 1]);
                }
            }
            console.log(`Low-Res Flood Fill Complete. Cleared ${clearedCount} pixels.`);

            // 3. Final steps: Quantize and Write
            const pngOptions = { compressionLevel: 9, quality: 100 };
            if (quantizeArg) {
                pngOptions.palette = true;
                pngOptions.colors = quantizeArg;
            }

            await sharp(data, { raw: info })
                .png(pngOptions)
                .toFile(outputPath);

        } else {
            console.log('Skipping Flood Fill (--nofill enabled for Sweep Test)');

            let finalImage = image;
            if (sharpenArg) finalImage = finalImage.sharpen();
            if (thresholdArg !== null) finalImage = finalImage.threshold(thresholdArg);

            const pngOptions = { palette: quantizeArg ? true : false };
            if (quantizeArg) {
                pngOptions.colors = quantizeArg;
                console.log(`Enforcing Palette (Quantize to ${quantizeArg} colors) in --nofill mode...`);
            }
            console.log('PNG Options:', JSON.stringify(pngOptions));

            // For sweep testing, we just downsample directly from the extracted image
            console.log(`Resizing (no-fill) to final output: ${sizeArg}x${sizeArg}...`);
            let finalOutput = finalImage
                .resize(sizeArg, sizeArg, { kernel: sharp.kernel.nearest, fit: 'contain' });

            if (palette.length > 0 || recolorArg) {
                console.log(`Processing pixels (Recolor: ${recolorArg || 'None'}, Snap: ${snapArg || 'None'})...`);
                const { data, info } = await finalOutput.raw().toBuffer({ resolveWithObject: true });
                for (let i = 0; i < data.length; i += info.channels) {
                    let r = data[i];
                    let g = data[i + 1];
                    let b = data[i + 2];

                    if (recolorArg) {
                        const recolored = getRecoloredPixel(r, g, b, recolorArg);
                        r = recolored.r; g = recolored.g; b = recolored.b;
                    }

                    if (maskSwapArg) {
                        const [src, target] = maskSwapArg.split('=');
                        const swapped = getMaskedRecoloredPixel(r, g, b, src, target);
                        r = swapped.r; g = swapped.g; b = swapped.b;
                    }

                    if (palette.length > 0) {
                        // Ensure final pixel is perfectly snapped
                        const entry = getNearestPaletteEntry(r, g, b);
                        if (entry) {
                            r = entry.r; g = entry.g; b = entry.b;
                        }
                    }

                    data[i] = r;
                    data[i + 1] = g;
                    data[i + 2] = b;
                }
                finalOutput = sharp(data, { raw: info });
            }

            await finalOutput
                .png(pngOptions)
                .toFile(outputPath);
        }

        console.log(`Success! Asset saved to: ${outputPath}`);
    } catch (err) {
        console.error('Error processing image:', err);
    }
}

processImage();
