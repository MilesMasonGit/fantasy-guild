import isEqual from 'fast-deep-equal/es6';

const hasOwn = Object.prototype.hasOwnProperty;

function isPlainObject(v) {
    if (v === null || typeof v !== 'object') return false;
    const proto = Object.getPrototypeOf(v);
    return proto === Object.prototype || proto === null;
}

/** The fields a record in a selected list is known by, in the order they are tried. */
const KEY_FIELDS = ['id', 'heroId', 'instanceId'];

function keyFieldOf(record) {
    for (const f of KEY_FIELDS) {
        const v = record[f];
        if (typeof v === 'string' || typeof v === 'number') return f;
    }
    return null;
}

function indexByKey(list, field) {
    const map = new Map();
    for (const item of list) {
        if (isPlainObject(item) && !map.has(item[field])) map.set(item[field], item);
    }
    return map;
}

/**
 * `next`, with every part that equals the same part of `prev` (by value, as `fast-deep-equal`
 * compares) replaced by `prev`'s own object. Returns `prev` itself when the two are equal.
 * A store hands its selected slice to React. A selector rebuilds its flat projection on every
 * read, so without this one changed flag in a list of eight hands all eight flags to React as
 * new objects, and every memoised child of every one of them draws again. With it, only the
 * changed element is new.
 * Arrays and plain objects are shared part by part, and copied only from the first difference
 * on (an equal read allocates nothing). A list of records that has shifted (one added, removed
 * or moved) pairs its records by `id`, `heroId` or `instanceId` instead of by place. Anything
 * else (a Map, a class instance) is kept whole when equal, else taken from `next`.
 * ⚠️ `prev`'s parts are reused as they are: never mutate a value a store handed out.
 */
export function shareEqual(prev, next) {
    if (prev === next) return prev;
    if (Array.isArray(next)) {
        if (!Array.isArray(prev)) return next;
        const n = next.length;
        let out = prev.length === n ? null : new Array(n);
        let byKey = null;
        let keyField = null;
        for (let i = 0; i < n; i++) {
            const x = next[i];
            let has = i < prev.length;
            let p = has ? prev[i] : undefined;
            if (isPlainObject(x)) {
                const f = keyFieldOf(x);
                if (f && !(has && isPlainObject(p) && p[f] === x[f])) {
                    if (!byKey || keyField !== f) { byKey = indexByKey(prev, f); keyField = f; }
                    has = byKey.has(x[f]);
                    p = byKey.get(x[f]);
                }
            }
            const v = has ? shareEqual(p, x) : x;
            if (out) out[i] = v;
            else if (v !== prev[i]) {
                out = prev.slice(0, i);
                out.length = n;
                out[i] = v;
            }
        }
        return out || prev;
    }
    if (isPlainObject(next)) {
        if (!isPlainObject(prev)) return next;
        const keys = Object.keys(next);
        let out = keys.length === Object.keys(prev).length ? null : {};
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            const had = hasOwn.call(prev, k);
            const v = had ? shareEqual(prev[k], next[k]) : next[k];
            if (out) out[k] = v;
            else if (!had || v !== prev[k]) {
                out = {};
                for (let j = 0; j < i; j++) out[keys[j]] = prev[keys[j]];
                out[k] = v;
            }
        }
        return out || prev;
    }
    return isEqual(prev, next) ? prev : next;
}
