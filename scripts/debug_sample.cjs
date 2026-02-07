const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function debugSample() {
    const inputPath = process.argv[2];
    const outputDir = process.argv[3];
    const baseName = process.argv[4];

    if (!inputPath || !outputDir || !baseName) {
        console.error("Usage: node debug_sample.cjs [input] [outputDir] [baseName]");
        return;
    }

    console.log(`Processing ${inputPath}...`);
    const image = sharp(inputPath);
    const { width, height, channels } = await image.metadata();

    const { data } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    // Target size 256
    const targetSize = 256;
    const blockSize = 4;

    // We will generate 4 variants: Offset 0, 1, 2, 3
    const offsets = [0, 1, 2, 3];

    for (const offset of offsets) {
        const outData = new Uint8Array(targetSize * targetSize * 4);

        for (let y = 0; y < targetSize; y++) {
            for (let x = 0; x < targetSize; x++) {
                // Calculate source coordinates
                // We want: (x * 4) + offset
                let srcX = (x * blockSize) + offset;
                let srcY = (y * blockSize) + offset;

                // Clamp
                if (srcX >= width) srcX = width - 1;
                if (srcY >= height) srcY = height - 1;

                const srcIdx = (srcY * width + srcX) * 4;
                const dstIdx = (y * targetSize + x) * 4;

                outData[dstIdx] = data[srcIdx];         // R
                outData[dstIdx + 1] = data[srcIdx + 1]; // G
                outData[dstIdx + 2] = data[srcIdx + 2]; // B
                outData[dstIdx + 3] = data[srcIdx + 3]; // A
            }
        }

        const outPath = path.join(outputDir, `${baseName}_offset_${offset}.png`);
        await sharp(outData, {
            raw: { width: targetSize, height: targetSize, channels: 4 }
        })
            .png()
            .toFile(outPath);

        console.log(`Saved ${outPath}`);
    }
}

debugSample();
