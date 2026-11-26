/**
 * The pin under a record's outputs (`sim.outputsPinned`): ticked, Recalculate and Sync keep every output's count and chance as written instead of tuning them toward the earnings band, and unticked the next Recalculate may tune them again. Shared by the Token and Recipe editors, like the time and XP pins.
 * @param sim       the record's `sim` object, or undefined if it has none yet
 * @param onChange  called with a patch to merge into `sim`
 */
export default function OutputsPin({ sim, onChange }) {
  const pinned = sim?.outputsPinned === true;
  return (
    <label className="flex items-start gap-1.5 mt-2 px-1 cursor-pointer select-none" data-outputs-pin={pinned ? 'on' : 'off'}>
      <input
        type="checkbox"
        aria-label="Pin these outputs"
        checked={pinned}
        onChange={(e) => onChange({ outputsPinned: e.target.checked ? true : undefined })}
        className="rounded border-white/10 cursor-pointer mt-0.5"
      />
      <span className="text-[10px] leading-relaxed" style={{ color: pinned ? 'var(--color-accent-hover)' : 'var(--color-text-muted)' }}>
        {pinned ? 'Pinned: Recalculate keeps these counts and chances. Untick to let it tune them again.' : 'Pin these counts and chances'}
      </span>
    </label>
  );
}
