// Thin hooks applied in memory as the dev server serves these files; src/ on disk is never touched. With
// globalThis.__TR unset or empty every hook falls through to today's code (checked byte for byte against
// the captures taken before any hook existed). The options themselves live in trx.js.
export const PATCHES = {
    'src/config/registries/terrainRegistry.js': [
        [`export function generatedOf(lookId) {
    return getLook(lookId)?.generated || null;`, `export function generatedOf(lookId) {
    const trLook = globalThis.__TR?.looks?.[lookId];
    if (trLook) return trLook;
    return getLook(lookId)?.generated || null;`]
    ],
    'src/systems/board/TerrainGrass.js': [
        [`export const GRASS_RULES = Object.freeze({
    earthCell: 40,`, `export const GRASS_RULES = (globalThis.__TR_RULES = {
    earthCell: 40,`],
        [`        const steps = banks[waterStyle[i]];
        if (!steps) continue;`, `        const steps = banks[waterStyle[i]];
        if (!steps) continue;
        if (globalThis.__TR?.bank) {
            const trCode = globalThis.__TRX.bankCode(ctx, i, px, py, f);
            if (trCode >= 0) { shore[i] = trCode; continue; }
        }`],
        [`            ctx.bankReach = reach * PLAN_PIXEL_U;`, `            ctx.bankReach = Math.max(reach * PLAN_PIXEL_U, globalThis.__TR?.bankReach || 0);`],
        [`        waterField: pixels.water?.f || null, waterStyle: pixels.water?.style || null, banks: null, bankReach: 0, isLand: null`,
            `        waterField: pixels.water?.f || null, waterStyle: pixels.water?.style || null, banks: null, bankReach: 0, isLand: null, trWater: pixels.water || null`],
        [`    return { looks: slots, slotOf, bits: ctx.bits, kinds: ctx.kinds, thresholds, shore: ctx.shore, ring: ctx.ring, bands, banked: Boolean(ctx.banks) };`,
            `    return { looks: slots, slotOf, bits: ctx.bits, kinds: ctx.kinds, thresholds, shore: ctx.shore, ring: ctx.ring, bands, banked: Boolean(ctx.banks), trWater: pixels.water || null, trWidth: width };`],
        [`    const unshaded = new Uint8Array(COLOUR.COUNT);
    if (!rules.water) for (const i of UNSHADED) { unshaded[i] = 1; unshaded[COLOUR.DIM + i] = 1; }`,
            `    const unshaded = new Uint8Array(COLOUR.COUNT);
    if (!rules.water) for (const i of UNSHADED) { unshaded[i] = 1; unshaded[COLOUR.DIM + i] = 1; }
    const trExtra = globalThis.__TR ? globalThis.__TRX?.extraColours?.(lookId, rules, { cleanOf, cleanColour, ramp, lighten }) : null;
    if (trExtra) for (const [k, c] of trExtra) { colours[k] = c; colours[COLOUR.DIM + k] = c; unshaded[k] = 1; unshaded[COLOUR.DIM + k] = 1; }`],
        [`            if ((u & ON_EARTH) === ON || (shape[i + up2] & ON_EARTH) === ON || (shape[i + left] & ON_EARTH) === ON) col = E0;
            else if ((shape[i + down] & ON_EARTH) === ON || (shape[i + right] & ON_EARTH) === ON) col = E4;`,
            `            if ((u & ON_EARTH) === ON || (shape[i + up2] & ON_EARTH) === ON || (shape[i + left] & ON_EARTH) === ON) col = globalThis.__TR?.earthRim ? globalThis.__TR.earthRim[0] : E0;
            else if ((shape[i + down] & ON_EARTH) === ON || (shape[i + right] & ON_EARTH) === ON) col = globalThis.__TR?.earthRim ? globalThis.__TR.earthRim[1] : E4;`],
        [`            } else colour[i] = E0;
        } else if (((c > 0 && isGrass(i - 1))`, `            } else colour[i] = globalThis.__TR?.earthRim ? globalThis.__TR.earthRim[0] : E0;
        } else if (((c > 0 && isGrass(i - 1))`],
        [`        if (cls.fleck && hash(c, r, sFleck) < fleckCuts[slot]) col = COLOUR.FOAM2;
        colour[i] = col;`, `        if (cls.fleck && hash(c, r, sFleck) < fleckCuts[slot]) col = COLOUR.FOAM2;
        if (globalThis.__TR?.water) {
            const trCol = globalThis.__TRX.waterColour(ctx, grass, seed, c, r, p, slot);
            if (trCol >= 0) col = trCol;
        }
        colour[i] = col;`],
        [`            if (v >= lo && v < hi) {
                colour[i] = COLOUR.BANK + v - lo;`, `            if (v >= 230 && v < 249) {
                colour[i] = 100 + v - 230;
                pieceAt[i] = 0;
                continue;
            }
            if (v >= lo && v < hi) {
                colour[i] = COLOUR.BANK + v - lo;`],
        [`    drawEarthDetails(ctx, seed);
    grass.looks.forEach((id, slot) => {`, `    drawEarthDetails(ctx, seed);
    if (globalThis.__TR?.earth) globalThis.__TRX.afterEarth(ctx, seed, { base, kinds: ctx.kinds });
    grass.looks.forEach((id, slot) => {`],
        [`    if (grass.banked) drawBanks(ctx);
    const body = bodyUnderPieces(`, `    if (grass.banked) drawBanks(ctx);
    if (globalThis.__TR) globalThis.__TRX?.afterAll?.(ctx, grass, seed, { base });
    const body = bodyUnderPieces(`]
    ],
    'src/ui/components/board/groundScreen.js': [
        [`                    const rgb = table[k & (COLOUR.DIM - 1)];`, `                    const rgb = table[k & (COLOUR.DIM - 1)] || table[0];`]
    ],
    'src/ui/components/board/TerrainCanvas.jsx': [
        [`    const fit = useMatFit() || 1;
    const ready = useSheetsReady();`, `    globalThis.__TR_ground = ground;
    const fit = useMatFit() || 1;
    const ready = useSheetsReady();`]
    ],
    'src/systems/board/TerrainLattice.js': [
        [`    // Which palette entries some pixel shows: the cells' terrains (a strip only carries a`,
            `    if (globalThis.__TR?.edges) globalThis.__TRX.raggedEdges({ at, width, height, cells, cols, rows, cellPx, border, seed });

    // Which palette entries some pixel shows: the cells' terrains (a strip only carries a`]
    ],
    'src/systems/atlas/WaterShapes.js': [
        [`            shapes.push({ k: s.k, points, w: s.w });`, `            shapes.push({ k: s.k, points, w: s.w, hw: s.hw });`],
        [`function riverInto(out, lattice, shape, L, scratch) {
    const pts = shape.points;`, `function riverInto(out, lattice, shape, L, scratch) {
    if (shape.hw) return globalThis.__TRX.riverInto(out, lattice, shape, L, { span, STYLE, RIVER, BANK_PAD });
    const pts = shape.points;`],
        [`    const out = { f: new Float64Array(n).fill(FAR), style: new Uint8Array(n), lattice };`,
            `    const out = { f: new Float64Array(n).fill(FAR), style: new Uint8Array(n), lattice, trRecord: water };`],
        [`    river(points, hw0, hw1) {
        return { k: SHAPE.RIVER,`, `    river(points, hw0, hw1) {
        const trShape = globalThis.__TR?.river && !this.trOff
            ? globalThis.__TRX.river(this, points, hw0, hw1, { dist, foldsBack, simplify, smoothPath, flat, SHAPE, CHANNEL_HW, FOLD_WIDTHS })
            : null;
        if (trShape) return trShape;
        return { k: SHAPE.RIVER,`],
        [`    splitRiver() {
        const [a, b] = this.crossing();`, `    splitRiver() {
        this.trOff = true;
        const [a, b] = this.crossing();`]
    ]
};
