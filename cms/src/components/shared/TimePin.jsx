/**
 * The pin beside a cycle-time field (`sim.timePinned`): ticked, Recalculate and Sync keep the time typed there instead of deriving it from the Tempo band, and unticked the next Recalculate derives it again. Shared by the Token and Recipe editors, like the XP pin.
 * @param sim       the record's `sim` object, or undefined if it has none yet
 * @param onChange  called with a patch to merge into `sim`
 */
export default function TimePin({ sim, onChange }) {
  const pinned = sim?.timePinned === true;
  return (
    <label className="flex items-start gap-1.5 mt-1.5 cursor-pointer select-none" data-time-pin={pinned ? 'on' : 'off'}>
      <input
        type="checkbox"
        aria-label="Pin this cycle time"
        checked={pinned}
        onChange={(e) => onChange({ timePinned: e.target.checked ? true : undefined })}
        className="rounded border-white/10 cursor-pointer mt-0.5"
      />
      <span className="text-[10px] leading-relaxed" style={{ color: pinned ? 'var(--color-accent-hover)' : 'var(--color-text-muted)' }}>
        {pinned ? 'Pinned: Recalculate keeps this time. Untick to derive it again.' : 'Pin this time'}
      </span>
    </label>
  );
}
