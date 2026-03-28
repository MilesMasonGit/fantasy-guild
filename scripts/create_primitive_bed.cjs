const sharp = require('sharp');
const path = require('path');

async function createPrimitiveBunkBed() {
    const width = 640;
    const height = 640;
    const blockSize = 20;
    const channels = 4;
    const data = new Uint8Array(width * height * channels);

    // Pure White Background
    data.fill(255);

    const drawBlock = (bx, by, r, g, b) => {
        for (let y = 0; y < blockSize; y++) {
            for (let x = 0; x < blockSize; x++) {
                const py = by * blockSize + y;
                const px = bx * blockSize + x;
                if (py < height && px < width) {
                    const i = (py * width + px) * channels;
                    data[i] = r;
                    data[i+1] = g;
                    data[i+2] = b;
                    data[i+3] = 255;
                }
            }
        }
    };

    const brown = [101, 67, 33];
    const blue = [52, 152, 219];
    const red = [231, 76, 60];

    // Bunk Bed Structure (Primitive)
    // 4 Posts
    for (let by = 4; by < 28; by++) {
        drawBlock(6, by, ...brown);   // Back Left
        drawBlock(25, by, ...brown);  // Front Right
        drawBlock(6, by+1, ...brown); // Perspective hack
        drawBlock(25, by+1, ...brown);
    }

    // Top Bunk (Frame)
    for (let bx = 6; bx <= 25; bx++) {
        for (let by = 6; by <= 10; by++) {
            drawBlock(bx, by, ...brown);
        }
    }
    // Top Blanket
    for (let bx = 8; bx <= 24; bx++) {
        for (let by = 7; by <= 9; by++) {
            drawBlock(bx, by, ...red);
        }
    }

    // Bottom Bunk (Frame)
    for (let bx = 6; bx <= 25; bx++) {
        for (let by = 20; by <= 24; by++) {
            drawBlock(bx, by, ...brown);
        }
    }
    // Bottom Blanket
    for (let bx = 8; bx <= 24; bx++) {
        for (let by = 21; by <= 23; by++) {
            drawBlock(bx, by, ...blue);
        }
    }

    const outputPath = path.join(__dirname, '..', 'public', 'assets', 'anchors', 'primitive_bunk_bed_anchor_640.png');
    await sharp(data, { raw: { width, height, channels } })
        .png()
        .toFile(outputPath);

    console.log(`Composite Primitive Anchor created: ${outputPath}`);
}

createPrimitiveBunkBed();
