// Checks rename-list.json against docs/reference/ASSET_NAMING.md and the files under public/assets.
// Usage: node tools/asset-rename/check-list.mjs   (exit code 1 when anything fails)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const ASSETS = path.join(ROOT, 'public/assets');
const rows = JSON.parse(fs.readFileSync(path.join(HERE, 'rename-list.json'), 'utf8'));

// Kind folder -> prefix. Longest folder first, so playmat/props wins over a shorter match.
const KINDS = [
    ['playmat/terrain', 'g'], ['playmat/props', 'p'],
    ['tokens', 't'], ['items', 'i'], ['heroes', 'h'], ['enemies', 'e'],
    ['ui', 'u'], ['backgrounds', 'b'], ['skills', 's'],
];
// Kinds whose files sit in a group folder, and whose names repeat that group.
const GROUPED = new Set(['tokens', 'items', 'enemies', 'backgrounds']);
const NAME = /^[a-z0-9]+(_[a-z0-9]+)*$/;

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);

const onDisk = [];
(function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        const rel = path.relative(ASSETS, full).split(path.sep).join('/');
        if (e.isDirectory()) { if (rel !== 'audio') walk(full); }
        else onDisk.push(rel);
    }
})(ASSETS);

const byFrom = new Map();
for (const r of rows) {
    if (byFrom.has(r.from)) fail(`two rows for ${r.from}`);
    byFrom.set(r.from, r);
    if (r.from.startsWith('audio/')) fail(`audio file listed: ${r.from}`);
}
for (const f of onDisk) if (!byFrom.has(f)) fail(`no row for ${f}`);
const diskSet = new Set(onDisk);
for (const r of rows) if (!diskSet.has(r.from)) fail(`row for a file that is not on disk: ${r.from}`);

const toSeen = new Map();
const keySeen = new Map();
for (const r of rows) {
    const where = r.from;
    if (!['move', 'keep', 'delete'].includes(r.action)) fail(`${where}: unknown action ${r.action}`);
    if (!['sure', 'check'].includes(r.confidence)) fail(`${where}: unknown confidence ${r.confidence}`);
    if (typeof r.inUse !== 'boolean' || !Array.isArray(r.usedBy)) fail(`${where}: inUse or usedBy missing`);

    if (r.action === 'delete') {
        if (r.to !== null || r.keyTo !== null) fail(`${where}: a delete has a target`);
        if (r.inUse) fail(`${where}: in use but marked delete`);
        continue;
    }
    if (r.action === 'keep' && r.to !== r.from) fail(`${where}: keep but to differs`);
    if (r.action === 'move' && r.to === r.from) fail(`${where}: move to the same path`);
    if (typeof r.to !== 'string') { fail(`${where}: no target`); continue; }

    const ext = path.extname(r.to);
    const stem = path.basename(r.to, ext);
    const dir = path.dirname(r.to);
    if (ext !== ext.toLowerCase()) fail(`${where}: extension not lower case (${r.to})`);
    if (!NAME.test(stem)) fail(`${where}: name not lower case words joined by _ (${r.to})`);
    if (dir.split('/').some(d => !/^[a-z0-9]+$/.test(d))) fail(`${where}: folder name not a lower-case word (${r.to})`);
    if (r.keyTo !== stem) fail(`${where}: keyTo ${r.keyTo} is not the file name ${stem}`);

    const kind = KINDS.find(([k]) => dir === k || dir.startsWith(k + '/'));
    if (!kind) { fail(`${where}: ${r.to} is not under a kind folder`); continue; }
    const [kindDir, prefix] = kind;
    if (!stem.startsWith(prefix + '_')) fail(`${where}: ${stem} should start with ${prefix}_ (kind ${kindDir})`);
    const under = dir === kindDir ? [] : dir.slice(kindDir.length + 1).split('/');
    if (under.length > 1) fail(`${where}: more than one folder under ${kindDir}/ (${r.to})`);
    if (GROUPED.has(kindDir)) {
        if (under.length !== 1) fail(`${where}: ${kindDir} files sit in a group folder (${r.to})`);
        else if (stem !== `${prefix}_${under[0]}` && !stem.startsWith(`${prefix}_${under[0]}_`)) fail(`${where}: ${stem} should repeat its group ${under[0]}`);
    } else if (under.length && !(kindDir === 'playmat/props' && under[0] === 'sheets')) {
        fail(`${where}: ${kindDir} has no group level (${r.to})`);
    }
    if (kindDir === 'heroes' && !/_(f|m|n)$/.test(stem) && !/_sheet$/.test(stem)) fail(`${where}: hero portrait should end in _f, _m or _n (${stem})`);

    if (/(^|_)(final|new|v\d+|\d+px|\d+x\d+)(_|$)/.test(stem)) fail(`${where}: forbidden word in ${stem}`);
    if (/\d/.test(stem)) warnings.push(`${stem}: has a digit`);
    if (/_sheet(_|$)/.test(stem)) {
        const still = path.join(dir, stem.replace(/_sheet(_[a-z]+)?$/, '') + ext).split(path.sep).join('/');
        if (!rows.some(o => o.to === still)) warnings.push(`${stem}: no still sprite ${still} beside it`);
    }

    if (toSeen.has(r.to)) fail(`${where}: target ${r.to} also used by ${toSeen.get(r.to)}`);
    toSeen.set(r.to, where);
    if (keySeen.has(stem)) fail(`${where}: sprite name ${stem} also used by ${keySeen.get(stem)}`);
    keySeen.set(stem, where);
}

const count = (field) => rows.reduce((m, r) => ((m[r[field]] = (m[r[field]] || 0) + 1), m), {});
console.log(`rows: ${rows.length}, files on disk (no audio): ${onDisk.length}`);
console.log('by action:', count('action'));
console.log('by confidence:', count('confidence'));
console.log('in use:', rows.filter(r => r.inUse).length, '| in use and moving:', rows.filter(r => r.inUse && r.action === 'move').length);
if (warnings.length) console.log(`\nwarnings (${warnings.length}):\n  ` + warnings.join('\n  '));
if (errors.length) {
    console.log(`\nFAILED (${errors.length}):\n  ` + errors.join('\n  '));
    process.exit(1);
}
console.log('\nOK');
