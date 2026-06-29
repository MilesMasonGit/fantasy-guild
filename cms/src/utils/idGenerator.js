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

/**
 * Converts a string to a clean, lowercase snake_case slug suitable for an ID.
 * @param {string} name
 * @param {string} prefix
 * @returns {string}
 */
export function slugify(name, prefix = '') {
  if (!name) return prefix;
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_') // replace non-alphanumeric chars with _
    .replace(/^_+|_+$/g, '');   // trim leading/trailing underscores
  return prefix ? `${prefix}_${slug}` : slug;
}

