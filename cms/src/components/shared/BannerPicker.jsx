import { areaBannerIds, areaBannerSrc, areaBannerLabel } from '../../../../src/config/areaBanners.js';

/**
 * Pick an area banner (`public/assets/backgrounds/area/`): the picture a Region shows behind its
 * row in the Atlas, the top bar's Region name and the arrival card. The first tile, Default,
 * leaves the pick to the game, which chooses by the Region's main biome (`defaultBanner`).
 *
 * @param {{ value?: string|null, defaultBanner: string, onChange: (id: string|null) => void }} props
 */
export default function BannerPicker({ value, defaultBanner, onChange }) {
  const ids = areaBannerIds();
  const picked = value && ids.includes(value) ? value : null;
  const tile = (id, label, selected, onClick, dataId) => (
    <button
      key={dataId}
      type="button"
      data-banner-choice={dataId}
      aria-pressed={selected}
      title={label}
      onClick={onClick}
      className="flex flex-col items-center gap-1 p-1 rounded-lg text-[10px] text-gray-400 hover:text-white"
      style={{
        background: 'none',
        border: `2px solid ${selected ? 'var(--color-accent-primary, #fbbf24)' : 'rgba(255,255,255,0.08)'}`,
        cursor: 'pointer',
      }}
    >
      <img src={areaBannerSrc(id)} alt="" className="w-16 h-16 pixel-art" style={{ imageRendering: 'pixelated', objectFit: 'cover', opacity: dataId === 'default' ? 0.55 : 1 }} />
      <span className="max-w-16 truncate">{label}</span>
    </button>
  );
  return (
    <div data-banner-picker className="space-y-2">
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))' }}>
        {tile(defaultBanner, `Default (${areaBannerLabel(defaultBanner)})`, !picked, () => onChange(null), 'default')}
        {ids.map((id) => tile(id, areaBannerLabel(id), picked === id, () => onChange(id), id))}
      </div>
      {value && !picked && (
        <p className="text-[11px]" style={{ color: 'var(--color-warning)' }}>
          {value} is not a picture in public/assets/backgrounds/area/: the game shows the default.
        </p>
      )}
    </div>
  );
}
