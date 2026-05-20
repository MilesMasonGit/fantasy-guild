let counter = Date.now();

/**
 * Generates a unique ID with a descriptive prefix.
 * @param {'item' | 'task' | 'enemy' | 'area' | 'quest' | 'subskill'} prefix
 * @returns {string}
 */
export function generateId(prefix = 'entity') {
  counter += 1;
  return `${prefix}_${counter.toString(36)}`;
}
