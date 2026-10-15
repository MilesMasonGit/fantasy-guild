import fs from 'fs';
import path from 'path';

/**
 * The palette drop folder (`cms/palettes-inbox/`): agents write palette files here, never into
 * `data/palettes/` (CMS-owned). The Studio's Recolor tab lists them, and the owner's Import click
 * adds one to the Material Library through the same files the library already saves to.
 *
 * A drop file is either
 * - `.json`: `{ "name": "forest_ground", "colors": ["#2a3b1c", ...], "group": "Forest" }`
 *   (`group` optional), or
 * - `.hex`: one hex colour per line (the Lospec download format); the file name is the palette name.
 */

const HEX = /^#?([0-9a-f]{6})$/i;
/** One plain file name in the folder: no separators, no `..`, a palette extension. */
const DROP_FILE = /^[A-Za-z0-9][A-Za-z0-9 _.-]*\.(json|hex)$/i;

/**
 * The absolute path of `file` inside `dir`, or null when `file` is not a plain drop-file name
 * (a path, a `..`, another extension). ⚠️ The only gate between a request and the disk.
 */
export function dropFilePath(dir, file) {
  if (typeof file !== 'string' || !DROP_FILE.test(file) || file.includes('..')) return null;
  const root = path.resolve(dir);
  const full = path.resolve(root, file);
  if (path.dirname(full) !== root) return null;
  return full;
}

function normaliseColors(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const c of list) {
    const m = typeof c === 'string' ? HEX.exec(c.trim()) : null;
    if (!m) return null;
    out.push('#' + m[1].toLowerCase());
  }
  return out.length ? out : null;
}

/** Parse one drop file's text into `{ name, colors, group }`, or `{ error }`. */
export function parseDropFile(file, text) {
  if (/\.hex$/i.test(file)) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const colors = normaliseColors(lines);
    if (!colors) return { error: 'Every line must be one hex colour, like ff8800' };
    return { name: file.replace(/\.hex$/i, ''), colors, group: null };
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    return { error: 'Not valid JSON: ' + err.message };
  }
  const name = typeof data?.name === 'string' ? data.name.trim() : '';
  if (!name) return { error: 'Missing "name"' };
  const colors = normaliseColors(data.colors);
  if (!colors) return { error: '"colors" must be a list of hex colours, like "#ff8800"' };
  const group = typeof data.group === 'string' && data.group.trim() ? data.group.trim() : null;
  return { name, colors, group };
}

/** Every palette file in the drop folder, parsed, sorted by file name. A missing folder lists nothing. */
export function listDropFolder(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && dropFilePath(dir, e.name))
    .map((e) => e.name)
    .sort()
    .map((file) => ({ file, ...parseDropFile(file, fs.readFileSync(path.join(dir, file), 'utf8')) }));
}

const readJsonFile = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {});

function writeJsonFile(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

/** The Material Library's two files; `/api/custom-palettes` and `/api/palette-groups` read and write these. */
export const libraryFiles = (palettesDir) => ({
  palettes: path.join(palettesDir, 'custom_palettes.json'),
  groups: path.join(palettesDir, 'palette_groups.json'),
});

/**
 * Add one drop file's palette to the Material Library. Returns `{ status, body }` for the route:
 * 400 for a bad name or file, 404 when it is not there, 409 when the name is taken and
 * `overwrite` is not set. The drop file stays where it is.
 */
export function importDropFile(dropDir, palettesDir, file, { overwrite = false } = {}) {
  const full = dropFilePath(dropDir, file);
  if (!full) return { status: 400, body: { error: 'Only a file directly in the palette drop folder can be imported' } };
  if (!fs.existsSync(full)) return { status: 404, body: { error: 'No such file in the palette drop folder' } };
  const parsed = parseDropFile(file, fs.readFileSync(full, 'utf8'));
  if (parsed.error) return { status: 400, body: { error: parsed.error } };

  const files = libraryFiles(palettesDir);
  const palettes = readJsonFile(files.palettes);
  if (palettes[parsed.name] && !overwrite) {
    return { status: 409, body: { error: 'A palette with that name exists', exists: true, name: parsed.name } };
  }
  writeJsonFile(files.palettes, { ...palettes, [parsed.name]: parsed.colors });
  if (parsed.group) writeJsonFile(files.groups, { ...readJsonFile(files.groups), [parsed.name]: parsed.group });
  return { status: 200, body: { success: true, name: parsed.name, colors: parsed.colors.length, group: parsed.group } };
}
