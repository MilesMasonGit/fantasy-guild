import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { CloseX, CLOSE_X_PX } from '../base/CloseX.jsx';
import { KitButton, KIT_BUTTON_TONE } from '../base/KitButton.jsx';
import { ArrowScrollList, PixelTriangle } from '../base/ArrowScrollList.jsx';
import { SkillIcon } from '../base/SkillIcon.jsx';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { VitalBar } from '../base/VitalBar.jsx';
import { TokenSprite, TOKEN_SURFACE, tokenSizeFor } from '../base/TokenSprite.jsx';
import { AnimatedHeroSprite } from '../board/AnimatedHeroSprite.jsx';
import { AnimatedEnemySprite } from '../board/AnimatedEnemySprite.jsx';
import { SpeechFrame } from '../board/SpeechFrame.jsx';
import { COMBAT_ATTACK_EVENT } from '../board/TokenHitArt.jsx';
import { isRealAttack } from '../board/hitAnimations.js';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { CombatGlyph } from './CombatGlyph.jsx';
import { GLYPH_COLOUR, damageTypeGlyph } from './combatGlyphs.js';
import { fightsOf, subscribeFights, subscribeMoments, startFightWatch, TONE, OUTCOME, MOMENT } from './fightWatch.js';
import { HitParts, ResistChips, resistTip } from './CombatStatParts.jsx';
import { fightPanelView, levelText, secondsText, styleName, clockText, damageText, damageTypeName } from './fightView.js';
import { t } from '../../../i18n/index.js';

/**
 * The fight window (owner's pick B, "the slim card", 2026-11-05): one narrow column. A title bar
 * ("Kira vs Goblin", minimize, close) that drags the window; the battle, the owner's battlefield
 * with both fighters at twice their art, the hero on the left facing right, a health bar with its
 * numbers over each and what just landed (the number, Crit!, Miss, Weak! or Resisted with the
 * hit's types; an enemy's move in a speech bubble over its bar); the stat block, one row a stat with
 * its icon in a shared middle column between the hero's value and the enemy's (style and level,
 * hit with its types, swing, resistances); the enemy's attacks, the last one
 * marked; what is on each fighter in two columns; the hero's elixirs with the fights each has
 * left; and the log, closed until asked for. Held by `FightPanelPopup`, one per hero.
 */

/** The window's width inside its frame, and the battle's size. */
export const PANEL_W = 344;
const ARENA_H = 216;
/** Fighters at twice their 64 px art. */
const FIGHTER_K = 2;
const FIGHTER_PX = 64 * FIGHTER_K;
const BATTLEFIELD = '/assets/backgrounds/invasion/b_invasion_battlefield.png';
const BATTLEFIELD_PX = 256 * 2;
/** Each fighter's bar over its head. */
const BAR_W = 112;
const BAR_H = 14;
/** Where each fighter stands: a quarter in from each side. */
const HERO_X = Math.round(PANEL_W / 4 - FIGHTER_PX / 2 + 4);
const ENEMY_CX = Math.round((3 * PANEL_W) / 4 - 4);
/** How long what just landed shows over a fighter, and an enemy's move over its bar. */
const LANDED_MS = 700;
const MOVE_MS = 1400;
/** About two log rows a press of an arrow. */
const LOG_STEP_PX = 40;

const TONE_COLOUR = Object.freeze({
    [TONE.HIT]: 'var(--color-ui-white)', [TONE.HURT]: 'var(--color-ui-red)', [TONE.HEAL]: 'var(--color-ui-green)',
    [TONE.MISS]: 'var(--color-ui-muted)', [TONE.NOTE]: 'var(--color-gi-text)'
});
const TONE_GLYPH = Object.freeze({
    [TONE.HIT]: GLYPH_COLOUR.text, [TONE.HURT]: GLYPH_COLOUR.red, [TONE.HEAL]: GLYPH_COLOUR.green,
    [TONE.MISS]: GLYPH_COLOUR.muted, [TONE.NOTE]: GLYPH_COLOUR.text
});

// ---------------------------------------------------------------------------------------------
// The battle
// ---------------------------------------------------------------------------------------------

