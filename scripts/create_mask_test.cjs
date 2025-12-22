const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function createTestImage() {
    const width = 32;
    const height = 32;
    const channels = 4;
    const data = new Uint8Array(width * height * channels);

    // Palettes from materials_library.json
    const iron = ["#1d1d2b", "#2c3e50", "#7f8c8d", "#bdc3c7", "#ecf0f1", "#ffffff"];
    const stone = ["#323232", "#4a4a4a", "#666666", "#888888", "#aaaaaa"];

    const hexToRgb = (hex) => {
        const r = parseInt(hex.substring(1, 3), 16);
        const g = parseInt(hex.substring(3, 5), 16);
        const b = parseInt(hex.substring(5, 7), 16);
        return [r, g, b];
    };

    // Fill top half with Iron
    for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 32; x++) {
            const colorIdx = Math.floor((x / 32) * iron.length);
            const [r, g, b] = hexToRgb(iron[colorIdx]);
            const i = (y * width + x) * channels;
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = 255;
        }
    }

    // Fill bottom half with Stone
    for (let y = 16; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
            const colorIdx = Math.floor((x / 32) * stone.length);
            const [r, g, b] = hexToRgb(stone[colorIdx]);
            const i = (y * width + x) * channels;
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = 255;
        }
    }

    const testInput = path.join(__dirname, '..', 'public', 'assets', 'icons', 'resources', 'mask_test_input.png');
    await sharp(data, { raw: { width, height, channels } })
        .png()
        .toFile(testInput);

    console.log(`Test input created at: ${testInput}`);
}

createTestImage();
