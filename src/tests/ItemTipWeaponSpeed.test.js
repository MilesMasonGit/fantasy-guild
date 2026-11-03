import { describe, it, expect } from 'vitest';
import { itemTipFacts } from '../ui/components/drawer/ItemTip.jsx';
import { secondsText } from '../ui/components/combat/fightView.js';
import { attackSpeedMs } from '../config/FormulaRegistry.js';

/** A weapon's tooltip says how fast it swings, in the seconds the enemy card and the fight panel use. */

const weapon = (extra) => ({ id: 'wt_weapon', equipSlot: 'hand', styles: ['melee'], damage: 2, ...extra });

describe('the item tooltip names a weapon\'s speed', () => {
    it.each([
        ['fast', 'Fast swing, every 2 s'],
        ['normal', 'Normal swing, every 3 s'],
        ['slow', 'Slow swing, every 4 s']
    ])('%s', (speed, line) => {
        expect(itemTipFacts(weapon({ speed })).speed).toBe(line);
    });

    it('an unnamed or unknown speed reads as the normal swing the fight gives it', () => {
        expect(itemTipFacts(weapon({})).speed).toBe('Normal swing, every 3 s');
        expect(itemTipFacts(weapon({ speed: 'blazing' })).speed).toBe('Normal swing, every 3 s');
    });

    it('agrees with the seconds the combat cards show', () => {
        expect(itemTipFacts(weapon({ speed: 'slow' })).speed).toContain(secondsText(attackSpeedMs('slow')));
    });

    it('still says damage, style and two-handed', () => {
        const facts = itemTipFacts(weapon({ speed: 'slow', damage: 3, hands: 2 }));
        expect(facts.hits).toBe('Hits 3 Slash, as Melee');
        expect(facts.twoHanded).toBe(true);
    });

    it('⚠️ says nothing on what is not a weapon', () => {
        expect(itemTipFacts({ id: 'wt_hat', equipSlot: 'hat' }).speed).toBeNull();
    });
});
