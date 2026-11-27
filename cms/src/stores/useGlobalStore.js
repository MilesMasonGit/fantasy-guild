import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_GLOBALS } from '../utils/constants';

/** Global simulation constants store: the tuning knobs for the economic engine. */
export const useGlobalStore = create(
  persist(
    (set) => ({
      ...DEFAULT_GLOBALS,

      setGlobal: (key, value) => set({ [key]: value }),

      setSellModifier: (type, value) =>
        set((s) => ({
          sellModifiers: { ...s.sellModifiers, [type]: value },
        })),

      setHeroProfile: (tier, patch) =>
        set((s) => ({
          heroProfiles: {
            ...s.heroProfiles,
            [tier]: { ...s.heroProfiles[tier], ...patch },
          },
        })),

      resetGlobals: () => set(DEFAULT_GLOBALS),
    }),
    {
      name: 'fantasy-guild-cms-globals',
      /**
       * Version 2 adds `simDials`.
       * ⚠️ `migrate` is not enough on its own: zustand runs it only when the stored `version` is a number that differs from this one, so a workspace written before any version key existed is used as-is, and a store that installed `simDials` only in `migrate` would hand `runSim` an undefined dial set. The defaults are therefore filled in `merge`, which runs on every rehydration; `migrate` is kept for a numbered mismatch, which would otherwise throw the dials away.
       */
      version: 2,
      /** The default merge plus the dial defaults. The spread order is zustand's own default (persisted wins over the fresh store); `simDials` is then layered so a stored dial set keeps every value the developer turned and gains any dial added since. */
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState || {}),
        simDials: { ...DEFAULT_GLOBALS.simDials, ...(persistedState?.simDials || {}) },
      }),
      migrate: (persistedState, version) => {
        // ⚠️ zustand does not call `migrate` for a versionless blob, so the versionless path is `merge`'s.
        if (version < 1) {
          return {
            ...DEFAULT_GLOBALS,
            ...persistedState,
            gphTargets: DEFAULT_GLOBALS.gphTargets,
            xphTargets: DEFAULT_GLOBALS.xphTargets,
          };
        }
        return persistedState;
      },
    }
  )
);
