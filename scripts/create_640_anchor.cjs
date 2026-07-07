const sharp = require('sharp');
const path = require('path');

async function create640Anchor() {
    const width = 640;
    const height = 640;
    const blockSize = 20; // 640 / 32
    const channels = 4;
    const data = new Uint8Array(width * height * channels);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const bx = Math.floor(x / blockSize);
            const by = Math.floor(y / blockSize);
            const isWhite = (bx + by) % 2 === 0;
            const val = isWhite ? 255 : 200; // Subtle checkerboard
            const i = (y * width + x) * channels;
            data[i] = val;
            data[i+1] = val;
            data[i+2] = val;
            data[i+3] = 255;
        }
    }

    const outputPath = path.join(__dirname, '..', 'public', 'assets', 'anchors', 'density_anchor_32px_640.png');
    await sharp(data, { raw: { width, height, channels } })
        .png()
        .toFile(outputPath);

    console.log(`Native 640px Anchor created: ${outputPath}`);
}

create640Anchor();
