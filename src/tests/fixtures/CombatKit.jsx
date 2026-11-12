// The combat screen drawn by the real components fed a fixture fight
// (`combatKit.js`): the fight's pieces on the mat (bars, button, a move's bubble, every float), the fight window
// with its log closed and open, a minimized window's tab mid-fight and after a win, and the enemy
// card fought and never fought.

import { useLayoutEffect, useRef, useState } from 'react';
import { HealthBar } from '../../ui/components/board/HealthBar.jsx';
import { SpeechFrame } from '../../ui/components/board/SpeechFrame.jsx';
import { CHIP, CHIP_PX, MAT_BAR } from '../../ui/components/board/healthBar.js';
import { buildFloat } from '../../ui/components/board/fx/fightFloats.js';
import { FightPanelView } from '../../ui/components/combat/FightPanel.jsx';
import { EnemyCardRows } from '../../ui/components/combat/EnemyCard.jsx';
import { FightTabView } from '../../ui/components/combat/FightTab.jsx';
import { PixelFrame, FRAME_KIND } from '../../ui/components/base/PixelFrame.jsx';
import { glyphSrc, GLYPH_COLOUR } from '../../ui/components/combat/combatGlyphs.js';
import { KIT_FIGHTS, KIT_FLOATS, KIT_CARDS, KIT_TABS, kitPanelView } from './combatKit.js';

/** The grass under the mat pieces: the mat's own mean green (the real mat is textured). */
const GROUND = '#5d9440';

/** A float as the mat builds it, standing still for the picture. */
const StillFloat = ({ m }) => {
    const ref = useRef(null);
    useLayoutEffect(() => {
        const el = buildFloat(m);
        el.style.visibility = 'visible';
        el.style.position = 'relative';
        el.style.translate = 'none';
        ref.current?.appendChild(el);
        return () => el.remove();
    }, [m]);
    return <span ref={ref} className="flex items-end justify-center" style={{ height: 52, '--fx-scale': 1 }} />;
};

/** The fight's pieces on the mat at the 1920 × 1080 size: the two bars with the button between them, a move's bubble, the floats. */
const BAR_TOP = 64;
const BTN_LEFT = 30 + MAT_BAR.W + CHIP.GAP;
const MatPieces = () => (
    <div className="flex flex-wrap items-start gap-4">
        <div className="relative" style={{ width: 2 * (30 + MAT_BAR.W + CHIP.GAP) + CHIP_PX, height: 120, background: GROUND }} data-kit-combat="mat">
            <HealthBar who="hero" cur={17} max={30} outward={-1} style={{ left: 30, top: BAR_TOP, width: MAT_BAR.W }} />
            <span className="absolute" style={{ left: BTN_LEFT, top: BAR_TOP + MAT_BAR.H / 2 - CHIP_PX / 2, width: CHIP_PX, height: CHIP_PX }}>
                <span aria-hidden="true" className="ui-frame-shadow-chamfer absolute inset-0" style={{ borderWidth: CHIP.BAND, borderImageWidth: `${CHIP.BAND}px`, transform: 'translate(4px, 4px)' }} />
                <span aria-hidden="true" className="ui-frame-chamfer absolute inset-0" style={{ borderWidth: CHIP.BAND, borderImageWidth: `${CHIP.BAND}px` }} />
                <img src={glyphSrc('fight', GLYPH_COLOUR.gold)} alt="" className="absolute" style={{ left: 8, top: 8, width: 16, height: 16, maxWidth: 'none', imageRendering: 'pixelated' }} />
            </span>
            <HealthBar who="enemy" cur={24} max={40} outward={1} style={{ left: BTN_LEFT + CHIP_PX + CHIP.GAP, top: BAR_TOP, width: MAT_BAR.W }} />
            <div className="absolute" style={{ left: BTN_LEFT + CHIP_PX + CHIP.GAP + MAT_BAR.W / 2, top: BAR_TOP - 10, transform: 'translate(-50%, -100%)' }}>
                <SpeechFrame tone="plain" u={1} tail className="whitespace-nowrap ui-text-title font-bold">Shiv</SpeechFrame>
            </div>
        </div>
        <div className="grid grid-cols-3 gap-x-6 gap-y-1 p-2" style={{ background: GROUND }} data-kit-combat="floats">
            {KIT_FLOATS.map((m, i) => (
                <div key={i} className="flex flex-col items-center" data-kit-float={`${m.kind}-${m.on}`}>
                    <StillFloat m={m} />
                    <span className="ui-text-small text-white">{m.caption}</span>
                </div>
            ))}
        </div>
    </div>
);

/** The panel with its log toggle working (closed to start with), and with the log open on each tab. */
const Panels = () => {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState('this');
    const view = kitPanelView();
    return (
        <div className="flex flex-wrap items-start gap-4 p-3" style={{ background: GROUND }} data-kit-combat="panels">
            <FightPanelView view={view} fights={KIT_FIGHTS} onClose={() => {}} onMinimize={() => {}} logOpen={open} onToggleLog={() => setOpen(o => !o)} tab={tab} onTab={setTab} />
            <FightPanelView view={view} fights={KIT_FIGHTS} onClose={() => {}} logOpen onToggleLog={() => {}} tab="last" onTab={() => {}} />
            <div className="flex flex-col gap-2" data-kit-combat="tabs">
                {KIT_TABS.map((tab, i) => <FightTabView key={i} heroId={view.heroId} tab={tab} still={view.hero.art.still} onOpen={() => {}} />)}
            </div>
        </div>
    );
};

/** The enemy card, fought (its kinds) and never fought. */
const Cards = () => (
    <div className="flex flex-wrap items-start gap-4" data-kit-combat="cards">
        {KIT_CARDS.map(card => (
            <PixelFrame key={card.typeId} kind={FRAME_KIND.CHAMFER} frameClassName="p-0.5 leading-snug text-white" style={{ width: 280 }}>
                <div className="ui-text-title font-bold text-gi-gold">{card.name}</div>
                <EnemyCardRows card={card} />
            </PixelFrame>
        ))}
    </div>
);

export const CombatKit = () => (
    <div className="flex flex-col gap-3" data-kit-combat-screen>
        <MatPieces />
        <Panels />
        <Cards />
    </div>
);
