// the event timings, kept together (no tuning page exists yet)

/** ⭐ Game value: the shortest time between one event ending and the next landing, in game ms. */
export const EVENT_WAIT_MIN_MS = 45 * 60 * 1000;

/** ⭐ Game value: the longest time between one event ending and the next landing, in game ms. */
export const EVENT_WAIT_MAX_MS = 75 * 60 * 1000;

/** ⭐ Game value: when nothing could land, the time until the next try. */
export const EVENT_RETRY_MS = 5 * 60 * 1000;

/** ⭐ Game value: how long a rich node stays on the mat, worked or not. */
export const UNWORKED_LEAVE_MS = 60 * 60 * 1000;
