import { KEYWORD, makeStatement, renderStatement, upkeepLine } from '../../utils/constants';

/**
 * ⭐ **The whole vocabulary, said aloud, for the owner to mark up.**
 *
 * Owner's brief (2026-09-12): *"generate a list of proposed rules effects in the
 * prototype and I point out what needs to be changed."*
 *
 * ⚠️ **Every sentence here is produced by the REAL renderer at render time**, not
 * pasted in. So this page cannot drift from the game, and the moment a wording
 * is fixed the gallery shows the fix. A gallery of hand-written examples would
 * be a second renderer, and would start lying the first time either changed.
 *
 * The `note` on a row is something I believe is wrong with the WORDING, for the
 * owner to confirm or overrule. `bug` means the sentence can state the opposite
 * of the rule, which is a different and more serious thing.
 */

const names = {
    token: (id) => ({ fixture_producer: 'Oak Tree', fixture_seafood_producer: 'Shrimp Pool' }[id] || id),
    item: (id) => ({ fixture_oak_wood: 'Oak Wood', item_raw_shrimp: 'Raw Shrimp' }[id] || id),
    effect: (id) => ({ fixture_effect_thorns: 'Thorns' }[id] || id),
};

const S = (kw, extra = {}) => ({ ...makeStatement(kw), ...extra });
const prov = (type, value, bucket = 'flat', extra = {}) =>
    S(KEYWORD.PROVIDES, { payload: { type, bucket, value }, ...extra });
const YLD = { type: 'YIELD', bucket: 'percentage', value: 0.25 };
const at = (event, scope, extra = {}) => ({ when: { event, scope, ...extra } });

