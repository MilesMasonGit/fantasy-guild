import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { PanelHeader } from '../base/CloseX.jsx';
import { KitButton, KIT_BUTTON_TONE } from '../base/KitButton.jsx';
import { ArrowScrollList, PixelTriangle } from '../base/ArrowScrollList.jsx';
import { SkillIcon } from '../base/SkillIcon.jsx';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { TokenSprite, TOKEN_SURFACE, tokenSizeFor } from '../base/TokenSprite.jsx';
import { AnimatedHeroSprite } from '../board/AnimatedHeroSprite.jsx';
import { AnimatedEnemySprite } from '../board/AnimatedEnemySprite.jsx';
import { COMBAT_ATTACK_EVENT } from '../board/TokenHitArt.jsx';
import { isRealAttack } from '../board/hitAnimations.js';
import { HP_BAR, HP_COLOUR, HP_TRACK, HP_EDGE, healthFillPx } from '../board/healthBar.js';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { CombatGlyph } from './CombatGlyph.jsx';
import { GLYPH_COLOUR } from './combatGlyphs.js';
import { fightsOf, subscribeFights, reconcile, adopt, startFightWatch, TONE, OUTCOME } from './fightWatch.js';
import { fightPanelView, levelText, secondsText, styleName, clockText } from './fightView.js';
import { t } from '../../../i18n/index.js';

/**
 * The fight panel (owner, 2026-10-25: Panel 3's fight display with Panel 2's card): a header with
 * the fight's clock; a short strip of the battlefield with both fighters at 1× at its ends, the hero
 * always on the left facing right, each moving as on the mat (idle, and a swing per real swing);
 * under it the versus card, one shared icon column so the hero's numbers and the enemy's read across
 * (level and style, health, hit, armour, swing), then the hero's elixirs and statuses beside the
 * enemy's kinds (once fought), statuses and buffs; and the log, closed until asked for, holding the
 * whole of this fight and the last one. Opens over the playmat (`FightPanelPopup`).
 */

/** The panel's width inside its frame. */
export const PANEL_W = 304;
/** The strip's height for a fighter at 1× (64 px), and the battlefield picture behind it. */
const STRIP_H = 76;
const BATTLEFIELD = '/assets/backgrounds/invasion/b_invasion_battlefield.png';
const BATTLEFIELD_PX = 256;
const FIGHTER_PX = 64;
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
// The strip
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
 * The battlefield strip: the owner's battlefield picture at 2×, the hero at its left end facing
 * right and the enemy at its right end facing left, both at 1×. The hero idles and swings once
 * per real swing; an enemy with an animation sheet plays its fight cycle as on the mat, one
 * without stands still (every enemy but the Cow today).
 */
