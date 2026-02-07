const sharp = require('sharp');
const path = require('path');

const inputPath = 'public/assets/backgrounds/interiors/bg_tavern_q256.png'; // Use q256 as base since it's cleaner than raw
const outputPath = 'public/assets/backgrounds/interiors/bg_tavern_uniform_1000.png';

async function process() {
    const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    // 10 levels per channel = 1000 colors total (10x10x10)
    const levels = 10;
    const step = 255 / (levels - 1);

    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.round(data[i] / step) * step;     // R
        data[i + 1] = Math.round(data[i + 1] / step) * step; // G
        data[i + 2] = Math.round(data[i + 2] / step) * step; // B
        // Alpha unchanged
    }

    await sharp(data, { raw: info })
        .png({ compressionLevel: 9 })
        .toFile(outputPath);

    console.log(`Saved uniform snap to ${outputPath}`);
}

process();
