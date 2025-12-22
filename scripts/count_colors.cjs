const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function countColors(filePath) {
    const palettePath = path.join(__dirname, '..', 'data', 'palettes', 'aap-splendor128.json');
    let paletteSet = new Set();
    if (fs.existsSync(palettePath)) {
        const pData = JSON.parse(fs.readFileSync(palettePath, 'utf8'));
        paletteSet = new Set(pData.colors.map(c => c.toLowerCase().replace('#', '')));
        console.log(`Loaded palette with ${paletteSet.size} colors.`);
    } else {
        console.log(`Warning: Palette file not found at ${palettePath}`);
    }

    const { data, info } = await sharp(filePath)
        .raw()
        .toBuffer({ resolveWithObject: true });

    const uniqueRGB = new Set();
    let semiTransparentCount = 0;
    let nonPalettePixels = 0;
    const nonPaletteColors = new Set();

    for (let i = 0; i < data.length; i += info.channels) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = info.channels === 4 ? data[i + 3] : 255;

        if (a > 0) {
            const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
            uniqueRGB.add(hex);

            if (paletteSet.size > 0 && !paletteSet.has(hex)) {
                nonPalettePixels++;
                nonPaletteColors.add(hex);
            }
        }

        if (a > 0 && a < 255) {
            semiTransparentCount++;
        }
    }

    console.log(`File: ${filePath}`);
    console.log(`Unique RGB Colors: ${uniqueRGB.size}`);
    if (uniqueRGB.size < 20) {
        console.log(`Colors: ${Array.from(uniqueRGB).join(', ')}`);
    }
    console.log(`Semi-Transparent Pixels (0 < Alpha < 255): ${semiTransparentCount}`);
    console.log(`Pixels NOT in Palette: ${nonPalettePixels}`);
    console.log(`Unique Colors NOT in Palette: ${nonPaletteColors.size}`);
    if (nonPaletteColors.size > 0) {
        console.log(`Sample Non-Palette Colors: ${Array.from(nonPaletteColors).slice(0, 5).join(', ')}`);
    }
}

const file = process.argv[2];
if (file) {
    countColors(file).catch(err => console.error(err));
}
