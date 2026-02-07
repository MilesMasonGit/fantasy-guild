const sharp = require('sharp');

const inputPath = 'public/assets/backgrounds/interiors/bg_cozy_kitchen_raw_base.png';
const outputPath = 'public/assets/backgrounds/interiors/bg_cozy_kitchen_kmeans_direct_64.png';
const K = 64;
const MAX_ITERATIONS = 5;

// Simple distance squared function
function distSq(c1, c2) {
    return (c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2;
}

async function process() {
    console.log(`Loading image...`);
    const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    // 1. Collect all unique colors with their counts/positions
    // For large images, we might want to sample, but for 256x256, we can process all pixels.
    const pixels = [];
    for (let i = 0; i < data.length; i += 4) {
        // Skip fully transparent pixels if needed, or treat alpha?
        // For simplicity, let's ignore alpha for clustering, pass it through later
        pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2], originalIndex: i });
    }

    // 2. Initialize Centroids (Randomly pick K pixels)
    let centroids = [];
    for (let i = 0; i < K; i++) {
        centroids.push(pixels[Math.floor(Math.random() * pixels.length)]);
    }

    // 3. K-Means Loop
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
        console.log(`Iteration ${iter + 1}/${MAX_ITERATIONS}...`);

        // Assign pixels to nearest centroid
        const assignments = new Array(pixels.length);
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

            assignments[i] = centerIdx;
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

        if (!changed) break;
    }

    // 4. Apply Final Palette
    console.log('Applying palette...');
    for (let i = 0; i < pixels.length; i++) {
        const p = pixels[i];
        let minDist = Infinity;
        let centerIdx = 0;

        // Find best match in final centroids
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
        // alpha unchanged
    }

    await sharp(data, { raw: info })
        .png({ compressionLevel: 9 })
        .toFile(outputPath);

    console.log(`Saved smart quantization to ${outputPath}`);
}

process();
