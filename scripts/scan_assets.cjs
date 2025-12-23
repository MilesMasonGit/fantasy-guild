const fs = require('fs');
const path = require('path');

// Configuration
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SPRITE_ROOT = path.join(PROJECT_ROOT, 'public/assets/sprites/implemented');
const OUTPUT_MANIFEST = path.join(PROJECT_ROOT, 'public/assets/sprite_manifest.json');
const OUTPUT_AUDIT = path.join(PROJECT_ROOT, 'public/assets/art_audit.json');

const REGISTRIES = {
    items: path.join(PROJECT_ROOT, 'src/config/registries/itemRegistry.js'),
    biomes: path.join(PROJECT_ROOT, 'src/config/registries/biomeRegistry.js'),
    projects: path.join(PROJECT_ROOT, 'src/config/registries/projectRegistry.js'),
    regions: path.join(PROJECT_ROOT, 'src/config/registries/regionRegistry.js')
};

// Categories to scan
const CATEGORIES = ['items', 'skills', 'heroes', 'biomes', 'projects', 'regions'];

// Ensure directory exists
if (!fs.existsSync(SPRITE_ROOT)) {
    console.error(`Error: Directory not found: ${SPRITE_ROOT}`);
    process.exit(1);
}

const manifest = {
    generatedAt: new Date().toISOString(),
    sprites: {}
};

try {
    let totalFound = 0;

    // 1. Scan Implemented Sprites
    CATEGORIES.forEach(category => {
        const categoryDir = path.join(SPRITE_ROOT, category);

        if (fs.existsSync(categoryDir)) {
            const files = fs.readdirSync(categoryDir);

            files.forEach(file => {
                if (file.endsWith('.png')) {
                    const id = path.basename(file, '.png');
                    manifest.sprites[id] = `assets/sprites/implemented/${category}/${file}`;
                    totalFound++;
                }
            });
        }
    });

    // Write Manifest
    fs.writeFileSync(OUTPUT_MANIFEST, JSON.stringify(manifest, null, 2));
    console.log(`✅ Sprite Manifest generated at ${OUTPUT_MANIFEST}`);

    // --- 2. Audit Report (Categorized) ---
    const auditData = {
        generatedAt: manifest.generatedAt,
        categories: {}
    };

    let grandTotalItems = 0;
    let grandTotalMissing = 0;

    for (const [category, registryPath] of Object.entries(REGISTRIES)) {
        if (!fs.existsSync(registryPath)) {
            console.warn(`Warning: Registry not found: ${registryPath}`);
            continue;
        }

        const registryContent = fs.readFileSync(registryPath, 'utf8');
        const idRegex = /id:\s*['"]([^'"]+)['"]/g;
        const registryIds = new Set();
        let match;

        while ((match = idRegex.exec(registryContent)) !== null) {
            registryIds.add(match[1]);
        }

        const missing = [];
        registryIds.forEach(id => {
            if (!manifest.sprites[id]) {
                missing.push(id);
            }
        });

        auditData.categories[category] = {
            total: registryIds.size,
            implemented: registryIds.size - missing.length,
            missing: missing,
            coveragePercent: Math.round(((registryIds.size - missing.length) / registryIds.size) * 100) || 0
        };

        grandTotalItems += registryIds.size;
        grandTotalMissing += missing.length;
    }

    // Add Global Stats
    const grandTotalFound = grandTotalItems - grandTotalMissing;
    auditData.totalItems = grandTotalItems;
    auditData.implementedItems = grandTotalFound;
    auditData.coveragePercent = Math.round((grandTotalFound / grandTotalItems) * 100) || 0;

    fs.writeFileSync(OUTPUT_AUDIT, JSON.stringify(auditData, null, 2));
    console.log(`✅ Categorized Art Audit saved to ${OUTPUT_AUDIT}`);
    console.log(`Global Coverage: ${auditData.implementedItems}/${auditData.totalItems} (${auditData.coveragePercent}%)`);

} catch (err) {
    console.error("Failed to generate manifest or audit:", err);
    process.exit(1);
}
