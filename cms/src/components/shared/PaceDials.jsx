/**
 * The **Pace dials** (plan §13.1 / §13.2 / §14, phase P8) — the two earn
 * curves, the player the projections assume, and the mastery expectation.
 *
 * ## Why numeric pin rows and a read-only curve
 *
 * The plan offers "pin editors over a drawn curve — draggable points, or
 * numeric rows if dragging fights the sitting", and is explicit that **the dial
 * is the deliverable, not the flourish**. Dragging a point over a log axis
 * spanning three orders of magnitude is a fiddly way to type 24,200, and a
 * half-working drag is worse than none — so the pins are typed, and the curve
 * beside them is a read-out that redraws as they are typed. Every edit is exact
 * and legible, and a kinked curve still shows up the moment it is made.
 *
 * ## The mastery read-out is the load-bearing part
 *
 * `skillMasteryHours` is an **expectation, not an input** — no pass reads it.
 * The number beside it is what the XP curve *actually* integrates to against
 * the game's own threshold table (`src/utils/XPCurve.js`), so moving an XPH pin
 * moves the read-out and a developer sees at once whether the climb still lands
 * where the plan says it should. A target shown without the actual would be a
 * dial that lies.
 *
 * ⚠️ Lives in its own file rather than inside `SettingsModal` because it is the
 * largest section in that modal by some way, and because the Map dials next to
 * it are the precedent for "one section, one concern".
 */

import { useGlobalStore } from '../../stores/useGlobalStore';
import { Section, Field } from './EditorLayout';
import { GPH_PINS, XPH_PINS, normaliseDials, gphAt } from '../../engine/sim/dials';
import { hoursToMastery, xphAt } from '../../engine/sim/xpPass';

/** The band plan §13.2 says one focused skill's climb should land inside. */
const MASTERY_BAND = Object.freeze({ min: 50, max: 60 });

const num = (value, fallback) => (Number.isFinite(value) ? value : fallback);
const inputClass = 'w-full text-emerald-400 font-bold font-mono text-xs';
const note = 'text-[10px] text-gray-500 italic';

export default function PaceDials() {
  const globals = useGlobalStore();
  const dials = globals.simDials || {};
  const setDial = (key, value) => globals.setGlobal('simDials', { ...dials, [key]: value });

  const gphPins = dials.gphPins || GPH_PINS;
  const xphPins = dials.xphPins || XPH_PINS;
  const setPin = (key, base, level, value) => setDial(key, { ...base, [level]: value });

  // The climb the current pins actually produce. `normaliseDials` refuses a
  // dial set the simulator would refuse, and a half-typed number in some other
  // section must not blank the whole settings modal.
  let actualHours;
  try {
    actualHours = hoursToMastery(normaliseDials(dials));
  } catch {
    actualHours = null;
  }
  const inBand = Number.isFinite(actualHours)
    && actualHours >= MASTERY_BAND.min && actualHours <= MASTERY_BAND.max;

  return (
    <Section title="Pace Dials — the earn curves (economic simulator §13.1–13.2)">
      <p className={`${note} block mb-3`}>
        Two curves, one growth number. Gold per hour and experience per hour are both pinned
        and read by straight lines between the pins, so moving one pin moves only the two
        segments touching it. The drawing is a read-out of the numbers below it.
      </p>

      <CurvePreview gphPins={gphPins} xphPins={xphPins} hoursPerDay={num(dials.hoursPerDay, 8)} />

      <div className="grid grid-cols-2 gap-6 mt-4">
        <PinColumn
          title="Gold per hour (§13.1)"
          pins={gphPins}
          fallback={GPH_PINS}
          onChange={(level, value) => setPin('gphPins', gphPins, level, value)}
          hint="A floor, not an average: it balances the just-qualified worker, and a hero levelled past the gate out-earns it through the speed bonus."
        />
        <PinColumn
          title="Experience per hour (§13.2)"
          pins={xphPins}
          fallback={XPH_PINS}
          onChange={(level, value) => setPin('xphPins', xphPins, level, value)}
          hint="7.5% per level all the way to 99 — unlike gold, this curve never flattens. A source splits off it by its Purpose tag: XPH 1.0, IPH 0.5, GPH 0.3."
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <Field label="Hours Per Day (the assumed player)">
          <div className="flex flex-col gap-1">
            <input
              type="number" step="1" min="1" max="24"
              value={num(dials.hoursPerDay, 8)}
              onChange={(e) => setDial('hoursPerDay', Number(e.target.value))}
              className={inputClass}
            />
            <span className={note}>
              How long the projected player plays. Not a property of the game — it is what turns
              board-hours into the "day in reach" column on the Map Economics tab.
            </span>
          </div>
        </Field>

        <Field label="Skill Mastery Hours (1→99, expected)">
          <div className="flex flex-col gap-1">
            <input
              type="number" step="1" min="1"
              value={num(dials.skillMasteryHours, 55)}
              onChange={(e) => setDial('skillMasteryHours', Number(e.target.value))}
              className={inputClass}
            />
            <span className={note}>
              An expectation, not an input — no pass reads it. The XP curve above is integrated
              against the game's own XP thresholds, and that is the number to watch:
            </span>
            <span
              className="text-xs font-mono font-bold"
              style={{ color: inBand ? 'var(--color-success, #10b981)' : 'var(--color-warning, #f59e0b)' }}
            >
              {Number.isFinite(actualHours)
                ? `these pins climb 1→99 in ${actualHours.toFixed(1)} board-hours`
                  + (inBand ? '' : ` — outside the ${MASTERY_BAND.min}–${MASTERY_BAND.max} band`)
                : 'these pins do not produce a finite climb'}
            </span>
          </div>
        </Field>
      </div>
    </Section>
  );
}

