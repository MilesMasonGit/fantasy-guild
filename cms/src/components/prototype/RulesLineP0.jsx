import { useState } from 'react';
import { KEYWORD, makeStatement, renderStatement } from '../../utils/constants';
import { StatementList } from '../editors/Statements';

/**
 * ⭐ **P0 — one look at the Rules Line, before anything is built on it.**
 *
 * Throwaway. Nothing here is wired: no editing, no state beyond which word is
 * pretending to be focused, no integration with the store. It exists to answer
 * the one complaint that cannot be settled by a test — *"too dense to read"* —
 * and the whole plan rests on the answer.
 *
 * ⚠️ **The left column is the REAL editor**, not a strawman recreation. It is
 * `StatementList` with the same statements, so the comparison is honest: if the
 * new line looks better here, it is beating the actual thing it replaces.
 *
 * ## What the segments are
 * Hand-written, and deliberately so. P1 is what teaches `renderStatement` to emit
 * them. Each rule prints the real renderer's output beneath it, so you can see at
 * a glance whether the hand-written segments join back to the same sentence —
 * which is the guarantee P1 has to keep for every rule in the game.
 *
 * Reachable at `?p0=1`. Delete this directory when the real thing lands.
 */

/** A word in the line that stands for a decision. */
const D = (text, slot, options) => ({ text, slot, options });
/** Connective tissue — belongs to the sentence, is not a decision. */
const T = (text) => ({ text });

/**
 * Four rules of escalating complexity.
 *
 * ⚠️ The roadmap said "a single `Deals` rule". One simple rule is the flattering
 * case and would not test the complaint at all — density only shows up on a rule
 * with a computed magnitude, a filter and a counted selector. The last two are
 * the ones to judge.
 */
const RULES = [
    {
        id: 'simple',
        statement: { ...makeStatement(KEYWORD.DEALS), payload: { amount: 2 } },
        segments: [
            T('When '),
            D("this Token's own cycle completes", 'moment', [
                ["this Token's own cycle completes", 'The moment this Token finishes its own work.'],
                ['a neighbour completes a cycle', 'An adjacent Token finishes work — or wins a fight.'],
                ['this Token spends its last charge', 'As this Token leaves the board.'],
                ['a hero engages this enemy', 'The moment a fight starts on this tile.'],
            ]),
            T(', deals '),
            D('2', 'amount', null),
            T(' damage to '),
            D('the hero', 'role', [
                ['the hero', 'Whoever worked this Token, or won the fight.'],
                ['itself', 'The Token or creature carrying the rule.'],
                // ⚠️ Was written as "the source" here, which is not a label the
                // game uses anywhere — `ROLES` calls it this. A prototype that
                // invents vocabulary is testing a sentence nobody would see.
                ['that Token', 'The neighbour whose event this was — the Token that finished, not the hero who worked it.'],
            ]),
            T('.'),
        ],
        fine: { charge: '1 charge', cooldown: 'no cooldown', chance: 'always' },
    },
    {
        id: 'provides',
        statement: {
            ...makeStatement(KEYWORD.PROVIDES),
            payload: { type: 'YIELD', bucket: 'percentage', value: 0.25 },
            to: { mode: 'tag', value: 'Coast' },
            reach: 'adjacent',
        },
        segments: [
            T('Provides '),
            D('25%', 'value', null),
            T(' '),
            D('more yield', 'type', [
                ['more yield', 'How much a Token produces per cycle.'],
                ['more speed', 'How fast a cycle completes.'],
                ['more armor', 'Flat damage subtracted from every hit.'],
                ['more damage', 'Outgoing damage in a fight.'],
            ]),
            T(' to '),
            D('adjacent', 'reach', [
                ['adjacent', 'The eight squares touching this one.'],
                ['this Token only', 'Itself, and nothing around it.'],
                ['adjacent and this', 'Both.'],
                ['the whole board', 'Every square in play.'],
            ]),
            T(' '),
            D('Coast', 'filter', [
                ['Coast', 'Tokens tagged Coast.'],
                ['every', 'No filter — all of them.'],
                ['stations', 'Only Tokens that are stations.'],
                ['ones being worked', 'Only Tokens a hero is standing on.'],
            ]),
            T(' Tokens.'),
        ],
        fine: { charge: 'free', cooldown: '—', chance: 'always' },
    },
    {
        id: 'stat',
        statement: {
            ...makeStatement(KEYWORD.DEALS),
            payload: { amount: 10, magnitude: 'stat', stat: 'actor_max_hp' },
        },
        segments: [
            T('When '),
            D("this Token's own cycle completes", 'moment', null),
            T(', deals damage equal to '),
            D('10%', 'amount', null),
            T(' of '),
            D("the hero's max HP", 'stat', [
                ["the hero's max HP", 'Scales with how tough they are.'],
                ["the hero's current HP", 'Scales with how healthy they are right now.'],
                ["the hero's level", 'Scales with progression.'],
                ['this Token’s charges left', 'Scales with how worn out it is.'],
            ]),
            T(' to '),
            D('the hero', 'role', null),
            T('.'),
        ],
        fine: { charge: '1 charge', cooldown: 'no cooldown', chance: 'always' },
    },
    {
        id: 'counted',
        statement: {
            ...makeStatement(KEYWORD.DEALS),
            payload: { amount: 1, magnitude: 'count', ignoresArmor: true },
            counted: { mode: 'tag', value: 'Coast', reach: 'board' },
        },
        segments: [
            T('When '),
            D("this Token's own cycle completes", 'moment', null),
            T(', deals '),
            D('1', 'amount', null),
            T(' damage per '),
            D('adjacent Coast Token', 'counted', [
                ['adjacent Coast Token', 'Counted around this Token, not around the target.'],
                ['Token on the board', 'Every Token in play.'],
                ['adjacent station', 'Only stations beside this one.'],
            ]),
            T(' to '),
            D('the hero', 'role', null),
            T(', '),
            D('ignoring armour', 'ignoresArmor', [
                ['ignoring armour', 'Pierces regardless of what they are wearing.'],
                ['(respecting armour)', 'Armour reduces it, and can stop it entirely.'],
            ]),
            T('.'),
        ],
        fine: { charge: '1 charge', cooldown: 'no cooldown', chance: 'always' },
    },
];

