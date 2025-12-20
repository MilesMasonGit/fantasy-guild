const fs = require('fs');
const path = require('path');

// Configuration
const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEST_ASSETS_DIR = path.join(PROJECT_ROOT, 'public/assets/testing');
const OUTPUT_MANIFEST = path.join(PROJECT_ROOT, 'public/assets/manifest.json');

// Ensure directory exists
if (!fs.existsSync(TEST_ASSETS_DIR)) {
    console.error(`Error: Directory not found: ${TEST_ASSETS_DIR}`);
    process.exit(1);
}

// Scan
try {
    const files = fs.readdirSync(TEST_ASSETS_DIR);

    const assets = files
        .filter(file => file.endsWith('.svg'))
        .map(file => {
            // Heuristic for size detection
            let size = 32; // Default
            if (file.includes('24px')) size = 24;
            else if (file.includes('48px')) size = 48;
            else if (file.includes('16px')) size = 16;

            return {
                name: file,
                path: `assets/testing/${file}`,
                gridSize: size
            };
        });

    // Write Manifest
    fs.writeFileSync(OUTPUT_MANIFEST, JSON.stringify({
        generatedAt: new Date().toISOString(),
        assets: assets
    }, null, 2));

    console.log(`✅ Artifact Manifest generated at ${OUTPUT_MANIFEST}`);
    console.log(`Included ${assets.length} SVG assets.`);

} catch (err) {
    console.error("Failed to generate manifest:", err);
    process.exit(1);
}
