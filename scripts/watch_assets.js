import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Watch configurations for different folders/sizes
const watchConfigs = [
  {
    name: 'Sprites (32px)',
    inputDir: path.join(__dirname, '..', 'public', 'assets', 'dataset', 'input32'),
    outputDir: path.join(__dirname, '..', 'public', 'assets', 'dataset'),
    backupDir: path.join(__dirname, '..', 'public', 'assets', 'dataset', 'input32', 'backup'),
    category: 'dataset',
    size: 32
  },
  {
    name: 'Sprites (64px)',
    inputDir: path.join(__dirname, '..', 'public', 'assets', 'dataset', 'input64'),
    outputDir: path.join(__dirname, '..', 'public', 'assets', 'dataset'),
    backupDir: path.join(__dirname, '..', 'public', 'assets', 'dataset', 'input64', 'backup'),
    category: 'dataset',
    size: 64
  },
  {
    name: 'Sprites (128px)',
    inputDir: path.join(__dirname, '..', 'public', 'assets', 'dataset', 'input128'),
    outputDir: path.join(__dirname, '..', 'public', 'assets', 'dataset'),
    backupDir: path.join(__dirname, '..', 'public', 'assets', 'dataset', 'input128', 'backup'),
    category: 'dataset',
    size: 128
  },
  {
    name: 'Sprites (256px)',
    inputDir: path.join(__dirname, '..', 'public', 'assets', 'dataset', 'input256'),
    outputDir: path.join(__dirname, '..', 'public', 'assets', 'dataset'),
    backupDir: path.join(__dirname, '..', 'public', 'assets', 'dataset', 'input256', 'backup'),
    category: 'dataset',
    size: 256
  },
  {
    name: 'Sprites (512px)',
    inputDir: path.join(__dirname, '..', 'public', 'assets', 'dataset', 'input512'),
    outputDir: path.join(__dirname, '..', 'public', 'assets', 'dataset'),
    backupDir: path.join(__dirname, '..', 'public', 'assets', 'dataset', 'input512', 'backup'),
    category: 'dataset',
    size: 512
  },
  {
    name: 'Sprites (512px to 32px)',
    inputDir: path.join(__dirname, '..', 'public', 'assets', 'dataset', '512input32'),
    outputDir: path.join(__dirname, '..', 'public', 'assets', 'dataset'),
    backupDir: path.join(__dirname, '..', 'public', 'assets', 'dataset', '512input32', 'backup'),
    category: 'dataset',
    size: 32
  },
  {
    name: 'Sprites (512px to 64px)',
    inputDir: path.join(__dirname, '..', 'public', 'assets', 'dataset', '512input64'),
    outputDir: path.join(__dirname, '..', 'public', 'assets', 'dataset'),
    backupDir: path.join(__dirname, '..', 'public', 'assets', 'dataset', '512input64', 'backup'),
    category: 'dataset',
    size: 64
  },
  {
    name: 'Sprites (1024px to 256px)',
    inputDir: path.join(__dirname, '..', 'public', 'assets', 'dataset', '1024input256'),
    outputDir: path.join(__dirname, '..', 'public', 'assets', 'dataset'),
    backupDir: path.join(__dirname, '..', 'public', 'assets', 'dataset', '1024input256', 'backup'),
    category: 'dataset',
    size: 256,
    extraArgs: '--nofill'
  },
  {
    name: 'Sprites (512px to 256px)',
    inputDir: path.join(__dirname, '..', 'public', 'assets', 'dataset', '512input256'),
    outputDir: path.join(__dirname, '..', 'public', 'assets', 'dataset'),
    backupDir: path.join(__dirname, '..', 'public', 'assets', 'dataset', '512input256', 'backup'),
    category: 'dataset',
    size: 256,
    extraArgs: '--nofill'
  }
];

// Ensure all configured directories exist
for (const config of watchConfigs) {
  if (!fs.existsSync(config.inputDir)) {
    fs.mkdirSync(config.inputDir, { recursive: true });
  }
  if (!fs.existsSync(config.backupDir)) {
    fs.mkdirSync(config.backupDir, { recursive: true });
  }
  console.log(`[Configured] Watching ${config.name} at: ${config.inputDir}`);
}

console.log('Press Ctrl+C to stop.\n');

// Store debounce timeouts per file path
const timeouts = new Map();

function checkAndProcess(fileName, config) {
  const filePath = path.join(config.inputDir, fileName);
  if (!fs.existsSync(filePath)) return;

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) return;

  // Ignore files inside backup folders or subdirectories
  if (fileName.includes(path.sep) || fileName.includes('/') || fileName.includes('\\')) return;

  const ext = path.extname(fileName).toLowerCase();
  if (ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png') return;

  console.log(`[${config.name} Detected] ${fileName}. Waiting for write to complete...`);

  const key = `${config.inputDir}:${fileName}`;

  // Clear existing timeout for this file
  if (timeouts.has(key)) {
    clearTimeout(timeouts.get(key));
  }

  // Set timeout to wait for file write completion
  const timeoutId = setTimeout(() => {
    timeouts.delete(key);
    processFile(fileName, config);
  }, 1000); // 1-second debounce to ensure download completes

  timeouts.set(key, timeoutId);
}

function processFile(fileName, config) {
  const filePath = path.join(config.inputDir, fileName);
  if (!fs.existsSync(filePath)) return;

  const outputName = path.basename(fileName, path.extname(fileName));
  console.log(`[Processing ${config.name}] ${fileName} -> ${config.size}px sprite...`);

  try {
    const processScript = path.join(__dirname, 'process_art.cjs');
    const extra = config.extraArgs ? ` ${config.extraArgs}` : '';
    const cmd = `node "${processScript}" "${filePath}" "${config.category}" "${outputName}" --size ${config.size}${extra}`;
    console.log(`> ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
    console.log(`[Success] Processed and saved sprite!`);

    // Move to backup directory to clean the queue
    const backupPath = path.join(config.backupDir, fileName);
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }
    fs.renameSync(filePath, backupPath);
    console.log(`[Backup] Moved master image to: ${backupPath}\n`);
  } catch (err) {
    console.error(`[Error] Failed to process ${fileName}: ${err.message}\n`);
  }
}

// Start watchers for all configurations
for (const config of watchConfigs) {
  fs.watch(config.inputDir, (eventType, fileName) => {
    if (!fileName) return;
    if (fileName === 'backup') return;

    if (eventType === 'rename' || eventType === 'change') {
      const filePath = path.join(config.inputDir, fileName);
      if (fs.existsSync(filePath)) {
        checkAndProcess(fileName, config);
      }
    }
  });
}
