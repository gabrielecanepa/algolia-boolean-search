import FiltersValidator from 'algolia-filters-js-syntax-validator'
import similarity from 'similarity'

import { isDoubleQuoted, normalizeWord } from './string'

/**
 * Filters validator by Algolia.
 */
const filtersValidator = new FiltersValidator()

/**
 * Regex identifying `and`, `or`, `not`, `-` and `*` operators.
 */
const BOOLEAN_REGEX = /(\sand\s|\sor\s|\s?not\s|\w+\*|\*\w+|\w+:\w+)/gi

/**
 * Parse a search query and test if it includes boolean operators.
 *
 * @param {string} query Search query
 * @returns {boolean} `true` if the query includes boolean operators
 */
export const isBooleanSearch = query => Boolean(query.match(BOOLEAN_REGEX))

let facetsList = {}

/**
 * Fetch all facets and store them in `facetsList`.
 *
 * @param {SearchIndex} index Algolia index
 * @returns {Promise} Promise that resolves when facets are fetched
 */
export const fetchFacetsList = async index => {
  const { facets, renderingContent } = await index.search('', {
    facets: ['*'],
    responseFields: ['facets', 'renderingContent'],
  })

  // Use the order specified in the dashboard under `Facets display` or the default one
  const orderedFacets = renderingContent.facetOrdering?.facets?.order || Object.keys(facets)

  // The format will be: { facetName: [facetValue1, facetValue2, ...] }
  facetsList = orderedFacets.reduce(
    (allFacets, facet) => ({
      ...allFacets,
      [facet]: Object.keys(facets[facet]),
    }),
    {}
  )
}

/**
 * Find one match in `facetsList` using the specified function.
 *
 * @param {string} word Word to find a match for
 * @param {function} fn Function to use to find a match
 * @returns {object | null} Object with facet type and value or `null` if there isn't a match
 */
const findFacetTypeAndValue = (word, fn) => {
  let value = normalizeWord(word)

  const type = Object.keys(facetsList).find(facet =>
    facetsList[facet].find(facetValue => {
      const match = fn(facetValue, word)
      if (match) value = facetValue
      return match
    })
  )

  if (!type) return null

  return { type, value }
}

/**
 * Find multiple matches in `facetsList` using the specified function.
 *
 * @param {string} word Word to find a match for
 * @param {function} fn Function to use to find a match
 * @returns {array} Array of objects with facet type and value
 */
const findMultipleFacetTypeAndValue = (word, fn) =>
  Object.keys(facetsList).reduce((acc, facet) => {
    const matches = []

    for (const facetValue of facetsList[facet]) {
      if (fn(facetValue, word)) matches.push({ type: facet, value: facetValue })
    }

    return [...acc, ...matches]
  }, [])

/**
 * Find a match in `facetsList` with the highest similarity.
 *
 * @param {string} word Word to find a match for
 * @returns {object | null} Object with facet type and value or `null` if there isn't a match
 */
const findSimilarFacetTypeAndValue = word =>
  Object.keys(facetsList).reduce((facetTypeAndValue, facet) => {
    const match = facetsList[facet].reduce((similarValue, facetValue) => {
      const similarityScore = similarity(normalizeWord(word), facetValue)

      if (similarityScore > 0.8 && (!similarValue || similarityScore > similarValue.similarityScore))
        return { facetValue, similarityScore }

      return similarValue
    }, null)

    if (match && (!facetTypeAndValue || match.similarityScore > facetTypeAndValue.similarityScore))
      return { type: facet, value: match.facetValue, similarityScore: match.similarityScore }

    return facetTypeAndValue
  }, null)

/**
 * Build one filter from a facet type and value.
 *
 * @param {string} type The facet type
 * @param {string} value The facet value
 * @returns {string} The built filter
 */
const buildFilter = (type, value) => {
  if (value.match(/\s/)) return `${type}:'${value}'` // add quotes if multi-word
  return `${type}:${value}`
}

/**
 * Build multiple filters from facet types and values.
 *
 * @param {array} matches Array of objects with facet type and value
 * @returns {string | null} Composed filter or `null` if `matches` is empty
 */
const buildMultipleFilters = matches => {
  if (!matches || matches.length === 0) return null

  return matches
    .map(match => {
      const { type, value } = match
      return buildFilter(type, value)
    })
    .join(' OR ')
}

/**
 * Parse a word and return a string filter or `null` if there are no matches.
 *
 * @param {string} value Word to parse
 * @returns {string | null} Filter or `null` if there isn't a match
 */
