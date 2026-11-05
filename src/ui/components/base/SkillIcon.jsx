import { useState } from 'react';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { cn } from '../../utils/cn.js';

/** Skills that currently have pixel art sprite assets. */
const KNOWN_SKILL_SPRITES = new Set([
    'mining',
    'logging',
    'fishing',
    'smithing',
    'crafting',
    'cooking',
    'melee',
    'ranged',
    'magic',
    'crime',
    'nature',
    'occult',
    'culinary',
    'farming',
    'flask',
    'industry',
    'nautical',
    'social'
]);

/**
 * The shared stand-in for a skill with no icon yet (`owner_art_list.md`, section 9): a plain
 * stepped stone, 16 art pixels like the skill icons. Drawn here because the art folder is the
 * owner's.
 */
const PLACEHOLDER_SVG = "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' shape-rendering='crispEdges'>"
    + "<path fill='#000' d='M4 1h8v1h2v2h1v8h-1v2h-2v1H4v-1H2v-2H1V4h1V2h2z'/>"
    + "<path fill='#6b6259' d='M4 2h8v1h1v1h1v8h-1v1h-1v1H4v-1H3v-1H2V4h1V3h1z'/>"
    + "<path fill='#8d8378' d='M6 5h4v1h1v4h-1v1H6v-1H5V6h1z'/>"
    + '</svg>';
export const SKILL_PLACEHOLDER_SPRITE = `data:image/svg+xml,${encodeURIComponent(PLACEHOLDER_SVG)}`;

/**
 * A skill's definition and sprite path (the shared placeholder when it has no icon), from its id
 * or definition (`skillId` when `skill` is neither).
 * @returns {{ def: Object|null, cleanId: string, spritePath: string }}
 */
export function skillArt(skill, skillId) {
    const rawId = (typeof skill === 'string' ? skill : (skill?.id || skillId)) || '';
    const normalizedId = String(rawId).toLowerCase().trim();
    const cleanId = normalizedId.startsWith('skill_') ? normalizedId.substring('skill_'.length) : normalizedId;

    const def = (typeof skill === 'object' && skill !== null)
        ? skill
        : (cleanId ? getSkill(cleanId) || getSkill(normalizedId) : null);

    let spritePath = def?.sprite || (cleanId ? resolveSpritePath(def || cleanId || normalizedId) : null);
    if (!spritePath && cleanId && KNOWN_SKILL_SPRITES.has(cleanId)) {
        spritePath = `assets/skills/s_${cleanId}.png`;
    }
    return { def, cleanId, spritePath: spritePath || SKILL_PLACEHOLDER_SPRITE };
}

/**
 * SkillIcon: a skill's pixel icon at a whole multiple of its art (standard 32 px). Never an emoji:
 * a skill with no art, or art that fails to load, draws the shared placeholder.
 *
 * @param {Object} props
 * @param {string|Object} props.skill - Skill ID or Skill definition object
 * @param {string} [props.skillId] - Alternative direct skill ID prop
 * @param {number} [props.size=32] - Display size in pixels (standard: 32)
 * @param {string} [props.className] - Additional CSS classes
 * @param {string} [props.alt] - Alt text for accessibility
 */
export const SkillIcon = ({
    skill,
    skillId,
    size = 32,
    className = '',
    alt
}) => {
    const [hasError, setHasError] = useState(false);

    const { def, cleanId, spritePath } = skillArt(skill, skillId);

    return (
        <img
            src={hasError ? SKILL_PLACEHOLDER_SPRITE : spritePath}
            alt={alt || def?.name || cleanId || 'Skill'}
            width={size}
            height={size}
            // ⚠️ Inline: no `pixelated` class exists, and without the property the browser
            // smooths the 16 px art into a blur.
            style={{ width: `${size}px`, height: `${size}px`, imageRendering: 'pixelated' }}
            className={cn('object-contain shrink-0 inline-block align-middle select-none', className)}
            onError={() => setHasError(true)}
        />
    );
};

export default SkillIcon;
