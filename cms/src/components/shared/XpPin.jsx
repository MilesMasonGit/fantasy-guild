/**
 * The pin beside an XP field (`sim.xpPinned`): ticked, Recalculate and Sync keep the number typed there instead of deriving it from the XPH curve, and unticked the next Recalculate derives it again. Shared by the Token and Recipe editors.
 * @param sim       the record's `sim` object, or undefined if it has none yet
 * @param onChange  called with a patch to merge into `sim`
 */
export default function XpPin({ sim, onChange }) {
  const pinned = sim?.xpPinned === true;
  return (
    <label className="flex items-start gap-1.5 mt-1.5 cursor-pointer select-none" data-xp-pin={pinned ? 'on' : 'off'}>
      <input
        type="checkbox"
        aria-label="Pin this XP number"
        checked={pinned}
        onChange={(e) => onChange({ xpPinned: e.target.checked ? true : undefined })}
        className="rounded border-white/10 cursor-pointer mt-0.5"
      />
      <span className="text-[10px] leading-relaxed" style={{ color: pinned ? 'var(--color-accent-hover)' : 'var(--color-text-muted)' }}>
        {pinned ? 'Pinned: Recalculate keeps this number. Untick to derive it again.' : 'Pin this number'}
      </span>
    </label>
  );
}
