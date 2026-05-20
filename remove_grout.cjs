const sharp = require('sharp');
const path = require('path');

async function removeWhiteGrout() {
    const input = 'public/assets/backgrounds/playmat/global/pm_board_stone_flagstone_white_grout.png';
    const output = 'public/assets/backgrounds/playmat/global/pm_board_stone_flagstone_transparent.png';
    
    const { data, info } = await sharp(input)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    // Tolerance for "white-ish" pixels
    const tolerance = 40; 
    let count = 0;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];

        // If pixel is white-ish, make it transparent
        if (r > 255 - tolerance && g > 255 - tolerance && b > 255 - tolerance) {
            data[i+3] = 0;
            count++;
        }
    }

    await sharp(data, { raw: info })
        .png()
        .toFile(output);

    console.log(`Cleared ${count} grout pixels.`);
}

removeWhiteGrout();
