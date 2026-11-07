import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Ajv2020 from 'ajv/dist/2020.js';

/**
 * The content schemas (`cms/schemas/*.schema.json`, JSON Schema draft 2020-12) checked against
 * `data/` or a workspace: `npm run cms -- validate [--data]`. An error is a value the game cannot
 * read as meant (a wrong type, a word outside the game's list); exit 1. A key no schema lists is a
 * warning, never an error: the schemas are permissive at first, and the unknown keys are the list
 * to review (a field nothing reads, or one the schemas have not caught up with).
 *
 * Node only.
 */

export const SCHEMA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schemas');

/** The schema for each data file. */
export const FILE_SCHEMAS = Object.freeze({
    'items.json': 'items',
    'tokens.json': 'tokens',
    'effects.json': 'effects',
    'tokenRecipes.json': 'tokenRecipes',
    'starterCamp.json': 'starterCamp',
    'skillPerks.json': 'skillPerks',
    'hallStars.json': 'hallStars',
    'world.json': 'world',
});
/** Files the game cannot start without. */
const REQUIRED_FILES = ['items.json', 'tokens.json'];
/** How many leading path segments of a file are record ids (folded together in the warnings). */
const KEYED_AT = { items: 0, tokens: 0, effects: 0, skillPerks: 0, hallStars: 1 };

const schemaUrl = (name) => `https://fantasy-guild.local/cms/schemas/${name}.schema.json`;

function readSchemas(dir) {
    return fs.readdirSync(dir).filter((f) => f.endsWith('.schema.json'))
        .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}

/** The same schema with every listed-properties object closed, so an unlisted key shows up as `additionalProperties`. */
function closed(node) {
    if (Array.isArray(node)) return node.map(closed);
    if (!node || typeof node !== 'object') return node;
    const out = {};
    for (const [key, value] of Object.entries(node)) {
        // A property named like a keyword ("properties", "items") is data here, not schema: copy its subschemas, not its name.
        out[key] = key === 'properties' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, closed(v)])) : closed(value);
    }
    if (out.properties && out.additionalProperties === undefined) out.additionalProperties = false;
    return out;
}

let compiled = null;
/** The validators, compiled once: `{ open, closed }` by schema name. */
export function validators(dir = SCHEMA_DIR) {
    if (compiled && compiled.dir === dir) return compiled;
    const schemas = readSchemas(dir);
    const make = (list) => {
        const ajv = new Ajv2020({ allErrors: true, strict: false });
        for (const schema of list) ajv.addSchema(schema);
        return (name) => ajv.getSchema(schemaUrl(name));
    };
    const open = make(schemas);
    const shut = make(schemas.map(closed));
    compiled = { dir, open, closed: shut };
    return compiled;
}

function describe(error) {
    const allowed = error.keyword === 'enum' ? `: one of ${error.params.allowedValues.map((v) => JSON.stringify(v)).join(', ')}` : '';
    return `${error.message}${allowed}`;
}

/** The record ids and list positions in a path folded to *, so one unknown key reads as one line. */
function pattern(instancePath, keyedAt) {
    return instancePath.split('/').slice(1).map((seg, i) => (/^\d+$/.test(seg) || i === keyedAt ? '*' : seg)).join('/');
}

/**
 * Check named values against their schemas.
 * @param {Array<{ where: string, schema: string, value: any }>} targets
 * @returns {{ errors: Array<{ where, path, message }>, unknown: Array<{ where, path, key }> }}
 */
