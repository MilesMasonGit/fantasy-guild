import { glyphSrc, GLYPH_COLOUR } from './combatGlyphs.js';

/** One combat glyph as a picture, `scale` screen pixels an art pixel (whole numbers only). */
export const CombatGlyph = ({ name, colour = GLYPH_COLOUR.text, scale = 2, outlined = false, style, ...rest }) => {
    const n = (outlined ? 10 : 8) * scale;
    return (
        <img
            src={glyphSrc(name, colour, outlined)}
            alt=""
            aria-hidden="true"
            draggable={false}
            data-glyph={name}
            className="select-none pointer-events-none shrink-0"
            style={{ width: n, height: n, imageRendering: 'pixelated', ...style }}
            {...rest}
        />
    );
};

export default CombatGlyph;
