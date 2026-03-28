const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function createTestImage() {
    const width = 1024;
    const height = 1024;
    const channels = 4;
    const data = new Uint8Array(width * height * channels);

    // Palettes from materials_library.json
    const iron = ["#1d1d2b", "#2c3e50", "#7f8c8d", "#bdc3c7", "#ecf0f1", "#ffffff"];
    
    const hexToRgb = (hex) => {
        const r = parseInt(hex.substring(1, 3), 16);
        const g = parseInt(hex.substring(3, 5), 16);
        const b = parseInt(hex.substring(5, 7), 16);
        return [r, g, b];
    };

    const blockSize = 32;

    for (let by = 0; by < 32; by++) {
        for (let bx = 0; bx < 32; bx++) {
            const colorIdx = (bx + by) % iron.length;
            const [r, g, b] = hexToRgb(iron[colorIdx]);
            
            for (let y = 0; y < blockSize; y++) {
                for (let x = 0; x < blockSize; x++) {
                    const py = by * blockSize + y;
                    const px = bx * blockSize + x;
                    const i = (py * width + px) * channels;
                    
                    data[i] = r;
                    data[i+1] = g;
                    data[i+2] = b;
                    data[i+3] = 255;

                    // Add some "dirty" background noise at the very edges of the canvas
                    if (py < 4 || py > 1020 || px < 4 || px > 1020) {
                        if ((py + px) % 2 === 0) {
                            data[i] = 245; data[i+1] = 245; data[i+2] = 245; // "Dirty" white
                        }
                    }
                }
            }
        }
    }

    const testInput = path.join(__dirname, '..', 'public', 'assets', 'anchors', 'mask_test_input.png');
    await sharp(data, { raw: { width, height, channels } })
        .png()
        .toFile(testInput);

    console.log(`Test input created at: ${testInput}`);
}

createTestImage();