const BORDER = 'var(--color-border-default)';
const SUBTLE = 'var(--color-border-subtle)';

function Word({ seg, focused, onFocus }) {
    if (!seg.slot) return <span style={{ color: 'var(--color-text-secondary)' }}>{seg.text}</span>;
    return (
        <button
            type="button"
            onClick={onFocus}
            style={{
                color: focused ? 'var(--color-bg-deep)' : 'var(--color-text-primary)',
                background: focused ? 'var(--color-accent-hover)' : 'transparent',
                borderBottom: focused ? '1px solid transparent' : `1px dashed ${BORDER}`,
                borderRadius: focused ? 3 : 0,
                padding: focused ? '1px 4px' : '1px 0',
                margin: focused ? '0 -1px' : 0,
                font: 'inherit',
                cursor: 'text',
            }}
        >
            {seg.text}
        </button>
    );
}

function Line({ rule, focusedSlot, setFocusedSlot, fineInLine }) {
    const joined = rule.segments.map((s) => s.text).join('');
    const real = renderStatement(rule.statement);
    const matches = joined === real;

    const fine = rule.fine;
    const inlineFine = fineInLine
        ? `  ·  spends ${fine.charge}, ${fine.cooldown}, fires ${fine.chance}`
        : '';

    return (
        <div style={{ marginBottom: 18 }}>
            <div
                style={{
                    background: 'var(--color-bg-base)',
                    border: `1px solid ${SUBTLE}`,
                    borderRadius: 6,
                    padding: '10px 12px',
                    fontSize: 14,
                    lineHeight: 1.7,
                }}
            >
                {rule.segments.map((seg, i) => (
                    <Word
                        key={i}
                        seg={seg}
                        focused={!!seg.slot && focusedSlot === `${rule.id}:${seg.slot}`}
                        onFocus={() => setFocusedSlot(`${rule.id}:${seg.slot}`)}
                    />
                ))}
                {inlineFine && (
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{inlineFine}</span>
                )}
            </div>

            {!fineInLine && (
                <div
                    style={{
                        display: 'flex',
                        gap: 14,
                        padding: '5px 12px',
                        fontSize: 11,
                        color: 'var(--color-text-muted)',
                    }}
                >
                    <span>spends <b style={{ color: 'var(--color-text-secondary)' }}>{fine.charge}</b></span>
                    <span>·</span>
                    <span>{fine.cooldown}</span>
                    <span>·</span>
                    <span>fires {fine.chance}</span>
                </div>
            )}

            {/*
              ⚠️ The check that matters for P1: the hand-written segments must
              join back to exactly what the real renderer prints. If this ever
              says NO, the prototype is showing a sentence the game would not.
            */}
            <div style={{ fontSize: 10, padding: '2px 12px', color: matches ? 'var(--color-success)' : 'var(--color-error)' }}>
                {matches ? '✓ joins to the real renderer output' : `✗ DRIFT — renderer says: ${real}`}
            </div>
        </div>
    );
}