/** One curve's pins as a typed column, sorted by level. */
function PinColumn({ title, pins, fallback, onChange, hint }) {
  const levels = Object.keys(pins).map(Number).sort((a, b) => a - b);
  return (
    <div>
      <h4 className="text-xs font-bold uppercase text-amber-400 mb-2">{title}</h4>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {levels.map((level) => (
          <label key={level} className="flex items-center gap-2">
            <span className="text-[10px] font-mono w-10 shrink-0" style={{ color: 'var(--color-text-muted)' }}>
              lv {level}
            </span>
            <input
              type="number" step="1" min="0"
              value={num(pins[level], fallback[level] ?? 0)}
              onChange={(e) => onChange(level, Number(e.target.value))}
              className={inputClass}
            />
          </label>
        ))}
      </div>
      <p className={`${note} block mt-2`}>{hint}</p>
    </div>
  );
}

/**
 * Both curves drawn on a shared logarithmic axis, with a dot on every pin.
 *
 * Log, because the curves span three orders of magnitude and on a linear axis
 * everything below level 60 lies flat on the floor. On a log axis steady
 * compounding is a straight line — which makes the gold curve's deliberate bend
 * at level 70 read as a bend, exactly the thing a developer editing pins needs
 * to see.
 */
function CurvePreview({ gphPins, xphPins, hoursPerDay }) {
  const W = 640;
  const H = 130;
  const pad = { l: 10, r: 10, t: 8, b: 14 };
  const safe = (v) => (Number.isFinite(v) && v > 0 ? v : 1);

  // The same straight-line reading the passes take, done locally so the preview
  // cannot throw on a dial set the store has not normalised yet.
  const read = (pins, level) => {
    const levels = Object.keys(pins).map(Number).sort((a, b) => a - b);
    if (levels.length === 0) return 1;
    if (level <= levels[0]) return safe(pins[levels[0]]);
    if (level >= levels[levels.length - 1]) return safe(pins[levels[levels.length - 1]]);
    for (let i = 0; i < levels.length - 1; i++) {
      const lo = levels[i];
      const hi = levels[i + 1];
      if (level >= lo && level <= hi) {
        const t = (level - lo) / (hi - lo);
        return safe(safe(pins[lo]) + t * (safe(pins[hi]) - safe(pins[lo])));
      }
    }
    return safe(pins[levels[levels.length - 1]]);
  };

  const samples = [];
  for (let level = 1; level <= 99; level++) samples.push(level);
  const values = samples.flatMap((l) => [read(gphPins, l), read(xphPins, l)]);
  const lo = Math.log10(Math.min(...values));
  const hi = Math.log10(Math.max(...values));
  const span = hi - lo || 1;

  const x = (level) => pad.l + ((level - 1) / 98) * (W - pad.l - pad.r);
  const y = (value) => pad.t + (1 - (Math.log10(safe(value)) - lo) / span) * (H - pad.t - pad.b);
  const line = (pins) => samples.map((l) => `${x(l).toFixed(1)},${y(read(pins, l)).toFixed(1)}`).join(' ');
  const dots = (pins) => Object.keys(pins).map(Number).sort((a, b) => a - b)
    .map((l) => ({ l, v: safe(pins[l]) }));
  const ticks = [1, 20, 40, 60, 80, 99];

  return (
    <div className="rounded-lg border p-2" style={{ borderColor: 'var(--color-border-subtle)' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ display: 'block' }}
        role="img"
        aria-label="Gold and experience per hour by level, on a logarithmic axis"
      >
        {ticks.map((l) => (
          <line
            key={l} x1={x(l)} y1={pad.t} x2={x(l)} y2={H - pad.b}
            stroke="var(--color-border-subtle, #333)" strokeWidth="1"
          />
        ))}
        {ticks.map((l) => (
          <text key={`t${l}`} x={x(l)} y={H - 3} fontSize="8" textAnchor="middle" fill="var(--color-text-muted, #888)">
            {l}
          </text>
        ))}
        <polyline points={line(gphPins)} fill="none" stroke="#fbbf24" strokeWidth="1.5" />
        <polyline points={line(xphPins)} fill="none" stroke="#38bdf8" strokeWidth="1.5" />
        {dots(gphPins).map(({ l, v }) => <circle key={`g${l}`} cx={x(l)} cy={y(v)} r="2.5" fill="#fbbf24" />)}
        {dots(xphPins).map(({ l, v }) => <circle key={`x${l}`} cx={x(l)} cy={y(v)} r="2.5" fill="#38bdf8" />)}
      </svg>
      <div className="flex flex-wrap gap-x-4 mt-1 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
        <span><span style={{ color: '#fbbf24' }}>&#9632;</span> gold / hour</span>
        <span><span style={{ color: '#38bdf8' }}>&#9632;</span> experience / hour</span>
        <span className="italic">logarithmic — a straight line is steady compounding</span>
        <span className="ml-auto font-mono">
          {`at lv 50: ${Math.round(gphAt(50, { gphPins })).toLocaleString()}g/h · `}
          {`${Math.round(xphAt(50, { xphPins })).toLocaleString()} xp/h · ${hoursPerDay}h/day`}
        </span>
      </div>
    </div>
  );
}