/** When this hero's last real swing began, as the mat's figure plays it (`MatHero`). */
function useLastSwingAt(heroId, live) {
    const [at, setAt] = useState(null);
    useEffect(() => {
        if (!live || !heroId) return undefined;
        return EventBus.subscribe(COMBAT_ATTACK_EVENT, (p) => {
            if (p?.heroId !== heroId || !isRealAttack(p)) return;
            setAt(typeof performance !== 'undefined' ? performance.now() : Date.now());
        }, UI_LISTENER);
    }, [heroId, live]);
    return live ? at : null;
}

/**
 * What just landed in this hero's fight, for the battle: the last moment on each side, and the
 * enemy's last named move, each gone after a moment. Only while the window is drawn and the fight
 * is live, so a minimized window or a finished fight listens to nothing.
 */
function useLanded(heroId, live) {
    const [landed, setLanded] = useState({ hero: null, enemy: null, move: null });
    useEffect(() => {
        if (!live || !heroId) return undefined;
        const timers = new Map();
        let n = 0;
        const show = (slot, value, ms) => {
            clearTimeout(timers.get(slot));
            setLanded(prev => ({ ...prev, [slot]: value }));
            timers.set(slot, setTimeout(() => setLanded(prev => (prev[slot] === value ? { ...prev, [slot]: null } : prev)), ms));
        };
        const off = subscribeMoments((m) => {
            if (m?.heroId !== heroId) return;
            if (m.move) show('move', { text: m.move, n: ++n }, MOVE_MS);
            if (m.kind === MOMENT.MOVE) return;
            show(m.on === 'hero' ? 'hero' : 'enemy', m, LANDED_MS);
        });
        return () => {
            off();
            for (const id of timers.values()) clearTimeout(id);
        };
    }, [heroId, live]);
    return live ? landed : { hero: null, enemy: null, move: null };
}

/** A moment over its fighter: the number (or Miss, or Crit! over it), Weak! or Resisted, the hit's types. */
const Landed = ({ m, cx, bottom }) => {
    if (!m) return null;
    const heal = m.kind === MOMENT.HEAL;
    const colour = heal ? 'var(--color-ui-green)' : m.on === 'hero' ? 'var(--color-ui-red)' : 'var(--color-ui-white)';
    const glyphColour = heal ? GLYPH_COLOUR.green : m.on === 'hero' ? GLYPH_COLOUR.red : GLYPH_COLOUR.white;
    const verdict = m.verdict === 'weak' ? t('fight.float.weak') : m.verdict === 'resisted' ? t('fight.float.resisted') : null;
    return (
        <div
            data-fight-landed={m.on}
            data-fight-landed-kind={m.kind}
            className="absolute flex flex-col items-center pointer-events-none font-bold leading-none whitespace-nowrap"
            style={{ left: cx, bottom, transform: 'translateX(-50%)' }}
        >
            {m.kind === MOMENT.CRIT && <span className="ui-text-small" style={{ color: 'var(--color-ui-gold)' }}>{t('fight.float.crit')}</span>}
            {verdict && (
                <span className="ui-text-small" data-fight-landed-verdict={m.verdict} style={{ color: m.verdict === 'weak' ? 'var(--color-ui-gold)' : 'var(--color-ui-muted)' }}>
                    {verdict}
                </span>
            )}
            <span className="inline-flex items-center gap-1 ui-text-title" style={{ color: colour }}>
                {m.kind === MOMENT.MISS ? t('fight.float.miss') : `${heal ? '+' : ''}${m.amount ?? ''}`}
                {(m.types || []).map(type => (
                    <span key={type} className="inline-flex" data-fight-landed-type={type}>
                        <CombatGlyph name={damageTypeGlyph(type)} colour={glyphColour} />
                    </span>
                ))}
            </span>
        </div>
    );
};

/**
 * The battle: the owner's battlefield picture at 2×, the hero at the left facing right and the
 * enemy at the right facing left, both at twice their art (an enemy drawn twice as large again at
 * 1×), each with its health bar and numbers over its head. The hero idles and swings once per
 * real swing; an enemy with an animation sheet plays its fight cycle as on the mat, one without
 * stands still (every enemy but the Cow today).
 */
