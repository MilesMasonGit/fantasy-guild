import { cn } from '../../utils/cn.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { landmarkLines } from './landmarkLines.js';

const names = {
    skillName: (id) => getSkill(id)?.name || id,
    itemName: (id) => getItem(id)?.name || id
};

/** A landmark's inspection block: what its challenge needs (`landmarkLines.js`). Nothing for any other Token. */
export const LandmarkBlock = ({ def }) => {
    const block = landmarkLines(def, names);
    if (!block) return null;
    return (
        <div data-landmark className="flex flex-col gap-1 px-3 py-2 rounded-lg bg-[#181412] border border-gi-gold/40 text-xs">
            <span className="text-[10px] font-bold gi-caps tracking-wider text-gi-gold">{block.title}</span>
            {block.lines.map((line, i) => (
                <div key={i} className="flex items-start justify-between gap-2">
                    <span className="text-gi-muted">{line.label}</span>
                    <span className={cn('text-right tabular-nums', line.placeholder ? 'italic text-gi-muted' : 'font-bold text-gi-text')}>
                        {line.value}
                    </span>
                </div>
            ))}
            <p className="text-[10px] text-gi-muted leading-relaxed">{block.note}</p>
        </div>
    );
};
