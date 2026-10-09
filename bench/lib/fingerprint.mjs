// Fantasy Guild bench — the work fingerprint (CR3-550). Loaded THROUGH Vite, so
// it reads the same engine modules the scenario ran.
//
// A run's fingerprint says WHAT the engine did, never how fast. Two runs of one
// scenario with the same seed must agree on it exactly, and `--compare` checks
// it against `bench/baseline.json`: a difference is "WORK CHANGED" (exit 2),
// told apart from a timing regression (exit 1).
//
// Totals alone are too weak: a change that moves a Token, reorders two spawns
// or gives the buff to a different Token can keep every total identical. So
// beside the readable totals there is one hash per kind of state, built from
// every Token, Bank entry, hero and loot sprite, with coordinates as exact
// numbers (never rounded), plus the number of `Math.random` draws the run made.

import { GameState } from '../../src/state/GameState.js';
import * as BoardState from '../../src/systems/board/BoardState.js';

/** FNV-1a, 32-bit, as 8 hex digits. A stable string hash; collisions don't matter here. */
export function fnv1a(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * JSON with object keys sorted, so two objects holding the same values hash
 * the same whatever order their keys were written in. Numbers keep full
 * precision (`JSON.stringify` writes the shortest exact form).
 */
export function canon(value) {
    if (value === undefined) return 'undefined';
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canon).join(',')}]`;
    const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
    return `{${keys.map(k => `${JSON.stringify(k)}:${canon(value[k])}`).join(',')}}`;
}

/** One line per Token on the mat, in arrival order: `id|typeId|x|y|charges|placedAt|cycle`. */
export function tokenLines() {
    return BoardState.tokens().map(t =>
        `${t.id}|${t.typeId}|${t.x}|${t.y}|${t.usesRemaining}|${t.placedAt}|${t.cycleElapsedMs}`);
}

/** A hash of every Token's id, type, exact point, charges, arrival order and cycle progress. */
export function tokensHash() {
    return fnv1a(tokenLines().join('\n'));
}

function bankHash(s, hash = fnv1a) {
    const items = s.inventory?.items || {};
    const lines = Object.keys(items).sort().map(id => `${id}:${Number(items[id]?.quantity) || 0}`);
    return hash(lines.join('\n'));
}

function heroHash(s, hash = fnv1a) {
    const heroes = [...(s.heroes || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const lines = heroes.map(h => canon({
        id: h.id,
        status: h.status,
        woundedUntil: h.woundedUntil,
        hp: h.hp?.current,
        energy: h.energy?.current,
        skills: h.skills,
        statuses: h.statuses,
        equipment: h.equipment,
        flag: BoardState.flagOf(h.id),
        claim: BoardState.claimOfHero(h.id)?.instanceId ?? null,
        body: BoardState.heroBodyOf(h.id)
    }));
    return hash(lines.join('\n'));
}

function spriteHash(s, hash = fnv1a) {
    // Every field: kind, item, quantity, exact point, where it flew from, its stack.
    const lines = (s.board?.sprites || []).map(canon);
    return hash(lines.join('\n'));
}

function binHash(s, hash = fnv1a) {
    const lines = (s.board?.bin || []).map(t => `${t?.id}|${t?.typeId}|${t?.usesRemaining}`);
    return hash(lines.join('\n'));
}

/**
 * Ids carry the wall-clock time they were made at (`tok_<ms>_…`, `sprite_<ms in base 36>_<n>`,
 * `quest_<ms>_…`). A catch-up makes them while the wall clock stands nearly still, live play while
 * it moves, so comparing the two (S8 against S8L) leaves that time out. The rest of each id (its
 * random part, its counter) stays.
 */
function withoutIdTimes(text) {
    return text
        .replace(/\btok_\d+_/g, 'tok_')
        .replace(/\bsprite_[0-9a-z]+_(\d+)/g, 'sprite_$1')
        .replace(/\bquest_\d+_/g, 'quest_');
}

/**
 * The end-of-run fingerprint. The totals are there to be read by a person; the
 * hashes and `randomDraws` are what make it strong.
 *
 * @param {{stableIds?: boolean}} [options] `stableIds`: leave the wall-clock time out of ids
 */
export function fingerprint({ stableIds = false } = {}) {
    const hash = stableIds ? (text) => fnv1a(withoutIdTimes(text)) : fnv1a;
    const s = GameState.state;
    let uses = 0;
    for (const t of BoardState.tokens()) uses += Number(t.usesRemaining) || 0;
    let items = 0;
    for (const entry of Object.values(s.inventory?.items || {})) items += Number(entry?.quantity) || 0;
    let xp = 0;
    for (const hero of s.heroes || []) {
        for (const sk of Object.values(hero.skills || {})) xp += Number(sk?.xp) || 0;
    }
    return {
        // Readable totals (the original fingerprint).
        tokens: BoardState.tokens().length,
        uses,
        bankItems: items,
        heroXp: Math.round(xp),
        sprites: (s.board?.sprites || []).length,
        gameTimeMs: s.time?.gameTimeMs,
        // The strong part.
        tokensHash: hash(tokenLines().join('\n')),
        bankHash: bankHash(s, hash),
        heroHash: heroHash(s, hash),
        spriteHash: spriteHash(s, hash),
        binHash: binHash(s, hash),
        randomDraws: globalThis.__bench.draws()
    };
}
