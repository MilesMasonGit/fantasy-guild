import { useSimulationStore } from '../../stores/useSimulationStore';
import { fingerprint } from '../../engine/sim/answers';
import { formatHours, LONG_LIFETIME_HOURS, SHORT_LIFETIME_HOURS } from '../../engine/sim/checkPass';

/**
 * The **"the sim answered" half** of the Simulator panel (plan §15.1, phase P6)
 * — read-only, filled by the last Recalculate, shared by the Token editor and
 * the Recipe editor so there is one surface rather than two that drift.
 *
 * What it shows, in the order §15.1 asks for:
 * - the cycle time it chose, inside its band;
 * - per output, the item's value with an **anchor** or **inherits** badge;
 * - any tuning, stated as a **diff** ("range 1–3 → 2–4");
 * - the **earn gauge** — a dot inside a bracket, readable without numbers;
 * - any **refusal cards** inline, not only in the audit panel;
 * - the grey **stale — recalculate** badge when the record has been edited
 *   since the run.
 *
 * ⚠️ Deliberately plain. The deliverable here is the information, not the
 * flourish — and everything it renders is computed in `engine/sim/answers.js`,
 * so this file holds no economics of its own.
 *
 * @param entityId  the Token or Recipe id
 * @param record    the live record, for the stale check
 */
