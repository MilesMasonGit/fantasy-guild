import { memo, useSyncExternalStore } from 'react';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { VitalBar } from '../base/VitalBar.jsx';
import { TokenSprite, TOKEN_SURFACE, tokenSizeFor } from '../base/TokenSprite.jsx';
import * as HeroManager from '../../../systems/hero/HeroManager.js';
import { fightsOf, subscribeFights } from './fightWatch.js';
import { heroArt } from './fightView.js';
import { resultWord } from './FightPanel.jsx';
import { restoreFightPanel, useFightWindows, fightTabs } from './fightPanelStore.js';
import { t } from '../../../i18n/index.js';

/**
 * A minimized fight window (owner's pick D, "faces and bars", 2026-11-05): the hero's face, both
 * names (the enemy's gives way to Won or Lost between fights), both health bars with their numbers,
 * the enemy's face. Clicking it opens the window again where it was.
 * ⚠️ A tab costs as little as it can (T-198): it reads only the fight's record, never the engine,
 * and draws again only when a name, a health or the result changes.
 */

/** The face boxes and the bars, in screen px. */
const FACE_PX = 44;
const TAB_BAR_W = 70;
const TAB_BAR_H = 14;

/** What a tab shows of a hero's fights, as one string: equal strings, nothing to draw. */
export function tabKey(fights) {
    const r = fights?.current || fights?.last;
    if (!r) return '';
    return [r.heroName, r.enemyName, r.typeId ?? '', r.hp.hero.cur, r.hp.hero.max, r.hp.enemy.cur, r.hp.enemy.max, fights.current ? '' : (r.outcome ?? '')].join('\u0001');
}

function readKey(key) {
    if (!key) return null;
    const [heroName, enemyName, typeId, hc, hm, ec, em, outcome] = key.split('\u0001');
    return { heroName, enemyName, typeId: typeId || null, hero: { cur: +hc, max: +hm }, enemy: { cur: +ec, max: +em }, outcome: outcome || null };
}

/** A face: the art at 1×, cropped to its head and shoulders. */
const Face = ({ children }) => (
    <span className="relative block shrink-0 overflow-hidden" style={{ width: FACE_PX, height: FACE_PX, background: '#241a12' }}>
        {children}
    </span>
);

export const FightTab = memo(function FightTab({ heroId }) {
    const key = useSyncExternalStore(
        (fn) => subscribeFights(heroId, fn),
        () => tabKey(fightsOf(heroId)),
        () => tabKey(fightsOf(heroId))
    );
    const tab = readKey(key);
    if (!tab) return null;
    const sprite = HeroManager.getHero(heroId)?.spriteId || HeroManager.getHero(heroId)?.classId || null;
    return <FightTabView heroId={heroId} tab={tab} still={heroArt(sprite).still} onOpen={() => restoreFightPanel(heroId)} />;
});

/**
 * The tab as drawn from what it shows: `tab` is `{ heroName, enemyName, typeId, hero: {cur, max},
 * enemy: {cur, max}, outcome }`, `still` the hero's picture.
 */
export const FightTabView = ({ heroId, tab, still, onOpen }) => {
    const result = resultWord(tab.outcome);
    const enemyPx = tab.typeId ? tokenSizeFor(TOKEN_SURFACE.INSPECT, tab.typeId) : 64;
    const label = `${t('fight.panel.title', { hero: tab.heroName, enemy: tab.enemyName })}: ${t('fight.window.restore')}`;
    return (
        <button
            type="button"
            data-fight-tab={heroId}
            aria-label={label}
            title={label}
            onClick={onOpen}
            className="ui-icon-button block p-0 m-0 border-0 bg-transparent cursor-pointer pointer-events-auto text-left"
        >
            <PixelFrame kind={FRAME_KIND.CHAMFER}>
                <div className="flex items-center gap-1.5">
                    <Face>
                        {still && <img src={still} alt="" draggable={false} className="absolute" style={{ left: -10, top: -6, width: 64, height: 64, maxWidth: 'none', imageRendering: 'pixelated' }} />}
                    </Face>
                    <div className="flex flex-col gap-1.5 px-0.5">
                        <span className="flex justify-between gap-3 ui-text-small font-bold leading-none whitespace-nowrap text-white">
                            <span data-fight-tab-hero>{tab.heroName}</span>
                            {result
                                ? <span data-fight-tab-result={tab.outcome} style={{ color: result.colour }}>{result.text}</span>
                                : <span data-fight-tab-enemy>{tab.enemyName}</span>}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <VitalBar data-fight-tab-hp="hero" value={tab.hero.cur} max={tab.hero.max} height={TAB_BAR_H} style={{ width: TAB_BAR_W }} />
                            <VitalBar data-fight-tab-hp="enemy" value={tab.enemy.cur} max={tab.enemy.max} height={TAB_BAR_H} style={{ width: TAB_BAR_W }} />
                        </span>
                    </div>
                    <Face>
                        {tab.typeId && (
                            <TokenSprite
                                typeId={tab.typeId}
                                surface={TOKEN_SURFACE.INSPECT}
                                className="absolute"
                                style={{ left: Math.round((FACE_PX - enemyPx) / 2), top: -6 }}
                            />
                        )}
                    </Face>
                </div>
            </PixelFrame>
        </button>
    );
};

/**
 * The tabs of the minimized windows, in a strip above the hero bar from the mat's left edge, the
 * latest at the end; more than fit wrap upward. Only a window the player minimized has a tab.
 */
export const FightTabStrip = () => {
    const tabs = fightTabs(useFightWindows());
    if (tabs.length === 0) return null;
    return (
        <div
            data-fight-tabs
            className="absolute left-2 right-2 bottom-2 flex flex-wrap-reverse items-end gap-2 pointer-events-none"
        >
            {tabs.map(w => <FightTab key={w.heroId} heroId={w.heroId} />)}
        </div>
    );
};

export default FightTabStrip;
