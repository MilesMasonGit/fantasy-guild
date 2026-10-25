// The combat screen on the style sheet page, drawn by the real components fed a fixture fight
// (`combatKit.js`): the fight's pieces on the mat (bars, chip, plate, every float), the fight panel
// with its log closed and open, and the enemy card fought and never fought.

import { useLayoutEffect, useRef, useState } from 'react';
import { HealthBar } from '../components/board/HealthBar.jsx';
import { WorkPlateView } from '../components/board/WorkPlateLayer.jsx';
import { buildFloat } from '../components/board/fx/fightFloats.js';
import { FightPanelView } from '../components/combat/FightPanel.jsx';
import { EnemyCardRows } from '../components/combat/EnemyCard.jsx';
import { PixelFrame, FRAME_KIND } from '../components/base/PixelFrame.jsx';
import { glyphSrc, GLYPH_COLOUR } from '../components/combat/combatGlyphs.js';
import { KIT_FIGHTS, KIT_PLATE_CELLS, KIT_FLOATS, KIT_CARDS, kitPanelView } from './combatKit.js';

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

/** The fight's pieces on the mat at the 1920 × 1080 size: the two bars, the chip, the plate, the floats. */
const MatPieces = () => (
    <div className="flex flex-wrap items-start gap-4">
        <div className="relative" style={{ width: 300, height: 140, background: GROUND }} data-kit-combat="mat">
            <HealthBar who="enemy" cur={24} max={40} outward={-1} style={{ left: 60, top: 40, width: 64 }} />
            <HealthBar who="hero" cur={17} max={30} outward={1} style={{ left: 150, top: 40, width: 64 }} />
            <span className="absolute" style={{ left: 14, top: 14, width: 32, height: 32 }}>
                <span aria-hidden="true" className="ui-frame-chamfer absolute inset-0" style={{ borderWidth: 6, borderImageWidth: '6px' }} />
                <img src={glyphSrc('fight', GLYPH_COLOUR.gold)} alt="" className="absolute" style={{ left: 8, top: 8, width: 16, height: 16, maxWidth: 'none', imageRendering: 'pixelated' }} />
            </span>
            <div className="absolute flex justify-center" style={{ left: 0, right: 0, top: 70 }}>
                <WorkPlateView cells={KIT_PLATE_CELLS} u={1} />
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
            <FightPanelView view={view} fights={KIT_FIGHTS} onClose={() => {}} logOpen={open} onToggleLog={() => setOpen(o => !o)} tab={tab} onTab={setTab} />
            <FightPanelView view={view} fights={KIT_FIGHTS} onClose={() => {}} logOpen onToggleLog={() => {}} tab="last" onTab={() => {}} />
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

export default CombatKit;