const GROUPS = [
    {
        title: 'Moments — when a rule fires',
        rows: [
            { s: S(KEYWORD.DEALS, { payload: { amount: 1 }, ...at('SELF_CYCLE_COMPLETE', 'self') }) },
            { s: S(KEYWORD.DEALS, { payload: { amount: 1 }, ...at('SELF_CYCLE_START', 'self') }) },
            { s: S(KEYWORD.DEALS, { payload: { amount: 1 }, ...at('CYCLE_COMPLETE', 'adjacent') }) },
            { s: S(KEYWORD.DEALS, { payload: { amount: 1 }, ...at('CYCLE_START', 'adjacent') }) },
            { s: S(KEYWORD.DEALS, { payload: { amount: 1 }, ...at('SELF_TOKEN_DEPLETED', 'self') }) },
            { s: S(KEYWORD.DEALS, { payload: { amount: 1 }, ...at('TOKEN_DEPLETED', 'adjacent') }) },
            {
                s: S(KEYWORD.DEALS, { payload: { amount: 1 }, ...at('SELF_COMBAT_ENGAGED', 'self') }),
                fixed: 'No more shouting (owner, 2026-09-12).',
            },
            { s: S(KEYWORD.DEALS, { payload: { amount: 1 }, ...at('COMBAT_ENGAGED', 'adjacent') }) },
            { s: S(KEYWORD.DEALS, { payload: { amount: 1 }, ...at('COMBAT_RESOLVED', 'adjacent') }) },
            {
                s: S(KEYWORD.DEALS, { payload: { amount: 1 }, ...at('ITEM_PRODUCED', 'adjacent') }),
                ruled: 'Owner: the ellipsis is fine — clicking it should open a SEARCH in the panel to pick the item. Recorded for P2/P3; nothing to change in the wording.',
            },
            { s: S(KEYWORD.DEALS, { payload: { amount: 1 }, ...at('ITEM_THRESHOLD', 'global', { watchItemId: 'fixture_oak_wood', threshold: 10 }) }) },
            { s: S(KEYWORD.DEALS, { payload: { amount: 1 }, ...at('EFFECT_TICK', 'self') }) },
        ],
    },
    {
        title: 'Production — what a Token makes',
        rows: [
            {
                s: prov('YIELD', 0.25, 'percentage'),
                note: 'You called this vague. It multiplies output quantity, and the fraction is rolled as a chance — 2 becomes 2, or 3 a quarter of the time. The sentence says none of that.',
            },
            { s: prov('YIELD', 1) },
            {
                s: prov('LOOT_MULT', 25),
                fixed: 'Now a thing that happens rather than a noun.',
            },
            {
                s: prov('LOOT_MULT', -25),
                fixed: 'The sign survives now — compare with the line above.',
            },
            {
                s: prov('FAIL_CHANCE', -10),
                fixed: 'Was the exact opposite of the rule. An axis now owns its wording in BOTH directions.',
            },
            {
                s: prov('WORK_TIME', -0.20, 'percentage'),
                fixed: 'Owner: "Works 20% faster is better terminology."',
            },
            {
                s: prov('INPUT_COST', -1),
                gap: 'Owner wants "Adjacent tokens consume 1 less Charcoal". ⚠️ Not a wording fix — this axis has no item at all. It applies to EVERY input equally, so naming one is a capability the grammar does not have. Needs its own slice.',
            },
            {
                s: prov('XP_BONUS', 0.5, 'percentage'),
                fixed: 'The doubled noun is gone.',
            },
            {
                s: prov('BONUS_DROP', 25, 'flat', { payload: { type: 'BONUS_DROP', bucket: 'flat', value: 25, itemId: 'item_raw_shrimp' } }),
                fixed: 'It names the item now — and this is your second example, verbatim.',
            },
        ],
    },
    {
        title: 'Combat',
        rows: [
            {
                s: prov('ARMOR', 3),
                note: 'Every combat rule carries this 17-word disclaimer. It is also now OUT OF DATE — since enemies became effect bearers, a monster carries its own armour.',
            },
            { s: prov('RESIST_FLAT', 2) },
            { s: prov('ACCURACY', -25) },
            { s: prov('BLOCK', 10) },
            { s: prov('DAMAGE', 4) },
            { s: prov('DAMAGE', 0.10, 'percentage') },
        ],
    },
    {
        title: 'Verbs — what a rule does',
        rows: [
            {
                s: S(KEYWORD.GRANTS, { payload: { itemId: 'item_raw_shrimp', quantity: 1, chance: 25 } }),
                note: '⭐ This is your other example — "25% chance to drop 1 Raw Shrimp" — and it already reads well.',
            },
            { s: S(KEYWORD.DEALS, { payload: { amount: 2, ignoresArmor: true } }) },
            { s: S(KEYWORD.HEALS, { payload: { amount: 5 } }) },
            { s: S(KEYWORD.RESTORES, { payload: { amount: 1 } }) },
            { s: S(KEYWORD.REMOVES, { payload: { effectId: 'fixture_effect_thorns' } }) },
            { s: S(KEYWORD.SPAWNS, { payload: { typeId: 'fixture_producer', placement: 'here' } }) },
            { s: S(KEYWORD.SPAWNS, { payload: { typeId: 'fixture_producer', placement: 'nearest_free' } }) },
            { s: S(KEYWORD.TRANSFORMS, { payload: { typeId: 'fixture_producer' } }) },
            { s: S(KEYWORD.APPLIES, { payload: { effectId: 'fixture_effect_thorns', scale: 2, durationMs: 30000, chance: 40 } }) },
        ],
    },
    {
        title: 'Who it reaches',
        rows: [
            { s: prov('YIELD', 0.25, 'percentage', { to: { mode: 'all' }, reach: 'self' }) },
            { s: prov('YIELD', 0.25, 'percentage', { payload: YLD, to: { mode: 'tag', value: 'Coast' }, reach: 'adjacent' }) },
            { s: prov('YIELD', 0.25, 'percentage', { payload: YLD, to: { mode: 'id', value: 'fixture_producer' } }) },
            { s: prov('YIELD', 0.25, 'percentage', { payload: YLD, to: { mode: 'all' }, reach: 'board' }) },
            { s: prov('YIELD', 0.25, 'percentage', { payload: YLD, to: { mode: 'all', filters: [{ kind: 'worked' }] } }) },
            { s: prov('YIELD', 0.25, 'percentage', { payload: YLD, to: { mode: 'all', filters: [{ kind: 'is_station', not: true }] } }) },
            { s: prov('YIELD', 0.25, 'percentage', { payload: YLD, to: { mode: 'all', filters: [{ kind: 'charges_below', value: 3 }] } }) },
            {
                s: prov('YIELD', 0.25, 'percentage', { payload: YLD, to: { mode: 'all', filters: [{ kind: 'tagged', value: 'Wet' }, { kind: 'worked' }] } }),
                note: 'Two filters stack with no "and" between them. Deliberate (it avoids a number-agreement trap) — worth a look.',
            },
        ],
    },
    {
        title: 'Cost and cadence — the fine print',
        rows: [
            { s: S(KEYWORD.GRANTS, { payload: { itemId: 'fixture_oak_wood', quantity: 1 }, ...at('CYCLE_COMPLETE', 'adjacent', { cooldownMs: 10000 }) }) },
            {
                s: prov('YIELD', 0.25, 'percentage', { payload: YLD, upkeep: { items: [{ itemId: 'fixture_oak_wood', quantity: 1 }], cadenceMs: 30000 } }),
                extraLine: true,
                fixed: 'Owner: a separate line, and "consumes" rather than "costing". It used to be a trailing clause on a sentence about something else.',
            },
            {
                s: S(KEYWORD.GRANTS, { payload: { itemId: 'fixture_oak_wood', quantity: 1 }, chargeDelta: -2 }),
                note: 'Still open: this rule costs 2 charges and the sentence never says so, while a cooldown right above it does.',
            },
        ],
    },
];