export const FightArena = ({ view }) => {
    const { hero, enemy, live } = view;
    const attackAt = useLastSwingAt(view.heroId, live);
    const landed = useLanded(view.heroId, live);
    const artPx = tokenSizeFor(TOKEN_SURFACE.INSPECT, enemy.typeId);
    const enemyScale = Math.max(1, Math.floor(FIGHTER_PX / artPx));
    const enemyPx = enemy.sheet ? FIGHTER_PX : artPx * enemyScale;
    const heroCx = HERO_X + FIGHTER_PX / 2;
    const barBottom = Math.max(FIGHTER_PX, enemyPx) + 4;
    const landedBottom = FIGHTER_PX - 36;
    return (
        <div data-fight-arena className="relative overflow-hidden" style={{ width: PANEL_W, height: ARENA_H, background: '#1a1512' }}>
            <img
                src={BATTLEFIELD}
                alt=""
                draggable={false}
                className="absolute select-none pointer-events-none"
                style={{ left: -60, top: ARENA_H - BATTLEFIELD_PX, width: BATTLEFIELD_PX, height: BATTLEFIELD_PX, maxWidth: 'none', imageRendering: 'pixelated' }}
            />
            <div data-fight-fighter="hero" className="absolute" style={{ left: HERO_X, bottom: 2, width: FIGHTER_PX, height: FIGHTER_PX }}>
                {hero.art?.sheet ? (
                    <AnimatedHeroSprite src={hero.art.sheet} heroId={view.heroId} alt={hero.name} size={FIGHTER_PX} animationState={live ? 'combat' : 'idle'} attackAt={attackAt} />
                ) : hero.art?.still ? (
                    <img src={hero.art.still} alt={hero.name} draggable={false} style={{ width: FIGHTER_PX, height: FIGHTER_PX, maxWidth: 'none', imageRendering: 'pixelated' }} />
                ) : null}
            </div>
            <div
                data-fight-fighter="enemy"
                data-fight-enemy-moves={enemy.sheet ? 'true' : 'false'}
                className="absolute"
                style={{ left: ENEMY_CX - enemyPx / 2, bottom: 2, width: enemyPx, height: enemyPx }}
            >
                {enemy.sheet ? (
                    <AnimatedEnemySprite src={enemy.sheet} heroId={live ? view.heroId : null} facing={-1} alt={enemy.name} size={FIGHTER_PX} />
                ) : (
                    <TokenSprite typeId={enemy.typeId} surface={TOKEN_SURFACE.INSPECT} size={enemyPx} />
                )}
            </div>
            <Tooltip title={t('fight.tip.hp', { name: hero.name, cur: hero.hp.cur, max: hero.hp.max })}>
                <div className="absolute cursor-help" style={{ left: heroCx - BAR_W / 2, bottom: barBottom, width: BAR_W }}>
                    <VitalBar data-fight-hp="hero" value={hero.hp.cur} max={hero.hp.max} height={BAR_H} />
                </div>
            </Tooltip>
            <Tooltip title={t('fight.tip.hp', { name: enemy.name, cur: enemy.hp.cur, max: enemy.hp.max })}>
                <div className="absolute cursor-help" style={{ left: ENEMY_CX - BAR_W / 2, bottom: barBottom, width: BAR_W }}>
                    <VitalBar data-fight-hp="enemy" who="enemy" value={enemy.hp.cur} max={enemy.hp.max} height={BAR_H} />
                </div>
            </Tooltip>
            <Landed m={landed.hero} cx={heroCx} bottom={landedBottom} />
            <Landed m={landed.enemy} cx={ENEMY_CX} bottom={landedBottom} />
            {landed.move && (
                <SpeechFrame
                    tail
                    data-fight-landed-move={landed.move.text}
                    className="absolute ui-text-small font-bold whitespace-nowrap pointer-events-none"
                    style={{ left: ENEMY_CX, bottom: barBottom + BAR_H + 14, transform: 'translateX(-50%)' }}
                >
                    {landed.move.text}
                </SpeechFrame>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------------------------
// The stat block
// ---------------------------------------------------------------------------------------------

/** An enemy's hit: as a hit's parts for one type; for moves in several types, the hit and each type's glyph. */
const EnemyHit = ({ enemy }) => {
    const types = enemy.hitTypes?.length ? enemy.hitTypes : [enemy.hitType];
    if (types.length <= 1) return <HitParts parts={[{ type: types[0] ?? enemy.hitType, hit: enemy.hit }]} />;
    return (
        <span className="inline-flex items-center gap-1" data-fight-hit-parts>
            {damageText(enemy.hit)}
            {types.map(type => (
                <span key={type} className="inline-flex" data-fight-hit-type={type}>
                    <CombatGlyph name={damageTypeGlyph(type)} colour={GLYPH_COLOUR.text} />
                </span>
            ))}
        </span>
    );
};

/** What each of an enemy's moves does, one line each, for the hit's tooltip. */
const movesTip = (moves) => (moves?.length
    ? [t('fight.tip.enemyMoves'), ...moves.map(m => `${m.name}: ${[m.hits ? damageTypeName(m.type) : t('fight.moves.noHit'), m.effect].filter(Boolean).join(', ')}`)]
    : undefined);

/** A value in the stat block, bold, with its tooltip. */
const Value = ({ tip, lines, children, ...rest }) => (
    <Tooltip title={tip} lines={lines}>
        <span className="inline-flex items-center gap-1 font-bold tabular-nums text-white cursor-help" {...rest}>{children}</span>
    </Tooltip>
);

/**
 * One row of the stat block: the hero's value on the left, the stat's icon in the shared middle
 * column, the enemy's value on the right, so each pair reads across.
 */
const StatRow = ({ stat, icon, iconTip, hero, enemy }) => (
    <div className="grid grid-cols-[1fr_20px_1fr] gap-2.5 items-center ui-text-body" style={{ minHeight: 21 }} data-fight-stat={stat}>
        <span className="flex justify-end min-w-0" data-fight-side="hero">{hero}</span>
        <Tooltip title={iconTip}>
            <span className="flex justify-center cursor-help" data-fight-row-icon={stat}>{icon}</span>
        </Tooltip>
        <span className="flex justify-start min-w-0" data-fight-side="enemy">{enemy}</span>
    </div>
);

/** A side's style and level; its own style's icon beside the level when it is not the one in the middle. */
const StyleValue = ({ side, shown }) => {
    const style = styleName(side.style);
    return (
        <Value
            tip={style ? t('fight.tip.level', { name: side.name, style, level: levelText(side.level) }) : t(side.armed ? 'fight.tip.noStyleArmed' : 'fight.tip.noStyle', { name: side.name })}
            data-fight-style={side.style || 'none'}
        >
            {side.style && side.style !== shown ? <SkillIcon skill={side.style} size={16} /> : null}
            {side.style ? levelText(side.level) : '–'}
        </Value>
    );
};

/** A side's resistances with their tooltip. */
const ResistValue = ({ side, who }) => (
    <Value
        tip={who === 'hero' ? t('fight.tip.heroResists', { name: side.name }) : t('fight.tip.enemyResists', { name: side.name })}
        lines={resistTip(side.resists || [])}
    >
        <ResistChips lines={side.resists || []} />
    </Value>
);

/**
 * The stat block (owner's pick B, "the slim card"): one row per stat, its icon in a shared middle
 * column between the hero's value and the enemy's. The style row's icon is the hero's style (the
 * enemy's when the hero has none).
 */
export const FightStats = ({ view }) => {
    const { hero, enemy } = view;
    const shown = hero.style || enemy.style || null;
    const swing = (side) => (side.swingMs ? secondsText(side.swingMs) : '–');
    return (
        <div data-fight-card className="flex flex-col gap-px">
            <StatRow
                stat="style"
                icon={shown ? <SkillIcon skill={shown} size={16} /> : <span className="text-gi-muted">–</span>}
                iconTip={styleName(shown) || t('fight.panel.noStyle')}
                hero={<StyleValue side={hero} shown={shown} />}
                enemy={<StyleValue side={enemy} shown={shown} />}
            />
            <StatRow
                stat="hit"
                icon={<CombatGlyph name="hit" colour={GLYPH_COLOUR.text} />}
                iconTip={t('fight.window.hit')}
                hero={(
                    <Value tip={t('fight.tip.heroHit', { hit: damageText(hero.hit) })} lines={hero.hitLines}>
                        {hero.hitParts?.length ? <HitParts parts={hero.hitParts} /> : damageText(hero.hit)}
                    </Value>
                )}
                enemy={(
                    <Value tip={t('fight.tip.enemyHit', { hit: damageText(enemy.hit) })} lines={movesTip(enemy.moves)}>
                        <EnemyHit enemy={enemy} />
                    </Value>
                )}
            />
            <StatRow
                stat="swing"
                icon={<CombatGlyph name="clock" colour={GLYPH_COLOUR.text} />}
                iconTip={t('fight.window.swing')}
                hero={<Value tip={t('fight.tip.swing', { time: swing(hero) })}>{swing(hero)}</Value>}
                enemy={<Value tip={t('fight.tip.swing', { time: swing(enemy) })}>{swing(enemy)}</Value>}
            />
            <StatRow
                stat="resists"
                icon={<CombatGlyph name="shield" colour={GLYPH_COLOUR.text} />}
                iconTip={t('fight.window.resist')}
                hero={<ResistValue side={hero} who="hero" />}
                enemy={<ResistValue side={enemy} who="enemy" />}
            />
        </div>
    );
};

// ---------------------------------------------------------------------------------------------
// The enemy's attacks, the effects, the elixirs
// ---------------------------------------------------------------------------------------------

/** An attack: its type in a small dark tile (gold when it was the last one), its name, the type named. */
const Attack = ({ m, last }) => (
    <Tooltip
        title={m.name}
        lines={[m.hits ? damageTypeName(m.type) : t('fight.moves.noHit'), m.effect, m.share != null ? t('fight.moves.share', { n: m.share }) : null, last ? t('fight.moves.lastMove') : null]}
    >
        <div className="flex items-center gap-2 cursor-help" style={{ minHeight: 26 }} data-fight-move={m.name} data-fight-move-last={last ? 'true' : 'false'}>
            <span
                className="shrink-0 flex items-center justify-center"
                style={{ width: 24, height: 24, background: '#241a12', boxShadow: `inset 0 0 0 2px ${last ? GLYPH_COLOUR.gold : 'var(--color-ui-frame)'}` }}
            >
                <CombatGlyph name={m.hits ? damageTypeGlyph(m.type) : 'star'} colour={last ? GLYPH_COLOUR.gold : GLYPH_COLOUR.text} />
            </span>
            <span className={`ui-text-body font-bold ${last ? 'text-white' : 'text-gi-text'}`}>{m.name}</span>
            <span className="ui-text-small text-gi-muted">{m.hits ? damageTypeName(m.type) : t('fight.moves.noHit')}</span>
            {last && <span className="ml-auto ui-text-small" style={{ color: 'var(--color-ui-gold)' }}>{t('fight.window.justUsed')}</span>}
        </div>
    </Tooltip>
);

/** The enemy's attacks, the one its last swing made marked; an enemy without moves has its one plain swing. */
export const AttackList = ({ enemy }) => {
    const moves = enemy.moves?.length
        ? enemy.moves
        : [{ name: t('fight.moves.unnamed'), hits: true, type: enemy.hitType, effect: null, share: null }];
    return (
        <div data-fight-moves>
            <div className="ui-text-small text-gi-muted pb-0.5">{t('fight.window.attacks', { enemy: enemy.name })}</div>
            <div className="flex flex-col gap-0.5">
                {moves.map((m, i) => <Attack key={`${m.name}-${i}`} m={m} last={!!enemy.lastMove && m.name === enemy.lastMove} />)}
            </div>
            {enemy.kinds == null ? (
                <div className="ui-text-small text-gi-muted pt-0.5" data-fight-kinds="unknown">{t('fight.panel.unknownKinds')}</div>
            ) : enemy.kinds.length > 0 && (
                <div className="flex flex-wrap gap-x-3 pt-0.5 ui-text-small" data-fight-kinds="known">
                    <span className="text-gi-muted">{t('fight.card.kinds')}</span>
                    {enemy.kinds.map(k => (
                        <Tooltip key={k.id} title={k.name} lines={[k.tip]}>
                            <span className="font-bold text-white cursor-help" data-fight-kind={k.id}>{k.name}</span>
                        </Tooltip>
                    ))}
                </div>
            )}
        </div>
    );
};

/** A status and its stacks: `Venom ×2`, with its drop or flame. */
const StatusRow = ({ s }) => (
    <Tooltip
        title={`${s.name} ×${s.stacks}`}
        lines={[
            s.maxStacks ? t('fight.tip.stacksUpTo', { count: s.maxStacks }) : null,
            s.ticksLeft != null ? t('fight.tip.ticksLeft', { count: s.ticksLeft }) : t('fight.tip.untilFightEnds')
        ]}
    >
        <span className="flex items-center gap-1.5 ui-text-small cursor-help" style={{ minHeight: 20 }} data-fight-status={s.id}>
            <CombatGlyph name={s.icon} colour={GLYPH_COLOUR.red} />
            <span className="font-bold text-white">{s.name}</span>
            <span className="tabular-nums font-bold text-white">×{s.stacks}</span>
        </span>
    </Tooltip>
);

/** A lingering effect for the fight (an elixir's Valor, a boss's Enrage): a gold star and its name. */
const BuffRow = ({ name }) => (
    <span className="flex items-center gap-1.5 ui-text-small" style={{ minHeight: 20 }} data-fight-buff={name}>
        <CombatGlyph name="star" colour={GLYPH_COLOUR.gold} />
        <span className="font-bold text-white">{name}</span>
    </span>
);

const EffectColumn = ({ side, who }) => {
    const buffs = side.buffs || [];
    const none = side.statuses.length === 0 && buffs.length === 0;
    return (
        <div className="flex flex-col min-w-0" data-fight-effects={who}>
            <div className="ui-text-small text-gi-muted pb-0.5">{t('fight.window.on', { name: side.name })}</div>
            {none && <span className="ui-text-small text-gi-muted">{t('fight.window.none')}</span>}
            {side.statuses.map(s => <StatusRow key={s.id} s={s} />)}
            {buffs.map((b, i) => <BuffRow key={`${b}-${i}`} name={b} />)}
        </div>
    );
};

/** What is on each fighter, in two columns. */
export const FightEffects = ({ view }) => (
    <div className="grid grid-cols-2 gap-2">
        <EffectColumn side={view.hero} who="hero" />
        <EffectColumn side={view.enemy} who="enemy" />
    </div>
);

/** An elixir: its icon and how many fights it has left, the one under way counted. */
const ElixirChip = ({ e }) => (
    <Tooltip title={e.name} lines={[t('fight.tip.elixir', { item: e.name, count: e.count })]}>
        <span className="inline-flex items-center gap-0.5 cursor-help" data-fight-elixir={e.itemId}>
            <ItemIcon item={e.itemId} size={32} title={null} />
            <span className="ui-text-small font-bold tabular-nums text-white">{e.count}</span>
        </span>
    </Tooltip>
);

const Elixirs = ({ elixirs }) => (elixirs.length === 0
    ? <span className="ui-text-small text-gi-muted" data-fight-elixirs="none">{t('fight.window.noElixirs')}</span>
    : (
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1" data-fight-elixirs="some">
            {elixirs.map(e => <ElixirChip key={e.itemId} e={e} />)}
            <span className="ui-text-small text-gi-muted whitespace-nowrap">{t('fight.window.fightsLeft')}</span>
        </span>
    ));

// ---------------------------------------------------------------------------------------------
// The log
// ---------------------------------------------------------------------------------------------

/** What a finished fight's log heads with: how it ended and how long it took. */
function endText(record) {
    if (!record?.endedAt) return null;
    const time = clockText(record.endedAt - record.startedAt);
    if (record.outcome === OUTCOME.WON) return t('fight.panel.won', { enemy: record.enemyName, time });
    if (record.outcome === OUTCOME.LOST) return t('fight.panel.lost', { time });
    return t('fight.panel.left', { time });
}

const LogLine = ({ line }) => (
    <div className="flex items-center gap-1.5" data-fight-log-line={line.key}>
        <CombatGlyph name={line.icon} colour={line.icon === 'star' ? GLYPH_COLOUR.gold : TONE_GLYPH[line.tone]} />
        <span className="flex-1 min-w-0">
            {t(`fight.log.${line.key}`, line.vars)}
            {line.types?.length > 0 && (
                <span className="text-gi-muted" data-fight-log-types={line.types.join(' ')}> · {line.types.map(damageTypeName).join(' + ')}</span>
            )}
            {line.verdict && (
                <span data-fight-log-verdict={line.verdict} style={{ color: line.verdict === 'weak' ? 'var(--color-ui-gold)' : 'var(--color-ui-muted)' }}>
                    {' '}{t(line.verdict === 'weak' ? 'fight.float.weak' : 'fight.float.resisted')}
                </span>
            )}
        </span>
        {line.amount && <span className="tabular-nums font-bold" style={{ color: TONE_COLOUR[line.tone] }}>{line.amount}</span>}
    </div>
);

/** A record's log, newest first, scrolled with the arrow bars; its heading says how it ended. */
const LogList = ({ record, empty }) => {
    if (!record) return <div className="ui-text-small text-gi-muted px-1 py-2 text-center" data-fight-log-empty>{empty}</div>;
    const lines = [...record.log].reverse();
    const ended = endText(record);
    return (
        <div className="flex flex-col" data-fight-log-record={record.id}>
            {(ended || record.joinedLate) && (
                <div className="ui-text-small text-gi-muted px-1 pb-0.5" data-fight-log-heading>
                    {[ended, record.joinedLate ? t('fight.panel.joinedLate') : null].filter(Boolean).join(' · ')}
                </div>
            )}
            <ArrowScrollList step={LOG_STEP_PX} compact className="max-h-44 flex flex-col gap-0.5 ui-text-small text-gi-text px-1">
                {lines.map(line => <LogLine key={line.n} line={line} />)}
                {record.trimmed > 0 && <div className="text-gi-muted">{t('fight.panel.trimmed')}</div>}
            </ArrowScrollList>
        </div>
    );
};

const TAB = Object.freeze({ THIS: 'this', LAST: 'last' });

/** The two tabs: a word each, the open one bright with a gold line under it (UI_STYLE "Tabs"). */
const LogTabs = ({ tab, onTab }) => (
    <div className="flex items-end gap-3 px-1" role="tablist">
        {[TAB.THIS, TAB.LAST].map(id => (
            <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                data-fight-log-tab={id}
                onClick={() => onTab(id)}
                className={`ui-text-small font-bold pb-0.5 border-b-2 bg-transparent cursor-pointer ${tab === id ? 'text-white border-[var(--color-ui-gold)]' : 'text-gi-muted border-transparent hover:text-white'}`}
            >
                {id === TAB.THIS ? t('fight.panel.thisFight') : t('fight.panel.lastFight')}
            </button>
        ))}
    </div>
);

/** The log, when asked for: the This fight / Last fight switch and the chosen fight's whole log. */
export const FightLog = ({ fights, open, tab, onTab }) => (
    <div className="flex flex-col gap-1" data-fight-log={open ? 'open' : 'closed'}>
        {open && <LogTabs tab={tab} onTab={onTab} />}
        {open && (
            tab === TAB.THIS
                ? <LogList record={fights.current} empty={t('fight.panel.noFight')} />
                : <LogList record={fights.last} empty={t('fight.panel.noLastFight')} />
        )}
    </div>
);

// ---------------------------------------------------------------------------------------------
// The window
// ---------------------------------------------------------------------------------------------

/** The minimize button, the close X's size: a gold bar at its foot, drawn in code. */
export const MinimizeButton = ({ onClick, label = t('fight.window.minimize'), ...rest }) => (
    <button
        type="button"
        aria-label={label}
        title={label}
        onClick={onClick}
        className="ui-icon-button shrink-0 relative p-0 bg-transparent border-0 cursor-pointer"
        style={{ width: CLOSE_X_PX, height: CLOSE_X_PX }}
        {...rest}
    >
        <span aria-hidden="true" className="absolute" style={{ left: 6, right: 6, bottom: 6, height: 6, background: '#000' }} />
        <span aria-hidden="true" className="absolute" style={{ left: 8, right: 8, bottom: 8, height: 2, background: GLYPH_COLOUR.gold }} />
    </button>
);

/** How the hero's last fight ended, for a window or tab between fights: Won, Lost, or nothing. */
export function resultWord(outcome) {
    if (outcome === OUTCOME.WON) return { text: t('fight.window.won'), colour: 'var(--color-ui-green)' };
    if (outcome === OUTCOME.LOST) return { text: t('fight.window.lost'), colour: 'var(--color-ui-red)' };
    return null;
}

/** "Kira vs Goblin": the two names, "vs" muted. */
const Title = ({ hero, enemy }) => (
    <span className="min-w-0 ui-text-title font-bold tracking-wide text-gi-text whitespace-nowrap overflow-hidden" data-fight-title>
        {hero} <span className="text-gi-muted">{t('fight.panel.versus')}</span> {enemy}
    </span>
);

const BREAK = <div aria-hidden="true" className="h-0.5 bg-white/10" />;

/**
 * The window as drawn from a view (`fightView.fightPanelView`) and the hero's fights.
 * `onDragStart(pointerEvent)` is handed the title bar's press, to move the window.
 */
export const FightPanelView = ({ view, fights, onClose, onMinimize = null, onDragStart = null, logOpen, onToggleLog, tab, onTab }) => {
    const result = view.ended ? resultWord(view.ended.outcome) : null;
    return (
        <PixelFrame kind={FRAME_KIND.CHAMFER} backdrop="fight" data-fight-panel={view.heroId} data-fight-live={view.live ? 'true' : 'false'} style={{ width: PANEL_W + 12 }}>
            <div className="relative flex flex-col" style={{ width: PANEL_W }}>
                <div
                    data-fight-titlebar
                    className="flex items-center gap-1 pl-1 pb-1 select-none"
                    style={{ cursor: onDragStart ? 'move' : undefined, touchAction: 'none' }}
                    onPointerDown={onDragStart ? (e) => { if (!e.target.closest('button')) onDragStart(e); } : undefined}
                >
                    <Title hero={view.hero.name} enemy={view.enemy.name} />
                    <span className="flex-1" />
                    {result && <span className="ui-text-small font-bold whitespace-nowrap" data-fight-result={view.ended.outcome} style={{ color: result.colour }}>{result.text}</span>}
                    {onMinimize && <MinimizeButton onClick={onMinimize} data-fight-minimize={view.heroId} />}
                    {onClose && <CloseX onClick={onClose} data-fight-close={view.heroId} />}
                </div>
                <FightArena view={view} />
                <div className="flex flex-col gap-1.5 px-1 pt-1.5 pb-0.5">
                    <FightStats view={view} />
                    {BREAK}
                    <AttackList enemy={view.enemy} />
                    {BREAK}
                    <FightEffects view={view} />
                    {BREAK}
                    <div className="flex items-center justify-between gap-2">
                        <Elixirs elixirs={view.hero.elixirs} />
                        <KitButton tone={KIT_BUTTON_TONE.PLAIN} onClick={onToggleLog} buttonClassName="ui-text-small" data-fight-log-toggle={logOpen ? 'open' : 'closed'}>
                            {t('fight.window.log')}
                            <span className="text-current"><PixelTriangle dir={logOpen ? 'up' : 'down'} /></span>
                        </KitButton>
                    </div>
                    {logOpen && BREAK}
                    <FightLog fights={fights} open={logOpen} tab={tab} onTab={onTab} />
                </div>
            </div>
        </PixelFrame>
    );
};

/**
 * The live window on `heroId`'s fights: drawn again when the fight watch hears something about
 * them, and no other time (no clock). The log starts closed; its switch starts on this fight, or
 * the last one when the hero is between fights.
 */
export const LiveFightPanel = ({ heroId, onClose, onMinimize = null, onDragStart = null }) => {
    useEffect(() => startFightWatch(), []);
    const fights = useSyncExternalStore(
        (fn) => subscribeFights(heroId, fn),
        () => fightsOf(heroId),
        () => fightsOf(heroId)
    );
    const [logOpen, setLogOpen] = useState(false);
    const [tab, setTab] = useState(() => (fightsOf(heroId).current ? TAB.THIS : TAB.LAST));
    // The window stays with its hero: the log turns to each new fight as it starts.
    const currentId = fights.current?.id ?? null;
    useEffect(() => { if (currentId != null) setTab(TAB.THIS); }, [currentId]);
    const view = useMemo(() => fightPanelView(heroId, fights), [heroId, fights]);
    if (!view) return null;
    return (
        <FightPanelView
            view={view}
            fights={fights}
            onClose={onClose}
            onMinimize={onMinimize}
            onDragStart={onDragStart}
            logOpen={logOpen}
            onToggleLog={() => setLogOpen(o => !o)}
            tab={tab}
            onTab={setTab}
        />
    );
};