export const FightStrip = ({ view }) => {
    const { hero, enemy, live } = view;
    const attackAt = useLastSwingAt(view.heroId, live);
    const enemyPx = enemy.sheet ? FIGHTER_PX : tokenSizeFor(TOKEN_SURFACE.INSPECT, enemy.typeId);
    const height = Math.max(STRIP_H, enemyPx + 12);
    return (
        <div data-fight-strip className="relative overflow-hidden mx-1.5" style={{ height }}>
            <img
                src={BATTLEFIELD}
                alt=""
                draggable={false}
                className="absolute select-none pointer-events-none"
                style={{ left: -60, top: -236 + (height - STRIP_H), width: BATTLEFIELD_PX * 2, height: BATTLEFIELD_PX * 2, maxWidth: 'none', imageRendering: 'pixelated' }}
            />
            <div data-fight-fighter="hero" className="absolute" style={{ left: 18, bottom: 4, width: FIGHTER_PX, height: FIGHTER_PX }}>
                {hero.art?.sheet ? (
                    <AnimatedHeroSprite src={hero.art.sheet} heroId={view.heroId} alt={hero.name} size={FIGHTER_PX} animationState={live ? 'combat' : 'idle'} attackAt={attackAt} />
                ) : hero.art?.still ? (
                    <img src={hero.art.still} alt={hero.name} draggable={false} style={{ width: FIGHTER_PX, height: FIGHTER_PX, imageRendering: 'pixelated' }} />
                ) : null}
            </div>
            <div data-fight-fighter="enemy" data-fight-enemy-moves={enemy.sheet ? 'true' : 'false'} className="absolute" style={{ right: 18, bottom: 4, width: enemyPx, height: enemyPx }}>
                {enemy.sheet ? (
                    <AnimatedEnemySprite src={enemy.sheet} heroId={live ? view.heroId : null} facing={-1} alt={enemy.name} size={FIGHTER_PX} />
                ) : (
                    <TokenSprite typeId={enemy.typeId} surface={TOKEN_SURFACE.INSPECT} />
                )}
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------------------------
// The versus card
// ---------------------------------------------------------------------------------------------

/** A thin bar like the mat's, at the panel's 2× (one art pixel = 2 px); shorter beside a long number. */
const PanelBar = ({ cur, max, text = '' }) => {
    const w = text.length > 8 ? 24 : 40;
    return (
        <span className="relative inline-block shrink-0" style={{ width: w, height: HP_BAR.H, background: HP_TRACK, boxShadow: `0 0 0 ${HP_BAR.EDGE}px ${HP_EDGE}` }}>
            <span className="absolute left-0 top-0 bottom-0" style={{ width: healthFillPx(cur, max, w), background: HP_COLOUR }} />
        </span>
    );
};

/** A side's style and level: the style's icon and `20/99`; a Recruit has no style. */
const StyleLevel = ({ side, mirror = false }) => {
    const style = styleName(side.style);
    return (
        <Tooltip title={style ? t('fight.tip.level', { name: side.name, style, level: levelText(side.level) }) : t(side.armed ? 'fight.tip.noStyleArmed' : 'fight.tip.noStyle', { name: side.name })}>
            <span className={`inline-flex items-center gap-1.5 ui-text-body cursor-help ${mirror ? 'flex-row-reverse' : ''}`} data-fight-style={side.style || 'none'}>
                {side.style ? <SkillIcon skill={side.style} size={16} title={null} /> : null}
                <span className="ui-text-small tabular-nums text-gi-muted">{side.style ? levelText(side.level) : t('fight.panel.noStyle')}</span>
            </span>
        </Tooltip>
    );
};

/** One row of the card: the hero's value right-aligned, the shared icon, the enemy's left-aligned. */
const VsRow = ({ id, glyph, hero, enemy, tips }) => (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 ui-text-body" data-fight-row={id}>
        <Tooltip title={tips[0]} lines={tips[2]}>
            <span className="flex justify-end items-center gap-2 font-bold tabular-nums text-white cursor-help" data-fight-side="hero">{hero}</span>
        </Tooltip>
        <CombatGlyph name={glyph} colour={GLYPH_COLOUR.text} />
        <Tooltip title={tips[1]}>
            <span className="flex justify-start items-center gap-2 font-bold tabular-nums text-white cursor-help" data-fight-side="enemy">{enemy}</span>
        </Tooltip>
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

/** A status and its stacks: `Poison ×2`, with its drop or flame. */
const StatusChip = ({ s, align = 'start' }) => (
    <Tooltip
        title={`${s.name} ×${s.stacks}`}
        lines={[
            s.maxStacks ? t('fight.tip.stacksUpTo', { count: s.maxStacks }) : null,
            s.ticksLeft != null ? t('fight.tip.ticksLeft', { count: s.ticksLeft }) : t('fight.tip.untilFightEnds')
        ]}
    >
        <span className={`inline-flex items-center gap-1 cursor-help ${align === 'end' ? 'flex-row-reverse' : ''}`} data-fight-status={s.id}>
            <CombatGlyph name={s.icon} colour={GLYPH_COLOUR.red} />
            <span className="font-bold text-white">{s.name}</span>
            <span className="tabular-nums font-bold text-white">×{s.stacks}</span>
        </span>
    </Tooltip>
);

export const VersusCard = ({ view }) => {
    const { hero, enemy } = view;
    const swing = (ms) => (ms ? secondsText(ms) : '–');
    return (
        <div data-fight-card className="flex flex-col gap-1 px-2 pt-1.5 pb-1">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3" data-fight-row="style">
                <span className="flex justify-end"><StyleLevel side={hero} mirror /></span>
                <span className="ui-text-small font-bold text-gi-muted">{t('fight.panel.versus')}</span>
                <span className="flex justify-start"><StyleLevel side={enemy} /></span>
            </div>
            <VsRow
                id="hp"
                glyph="heart"
                hero={<><PanelBar cur={hero.hp.cur} max={hero.hp.max} text={hero.hpText} /><span data-fight-hp="hero" className="ui-text-small whitespace-nowrap">{hero.hpText}</span></>}
                enemy={<><span data-fight-hp="enemy" className="ui-text-small whitespace-nowrap">{enemy.hpText}</span><PanelBar cur={enemy.hp.cur} max={enemy.hp.max} text={enemy.hpText} /></>}
                tips={[
                    t('fight.tip.hp', { name: hero.name, cur: hero.hp.cur, max: hero.hp.max }),
                    t('fight.tip.hp', { name: enemy.name, cur: enemy.hp.cur, max: enemy.hp.max })
                ]}
            />
            <VsRow
                id="hit"
                glyph="hit"
                hero={hero.hit}
                enemy={enemy.hit}
                tips={[t('fight.tip.heroHit', { hit: hero.hit }), t('fight.tip.enemyHit', { hit: enemy.hit }), hero.hitLines]}
            />
            <VsRow
                id="armour"
                glyph="shield"
                hero={hero.armour}
                enemy={enemy.armour}
                tips={[t('fight.tip.heroArmour', { armour: hero.armour }), t('fight.tip.enemyArmour', { armour: enemy.armour })]}
            />
            <VsRow
                id="swing"
                glyph="clock"
                hero={swing(hero.swingMs)}
                enemy={swing(enemy.swingMs)}
                tips={[t('fight.tip.swing', { time: swing(hero.swingMs) }), t('fight.tip.swing', { time: swing(enemy.swingMs) })]}
            />
            <div aria-hidden="true" className="h-px bg-white/10 my-0.5" />
            <div className="grid grid-cols-2 gap-3 items-start ui-text-body">
                <div className="flex flex-col gap-1" data-fight-effects="hero">
                    {hero.elixirs.length > 0 && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">{hero.elixirs.map(e => <ElixirChip key={e.itemId} e={e} />)}</div>
                    )}
                    {hero.statuses.map(s => <StatusChip key={s.id} s={s} />)}
                </div>
                <div className="flex flex-col items-end gap-1 text-right" data-fight-effects="enemy">
                    {enemy.kinds == null ? (
                        <span className="ui-text-small text-gi-muted" data-fight-kinds="unknown">{t('fight.panel.unknownKinds')}</span>
                    ) : enemy.kinds.map(k => (
                        <Tooltip key={k.id} title={k.name} lines={[k.tip]}>
                            <span className="font-bold text-white cursor-help" data-fight-kind={k.id}>{k.name}</span>
                        </Tooltip>
                    ))}
                    {enemy.statuses.map(s => <StatusChip key={s.id} s={s} align="end" />)}
                    {enemy.buffs.map((b, i) => (
                        <span key={`${b}-${i}`} className="inline-flex items-center gap-1 ui-text-small text-gi-text" data-fight-buff={b}>
                            {b}<CombatGlyph name="star" colour={GLYPH_COLOUR.gold} />
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};

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
        <span className="flex-1 min-w-0">{t(`fight.log.${line.key}`, line.vars)}</span>
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

/**
 * The log part: "Show log" until asked; open, the This fight / Last fight switch and the chosen
 * fight's whole log.
 */
export const FightLog = ({ fights, open, onToggle, tab, onTab }) => (
    <div className="flex flex-col gap-1 px-1.5 pb-1" data-fight-log={open ? 'open' : 'closed'}>
        {open && <div aria-hidden="true" className="h-px bg-white/10" />}
        {open && <LogTabs tab={tab} onTab={onTab} />}
        {open && (
            tab === TAB.THIS
                ? <LogList record={fights.current} empty={t('fight.panel.noFight')} />
                : <LogList record={fights.last} empty={t('fight.panel.noLastFight')} />
        )}
        <div className="flex justify-center pt-0.5 pb-1">
            <KitButton tone={KIT_BUTTON_TONE.PLAIN} onClick={onToggle} buttonClassName="ui-text-small" data-fight-log-toggle={open ? 'open' : 'closed'}>
                {open ? t('fight.panel.hideLog') : t('fight.panel.showLog')}
                <span className="text-current"><PixelTriangle dir={open ? 'up' : 'down'} /></span>
            </KitButton>
        </div>
    </div>
);

// ---------------------------------------------------------------------------------------------
// The panel
// ---------------------------------------------------------------------------------------------

/** The panel as drawn from a view (`fightView.fightPanelView`) and the hero's fights. */
export const FightPanelView = ({ view, fights, onClose, logOpen, onToggleLog, tab, onTab }) => (
    <PixelFrame kind={FRAME_KIND.CHAMFER} data-fight-panel={view.heroId} data-fight-live={view.live ? 'true' : 'false'} style={{ width: PANEL_W + 12 }}>
        <div className="relative flex flex-col" style={{ width: PANEL_W }}>
            <PanelHeader
                title={view.title}
                sprite={<CombatGlyph name="fight" colour={GLYPH_COLOUR.gold} />}
                onClose={onClose}
                className="px-1.5 pt-1 pb-1"
            >
                <span className="ui-text-small tabular-nums text-gi-muted whitespace-nowrap" data-fight-clock>
                    {view.ended ? endText(fights.last) : view.clock}
                </span>
            </PanelHeader>
            <FightStrip view={view} />
            <VersusCard view={view} />
            <FightLog fights={fights} open={logOpen} onToggle={onToggleLog} tab={tab} onTab={onTab} />
        </div>
    </PixelFrame>
);

/** How often an open panel reads its clock again. */
export const PANEL_CLOCK_MS = 1000;

/**
 * The live panel on `heroId`'s fight: drawn again when the fight watch hears something about it, and
 * once a second for the clock. The log starts closed; its switch starts on this fight, or the
 * last one when the hero is between fights.
 */
export const LiveFightPanel = ({ heroId, onClose }) => {
    useEffect(() => startFightWatch(), []);
    const fights = useSyncExternalStore(
        (fn) => subscribeFights(heroId, fn),
        () => fightsOf(heroId),
        () => fightsOf(heroId)
    );
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        adopt(heroId);
        const timer = setInterval(() => {
            if (!reconcile(heroId)) adopt(heroId);
            setNow(Date.now());
        }, PANEL_CLOCK_MS);
        return () => clearInterval(timer);
    }, [heroId]);
    const [logOpen, setLogOpen] = useState(false);
    const [tab, setTab] = useState(() => (fightsOf(heroId).current ? TAB.THIS : TAB.LAST));
    const view = useMemo(() => fightPanelView(heroId, fights, now), [heroId, fights, now]);
    if (!view) return null;
    return (
        <FightPanelView
            view={view}
            fights={fights}
            onClose={onClose}
            logOpen={logOpen}
            onToggleLog={() => setLogOpen(o => !o)}
            tab={tab}
            onTab={setTab}
        />
    );
};

export default LiveFightPanel;
