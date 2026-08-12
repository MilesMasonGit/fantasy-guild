import React from 'react';
import { cn } from '../../utils/cn.js';
import { TILE_PX, GUILD_HALL_TILE, PAIR_OFFSET_PX, HERO_HIT_PX } from './boardConstants.js';
import { tokenName } from '../../../config/registries/tokenRegistry.js';
import { useEntityDrag, useEntityDrop, mergeRefs } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { TileProgressRing } from './TileProgressRing.jsx';
import { TokenSprite, PixelArt, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { getTokenType } from '../../../config/registries/tokenRegistry.js';
import { ALERT } from '../../../systems/board/BoardRunner.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { useEngine } from '../../hooks/useEngine.js';

/**
 * What the red mark means, in the player's words. Hovering states exactly what
 * is wrong (D-114) — there is no aggregate supply dashboard, so diagnosis
 * happens tile by tile.
 */
const ALERT_HINT = {
    [ALERT.INPUTS]: 'Waiting for materials — nothing in the Bank or on the board',
    [ALERT.ACCESS]: 'This hero’s skill is too low to work this Token',
    [ALERT.CONFLICT]: 'Two schematics beside this station want different things — remove one',
    [ALERT.NO_RECIPE]: 'Nothing beside this station tells it what to make',
    // D-133's silent failure, said out loud on hover. ⚠️ This mark is the ONLY
    // cue a returning player gets that their Bank ran dry rather than something
    // breaking (risk 15), so the wording has to name the cause outright.
    unstocked: 'This tile ran dry and the Vault has no replacement — restock it'
};

/**
 * BoardTile — one of the 49 tiles.
 *
 * ## The grid is real but invisible (D-143)
 * No drawn gridlines. Tokens sit on an implied lattice and read as **solid
 * objects resting on a surface**, not as cells in a spreadsheet. The floor art
 * does the work; the only borders that ever appear are transient drag cues.
 *
 * ## What a tile shows (D-85)
 * Exactly three things, always: Token art, the hero on it, and one alert mark.
 *
 * ## The hero is a SPRITE, and the pair stands apart (D-266)
 * The hero used to be a **name chip** — a scrap of text pinned to the corner,
 * which is the one thing D-85's own "just display the sprite, like a little toy"
 * ruling was written against. It is now the hero's actual portrait, drawn at the
 * same 128px as the Token, with the two pushed `PAIR_OFFSET_PX` apart: hero
 * left, Token right, overlapping across 80 of their 128 pixels.
 *
 * ⚠️ **This does not add a fourth thing to the tile — it replaces the chip.**
 * The name is gone from the board entirely and lives on hover, alongside the
 * Token's name and charges. Heroes are told apart by their portrait, which is
 * what the 29-portrait catalogue and the free-choice picker were for.
 *
 * ⚠️ **The pair overhangs the tile by 24px on each side** and nothing clips it —
 * see `PAIR_OFFSET_PX` for why that is load-bearing rather than sloppy, and why
 * there is no `z-index` anywhere near it.
 *
 * ⚠️ **The idle cue is currently TEXT ONLY** (owner decision 2026-08-12). The
 * yellow glowing chip was the loudest mark on the board and the main thing a
 * returning player scanned for (D-172); it went with the chip, and its
 * replacement is deferred to a later animation pass. Until that lands, an idle
 * hero is distinguishable **only by hovering them** — so `idle` is still
 * computed and still plumbed through to the tooltip, ready for the animation to
 * hang off. The red Token-side alert (D-172's other half) is untouched.
 *
 * ⚠️ **No name label, and no charge counter** (owner decision 2026-08-06):
 * *"just display the sprite, like a little toy."* Both were briefly present and
 * both are gone — together they were 85 of the 128 elements competing for the
 * eye on a full board. Identification is by **art**, with the name and remaining
 * uses on hover (D-22) and in the inspection panel (D-145).
 *
 * This is also what D-143 asks for: Tokens should read as **solid objects
 * resting on a surface**, not as labelled cells in a spreadsheet. The art fills
 * the tile edge to edge at 128px (D-218) and carries a contact shadow, so it
 * looks placed rather than painted on.
 * *(This paragraph used to say the art sat "inset rather than filling the tile".
 * D-218 reversed that; the inset was a consequence of the old 96px size.)*
 *
 * *Cost, accepted:* while the art is placeholder skill icons, Tokens are hard to
 * tell apart at a glance. Real Token art in Phase 9/10 is what pays that back.
 *
 * ⚠️ **An unstaffed Token is not an error** (D-149). With ~8 heroes on 48 tiles
 * most of the board is unstaffed at any moment, so it is not flagged. Alerts
 * appear only when a Token *has* a hero and still cannot work.
 *
 * *This used to be expressed by dimming unstaffed art to `opacity-55`.*
 * **D-231 removed the dimming**: a Token on the board now renders at full
 * strength whether or not someone is working it. D-149's rule is unchanged —
 * only its visual expression is gone, so the alert mark carries it alone.
 */

/** Floor sprites, cycled so the surface has texture rather than one flat tile. */
const FLOOR = [
    'pm_board_guild_hall_1', 'pm_board_guild_hall_2', 'pm_board_guild_hall_3',
    'pm_board_guild_hall_4', 'pm_board_guild_hall_5'
];
const floorFor = (i) => `/assets/playmat/tiles/${FLOOR[i % FLOOR.length]}.png`;

export const BoardTile = ({ index, token, heroName, heroSprite, onPlaceToken, onPlaceHero, onPickUp, onOpenGuildHall, onBurstMap, onInspectToken, onHover }) => {
    const { EventBus } = useEngine();
    const isGuildHall = index === GUILD_HALL_TILE;

    // ⚠️ A projected tile can carry a hero, an alert, or both with NO Token —
    // a person standing on bare ground (D-60) or a vacancy the Manager cannot
    // fill (D-133). `token` being present no longer implies `token.typeId`.
    const hasToken = !!token?.typeId;

    // The pair only splits when there IS a pair (D-266). A hero on bare ground
    // has nothing to stand beside, so they take the middle of the tile — which
    // makes the off-centre stance mean something specific: *this person is
    // working that object*, rather than being where heroes happen to go.
    const paired = hasToken && !!token?.heroId;
    const offset = paired ? PAIR_OFFSET_PX : 0;
    // A Map sitting on a tile is waiting to be torn open, not worked (D-155).
    const isMap = hasToken && !!getTokenType(token.typeId)?.mapId;

    // A placed Token can be dragged straight to another tile — tile-to-tile is
    // one drag, not a trip through the Tray.
    const drag = useEntityDrag({
        id: `tile-token-${index}`,
        kind: DRAG_KIND.TOKEN,
        payload: { typeId: token?.typeId, from: { tile: index } },
        sourceSurface: DND_SURFACE.BOARD,
        disabled: !hasToken || isGuildHall
    });

    const drop = useEntityDrop({
        id: `tile-${index}`,
        surface: DND_SURFACE.BOARD,
        // The Guild Hall accepts nothing (D-106) — a real rule, so the tile
        // shows the red "no" cue rather than silently swallowing the drop.
        accepts: (p) => !isGuildHall && (p.kind === DRAG_KIND.TOKEN || p.kind === DRAG_KIND.HERO),
        onDrop: (p) => {
            if (p.kind === DRAG_KIND.TOKEN) onPlaceToken?.(index, p);
            else if (p.kind === DRAG_KIND.HERO) onPlaceHero?.(index, p);
        },
        disabled: isGuildHall
    });

    /**
     * Whether a Token just arrived on this tile, so it can play its landing
     * (D-230).
     *
     * ⚠️ **Driven by the TILE_CHANGED event, not by the rendered value.** The
     * obvious implementation — compare this render's `typeId` against the last
     * one — looks right and is wrong: tiles mount **before** a save finishes
     * loading, so hydration reads as "a Token arrived" on every tile at once and
     * a loaded board bounces all 48 in unison. Only `Placement` publishes
     * TILE_CHANGED, so keying off it means the landing plays for **placements
     * and displacements and nothing else** — never on load, never on a re-render
     * for progress, a hero, or an alert.
     *
     * ⚠️ **The dimming that used to live here is gone** (D-231). An unstaffed
     * Token used to render at `opacity-55`. D-149's rule that an unstaffed Token
     * is *not an error* still stands and still governs alert marks — it is just
     * no longer expressed by fading the art, so a Token on the board now looks
     * like the same object whether or not someone is working it.
     */
    const [landing, setLanding] = React.useState(false);
    React.useEffect(() => {
        if (!EventBus) return;
        let timer = null;
        const unsub = EventBus.subscribe(BOARD_EVENTS.TILE_CHANGED, (p) => {
            if (p?.tile !== index || !p?.typeId) return;
            setLanding(true);
            clearTimeout(timer);
            timer = setTimeout(() => setLanding(false), 400);
        });
        return () => { clearTimeout(timer); unsub(); };
    }, [EventBus, index]);
    const label = hasToken ? tokenName(token.typeId) : null;

    // Charges are deliberately NOT drawn on the tile. D-85 budgets a tile at
    // exactly three things — Token art, the hero on it, and one alert mark —
    // and lists "uses remaining" as **hover only**. A full board is 48 tiles;
    // a counter on each was 36 extra numbers competing for attention, which is
    // precisely the visual clutter that killed the previous spatial playmat
    // (risk 7). It lives in the tooltip instead.

    return (
        <div
            ref={mergeRefs(drag.setNodeRef, drop.setNodeRef)}
            {...drop.droppableProps}
            {...(hasToken && !isGuildHall ? drag.handleProps : {})}
            // The centre tile IS the Guild Hall (D-121): upgrades are installed
            // there, so that is where they are bought. It is also the reserved
            // landing site for board-wide events — a hook, not a feature (D-135).
            // The Guild Hall opens the upgrade tree; every other tile opens its
            // Token's detail sheet (D-145). The hover tooltip carries the name
            // and charges, but inputs, recipes and pairings need the panel.
            onClick={
                isGuildHall ? () => onOpenGuildHall?.()
                    : hasToken ? () => onInspectToken?.(token.typeId)
                        : undefined
            }
            // Opening a Map ON the board scatters its contents around where it
            // sat (D-155), which is the version worth doing on purpose: you can
            // burst it right where you want to build.
            onDoubleClick={isMap ? () => onBurstMap?.(index) : undefined}
            onMouseEnter={() => onHover?.(index)}
            onMouseLeave={() => onHover?.(null)}
            title={
                isGuildHall ? 'Guild Hall — click to open the upgrade tree'
                    : isMap
                        ? `${label} — double-click to tear it open here`
                        : hasToken
                        ? `${label} — ${token.usesRemaining == null ? 'unlimited use' : `${token.usesRemaining} uses left`}`
                        : `Tile ${index}`
            }
            style={{
                width: TILE_PX,
                height: TILE_PX,
                backgroundImage: `url(${floorFor(index)})`,
                backgroundSize: 'cover',
                imageRendering: 'pixelated'
            }}
            className={cn(
                'relative select-none',
                isGuildHall && 'cursor-pointer',
                hasToken && !isGuildHall && 'cursor-grab active:cursor-grabbing',
                // Transient drag cues only — no permanent gridlines (D-143).
                drop.valid && 'ring-2 ring-inset ring-gi-success/80',
                drop.invalid && 'ring-2 ring-inset ring-gi-danger/80',
                drag.isDragging && 'opacity-40'
            )}
        >
            {isGuildHall && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                    <span className="text-[10px] font-bold tracking-wide text-white/80 text-center leading-tight">
                        GUILD<br />HALL
                    </span>
                </div>
            )}

            {hasToken && (
                <>
                    {/* 128px, filling the tile edge to edge (D-218). The art IS
                        the object — no frame, and the same contact shadow it
                        carries on every other surface (D-219, D-215).

                        ⚠️ Zero margin is the accepted cost: the progress ring,
                        the alert dot and the hero chip now sit ON the artwork
                        rather than beside it. Their legibility against busy art
                        belongs to R-7 and R-6 — do not grow the tile's mark
                        budget here (D-85). */}
                    {/* ⚠️ The shift lives on this WRAPPER, not on the art.
                        `gi-token-land` animates the sprite's own `transform`, so
                        an inline `translateX` on the same element would be
                        overridden for the 400ms the landing plays — the Token
                        would snap to centre and jump right as it finished.
                        Splitting the two transforms across two elements is the
                        same fix `SpriteLayerView` uses for the loot arc. */}
                    <div
                        className="absolute inset-0"
                        style={{ transform: offset ? `translateX(${offset}px)` : undefined }}
                    >
                        <TokenSprite
                            typeId={token.typeId}
                            surface={TOKEN_SURFACE.BOARD}
                            alt={label}
                            className={cn(
                                'absolute inset-0 m-auto',
                                // Placement lands (D-230). Plays only when this tile's
                                // Token actually changes — never on load, never on a
                                // re-render — so a board of 48 does not bounce every
                                // time you open the game.
                                landing && 'gi-token-land'
                            )}
                        />
                    </div>

                    {/* Cycle progress. Ref-driven — see TileProgressRing. */}
                    <TileProgressRing tile={index} />
                </>
            )}

            {/* ONE alert mark (D-85). Several conditions can stop a tile — no
                inputs, hero unqualified, a context conflict, a Manager with an
                empty Vault — and they all collapse into a single "look at me",
                with the cause on hover (D-114).

                Outside the Token guard on purpose: D-133's `unstocked` belongs
                to a tile with **nothing on it**. That case is the one the player
                most needs to see, because it is the reason an unattended board
                quietly stopped. */}
            {token?.alert && (
                <span
                    title={ALERT_HINT[token.alert] || 'This tile cannot work'}
                    className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-gi-danger border border-black/50 shadow-[0_0_6px_2px_rgba(239,68,68,0.55)] pointer-events-auto"
                />
            )}

            {/* The hero OVERLAYS the Token they work (D-57) — they stand on top
                of it, so this sits above the art rather than beside it. They are
                drawn whether or not there IS a Token: a person on bare ground is
                a real state (D-60), and the one a returning player must be able
                to spot.

                Its own drag source, nested inside the tile's: heroes move
                TILE-TO-TILE directly, without a trip through the Dock (D-134),
                because reassigning the workforce is the game's most frequent
                action and must cost one drag, not two. Clicking instead recalls
                them — the 8px activation distance on the shared sensor is what
                separates the two. */}
            {token?.heroId && (
                <HeroBadge
                    index={index}
                    heroId={token.heroId}
                    heroName={heroName}
                    heroSprite={heroSprite}
                    offset={offset}
                    // Standing on nothing is the plainest idleness there is.
                    idle={!hasToken || !!token.alert}
                    onPickUp={onPickUp}
                />
            )}
        </div>
    );
};

