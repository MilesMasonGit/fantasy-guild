import { memo, useState } from 'react';
import { Tooltip } from '../base/Tooltip.jsx';
import { PROBLEM_COLOUR, PROBLEM_MARK_ART_PX, PROBLEM_SPRITE } from './problemMark.js';

/**
 * ProblemMark: a Token's one problem mark, the "!" in yellow (waiting) or red (can't), drawn at
 * the Token's own art-pixel size (`artUnit` mat units a pixel) with a hard shadow. Hovering it
 * shows the kit's tooltip with exactly what is wrong; `tip` is read when the pointer arrives (a
 * string, or a function that reads the engine), never per render. Pressing it grabs the Token
 * (`dragProps`); `onClick` is for a problem a click fixes (choosing a recipe).
 * One element on the mat; the tooltip exists only while hovered.
 */
export const ProblemMark = memo(function ProblemMark({ problem, tip, artUnit = 2, dragProps = null, onClick = null }) {
    const [text, setText] = useState(null);
    if (!problem) return null;
    const size = PROBLEM_MARK_ART_PX * artUnit;
    const read = () => setText(typeof tip === 'function' ? tip() : tip);
    return (
        <Tooltip content={text ? <span style={{ color: PROBLEM_COLOUR[problem.severity] }}>{text}</span> : null}>
            <img
                data-problem-mark={problem.kind}
                data-problem-severity={problem.severity}
                src={PROBLEM_SPRITE[problem.severity]}
                alt=""
                draggable={false}
                {...dragProps}
                onPointerEnter={read}
                onClick={onClick ? (e) => { e.stopPropagation(); onClick(e); } : undefined}
                className="relative shrink-0 pointer-events-auto select-none cursor-grab active:cursor-grabbing"
                style={{
                    width: size,
                    height: size,
                    imageRendering: 'pixelated',
                    filter: `drop-shadow(${artUnit}px ${artUnit}px 0 #000)`
                }}
            />
        </Tooltip>
    );
});

export default ProblemMark;
