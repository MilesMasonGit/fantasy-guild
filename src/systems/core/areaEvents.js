// Fantasy Guild - Area-Scoped Event Names (Deck Loop rework, Phase 2 §2F)

/**
 * Area-scoped event naming convention: `area:<event_name>`.
 *
 * Every event in this registry carries an `{ areaId }` payload (plus
 * event-specific extras). Subscribers filter on `payload.areaId` and ignore
 * events for other areas entirely — this is the core of the performance
 * architecture that lets 12 areas run simultaneously without cascade
 * recalculations (see roadmap Appendix B, pattern 1).
 *
 * Global events (`inventory_updated`, `collection_updated`, ...) are still
 * used for truly global changes, but they must NOT trigger per-card stat
 * recalculation — only area-scoped events do that.
 */
export const AREA_EVENTS = {
    /** A card was slotted/unslotted/swapped in this area's deck. Payload: { areaId } */
    DECK_UPDATED: 'area:deck_updated',
    /** The active card finished its task in this area. Payload: { areaId, slotIndex, templateId } */
    CARD_COMPLETED: 'area:card_completed',
    /** The hero assignment or hero equipment changed for this area. Payload: { areaId, heroId } */
    HERO_CHANGED: 'area:hero_changed',
    /** This area's deck slots need stat recalculation. Payload: { areaId } */
    STATS_DIRTY: 'area:stats_dirty',
    /** This area toggled between adventure/stationed. Payload: { areaId, mode } */
    MODE_SWITCHED: 'area:mode_switched',
    /** The station card slotted in this area changed. Payload: { areaId, stationTemplateId } */
    STATION_CHANGED: 'area:station_changed',
    /** A craft cycle completed at this area's station. Payload: { areaId, recipeId } */
    CRAFT_COMPLETED: 'area:craft_completed',
    /** Combat delegated by the loop resolved. Payload: { areaId, outcome: 'victory'|'defeat' } */
    COMBAT_RESOLVED: 'area:combat_resolved',
    /** High-frequency active-card progress tick (ref-based UI updates only, Phase 6 §D). Payload: { areaId, percent } */
    PROGRESS: 'area:progress'
};
