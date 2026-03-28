const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const input = 'public/assets/sprites/masters/hero_adventurer_seasoned_master.png';
const outputDir = 'public/assets/sprites/implemented/heroes';
const outputFile = path.join(outputDir, 'hero_adventurer_seasoned_v4_20px.png');

async function extract20px() {
    console.log('Extracting using 20px logic blocks (640px / 32 = 20)...');
    
    try {
        const image = sharp(input);
        const metadata = await image.metadata();
        console.log(`Original Metadata: ${metadata.width}x${metadata.height}`);

        const sizeArg = 32;
        const blockSize = metadata.width / sizeArg; // Should be 20
        const offset = Math.floor(blockSize / 2); // 10px to hit center of first block

        console.log(`Block Size: ${blockSize}, Pulse Offset: ${offset}`);

        const result = await image
            .extract({
                left: offset,
                top: offset,
                width: metadata.width - offset,
                height: metadata.height - offset
            })
            .resize(32, 32, { kernel: sharp.kernel.nearest })
            .toFile(outputFile);

        console.log(`Success! Saved to ${outputFile}`);
    } catch (err) {
        console.error('Error:', err);
    }
}

extract20px();
