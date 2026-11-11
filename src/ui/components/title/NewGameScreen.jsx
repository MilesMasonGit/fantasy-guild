import { useMemo, useState } from 'react';
import { ArrowLeft, Dices, Play } from 'lucide-react';
import { t } from '../../../i18n/index.js';
import { useEscapeLayer } from '../../utils/escapeLayers.js';
import { KitButton, KIT_BUTTON_TONE, PixelToggle } from '../base/KitButton.jsx';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { HeroLookFields } from '../../modals/HeroEditModal.jsx';
import { WorldMap } from '../atlas/WorldMap.jsx';
import { previewView } from '../atlas/worldPreview.js';
import { TitleScreen, TITLE_WIDE_PANEL_PX } from './TitleScreen.jsx';
import * as World from '../../../systems/world/World.js';
import { nextSeed } from '../../../systems/atlas/seededRandom.js';
import { GUILD_NAME_MAX, cleanGuildName } from '../../../systems/core/GuildName.js';
import { HERO_PORTRAITS } from '../../../config/registries/heroPortraits.js';
import { getRandomName } from '../../../config/registries/nameRegistry.js';
import { FLAG_COLOURS } from '../../../systems/board/FlagColours.js';

/** The preview draws the world map at half its size: one screen pixel per art pixel, still crisp. */
const PREVIEW_SCALE = 0.5;

const LABEL = 'ui-text-body font-bold gi-caps tracking-widest text-gi-muted';

/** A world rolled for the screen, and how long the roll took, for the checks. */
function roll(seed) {
    const started = performance.now();
    const rolled = World.rollWorld(seed);
    return { ...rolled, view: previewView(rolled.world), ms: performance.now() - started };
}

/**
 * The world map, small and read-only: the painted world, its tiles and what stands on them. It
 * fills the room its column leaves; the map centres on the Hall and a drag shows the rest.
 */
const WorldPreview = ({ view }) => (
    <div
        data-new-game-world={view.seed}
        className="relative overflow-hidden ui-pixel-edge flex-1 min-h-0 w-full"
    >
        <div
            className="absolute left-0 top-0"
            style={{
                width: `${100 / PREVIEW_SCALE}%`,
                height: `${100 / PREVIEW_SCALE}%`,
                transform: `scale(${PREVIEW_SCALE})`,
                transformOrigin: '0 0'
            }}
        >
            <WorldMap view={view} readOnly scale={PREVIEW_SCALE} />
        </div>
    </div>
);

/**
 * The one screen between picking an empty slot and playing: the Guild's name, the world (its three
 * strict rings, rolled again by Reroll as often as liked, free) and the first hero's name, portrait
 * and flag colour, with the hero edit window's own controls. Begin hands the choices to the new game
 * (`EngineBootstrap.createDefaultGameData`); Back returns to the slots and nothing is kept.
 *
 * @param {object} props
 * @param {number} props.slotIndex
 * @param {(setup: {guildName: string, worldSeed: number, lessons: boolean, hero: object}) => void} props.onBegin
 * @param {() => void} props.onBack
 */
