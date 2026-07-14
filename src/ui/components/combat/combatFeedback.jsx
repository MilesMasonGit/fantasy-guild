import React, { useEffect, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { EventBus } from '../../../systems/core/EventBus.js';

const FLOATER_MS = 1000;
const PULSE_MS = 300;

/**
 * useCombatFeedback — per-combatant animation state for the split combat
 * theatre (owner design 2026-07-14): the hero animates on the Hero card and
 * the enemy on the combat card. `side` is the combatant this element
 * represents; it lunges on its own attacks, and rattles + shows a damage
 * floater when the other side lands a hit on it.
 */
export function useCombatFeedback(cardId, side) {
    const [attacking, setAttacking] = useState(false);
    const [struck, setStruck] = useState(false);
    const [floaters, setFloaters] = useState([]);

    useEffect(() => {
        if (!cardId) return;
        let alive = true;

        const pushFloater = (f) => {
            const id = Math.random().toString(36).slice(2);
            setFloaters(prev => [...prev, { id, x: 30 + Math.random() * 30, y: 30 + Math.random() * 25, ...f }]);
            setTimeout(() => { if (alive) setFloaters(prev => prev.filter(n => n.id !== id)); }, FLOATER_MS);
        };
        const pulse = (setter) => {
            setter(true);
            setTimeout(() => { if (alive) setter(false); }, PULSE_MS);
        };

        const attackEvent = side === 'hero' ? 'combat_hero_attack' : 'combat_enemy_attack';
        const struckEvent = side === 'hero' ? 'combat_enemy_attack' : 'combat_hero_attack';

        const unsubs = [
            EventBus.subscribe(attackEvent, e => { if (e.cardId === cardId) pulse(setAttacking); }),
            EventBus.subscribe(struckEvent, e => {
                if (e.cardId !== cardId) return;
                pulse(setStruck);
                pushFloater({ value: e.damage || 0, hit: e.hit });
            })
        ];
        if (side === 'hero') {
            // Thorns-style reflected damage lands on the hero
            unsubs.push(EventBus.subscribe('combat_enemy_trait_trigger', e => {
                if (e.cardId !== cardId) return;
                pushFloater({ value: e.damage || 0, hit: true, variant: 'reflected' });
            }));
        }

        return () => { alive = false; unsubs.forEach(u => u()); };
    }, [cardId, side]);

    return { attacking, struck, floaters };
}

/** Floating damage/miss numbers, overlaid on the combatant's card. */
export const DamageFloaters = ({ floaters }) => {
    if (!floaters || floaters.length === 0) return null;
    return (
        <div className="absolute inset-0 pointer-events-none z-30 font-pixel overflow-hidden">
            {floaters.map(num => (
                <div
                    key={num.id}
                    className={cn(
                        'combat-floating-text-simple select-none font-pixel whitespace-nowrap',
                        !num.hit && 'combat-floating-text--miss',
                        num.hit && num.variant === 'reflected' && 'combat-floating-text--reflected',
                        num.hit && num.variant !== 'reflected' && 'combat-floating-text--damage'
                    )}
                    style={{ left: `${num.x}%`, top: `${num.y}%` }}
                >
                    {num.hit ? `-${num.value}` : 'MISS'}
                </div>
            ))}
        </div>
    );
};