export function checkTargets(targets, dir = SCHEMA_DIR) {
    const v = validators(dir);
    const errors = [];
    const unknown = [];
    for (const { where, schema, value } of targets) {
        const open = v.open(schema);
        if (!open(value)) {
            for (const e of open.errors) {
                // An anyOf says only that no branch fitted; the branch errors say why.
                if (e.keyword === 'anyOf') continue;
                errors.push({ where, path: e.instancePath || '/', message: describe(e) });
            }
        }
        const shut = v.closed(schema);
        if (!shut(value)) {
            const seen = new Set();
            for (const e of shut.errors) {
                if (e.keyword !== 'additionalProperties') continue;
                const full = `${e.instancePath}/${e.params.additionalProperty}`;
                if (seen.has(full)) continue;
                seen.add(full);
                unknown.push({ where, path: full, key: e.params.additionalProperty, pattern: pattern(full, KEYED_AT[schema]) });
            }
        }
    }
    return { errors, unknown };
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** Check the game's files in `dataDir`: every file a schema covers, and the two the game cannot start without. */
export function validateDataDir(dataDir, dir = SCHEMA_DIR) {
    const targets = [];
    const errors = [];
    for (const [file, schema] of Object.entries(FILE_SCHEMAS)) {
        const full = path.join(dataDir, file);
        if (!fs.existsSync(full)) {
            if (REQUIRED_FILES.includes(file)) errors.push({ where: file, path: '/', message: 'is missing' });
            continue;
        }
        try {
            targets.push({ where: file, schema, value: readJson(full) });
        } catch (err) {
            errors.push({ where: file, path: '/', message: 'is not valid JSON: ' + err.message });
        }
    }
    const result = checkTargets(targets, dir);
    return { errors: [...errors, ...result.errors], unknown: result.unknown, checked: targets.map((t) => t.where) };
}

/**
 * Check a workspace (the disk workspace's `workspace`): each collection against the schema of the
 * file Sync writes it into. Recipes sit in pools per skill; the Guild Hall's sky in two maps.
 */
export function validateWorkspace(workspace, dir = SCHEMA_DIR) {
    const ws = workspace || {};
    const targets = [
        { where: 'items', schema: 'items', value: ws.items ?? {} },
        { where: 'tokens', schema: 'tokens', value: ws.tokens ?? {} },
        { where: 'effects', schema: 'effects', value: ws.effects ?? {} },
    ];
    for (const [skill, pool] of Object.entries(ws.recipePools || {})) {
        targets.push({ where: `recipePools.${skill}`, schema: 'tokenRecipes', value: pool });
    }
    if (ws.starterCamp != null) targets.push({ where: 'starterCamp', schema: 'starterCamp', value: ws.starterCamp });
    if (ws.skillPerks != null) targets.push({ where: 'skillPerks', schema: 'skillPerks', value: ws.skillPerks });
    if (ws.hallStars != null || ws.hallConstellations != null) {
        targets.push({ where: 'hallStars', schema: 'hallStars', value: { constellations: ws.hallConstellations ?? {}, stars: ws.hallStars ?? {} } });
    }
    if (ws.world != null) targets.push({ where: 'world', schema: 'world', value: ws.world });
    const result = checkTargets(targets, dir);
    return { ...result, checked: targets.map((t) => t.where) };
}

/** The unknown keys folded by place: `{ where, pattern, key, count }`, most frequent first. */
export function unknownKeySummary(unknown) {
    const by = new Map();
    for (const u of unknown) {
        // Pools of one recipe file read as one place.
        const where = u.where.startsWith('recipePools.') ? 'recipePools.*' : u.where;
        const id = `${where} ${u.pattern}`;
        const row = by.get(id) || { where, pattern: u.pattern, key: u.key, count: 0 };
        row.count += 1;
        by.set(id, row);
    }
    return [...by.values()].sort((a, b) => b.count - a.count || a.where.localeCompare(b.where) || a.pattern.localeCompare(b.pattern));
}

/** What the command line prints. */
export function reportLines({ errors, unknown }, { all = false } = {}) {
    const keys = unknownKeySummary(unknown);
    const lines = [`${errors.length} error${errors.length === 1 ? '' : 's'}, ${keys.length} unknown key${keys.length === 1 ? '' : 's'} (warnings).`];
    if (errors.length) {
        lines.push('Errors:');
        const shown = all ? errors : errors.slice(0, 50);
        for (const e of shown) lines.push(`- ${e.where}${e.path === '/' ? '' : ' ' + e.path}: ${e.message}`);
        if (shown.length < errors.length) lines.push(`  and ${errors.length - shown.length} more (--all lists them)`);
    }
    if (keys.length) {
        lines.push('Unknown keys (no schema lists them; review input, not errors):');
        for (const k of keys) lines.push(`- ${k.where} /${k.pattern}: ${k.count} record${k.count === 1 ? '' : 's'}`);
    }
    return lines;
}
