const sharp = require('sharp');
const fs = require('fs');

async function countColors(path) {
    if (!fs.existsSync(path)) {
        console.log(`File not found: ${path}`);
        return;
    }
    const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const colors = new Set();
    for (let i = 0; i < data.length; i += 4) {
        // r,g,b,a
        const key = `${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`;
        colors.add(key);
    }
    console.log(`${path}: ${colors.size} unique colors`);
}

async function run() {
    await countColors('public/assets/backgrounds/interiors/bg_cozy_kitchen_kmeans_direct_64.png');
}

run();
