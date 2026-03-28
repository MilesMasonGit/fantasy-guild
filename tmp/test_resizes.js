const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const input = 'public/assets/sprites/masters/hero_adventurer_seasoned_master.png';
const outputDir = 'tmp/test_downsample';

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function test() {
    console.log('Testing naive downsampling...');
    
    // Method 1: Nearest Neighbor (Point Sampling)
    await sharp(input)
        .resize(32, 32, { kernel: sharp.kernel.nearest })
        .toFile(path.join(outputDir, 'nearest.png'));
    
    // Method 2: Lanczos (Smoother)
    await sharp(input)
        .resize(32, 32, { kernel: sharp.kernel.lanczos3 })
        .toFile(path.join(outputDir, 'lanczos.png'));

    // Method 3: Mitchell
    await sharp(input)
        .resize(32, 32, { kernel: sharp.kernel.mitchell })
        .toFile(path.join(outputDir, 'mitchell.png'));

    console.log('Done. Check tmp/test_downsample/');
}

test();