export const NewGameScreen = ({ slotIndex, onBegin, onBack }) => {
    const [guildName, setGuildName] = useState('');
    const [world, setWorld] = useState(() => roll(World.freshWorldSeed(Date.now())));
    const [heroName, setHeroName] = useState(() => getRandomName());
    const [spriteId, setSpriteId] = useState(() => HERO_PORTRAITS[Math.floor(Math.random() * HERO_PORTRAITS.length)]);
    const [flagColour, setFlagColour] = useState(FLAG_COLOURS[0]);
    const [lessons, setLessons] = useState(true);
    useEscapeLayer(true, onBack);

    const reroll = () => setWorld(w => roll(nextSeed(w.seed)));
    const canBegin = heroName.trim().length > 0;
    const begin = () => {
        if (!canBegin) return;
        onBegin({
            guildName: cleanGuildName(guildName) || t('newGame.defaultGuildName'),
            worldSeed: world.seed,
            lessons,
            hero: { name: heroName.trim(), spriteId, flagColour }
        });
    };
    const view = useMemo(() => world.view, [world]);

    return (
        <TitleScreen panelPx={TITLE_WIDE_PANEL_PX} showName={false}>
            {/* One screen, whole on a 1366 x 768 screen: the header and the footer (Back, Begin)
                stay put, the world and the portraits take the height left between them. */}
            <PixelFrame kind={FRAME_KIND.CHAMFER} className="h-full" frameClassName="flex flex-col" data-new-game-screen={slotIndex + 1}>
                <div className="shrink-0 px-6 pt-4 pb-3 border-b border-gi-border/50">
                    <h2 className="m-0 ui-text-title font-bold text-gi-primary tracking-wide uppercase">{t('newGame.title', { n: slotIndex + 1 })}</h2>
                </div>

                <div className="flex-1 min-h-0 px-6 py-3 flex gap-6">
                    <section className="flex-[1.1] min-w-0 flex flex-col gap-2">
                        <span className={LABEL}>{t('newGame.world')}</span>
                        <WorldPreview view={view} />
                        <div className="shrink-0 flex items-center gap-3">
                            <KitButton onClick={reroll} buttonClassName="gap-2 py-1.5 px-4 text-xs uppercase tracking-widest" data-new-game-reroll data-roll-ms={Math.round(world.ms)}>
                                <Dices size={16} /> {t('newGame.reroll')}
                            </KitButton>
                            <span className="ui-text-body text-gi-muted">{t('newGame.worldHint')}</span>
                        </div>
                    </section>

                    <section className="flex-1 min-w-0 flex flex-col gap-3">
                        <label className="shrink-0 flex flex-col gap-1.5">
                            <span className={LABEL}>{t('newGame.guildName')}</span>
                            <input
                                type="text"
                                data-new-game-guild-name
                                value={guildName}
                                maxLength={GUILD_NAME_MAX}
                                placeholder={t('newGame.defaultGuildName')}
                                onChange={(e) => setGuildName(e.target.value)}
                                className="ui-pixel-edge px-3 py-2 bg-black/40 text-gi-text text-sm focus:outline-none transition-colors"
                            />
                        </label>
                        <div className="flex-1 min-h-0 flex flex-col gap-2" data-new-game-hero>
                            <span className="shrink-0 ui-text-title font-bold text-gi-primary tracking-wide uppercase">{t('newGame.firstHero')}</span>
                            <HeroLookFields
                                name={heroName}
                                onName={setHeroName}
                                onEnter={begin}
                                spriteId={spriteId}
                                onSprite={setSpriteId}
                                flagColour={flagColour}
                                onFlagColour={setFlagColour}
                                fill
                            />
                        </div>
                    </section>
                </div>

                <div className="shrink-0 px-6 py-3 border-t border-gi-border/50 flex items-center justify-between" data-new-game-footer>
                    <KitButton tone={KIT_BUTTON_TONE.PLAIN} onClick={onBack} buttonClassName="gap-1 py-2 px-4 text-xs uppercase tracking-widest" data-new-game-back>
                        <ArrowLeft size={14} /> {t('newGame.back')}
                    </KitButton>
                    <label className="flex items-center gap-3 cursor-pointer" data-new-game-lessons={lessons ? 'on' : 'off'}>
                        <span className="flex flex-col items-end">
                            <span className={LABEL}>{t('newGame.lessons')}</span>
                            <span className="ui-text-small text-gi-muted">{t('newGame.lessonsHint')}</span>
                        </span>
                        <PixelToggle on={lessons} onClick={() => setLessons(v => !v)} aria-label={t('newGame.lessons')} />
                    </label>
                    <KitButton onClick={begin} disabled={!canBegin} className="mr-1 mb-1" buttonClassName="gap-2 py-2 px-8 uppercase tracking-widest" data-new-game-begin>
                        <Play size={16} /> {t('newGame.begin')}
                    </KitButton>
                </div>
            </PixelFrame>
        </TitleScreen>
    );
};
