// Throwaway (brief 460 P1): evaluated in the running game's page by capture.mjs. It adds one <style>
// that swaps each soft effect for its proposed hard version, so the same screen can be shot before
// and after. Nothing here is game code.
// window.HP.look('before' | 'after' | 'afterB')   afterB = after, plus a 2 px hard outline on the mat's words
// window.HP.floater(tokenId)                      the -1 floater's own markup on a Token (it is switched off in the game)
(() => {
    const GOLD = '#facc15';
    const hardRing = (c, p) => [[p, 0], [-p, 0], [0, p], [0, -p]].map(([x, y]) => `drop-shadow(${x}px ${y}px 0 ${c})`).join(' ');
    const AFTER = `
/* Words on the mat: the soft filter shadow goes; the game's global 1 px hard outline stays. */
[data-token-name] span, [data-charge-floater] > div { filter: none !important; }
/* State badges: a hard black copy one art pixel down-right, like the problem mark's. */
[data-station-gear] > button, [data-tile-disallowed], [data-demolish-badge] { filter: drop-shadow(2px 2px 0 #000) !important; }
/* Nav bubbles: the icon's hard shadow, one orb art pixel straight down. */
[data-alpha-circle] > svg { filter: drop-shadow(0 4px 0 rgba(0,0,0,0.75)) !important; }
/* A bubble that takes a dropped item: the green ring alone, no glow. */
.ring-gi-success { box-shadow: 0 0 0 4px var(--color-gi-success, #22c55e) !important; }
/* The Token Summary's lit Tokens: the gold attention outline (UI_STYLE), hard. */
[data-summary-highlight="true"] { filter: ${hardRing(GOLD, 2)} !important; }
/* The drag ghost's refusal mark: hard shadow, and still (no glow, no bounce). */
[data-hp-ghost-mark], img[alt="Disallow"].animate-bounce { filter: drop-shadow(2px 2px 0 #000) !important; animation: none !important; }
/* A ribbon's item grown on hover: a hard shadow down-right instead of the soft cloud. */
.group:hover [data-item-bar-sprite] { filter: drop-shadow(2px 2px 0 #000) !important; }
`;
    const AFTER_B = `
[data-token-name] span, [data-charge-floater] > div { text-shadow: var(--shadow-outline-2) !important; }
`;
    const style = document.createElement('style');
    style.id = 'hp-look';
    document.head.appendChild(style);
    window.HP = {
        look(mode) {
            style.textContent = mode === 'after' ? AFTER : mode === 'afterB' ? AFTER + AFTER_B : '';
        },
        // The floater exactly as TokenChargeDeltaFloater draws it, held still at full strength.
        // A badge's own markup (TokenBadges.jsx) in a Token's middle row, for the two the starter
        // camp cannot show: the demolition mark (its Tokens cannot be demolished) and the gold
        // gear (none of its stations has a recipe to pick yet).
        badge(tokenId, kind, iconSrc) {
            const token = document.querySelector(`[data-token-overlay="${tokenId}"]`) || document.querySelector(`[data-token-id="${tokenId}"]`);
            const row = document.createElement('div');
            row.setAttribute('data-hp-badge', kind);
            row.className = 'absolute z-20 flex items-center justify-center pointer-events-none';
            Object.assign(row.style, { left: '0', width: '100%', top: '50%', transform: 'translateY(-50%)' });
            if (kind === 'marked') {
                row.innerHTML = `<div data-demolish-badge="true" class="shrink-0 select-none w-7 h-7 flex items-center justify-center rounded-full bg-black/70 border border-gi-warning/80 filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"><img src="${iconSrc}" style="width:16px;height:16px;image-rendering:pixelated"></div>`;
            } else {
                // On a Token the gear is the problem mark's size: 16 art pixels x 2 = 32 mat units.
                const mask = (dx, dy) => `left:${dx}px;top:${dy}px;width:32px;height:32px;mask-image:url('/assets/ui/u_gear.png');-webkit-mask-image:url('/assets/ui/u_gear.png');mask-size:100% 100%;-webkit-mask-size:100% 100%;mask-repeat:no-repeat;image-rendering:pixelated`;
                const outline = [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([dx, dy]) => `<span class="gi-gear-alert absolute pointer-events-none" style="${mask(dx, dy)}"></span>`).join('');
                row.innerHTML = `<div data-station-gear="unset" class="relative shrink-0"><button type="button" style="width:32px;height:32px" class="flex items-center justify-center p-0 select-none filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] relative">${outline}<img src="/assets/ui/u_gear.png" class="relative object-contain pointer-events-none" style="width:32px;height:32px;image-rendering:pixelated"></button></div>`;
            }
            token.appendChild(row);
            const r = row.firstElementChild.getBoundingClientRect();
            return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
        },
        // Inside the Token's own box, so it takes the mat's scale like the real one.
        floater(tokenId, text = '-1') {
            document.querySelector('[data-hp-floater]')?.remove();
            const token = document.querySelector(`[data-token-overlay="${tokenId}"]`) || document.querySelector(`[data-token-id="${tokenId}"]`);
            const host = document.createElement('div');
            host.setAttribute('data-hp-floater', '');
            host.setAttribute('data-charge-floater', 'ring');
            host.className = 'absolute z-50 pointer-events-none';
            host.style.left = '58%';
            host.style.top = '18%';
            const d = document.createElement('div');
            d.className = 'font-bold ui-text-title tabular-nums leading-none tracking-tight pointer-events-none select-none drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)] whitespace-nowrap text-amber-200';
            d.textContent = text;
            host.appendChild(d);
            token.appendChild(host);
            const r = d.getBoundingClientRect();
            return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
        }
    };
    return 'ok';
})();
