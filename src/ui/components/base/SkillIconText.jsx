import { SkillIcon } from './SkillIcon.jsx';

/**
 * Words with skill icons inline, as the level-requirement writer (`systems/core/levelNeed.js`)
 * places them: `icons` is `[{ skill, at }]`, each icon drawn just before character `at` of `text`.
 * Text without icons draws as plain text.
 */
// ⚠️ Inline: the unlayered reset in `styles/main.css` makes every img a block, which would put the
// icon on a line of its own; an inline-block box around it keeps it in the words.
const INLINE = { display: 'inline-block', verticalAlign: 'middle', lineHeight: 0 };

export const SkillIconText = ({ text, icons = null, size = 16 }) => {
    const shown = (icons || []).filter(i => i?.skill && i.at >= 0 && i.at <= text.length).sort((a, b) => a.at - b.at);
    if (!shown.length) return text;
    const out = [];
    let from = 0;
    shown.forEach((icon, n) => {
        if (icon.at > from) out.push(text.slice(from, icon.at));
        out.push(
            <span key={`i${n}`} data-skill-icon-text={icon.skill} aria-hidden="true" style={INLINE}>
                <SkillIcon skill={icon.skill} size={size} className="mr-0.5" />
            </span>
        );
        from = icon.at;
    });
    if (from < text.length) out.push(text.slice(from));
    return <>{out}</>;
};

export default SkillIconText;