/**
 * The hero standing on a Token: drag to redeploy, click to recall.
 *
 * ## A portrait, not a label (D-266)
 * Drawn at `TILE_PX` — the same size as the Token they work — and pushed
 * `PAIR_OFFSET_PX` to its left, vertically centred, so the two read as a person
 * standing with an object rather than a caption stuck on one.
 *
 * ## What you see and what you can grab are different shapes, on purpose
 * The art is 128px and `pointer-events-none`; the button under it is
 * `HERO_HIT_PX` wide. A hit area matching the art would cover the Token almost
 * entirely and steal both of the Token's gestures — click-to-inspect (D-145) and
 * the tile-to-tile drag. Sizing the box to the figure's body keeps the hero
 * grabbable for the redeploy drag (D-134), which is the game's most frequent
 * action, while leaving the Token's right side clickable.
 *
 * ## Two marks, two colours — and one of them is temporarily missing (D-172)
 * | Mark | Means | Fix |
 * | :-- | :-- | :-- |
 * | 🔴 red, on the Token | Staffed but stuck | Fix the supply or the layout |
 * | 🟡 yellow, on the hero | This person has nothing to do | Move them, or restock |
 *
 * ⚠️ **The yellow mark has no visual right now.** It lived on the name chip this
 * component replaced, and the owner deferred its replacement to a later
 * animation pass (2026-08-12) rather than porting a glow onto the portrait. That
 * is a real regression in the meantime, and worth naming plainly: **spotting
 * idle people is the main thing a returning player needs to do**, and until the
 * animation lands the only way to do it is to hover them one at a time.
 *
 * `idle` is therefore still computed and still reaches the tooltip — the
 * animation has a prop waiting for it, not a wire to re-run.
 */
