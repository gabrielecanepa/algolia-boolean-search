/**
 * Check if a string is double quoted.
 *
 * @param {string} string String to check
 * @returns {boolean} `true` if double quoted
 */
export const isDoubleQuoted = string =>
  string.startsWith('"') &&
  string.endsWith('"') &&
  string
    .slice(1, -1)
    .split('')
    .every(char => char !== '"')

/**
 * Remove quotes from a word.
 *
 * @param {string} word Word to remove quotes from
 * @returns {string} Word without quotes
 */
export const normalizeWord = word => (isDoubleQuoted(word) ? word.slice(1, -1) : word)

/**
 * Titleize a string.
 * @example "hello world" -> "Hello World"
 *
 * @param {string} string String to titleize
 * @returns {string} Titleized string
 */
export const titleize = string =>
  string
    .split(' ')
    .map(word => `${word[0].toUpperCase()}${word.slice(1)}`)
    .join(' ')

/**
 * Titleize label and highlighted terms for a refinement list item
 *
 * @param {array} items Array of refinement list items
 * @returns {array} Array of items with titleized label and highlighted terms
 */
export const titleizeItems = items =>
  items.map(({ label, highlighted, ...rest }) => ({
    label: titleize(label),
    highlighted: titleize(highlighted),
    ...rest,
  }))
