const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputPath = path.join(__dirname, '..', 'public', 'assets', 'icons', 'resources', 'iron_ingot_smooth_v10.png');
const outputDir = path.join(__dirname, '..', 'public', 'assets', 'icons', 'templates');
const outputPath = path.join(outputDir, 'ingot_template.png');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function makeTemplate() {
    try {
        console.log(`Desaturating: ${inputPath} -> ${outputPath}`);
        await sharp(inputPath)
            .grayscale()
            .toFile(outputPath);
        console.log('Template created successfully!');
    } catch (err) {
        console.error('Error creating template:', err);
    }
}

makeTemplate();
