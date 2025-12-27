const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ARGS = process.argv.slice(2);
const COMMAND = ARGS[0];

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PROCESS_SCRIPT = path.join(PROJECT_ROOT, 'scripts/process_art.cjs');
// The Four Gates (Nested in public/assets/sprites/)
const MASTERS_DIR = path.join(PROJECT_ROOT, 'public/assets/sprites/masters');      // 1024px RAW
const TEMPLATES_DIR = path.join(PROJECT_ROOT, 'public/assets/sprites/templates');    // 32px Greyscale
const WORKSPACE_DIR = path.join(PROJECT_ROOT, 'public/assets/sprites/workspace');    // 32px Review
const IMPLEMENTED_DIR = path.join(PROJECT_ROOT, 'public/assets/sprites/implemented'); // 32px GAME LIVE

function log(msg) {
    console.log(`[FORGE] ${msg}`);
}

function run(cmd) {
    log(`Executing: ${cmd}`);
    try {
        execSync(cmd, { stdio: 'inherit', cwd: PROJECT_ROOT });
    } catch (err) {
        console.error(`[FORGE ERROR] Command failed: ${cmd}`);
        process.exit(1);
    }
}

async function handleMaster() {
    const [src, id] = ARGS.slice(1);
    if (!src || !id) {
        console.error("Usage: forge master <path_to_raw> <id>");
        process.exit(1);
    }

    log(`Forging Master: ${id} from ${src}`);

    // Default High-Fi Extraction Flags
    const targetDir = WORKSPACE_DIR;
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    // Copy original to masters source backup
    const sourceDir = MASTERS_DIR;
    if (!fs.existsSync(sourceDir)) fs.mkdirSync(sourceDir, { recursive: true });
    fs.copyFileSync(src, path.join(sourceDir, `${id}.png`));

    const flags = [
        `"${src}"`,
        `"workspace"`,
        `"${id}"`,
        `--size 32`,
        `--pulse`,
        `--grid 1x1`,
        `--tile 1,1`,
        `--postfill`,
        `--snap universal,iron,oak`,
        `--nofill`,
        `--threshold 254`,
        ARGS.includes('--flip') ? '--flip' : ''
    ].join(' ');

    run(`node "${PROCESS_SCRIPT}" ${flags}`);
    log(`✅ Master [${id}] extracted to Workspace/ for review.`);
}

async function handleVariant() {
    const [masterId, material] = ARGS.slice(1);
    if (!masterId || !material) {
        console.error("Usage: forge variant <master_id> <material_ramp_id>");
        process.exit(1);
    }

    let masterPath = path.join(TEMPLATES_DIR, `${masterId}_template.png`);
    if (!fs.existsSync(masterPath)) {
        // Fallback to non-suffixed templates if user didn't rename yet
        masterPath = path.join(TEMPLATES_DIR, `${masterId}.png`);
        if (!fs.existsSync(masterPath)) {
            console.error(`Error: Template not found in ${TEMPLATES_DIR}: ${masterId}_template.png`);
            process.exit(1);
        }
    }

    const targetId = `${masterId}_${material}`;
    log(`Forging Variant: ${targetId} using material [${material}]`);

    let flags = [
        `"${masterPath}"`,
        `workspace`,
        `"${targetId}"`,
        `--size 32`,
        `--nofill`,
        ARGS.includes('--flip') ? '--flip' : ''
    ];

    if (material === 'greyscale' || material === 'charcoal') {
        // Special case: Global Recolor (Desaturate/Remap everything)
        flags.push(`--recolor ${material}`);
        flags.push(`--snap ${material}`);
    } else {
        // Standard case: Swap Iron base material
        flags.push(`--snap iron,oak,${material}`);
        flags.push(`--mask-swap iron=${material}`);
    }

    run(`node "${PROCESS_SCRIPT}" ${flags.join(' ')}`);
    log(`✅ Variant [${targetId}] created in Workspace/ for review.`);
}

async function handleDebug() {
    const [id] = ARGS.slice(1);
    if (!id) {
        console.error("Usage: forge debug <id>");
        process.exit(1);
    }

    const masterPath = path.join(MASTERS_DIR, `${id}.png`);
    if (!fs.existsSync(masterPath)) {
        console.error(`Error: Master not found: ${masterPath}`);
        process.exit(1);
    }

    log(`Generating Diagnostic Segmentation Map for [${id}]...`);
    const flags = [
        `"${masterPath}"`,
        `masters`,
        `"${id}_segmentation"`,
        `--size 32`,
        `--snap iron,oak,universal`,
        `--debug`,
        `--nofill`
    ].join(' ');

    run(`node "${PROCESS_SCRIPT}" ${flags}`);
    log(`✅ Segmentation map [${id}_segmentation] created in masters/`);
}

// Router
switch (COMMAND) {
    case 'master':
        handleMaster();
        break;
    case 'variant':
        handleVariant();
        break;
    case 'debug':
        handleDebug();
        break;
    default:
        console.log("Forge 2.0 Commands:");
        console.log("  master <src> <id>      - Extract 32px master from raw 1024px gen");
        console.log("  variant <id> <mat>     - Create material variant (e.g. forge variant battleaxe copper)");
        console.log("  debug <id>             - Generate segmentation map (Cyan=Iron, Orange=Oak)");
}
