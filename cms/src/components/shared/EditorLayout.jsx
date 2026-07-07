import React from 'react';
import { Trash2, Sparkles, Image } from 'lucide-react';
import { slugify } from '../../utils/idGenerator';
import { useEntityStore } from '../../stores/useEntityStore';
import { resolveSpritePath } from '../../../../src/utils/AssetManager.js';

export function Header({ name, id, onDelete, onSuggest, deleteLabel = "DELETE", sprite, isBackground, isEnemy }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className={
          isBackground 
            ? "w-24 h-12 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 select-none overflow-hidden relative"
            : isEnemy
              ? "w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 select-none overflow-hidden relative"
              : "w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 select-none overflow-hidden relative"
        }>
          {(() => {
            const resolvedPath = sprite ? resolveSpritePath(sprite) : null;
            if (resolvedPath) {
              const imgSrc = resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`;
              return (
                <>
                  <img 
                    src={imgSrc} 
                    className={
                      isBackground
                        ? "w-full h-full object-cover pixel-art"
                        : isEnemy
                          ? "max-w-[64px] max-h-[64px] object-contain pixel-art"
                          : "w-10 h-10 object-contain pixel-art"
                    } 
                    alt={name} 
                    onError={(e) => {
                      e.target.style.display = 'none';
                      const fb = e.target.nextElementSibling;
                      if (fb) fb.style.display = 'block';
                    }} 
                  />
                  <Image size={18} className="text-gray-600" style={{ display: 'none' }} />
                </>
              );
            }
            return <Image size={18} className="text-gray-600" />;
          })()}
        </div>
        <div>
          <h2 className="text-xl font-bold text-white leading-tight">{name}</h2>
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-tighter block mt-0.5">{id}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onSuggest && (
          <button 
            onClick={onSuggest} 
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all text-xs font-bold"
          >
            <Sparkles size={14} /> AI Suggest
          </button>
        )}
        {onDelete && (
          <button 
            onClick={onDelete} 
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all text-xs font-bold"
          >
            <Trash2 size={14} /> {deleteLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export function Section({ title, icon, children, className = "" }) {
  return (
    <section className={`rounded-xl p-5 border bg-[#1a1a1e] border-white/10 space-y-4 ${className}`}>
      <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-gray-500">
        {icon} {title}
      </h3>
      {children}
    </section>
  );
}

export function Field({ label, className = "", children }) {
  return (
    <div className={className}>
      <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-gray-500 select-none">{label}</label>
      {children}
    </div>
  );
}

export function Empty({ text }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-gray-500 gap-4">
      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/5 opacity-50 select-none">
        <Image size={24} className="text-gray-600" />
      </div>
      <p className="text-sm">{text}</p>
    </div>
  );
}

export function Metric({ label, value, suffix = '', color = 'text-gray-400' }) {
  const formatted = typeof value === 'number' ? Math.round(value) : (value || '—');
  return (
    <div className="flex flex-col">
      <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest select-none">{label}</span>
      <span className={`text-xs font-mono font-black truncate ${color}`}>
        {formatted}{formatted !== '—' && suffix}
      </span>
    </div>
  );
}

export function IdSyncField({ entity, entityType, onUpdate }) {
  const handleRename = (newId) => {
    useEntityStore.getState().renameEntityId(entity.id, newId, entityType);
  };

  return (
    <>
      <Field label="Entity ID">
        <input
          type="text"
          value={entity.id}
          disabled={entity.autoSyncId ?? true}
          onChange={(e) => handleRename(e.target.value)}
          className={`w-full font-mono text-xs ${(entity.autoSyncId ?? true) ? 'bg-black/20 border-white/5 text-gray-500 cursor-not-allowed' : 'bg-black/40 border-white/10 text-white'}`}
          placeholder={`${entityType}_id`}
        />
      </Field>
      <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
        <input 
          type="checkbox" 
          id={`autoSyncId_${entity.id}`}
          checked={entity.autoSyncId ?? true} 
          onChange={(e) => {
            const checked = e.target.checked;
            onUpdate('autoSyncId', checked);
            if (checked) {
              const desiredId = slugify(entity.name, entityType);
              if (desiredId && desiredId !== entity.id) {
                handleRename(desiredId);
              }
            }
          }}
          className="rounded border-white/10 text-emerald-500 focus:ring-emerald-500/50 cursor-pointer"
        />
        <div className="flex flex-col">
          <label htmlFor={`autoSyncId_${entity.id}`} className="text-xs font-bold text-white select-none cursor-pointer">
            Auto-Sync ID with Name
          </label>
        </div>
      </div>
    </>
  );
}
