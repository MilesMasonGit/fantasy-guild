import { create } from 'zustand';

/**
 * Simulation results store.
 * Populated after each "Run Simulation" batch.
 */
export const useSimulationStore = create((set) => ({
  // Audit results from the last simulation run
  auditResults: [],
  proposals: null,
  
  // Ghost updates from the last run (contains calculated EV, GPH, etc.)
  itemUpdates: {},
  taskUpdates: {},
  recipeUpdates: {},
  enemyUpdates: {},

  // Simulation state
  isRunning: false,
  progress: 0,
  progressLabel: '',
  lastRunTimestamp: null,
  progressionReports: {},

  // Actions
  setRunning: (isRunning) => set({ isRunning }),
  setProgress: (progress, label) => set({ progress, progressLabel: label || '' }),
  setAuditResults: (results, progressionReports, proposals, itemUpdates, taskUpdates, recipeUpdates, enemyUpdates) =>
    set({
      auditResults: results,
      progressionReports: progressionReports || {},
      proposals: proposals || null,
      itemUpdates: itemUpdates || {},
      taskUpdates: taskUpdates || {},
      recipeUpdates: recipeUpdates || {},
      enemyUpdates: enemyUpdates || {},
      lastRunTimestamp: Date.now(),
    }),
  clearResults: () => set({ 
    auditResults: [], 
    proposals: null, 
    itemUpdates: {}, 
    taskUpdates: {}, 
    recipeUpdates: {}, 
    enemyUpdates: {},
    lastRunTimestamp: null 
  }),
}));
