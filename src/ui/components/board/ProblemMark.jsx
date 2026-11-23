import { memo } from 'react';
import { PROBLEM_MARK_ART_PX, PROBLEM_SPRITE } from './problemMark.js';

/**
 * ProblemMark: a Token's one problem mark, the "!" in yellow (waiting) or red (can't), drawn at
 * the Token's own art-pixel size (`artUnit` mat units a pixel) with a hard shadow, in the Token's
 * centre, still. It has no tooltip: what is wrong is on the Token's card (right-click). Pressing it
 * grabs the Token (`dragProps`); `onClick` is for a problem a click fixes (a choice waiting: it
 * opens the card).
 * It flows in its parent's row unless `style` places it, so a mark can stand anywhere on the mat
 * (where an event stood, say). One element on the mat.
 */
export const ProblemMark = memo(function ProblemMark({ problem, artUnit = 2, dragProps = null, onClick = null, style = null }) {
    if (!problem) return null;
    const size = PROBLEM_MARK_ART_PX * artUnit;
    return (
        <img
            data-problem-mark={problem.kind}
            data-problem-severity={problem.severity}
            src={PROBLEM_SPRITE[problem.severity]}
            alt=""
            draggable={false}
            {...dragProps}
            onClick={onClick ? (e) => { e.stopPropagation(); onClick(e); } : undefined}
            className="relative shrink-0 pointer-events-auto select-none cursor-grab active:cursor-grabbing"
            style={{
                width: size,
                height: size,
                imageRendering: 'pixelated',
                filter: `drop-shadow(${artUnit}px ${artUnit}px 0 #000)`,
                ...style
            }}
        />
    );
});
