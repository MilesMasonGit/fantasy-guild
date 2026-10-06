import { create } from 'zustand';

/** Simulation results store. */
export const useSimulationStore = create((set) => ({
  auditResults: [],
  proposals: null,
  
  itemUpdates: {},
  taskUpdates: {},
  recipeUpdates: {},
  enemyUpdates: {},

  /** The economic simulator's own output. `simAnswers` is one record per Token/Recipe for the Simulator panel's answer half. `churnReport` is the last run's report and also the input to the next run's refusal diff through its `refusalKeys`; it is not persisted, so a reload starts the diff over and the report claims nothing new on a first run. */
  simAnswers: {},
  churnReport: null,
  /** The Map check's table, one report per Map. A skipped Map (guild-hall, empty pool) stays in the list with a `skipped` reason rather than missing, so the table can say why. */
  mapReports: [],
  /** The last run's rows, as the passes produced them. The audit panel gets rows flattened into prose, which loses the structure the anchor re-elect card needs (which item, which stored election, which candidate would win), so they are kept here as well. */
  simRows: [],
  /** One chain trail per item, keyed by item id for the Item editor. */
  simChains: {},
  /**
   * Anchor re-elections the designer has waved away this session, keyed `itemId|wouldElectId`.
   * ⚠️ Deliberately not persisted and keyed by the candidate: dismissing one candidate says nothing about the next Token that out-ranks it, so a dismissal is a not-now, not a setting.
   */
  dismissedElections: {},

  isRunning: false,
  progress: 0,
  progressLabel: '',
  lastRunTimestamp: null,
  progressionReports: {},

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
  /** Land the simulator's own output. Kept separate from `setAuditResults` so its legacy signature does not have to grow again. */
  setSimResults: ({ simAnswers, churnReport, mapReports, simRows, simChains }) => set({
    simAnswers: simAnswers || {},
    churnReport: churnReport || null,
    mapReports: mapReports || [],
    simRows: simRows || [],
    simChains: simChains || {},
  }),
  dismissElection: (key) => set((s) => ({
    dismissedElections: { ...s.dismissedElections, [key]: true },
  })),
  clearResults: () => set({
    auditResults: [],
    simAnswers: {},
    churnReport: null,
    mapReports: [],
    simRows: [],
    simChains: {},
    dismissedElections: {},
    proposals: null, 
    itemUpdates: {}, 
    taskUpdates: {}, 
    recipeUpdates: {}, 
    enemyUpdates: {},
    lastRunTimestamp: null 
  }),
}));
