import algoliasearch from 'algoliasearch'
import instantsearch from 'instantsearch.js'
import { configure, hits, pagination, panel, refinementList, searchBox } from 'instantsearch.js/es/widgets'

import { fetchFacetsList, isBooleanSearch, useBooleanSearch } from '@/utils/search'
import { titleizeItems } from '@/utils/string'
import { hit as hitTemplate } from '@/components'

const searchClient = algoliasearch('0UI9MOXMX5', '1d30c6a6ea8a7dfcc9797671c39723db')
const index = searchClient.initIndex('boolean_search')

// Keep track of the search state
const localSearchState = {
  query: '',
  facetFilters: [],
  filters: '',
  page: 0,
}

const runDefaultSearch = (helper, params = {}) => {
  const { query = '', page = 0 } = params

  helper
    .setQuery(query)
    .setQueryParameter('advancedSyntax', true) // enable advanted syntax in standard search
    .setQueryParameter('filters', '') // reset eventual boolean filters
    .setPage(page) // the page needs to be set again as `setQuery` resets it
    .search()
}

const runBooleanSearch = async (helper, params = {}) => {
  const { filters = '', page = 0 } = params

  helper
    // No query or advanced syntax needed, results are fully handled by filters
    .setQuery('')
    .setQueryParameter('advancedSyntax', false)
    .setQueryParameter('filters', filters)
    .setPage(page)
    .search()
}

const searchFunction = helper => {
  const { query: userQuery, facetFilters, filters: userFilters, page } = helper.getQuery()

  // Use previous query on page change
  // needed by boolean search as the query would always be empty
  let query = userQuery !== localSearchState.query && page !== localSearchState.page
    ? localSearchState.query
    : userQuery
  // Use previous facetFilters on page change
  // needed by boolean search as filters would always be empty
  const filters = JSON.stringify(facetFilters) !== JSON.stringify(localSearchState.facetFilters)
    ? localSearchState.filters
    : userFilters

  // Update the search state
  localSearchState.query = query
  localSearchState.facetFilters = facetFilters
  localSearchState.filters = filters
  localSearchState.page = page

  // Trim extra whitespaces to avoid empty results
  query = query.trim()

  if (isBooleanSearch(query)) {
    const { filters: booleanFilters, errorMessage } = useBooleanSearch(query)
    if (!booleanFilters || errorMessage) return runDefaultSearch(helper, { query, page })
    return runBooleanSearch(helper, { query, filters: booleanFilters, page })
  }

  return runDefaultSearch(helper, { query, page })
}

const search = instantsearch({
  indexName: 'boolean_search',
  searchClient,
  searchFunction,
})

// Workaround to display the current search query when navigating
// to another page; it would always be empty with boolean search
const initInputValueEvents = () => {
  const searchBoxInput = document.querySelector('#searchbox input')

  const updateSearchBoxInputValue = () => {
    searchBoxInput.value = localSearchState.query
  }
  const debounceUpdateSearchBoxInputValue = () => {
    setTimeout(updateSearchBoxInputValue)
  }

  search.on('render', updateSearchBoxInputValue)
  searchBoxInput.addEventListener('focus', debounceUpdateSearchBoxInputValue)
  searchBoxInput.addEventListener('blur', debounceUpdateSearchBoxInputValue)
}

search.addWidgets([
  configure({
    hitsPerPage: 10,
  }),
  searchBox({
    container: '#searchbox',
    autofocus: true,
  }),
  hits({
    container: '#hits',
    templates: {
      item: hitTemplate,
    },
  }),
  panel({
    templates: { header: 'gender' },
  })(refinementList)({
    container: '#gender-list',
    attribute: 'gender',
    transformItems: titleizeItems,
  }),
  panel({
    templates: { header: 'category' },
  })(refinementList)({
    container: '#category-list',
    attribute: 'categories',
  }),
  panel({
    templates: { header: 'brand' },
  })(refinementList)({
    container: '#brand-list',
    attribute: 'brand',
  }),
  panel({
    templates: { header: 'color' },
  })(refinementList)({
    container: '#color-list',
    attribute: 'color',
    transformItems: titleizeItems,
  }),
  pagination({
    container: '#pagination',
  }),
])

const runApp = async () => {
  // Fetch all facets: this will populate `facetsList` in ./utils/search.js
  await fetchFacetsList(index)
  // Start the search
  search.start()
  // Store the search input element
  initInputValueEvents()
}

runApp()