export default function SimAnswer({ entityId, record }) {
  const answer = useSimulationStore((s) => s.simAnswers[entityId]);

  if (!answer) {
    return (
      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
        Nothing yet — press <strong>Recalculate</strong> in the top bar and the
        simulator's answer appears here.
      </p>
    );
  }

  const stale = fingerprint(record) !== answer.fingerprint;

  return (
    <div className="space-y-3">
      {stale && (
        <div
          className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded inline-block"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-muted)' }}
        >
          stale — recalculate
        </div>
      )}

      {answer.skipped === 'inert' && (
        <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          No work cycle, so there is nothing here to balance.
        </p>
      )}
      {answer.skipped === 'untagged' && (
        <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          Untagged — the simulator does not guess a Tempo or a Purpose, so it
          left every number exactly as you typed it.
        </p>
      )}

      {answer.cycleTimeMs != null && (
        <Line label="Cycle">
          {Math.round(answer.cycleTimeMs / 1000)}s
          {answer.band && (
            <span style={{ color: 'var(--color-text-muted)' }}>
              {' '}· {answer.tempo} band {Math.round(answer.band.minMs / 1000)}–
              {Math.round(answer.band.maxMs / 1000)}s{answer.band.topIsSoft ? '+' : ''}
            </span>
          )}
        </Line>
      )}

      {answer.outputs.length > 0 && (
        <div className="space-y-1.5">
          {answer.outputs.map((o) => (
            <div key={o.itemId} className="text-[11px] leading-relaxed">
              <span style={{ color: 'var(--color-text-secondary)' }}>{o.itemId}</span>
              {' '}
              {o.value == null ? (
                <span style={{ color: 'var(--color-warning)' }}>has no value yet</span>
              ) : o.anchored ? (
                <>
                  <Badge tone="accent">sets</Badge>
                  <strong style={{ color: 'var(--color-text-primary)' }}> {o.value}g</strong>
                </>
              ) : (
                <>
                  <Badge tone="muted">inherits</Badge>
                  <strong style={{ color: 'var(--color-text-primary)' }}> {o.value}g</strong>
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    {' '}from {o.sourceName ?? o.sourceId}
                  </span>
                </>
              )}
              {/* F9's standing caption. Value-absorbs-yield is the one
                  behaviour of this tool that inverts a designer's instinct, and
                  the churn report after the fact is too late to be the first
                  warning. */}
              {o.anchored && (
                <span className="block text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                  changing this yield changes {o.itemId}'s price, not this one's earnings
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {answer.tuning && (
        <Line label="Tuned">
          <span style={{ color: 'var(--color-text-primary)' }}>{answer.tuning.diff}</span>
          <span style={{ color: 'var(--color-text-muted)' }}> · one lever ({answer.tuning.lever})</span>
        </Line>
      )}

      {answer.earn && <EarnGauge earn={answer.earn} />}

      {answer.lifetime && <LifetimeLine lifetime={answer.lifetime} />}

      {answer.notJudged && (
        <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
          {answer.notJudged === 'unpriced-inputs'
            ? 'Not judged — one of its inputs has no value yet, so any verdict would be guesswork.'
            : answer.notJudged === 'craft-margin-floor'
              ? 'Not judged — the craft-margin dial set this price rather than its Purpose target.'
              : 'Not judged — nothing it makes has a value.'}
        </p>
      )}

      {answer.refusals.map((r, i) => <RefusalCard key={`${r.code}-${i}`} refusal={r} />)}
    </div>
  );
}

/** A labelled line, the panel's one layout primitive. */
function Line({ label, children }) {
  return (
    <div className="text-[11px] leading-relaxed">
      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </span>
      <span> {children}</span>
    </div>
  );
}

function Badge({ tone, children }) {
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
      style={{
        background: tone === 'accent' ? 'var(--color-accent-muted)' : 'rgba(255,255,255,0.06)',
        color: tone === 'accent' ? 'var(--color-accent-hover)' : 'var(--color-text-muted)',
      }}
    >
      {children}
    </span>
  );
}

/**
 * The earn gauge: a dot inside a bracket.
 *
 * §15.1 asks for something *readable without numbers* — the bracket is the
 * band, the dot is where this source actually earns. The axis runs from nothing
 * to twice the target, so a dot pinned at either end reads as "way off" without
 * anyone having to do arithmetic. The numbers are still printed underneath for
 * anyone who wants them.
 */
function EarnGauge({ earn }) {
  const axisMax = earn.targetPerHour * 2;
  const pct = (v) => Math.max(0, Math.min(100, (v / axisMax) * 100));
  const lo = pct(earn.targetPerHour * (1 - earn.band));
  const hi = pct(earn.targetPerHour * (1 + earn.band));
  const dot = pct(earn.profitPerHour);
  const inside = earn.profitPerHour >= earn.targetPerHour * (1 - earn.band)
    && earn.profitPerHour <= earn.targetPerHour * (1 + earn.band);

  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
        Earns
      </div>
      <div className="relative h-4 rounded" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {/* the band */}
        <div
          className="absolute top-0 bottom-0 rounded"
          style={{ left: `${lo}%`, width: `${Math.max(hi - lo, 1)}%`, background: 'rgba(255,255,255,0.10)' }}
        />
        {/* the target */}
        <div className="absolute top-0 bottom-0" style={{ left: `${pct(earn.targetPerHour)}%`, width: 1, background: 'rgba(255,255,255,0.25)' }} />
        {/* the dot */}
        <div
          className="absolute rounded-full"
          style={{
            left: `calc(${dot}% - 4px)`, top: 4, width: 8, height: 8,
            background: inside ? 'var(--color-success, #10b981)' : 'var(--color-warning, #f59e0b)',
          }}
        />
      </div>
      <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
        {Math.round(earn.profitPerHour)}g/h against a target of {Math.round(earn.targetPerHour)}g/h
        {' '}(±{Math.round(earn.band * 100)}%)
      </div>
    </div>
  );
}

/**
 * The lifetime line, **hours first** (plan §15.1, CMS-135).
 *
 * > "lives ~3.1h · returns ~14× its find cost"
 *
 * Hours-first is the ruled way to think about charges: a raw count answers
 * nothing on its own, because 25 charges is twenty minutes on a fast Token and
 * most of a day on a heavy one. The count still shows, beside the translation —
 * charges stay hand-typed (D-176 untouched) and the author needs to see the
 * number they typed.
 *
 * The two scale heuristics from the ruling are echoed here as a quiet caption,
 * and filed properly as Info rows by the check pass. This is the early warning;
 * the audit row is the record.
 */
function LifetimeLine({ lifetime }) {
  const long = !lifetime.unlimited && lifetime.hours > LONG_LIFETIME_HOURS;
  const short = !lifetime.unlimited && lifetime.hours < SHORT_LIFETIME_HOURS;

  return (
    <Line label="Lifetime">
      <span style={{ color: 'var(--color-text-primary)' }}>
        lives ~{formatHours(lifetime.hours)}
      </span>
      {lifetime.returnFactor != null && (
        <span style={{ color: 'var(--color-text-primary)' }}>
          {' '}· returns ~{lifetime.returnFactor < 10
            ? lifetime.returnFactor.toFixed(1)
            : Math.round(lifetime.returnFactor)}× its find cost
        </span>
      )}
      <span style={{ color: 'var(--color-text-muted)' }}>
        {lifetime.unlimited
          ? ' · never runs out, so this is the assumed-lifetime dial, not a measurement'
          : ` · ${lifetime.charges} charges at the cycle above`}
        {lifetime.findCost != null && ` · found for ${lifetime.findCost}g of a burst`}
      </span>
      {(long || short) && (
        <span className="block text-[10px]" style={{ color: 'var(--color-warning, #f59e0b)' }}>
          {long
            ? 'one copy lasts over a day at the board — scenery rather than a supply, and the audit says so if it is Common'
            : 'spent in under ten minutes — a player will barely see it run'}
        </span>
      )}
    </Line>
  );
}

/**
 * One refusal, inline (plan §12): what, why in game terms, and ranked remedies.
 * Every remedy names a tag or a dial — that is the catalogue's job, not this
 * component's.
 */
function RefusalCard({ refusal }) {
  const colour = refusal.severity === 'critical'
    ? 'var(--color-error, #ef4444)'
    : refusal.severity === 'warning'
      ? 'var(--color-warning, #f59e0b)'
      : 'var(--color-info, #3b82f6)';

  return (
    <div className="rounded-lg p-2.5 border" style={{ borderColor: `${colour}55`, background: `${colour}12` }}>
      <div className="text-[11px] font-bold" style={{ color: colour }}>
        {refusal.what ?? refusal.message}
      </div>
      {refusal.why && (
        <div className="text-[10px] mt-1 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          {refusal.why}
        </div>
      )}
      {refusal.remedies.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {refusal.remedies.map((remedy, i) => (
            <li key={i} className="text-[10px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              → {remedy}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