const parseFilter = value => {
  if (value.includes(':')) return value

  // With wildcard
  if (value.startsWith('*')) {
    const matches = findMultipleFacetTypeAndValue(value.slice(1), (a, b) => a.toLowerCase().endsWith(b.toLowerCase()))
    return buildMultipleFilters(matches)
  }
  if (value.endsWith('*')) {
    const matches = findMultipleFacetTypeAndValue(value.slice(0, -1), (a, b) =>
      a.toLowerCase().startsWith(b.toLowerCase())
    )
    return buildMultipleFilters(matches)
  }

  // Return exact match if quoted single word
  if (isDoubleQuoted(value) && !value.match(/\s/)) {
    const facetTypeAndValue = findFacetTypeAndValue(value, (a, b) => a.toLowerCase() === b.toLowerCase())
    if (!facetTypeAndValue) return null
    return buildFilter(facetTypeAndValue.type, facetTypeAndValue.value)
  }

  // Try multiple exact match
  const matches = findMultipleFacetTypeAndValue(value, (a, b) => a.toLowerCase() === b.toLowerCase())
  if (matches.length > 0) return buildMultipleFilters(matches)

  // If no exact match, try to find one match with the highest similarity (see https://npmjs.com/package/similarity)
  const facetTypeAndValue = findSimilarFacetTypeAndValue(value)

  if (!facetTypeAndValue) return null

  return buildFilter(facetTypeAndValue.type, facetTypeAndValue.value)
}

/**
 * Parse a portion of the query and returns a parsed string filter.
 *
 * @param {string} word Word to parse
 * @returns {string | null} Filter or `null` if there isn't a match
 */
const getFilter = word => {
  if (word.match(/^(and|or|not)$/i)) return word.toUpperCase()

  if (word.startsWith('-')) {
    const lastChar = word.at(-1) === ')' ? ')' : ''

    const filter = parseFilter(lastChar === ')' ? word.slice(1, -1) : word.slice(1))
    if (!filter) return null

    const words = filter.split(' ')

    if (words.length === 0) return `NOT ${filter}${lastChar}`
    const facets = words.filter(w => w !== 'OR')
    return `NOT ${facets[0]}${facets.slice(1).map(facet => ` AND NOT ${facet}`)}${lastChar}`
  }
  if (word.startsWith('(')) {
    if (word[1] && word[1] === '-') return `(${getFilter(word.slice(1))})`

    const filter = parseFilter(word.slice(1))
    return filter ? `(${filter}` : null
  }
  if (word.endsWith(')')) {
    const filter = parseFilter(word.slice(0, -1))
    return filter ? `${filter})` : null
  }

  return parseFilter(word)
}

/**
 * Main function to turn a boolean query into Algolia filters.
 *
 * @param {string} booleanQuery Boolean query
 * @returns {object} Object with the filters string and an eventual error message
 */
export const useBooleanSearch = booleanQuery => {
  const words = booleanQuery
    .replace(/\s{2,}/g, ' ') // remove extra spaces
    .split(' ')
    .map(w => w.replace(/["'`]/g, '"')) // turn all quotes into double quotes

  let filtersList = []

  for (const word of words) {
    const filter = getFilter(word)

    if (!filter) {
      filtersList = []
      break
    }

    filtersList.push(filter)
  }

  // Join filters with parentheses
  for (const [i, filter] of filtersList.entries()) {
    if (filter.startsWith('(')) {
      const j = filtersList.findIndex((f, j) => j > i && f.endsWith(')'))
      if (!filtersList[j]) break

      filtersList[i] = filtersList[i].slice(1)
      filtersList[j] = filtersList[j].slice(0, -1)
      filtersList = [...filtersList.slice(0, i), filtersList.slice(i, j + 1).join(' ')]
    }
  }

  const filters = filtersList.reduce((mappedFiltersList, filter, i) => {
    let formattedFilter = filter
    const previousFilter = mappedFiltersList[i - 1]

    // Add parentheses around composed filters
    if (filtersList.length > 1 && i > 0 && previousFilter !== 'OR' && filter.includes(' OR ')) {
      // Handle multiple negations
      if (previousFilter === 'NOT') {
        const values = filter.split(' OR ')
        formattedFilter = values.map(v => `NOT ${v}`).join(' AND ')
        mappedFiltersList.pop()
      }
      if (mappedFiltersList.at(-1)) formattedFilter = `(${formattedFilter})`
    }
    // Prepend AND if the previous item is not AND or OR
    if (i > 0 && !filter.match(/^(and|or|not)$/i) && !previousFilter.match(/^(and|or|not)$/i)) {
      formattedFilter = `AND ${formattedFilter}`
    }

    return [...mappedFiltersList, formattedFilter]
  }, []).join(' ')

  const { errorMessage } = filtersValidator.parse(filters)

  return {
    errorMessage,
    filters,
  }
}