const HeroBadge = ({ index, heroId, heroName, heroSprite, offset, idle, onPickUp }) => {
    const drag = useEntityDrag({
        id: `tile-hero-${index}`,
        kind: DRAG_KIND.HERO,
        payload: { heroId, name: heroName, from: { tile: index } },
        sourceSurface: DND_SURFACE.BOARD
    });

    // The portrait id resolves the same way it does in the Dock and on the drag
    // ghost. A hero with no usable portrait still gets a button: they are on the
    // board, and an invisible person is worse than an unrecognisable one.
    const art = heroSprite ? resolveSpritePath(heroSprite) : null;

    return (
        <button
            ref={drag.setNodeRef}
            {...drag.handleProps}
            type="button"
            onClick={(e) => { e.stopPropagation(); onPickUp?.(index); }}
            title={
                idle
                    ? `${heroName || 'Hero'} has nothing to do — move them, or restock this tile`
                    : `${heroName || 'Hero'} — drag to another tile, or click to recall`
            }
            style={{
                // Centred on the tile, then shifted left by the pair offset. The
                // box is narrower than the art, so it is positioned from its own
                // centre rather than pinned to a corner.
                left: (TILE_PX - HERO_HIT_PX) / 2 - offset,
                top: 0,
                width: HERO_HIT_PX,
                height: TILE_PX
            }}
            className={cn(
                'absolute pointer-events-auto',
                'cursor-grab active:cursor-grabbing',
                drag.isDragging && 'opacity-40'
            )}
        >
            {art && (
                <PixelArt
                    src={art}
                    alt={heroName || 'Hero'}
                    size={TILE_PX}
                    // Overflows the button on both sides — see above. Centred on
                    // the button's centre, which is already the shifted position.
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                />
            )}
        </button>
    );
};

export default BoardTile;