/** Moments and readings that do not exist yet. Named, not invented. */
const GAPS = [
    ['When this enemy is dealt damage', 'Your example. Nothing fires on damage — the only combat moments are a fight beginning, a fight being won, and a hero engaging this enemy.'],
    ['When this enemy dies', 'A monster that leaves something behind on death has no moment to hang off. COMBAT_RESOLVED is adjacency-scoped — the neighbour hears it, the monster itself does not.'],
    ['When a hero is downed', 'Nothing reacts to losing.'],
    ['When a hero picks this up / drops it', 'An item can provide numbers, but nothing happens at the moment of equipping.'],
    ['When this Token is placed', 'No moment for arriving on the board — only for cycles, depletion and combat.'],
    ['A chance to double the loot of ONE named item', 'Double loot is per cycle and covers everything the Token made.'],
];

const SUBTLE = 'var(--color-border-subtle)';

const FLAGS = {
    bug: ['✗', 'var(--color-error)'],
    gap: ['⚠', 'var(--color-error)'],
    note: ['•', 'var(--color-warning)'],
    ruled: ['✓', 'var(--color-info)'],
    fixed: ['✓', 'var(--color-success)'],
};

function Row({ row }) {
    const sentence = renderStatement(row.s, names);
    const kind = ['bug', 'gap', 'note', 'ruled', 'fixed'].find((k) => row[k]);
    const [mark, colour] = FLAGS[kind] || [];

    return (
        <div style={{ padding: '7px 0', borderBottom: `1px solid ${SUBTLE}` }}>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-primary)' }}>
                {sentence}
            </div>
            {row.extraLine && upkeepLine(row.s, names) && (
                <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-primary)' }}>
                    {upkeepLine(row.s, names)}
                </div>
            )}
            {kind && (
                <div style={{ fontSize: 11, lineHeight: 1.5, color: colour, marginTop: 3, paddingLeft: 14, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0 }}>{mark}</span>
                    {row[kind]}
                </div>
            )}
        </div>
    );
}

export default function VocabularyGallery() {
    const all = GROUPS.flatMap((g) => g.rows);
    const fixed = all.filter((r) => r.fixed).length;
    const open = all.filter((r) => r.bug || r.note || r.gap).length;

    return (
        <div style={{ marginTop: 36, borderTop: `2px solid var(--color-border-default)`, paddingTop: 22 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: 'var(--color-text-primary)' }}>
                The whole vocabulary, said aloud
            </h2>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', maxWidth: 820, lineHeight: 1.65, marginBottom: 6 }}>
                Every sentence below is produced by the <b>real renderer</b>, live — not
                pasted in. So this page cannot drift from what the game prints, and a
                wording fix shows up here the moment it lands.
            </p>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', maxWidth: 820, lineHeight: 1.65, marginBottom: 18 }}>
                <span style={{ color: 'var(--color-success)' }}>✓ {fixed} fixed from your notes</span>
                {'  ·  '}
                <span style={{ color: 'var(--color-warning)' }}>{open} still open</span>
                {'  ·  '}the rest are here for you to mark up.
            </p>

            {GROUPS.map((group) => (
                <div key={group.title} style={{ marginBottom: 26 }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--color-accent-hover)', marginBottom: 6 }}>
                        {group.title}
                    </div>
                    {group.rows.map((row, i) => <Row key={i} row={row} />)}
                </div>
            ))}

            <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                    Cannot be said yet
                </div>
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', maxWidth: 820, lineHeight: 1.6, marginBottom: 10 }}>
                    Things a designer might reasonably reach for that the grammar has no
                    words for. Listed rather than invented — each one is a decision, not
                    an oversight to be quietly filled in.
                </p>
                {GAPS.map(([what, why]) => (
                    <div key={what} style={{ padding: '6px 0', borderBottom: `1px solid ${SUBTLE}` }}>
                        <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{what}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.5, marginTop: 2 }}>{why}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
