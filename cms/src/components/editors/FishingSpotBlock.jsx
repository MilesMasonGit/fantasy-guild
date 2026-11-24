import { FishingHook } from 'lucide-react';
import { WATER_KIND_CHOICES, spotOf } from '../../../../src/config/registries/fishingSpots.js';
import { BIOMES } from '../../../../src/config/biomeTerrain.js';
import { Section, Field } from '../shared/EditorLayout';

/**
 * A fishing spot kind (`spot: { water, biomes, everyMinutes, most, leaveChance, unworkedMinutes }`):
 * a Token that arrives on the mat's water by itself and leaves again. The game's reader is
 * `src/config/registries/fishingSpots.js`; the engine is `src/systems/board/FishingSpots.js`.
 *
 * Written only while ticked: unticking drops the key, so every other Token's record stays
 * byte-identical. Ticking it on a Token that stands nowhere yet also ticks Water in Stands on, since
 * a spot can only land on water.
 */

const NEW_SPOT = Object.freeze({ water: ['sea', 'fresh'], everyMinutes: 10, most: 3, leaveChance: 5, unworkedMinutes: 30 });

const biomeLabel = (id) => id.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/** A chip row's next list: `id` toggled, kept in `order`. */
const toggled = (list, id, order) => {
  const now = Array.isArray(list) ? list : [];
  const next = now.includes(id) ? now.filter((x) => x !== id) : [...now, id];
  return order.filter((x) => next.includes(x));
};

function Chip({ on, onClick, children, ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`px-2 py-0.5 rounded-md text-[11px] border transition-colors ${on
        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
        : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-200'}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export default function FishingSpotBlock({ token, onPatch }) {
  const raw = token?.spot && typeof token.spot === 'object' ? token.spot : null;
  const spot = raw ? spotOf(token) : null;
  const waterOrder = WATER_KIND_CHOICES.map((c) => c.id);

  const setSpot = (patch) => onPatch({ spot: { ...raw, ...patch } });
  const number = (key) => (e) => setSpot({ [key]: Math.max(0, Number(e.target.value) || 0) });

  const turnOn = () => {
    const patch = { spot: { ...NEW_SPOT } };
    if (!(token.standsOn || []).length) patch.standsOn = ['water'];
    onPatch(patch);
  };

  return (
    <Section title="Fishing spot" icon={<FishingHook size={14} />}>
      <div data-field="fishing-spot" className="space-y-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            aria-label="A fishing spot"
            data-spot-on
            checked={!!raw}
            onChange={(e) => (e.target.checked ? turnOn() : onPatch({ spot: undefined }))}
            className="rounded border-white/10 text-emerald-500 cursor-pointer"
          />
          <span className="text-xs text-gray-300">A fishing spot: arrives on the water by itself and leaves again</span>
        </label>

        {raw && (
          <>
            <div title="The water it lands on. None ticked: it never arrives by itself (an event may still land it).">
              <span className="text-xs text-gray-300">Lands on</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {WATER_KIND_CHOICES.map((c) => (
                  <Chip key={c.id} data-spot-water={c.id} on={(raw.water || []).includes(c.id)} onClick={() => setSpot({ water: toggled(raw.water, c.id, waterOrder) })}>
                    {c.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div title="The Regions it arrives in, by biome. None ticked: any Region.">
              <span className="text-xs text-gray-300">In</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {BIOMES.map((b) => (
                  <Chip key={b} data-spot-biome={b} on={(raw.biomes || []).includes(b)} onClick={() => setSpot({ biomes: toggled(raw.biomes, b, BIOMES) })}>
                    {biomeLabel(b)}
                  </Chip>
                ))}
                {!(raw.biomes || []).length && <span className="text-[10px] ml-1 text-gray-500">any Region</span>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Arrives about every (minutes)">
                <input type="number" min={0} step={0.5} aria-label="Arrives about every" data-spot-every value={raw.everyMinutes ?? 0} onChange={number('everyMinutes')} className="w-full" />
              </Field>
              <Field label="Most at once on a mat">
                <input type="number" min={0} step={1} aria-label="Most at once" data-spot-most value={raw.most ?? 0} onChange={number('most')} className="w-full" />
              </Field>
              <Field label="Moves on after a catch (%)">
                <input type="number" min={0} max={100} step={0.5} aria-label="Chance to move on" data-spot-leave value={raw.leaveChance ?? 0} onChange={number('leaveChance')} className="w-full" />
              </Field>
              <Field label="Drifts off unworked after (minutes)">
                <input type="number" min={0} step={1} aria-label="Drifts off unworked after" data-spot-unworked value={raw.unworkedMinutes ?? 0} onChange={number('unworkedMinutes')} className="w-full" />
              </Field>
            </div>
            <p data-spot-summary className="text-[10px] text-gray-500 leading-relaxed">
              {spot?.everyMs > 0 && spot.water.length && spot.most > 0
                ? <>One arrives every {raw.everyMinutes} minutes or so (each wait drawn from half to one and a half of it), up to {spot.most} on a mat at once.</>
                : <>It never arrives by itself: give it a water, a rate and a most of at least 1 (an event can still land it).</>}
              {' '}Each catch has a {spot?.leaveChance || 0}% chance it moves on
              {spot?.unworkedMs > 0 ? <>; with nobody working it, it drifts off after {raw.unworkedMinutes} minutes.</> : <>; unworked, it stays.</>}
              {' '}It never counts toward the Token cap. Its catch is its catch pools: a pool can name the water and biomes it holds for.
            </p>
          </>
        )}
      </div>
    </Section>
  );
}
