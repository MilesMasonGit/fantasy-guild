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

  /**
   * The economic simulator's own output (phase P6).
   *
   * - `simAnswers` — one record per Token/Recipe for the Simulator panel's
   *   "the sim answered" half (`engine/sim/answers.js` builds them).
   * - `churnReport` — the last run's churn report (`engine/sim/churn.js`).
   *   ⚠️ It is also the **input to the next run's refusal diff**, through its
   *   `refusalKeys`, so it must survive between runs. It is not persisted: a
   *   reload starts the diff over, and the report says so by claiming nothing
   *   new on a first run.
   */
  simAnswers: {},
  churnReport: null,
  /**
   * The Map check's table (phase P7) — one report per Map: derived level,
   * cost, scrap side against its bound, productive side against its bound, and
   * the verdict. A skipped Map (guild-hall, empty pool) is in the list with a
   * `skipped` reason rather than missing from it, so the table can say why.
   */
  mapReports: [],
  /**
   * The last run's rows, as the passes produced them (phase P9).
   *
   * The audit panel gets rows flattened into prose through the auditor's
   * refusal channel, which is one line each and loses the structure. The
   * anchor re-elect card needs the structure — which item, which stored
   * election, which candidate would win — so the rows are kept here as well.
   * Same data, two readers, one run.
   */
  simRows: [],
  /**
   * One chain trail per item (`engine/sim/chain.js`) — criterion 11's
   * explainability surface, reachable from the Item editor.
   */
  simChains: {},
  /**
   * Anchor re-elections the designer has waved away this session, keyed
   * `itemId|wouldElectId`.
   *
   * ⚠️ Deliberately **not** persisted and deliberately keyed by the candidate:
   * dismissing "this Token would out-rank the stored anchor" says nothing about
   * the *next* Token that out-ranks it, so a new candidate raises the row again.
   * A dismissal is a "not now", not a setting.
   */
  dismissedElections: {},

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
  /** Land the simulator's own output. Kept separate from `setAuditResults`
   *  so the seven-argument legacy signature does not have to grow again. */
  setSimResults: ({ simAnswers, churnReport, mapReports, simRows, simChains }) => set({
    simAnswers: simAnswers || {},
    churnReport: churnReport || null,
    mapReports: mapReports || [],
    simRows: simRows || [],
    simChains: simChains || {},
  }),
  /** Hide one anchor re-election prompt for the rest of the session. */
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
