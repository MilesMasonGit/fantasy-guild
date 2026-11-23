import { Tooltip } from './Tooltip.jsx';
import { explainOf } from './effectExplain.js';

/**
 * An effect's name that explains itself on hover (its palette `explains`). Plain text for an
 * effect with no description.
 * ⚠️ Not inside another `Tooltip`'s box: that box follows the pointer, so a hover in it can never
 * be reached. A tooltip lists the descriptions as lines instead (`explainLinesOf`).
 */
export const EffectName = ({ type, children }) => {
    const e = explainOf(type);
    const text = children ?? e?.name ?? type;
    if (!e) return <span>{text}</span>;
    return (
        <Tooltip title={e.name} lines={[e.text]}>
            <span data-effect-name={type} className="cursor-help underline decoration-dotted decoration-white/40">{text}</span>
        </Tooltip>
    );
};

/**
 * A rule line from its segments (`renderSegments`), each effect name hoverable; `hover={false}`
 * for plain text inside a tooltip.
 */
export const RuleLine = ({ segments, hover = true, className, ...rest }) => (
    <span className={className} {...rest}>
        {segments.map((s, i) => (s.effect && hover
            ? <EffectName key={i} type={s.effect}>{s.text}</EffectName>
            : <span key={i}>{s.text}</span>))}
    </span>
);
