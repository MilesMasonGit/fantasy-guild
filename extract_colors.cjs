const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const dir = 'public/assets/backgrounds/playmat/global/colorlab';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));

async function extractColors() {
    const colorCounts = {};

    for (const file of files) {
        const filePath = path.join(dir, file);
        const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
        
        for (let i = 0; i < data.length; i += info.channels) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = info.channels === 4 ? data[i + 3] : 255;
            
            if (a < 128) continue; // Skip transparent
            
            const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
            colorCounts[hex] = (colorCounts[hex] || 0) + 1;
        }
    }

    const sortedColors = Object.entries(colorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2000); // Get top 2000 colors

    const results = { Stone: [], Moss: [], Dirt: [] };

    sortedColors.forEach(([hex, count]) => {
        const r = parseInt(hex.substring(1, 3), 16);
        const g = parseInt(hex.substring(3, 5), 16);
        const b = parseInt(hex.substring(5, 7), 16);
        
        // Refined classification
        if (g > r && g > b && (g - r > 5 || g - b > 5)) {
            results.Moss.push({ hex, count });
        } else if (r > g && r > b && (r - g > 5 || r - b > 5)) {
            results.Dirt.push({ hex, count });
        } else {
            results.Stone.push({ hex, count });
        }
    });

    console.log('--- Top 20 Stone ---');
    results.Stone.slice(0, 20).forEach(c => console.log(`${c.hex}: ${c.count}`));
    console.log('--- Top 20 Moss ---');
    results.Moss.slice(0, 20).forEach(c => console.log(`${c.hex}: ${c.count}`));
    console.log('--- Top 20 Dirt ---');
    results.Dirt.slice(0, 20).forEach(c => console.log(`${c.hex}: ${c.count}`));
}

extractColors().catch(console.error);
