import { Waves } from 'lucide-react';
import { spotRateOf, SPOT_RATE_MAX } from '../../../../src/config/registries/fishingSpots.js';
import { Section, Field } from '../shared/EditorLayout';

/**
 * Raises the spot rate (`spotRate: { percent }`): any Token may carry it. On the water within the
 * standard reach of it, fishing spots arrive that much more often. The game's reader is
 * `src/config/registries/fishingSpots.js` (`spotRateOf`); the engine is
 * `src/systems/board/FishingSpots.js`.
 *
 * Written only while ticked: unticking drops the key, so every other Token's record stays
 * byte-identical.
 */

const NEW_RATE = Object.freeze({ percent: 100 });

export default function SpotRateBlock({ token, onPatch }) {
  const raw = token?.spotRate && typeof token.spotRate === 'object' && !Array.isArray(token.spotRate) ? token.spotRate : null;
  const percent = raw ? spotRateOf(token) : 0;

  return (
    <Section title="Draws fishing spots" icon={<Waves size={14} />}>
      <div data-field="spot-rate" className="space-y-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            aria-label="Draws fishing spots"
            data-spot-rate-on
            checked={!!raw}
            onChange={(e) => onPatch({ spotRate: e.target.checked ? { ...NEW_RATE } : undefined })}
            className="rounded border-white/10 text-emerald-500 cursor-pointer"
          />
          <span className="text-xs text-gray-300">Fishing spots arrive more often on the water in its reach</span>
        </label>

        {raw && (
          <>
            <Field label="More often in its reach (%)">
              <input
                type="number" min={0} max={SPOT_RATE_MAX} step={5} aria-label="Spot rate raise" data-spot-rate-percent
                value={raw.percent ?? 0}
                onChange={(e) => onPatch({ spotRate: { ...raw, percent: Math.max(0, Number(e.target.value) || 0) } })}
                className="w-full"
              />
            </Field>
            <p data-spot-rate-summary className="text-[10px] text-gray-500 leading-relaxed">
              {percent > 0
                ? <>On the water in its reach, spots arrive {percent}% more often; the water beyond it, as before. Several Tokens that reach the same water add up, and a spot kind's most at once still holds.</>
                : <>At 0% it raises nothing.</>}
            </p>
          </>
        )}
      </div>
    </Section>
  );
}
