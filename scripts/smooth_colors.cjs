const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const inputPath = args[0];
const outputPath = args[1];
const K = parseInt(args[2]) || 64;
const MAX_ITERATIONS = parseInt(args[3]) || 10;

if (!inputPath || !outputPath) {
    console.error('Usage: node scripts/smooth_colors.cjs <input_path> <output_path> [K] [max_iterations]');
    process.exit(1);
}

// Simple distance squared function
function distSq(c1, c2) {
    return (c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2;
}

async function processImage() {
    console.log(`Loading image: ${inputPath}`);
    if (!fs.existsSync(inputPath)) {
        console.error(`Error: File not found: ${inputPath}`);
        process.exit(1);
    }

    const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    console.log(`Clustering into ${K} colors (Max iterations: ${MAX_ITERATIONS})...`);

    const pixels = [];
    for (let i = 0; i < data.length; i += 4) {
        // Skip fully transparent pixels if needed?
        // Treating as opaque for now as in test_kmeans.cjs
        pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2], a: data[i+3], originalIndex: i });
    }

    // Initialize Centroids (Randomly pick K pixels)
    let centroids = [];
    // Use a subset of pixels to avoid extreme bias if the image is large
    for (let i = 0; i < K; i++) {
        centroids.push(pixels[Math.floor(Math.random() * pixels.length)]);
    }

    // K-Means Loop
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
        // Assign pixels to nearest centroid
        const sums = new Array(K).fill(0).map(() => ({ r: 0, g: 0, b: 0, count: 0 }));

        for (let i = 0; i < pixels.length; i++) {
            const p = pixels[i];
            let minDist = Infinity;
            let centerIdx = 0;

            for (let c = 0; c < K; c++) {
                const d = distSq(p, centroids[c]);
                if (d < minDist) {
                    minDist = d;
                    centerIdx = c;
                }
            }

            sums[centerIdx].r += p.r;
            sums[centerIdx].g += p.g;
            sums[centerIdx].b += p.b;
            sums[centerIdx].count++;
        }

        // Recompute centroids
        let changed = false;
        for (let c = 0; c < K; c++) {
            if (sums[c].count > 0) {
                const newR = Math.round(sums[c].r / sums[c].count);
                const newG = Math.round(sums[c].g / sums[c].count);
                const newB = Math.round(sums[c].b / sums[c].count);

                if (newR !== centroids[c].r || newG !== centroids[c].g || newB !== centroids[c].b) {
                    centroids[c] = { r: newR, g: newG, b: newB };
                    changed = true;
                }
            }
        }

        process.stdout.write(`.`);
        if (!changed) {
            console.log(`\nConverged after ${iter + 1} iterations.`);
            break;
        }
        if (iter === MAX_ITERATIONS - 1) console.log(`\nReached max iterations.`);
    }

    // Apply Final Palette
    console.log('Applying palette...');
    for (let i = 0; i < pixels.length; i++) {
        const p = pixels[i];
        let minDist = Infinity;
        let centerIdx = 0;

        for (let c = 0; c < K; c++) {
            const d = distSq(p, centroids[c]);
            if (d < minDist) {
                minDist = d;
                centerIdx = c;
            }
        }

        const best = centroids[centerIdx];
        const idx = p.originalIndex;
        data[idx] = best.r;
        data[idx + 1] = best.g;
        data[idx + 2] = best.b;
        // alpha remains unchanged
    }

    await sharp(data, { raw: info })
        .png({ compressionLevel: 9 })
        .toFile(outputPath);

    console.log(`Success! Saved smoothed image to ${outputPath}`);
}

processImage();
