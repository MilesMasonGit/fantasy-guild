import { useState } from 'react';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { cn } from '../../utils/cn.js';

/**
 * SkillIcon — Displays a pixel-art sprite (standard 32px) for skills with authored sprites,
 * falling back gracefully to the skill's emoji icon.
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

    const rawId = (typeof skill === 'string' ? skill : (skill?.id || skillId)) || '';
    const normalizedId = String(rawId).toLowerCase().trim();
    const cleanId = normalizedId.startsWith('skill_') ? normalizedId.substring('skill_'.length) : normalizedId;

    const def = (typeof skill === 'object' && skill !== null)
        ? skill
        : (cleanId ? getSkill(cleanId) || getSkill(normalizedId) : null);

    // List of skills that currently have pixel art sprite assets
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

    // Resolve sprite from definition, AssetManager, or standard directory path
    let spritePath = def?.sprite || (cleanId ? resolveSpritePath(def || cleanId || normalizedId) : null);
    if (!spritePath && cleanId && KNOWN_SKILL_SPRITES.has(cleanId)) {
        spritePath = `assets/skills/skill_${cleanId}.png`;
    }

    const hasSprite = !hasError && Boolean(spritePath);
    const name = def?.name || cleanId || 'Skill';
    const emoji = def?.icon || '✨';

    if (hasSprite) {
        return (
            <img
                src={spritePath}
                alt={alt || name}
                width={size}
                height={size}
                style={{ width: `${size}px`, height: `${size}px` }}
                className={cn('object-contain pixelated shrink-0 inline-block align-middle select-none', className)}
                onError={() => setHasError(true)}
            />
        );
    }

    return (
        <span
            style={{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.max(12, Math.round(size * 0.62))}px` }}
            className={cn('inline-flex items-center justify-center shrink-0 leading-none select-none align-middle', className)}
            title={alt || name}
        >
            {emoji}
        </span>
    );
};

export default SkillIcon;