function Panel({ focusedSlot }) {
    const [ruleId, slot] = (focusedSlot || '').split(':');
    const rule = RULES.find((r) => r.id === ruleId);
    const seg = rule?.segments.find((s) => s.slot === slot);
    const options = seg?.options;

    return (
        <div
            style={{
                width: 260,
                flexShrink: 0,
                border: `1px solid ${SUBTLE}`,
                borderRadius: 6,
                background: 'var(--color-bg-base)',
                padding: 12,
                alignSelf: 'flex-start',
                position: 'sticky',
                top: 12,
            }}
        >
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                What can go here
            </div>

            {!seg && (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                    Click any underlined word in a rule.
                </div>
            )}

            {seg && !options && (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                    <b style={{ color: 'var(--color-text-secondary)' }}>{seg.text}</b>
                    <div style={{ marginTop: 6 }}>
                        Options not written out for this slot in the prototype — the
                        real one reads them from the registries.
                    </div>
                </div>
            )}

            {options && (
                <>
                    <input
                        placeholder="type to narrow…"
                        readOnly
                        style={{
                            width: '100%', fontSize: 12, marginBottom: 10, padding: '4px 6px',
                            background: 'var(--color-bg-surface)', border: `1px solid ${BORDER}`,
                            borderRadius: 4, color: 'var(--color-text-primary)',
                        }}
                    />
                    {options.map(([label, hint]) => (
                        <div key={label} style={{ marginBottom: 9 }}>
                            <div style={{ fontSize: 12.5, color: label === seg.text ? 'var(--color-accent-hover)' : 'var(--color-text-primary)' }}>
                                {label === seg.text ? '● ' : '○ '}{label}
                            </div>
                            <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', lineHeight: 1.5, paddingLeft: 14 }}>
                                {hint}
                            </div>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}

export default function RulesLineP0() {
    const [focusedSlot, setFocusedSlot] = useState('simple:role');
    const [fineInLine, setFineInLine] = useState(false);
    const [showToday, setShowToday] = useState(true);

    // The real editor needs statements with ids and an onChange it can call.
    const [todayStatements, setTodayStatements] = useState(
        RULES.slice(0, 2).map((r, i) => ({ ...r.statement, id: `p0_${i}` }))
    );

    return (
        <div style={{ padding: 20, height: '100%', overflow: 'auto', color: 'var(--color-text-primary)' }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                The Rules Line — P0
            </h1>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4, maxWidth: 760, lineHeight: 1.6 }}>
                Nothing here is wired. Clicking a word moves the panel; it does not
                change anything. The question this is here to answer is whether the
                line <i>reads as a sentence</i>.
            </p>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 16, maxWidth: 760, lineHeight: 1.6 }}>
                The last two rules are the ones to judge — a computed magnitude and a
                counted selector are where density actually shows up.
            </p>

            <div style={{ display: 'flex', gap: 16, marginBottom: 20, fontSize: 12 }}>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="checkbox" checked={fineInLine} onChange={(e) => setFineInLine(e.target.checked)} />
                    Put cost and cadence <b>in</b> the sentence
                </label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="checkbox" checked={showToday} onChange={(e) => setShowToday(e.target.checked)} />
                    Show today&rsquo;s editor beside it
                </label>
            </div>

            {/*
              ⚠️ The panel is on the LEFT (owner, 2026-09-12). Not cosmetic: the
              eye starts at the left margin, so what-can-go-here is read before
              the sentence rather than after it — and the lines keep a straight
              left edge to read down, which they lose when a variable-width
              panel sits in front of them.
            */}
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                <Panel focusedSlot={focusedSlot} />

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--color-accent-hover)', marginBottom: 10 }}>
                        Proposed
                    </div>
                    {RULES.map((rule) => (
                        <Line
                            key={rule.id}
                            rule={rule}
                            focusedSlot={focusedSlot}
                            setFocusedSlot={setFocusedSlot}
                            fineInLine={fineInLine}
                        />
                    ))}
                </div>
            </div>

            {showToday && (
                <div style={{ marginTop: 32, borderTop: `1px solid ${SUBTLE}`, paddingTop: 20 }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                        Today, for the first two rules
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 12, maxWidth: 760, lineHeight: 1.6 }}>
                        This is the real editor, not a recreation — the same component the
                        CMS renders, given the same two statements.
                    </p>
                    <StatementList statements={todayStatements} onChange={setTodayStatements} />
                </div>
            )}
        </div>
    );
}
