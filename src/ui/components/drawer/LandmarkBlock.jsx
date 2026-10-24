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
        <div data-landmark className="flex flex-col gap-1 px-2 py-1.5 bg-black/65 text-xs">
            <span className="ui-text-body font-bold gi-caps tracking-wider text-gi-gold">{block.title}</span>
            {block.lines.map((line, i) => (
                <div key={i} className="flex items-start justify-between gap-2">
                    <span className="text-gi-muted">{line.label}</span>
                    <span className={cn('text-right tabular-nums', line.placeholder ? 'italic text-gi-muted' : 'font-bold text-gi-text')}>
                        {line.value}
                    </span>
                </div>
            ))}
            <p className="ui-text-body text-gi-muted leading-relaxed">{block.note}</p>
        </div>
    );
};
