import algoliasearch from 'algoliasearch'
import instantsearch from 'instantsearch.js'
import { configure, hits, pagination, panel, refinementList, searchBox } from 'instantsearch.js/es/widgets'

import { fetchFacetsList, isBooleanSearch, useBooleanSearch } from '@/utils/search'
import { titleizeItems } from '@/utils/string'
import { hit as hitTemplate } from '@/components'

const searchClient = algoliasearch('0UI9MOXMX5', '1d30c6a6ea8a7dfcc9797671c39723db')
const index = searchClient.initIndex('boolean_search')

// Keep track of the search state
const state = {
  query: '',
  page: 0,
}

const runDefaultSearch = (helper, params = {}) => {
  const { query = '', page = 0 } = params

  helper
    .setQuery(query)
    .setQueryParameter('advancedSyntax', true) // enable advanted syntax for default search
    .setQueryParameter('filters', '') // reset eventual filters
    .setPage(page) // the page needs to be set again
    .search()
}

const runBooleanSearch = (helper, params = {}) => {
  const { filters = '', page = 0 } = params

  helper
    .setQuery('') // results are handled by the filters
    .setQueryParameter('filters', filters)
    .setQueryParameter('advancedSyntax', false) // not needed here
    .setPage(page)
    .search()
}

const searchFunction = helper => {
  const { query: userQuery, page } = helper.getQuery()
  let query = userQuery.trim()

  // Use previous query on page change for boolean search
  if (query !== state.query && page !== state.page) query = state.query
  state.query = query
  state.page = page

  if (isBooleanSearch(query)) {
    const { filters, errorMessage } = useBooleanSearch(query)
    if (!filters || errorMessage) return runDefaultSearch(helper, { query, page })
    return runBooleanSearch(helper, { query, filters, page })
  }

  return runDefaultSearch(helper, { query, page })
}

const search = instantsearch({
  indexName: 'boolean_search',
  searchClient,
  searchFunction,
})

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
  // Fetch all facets - this will populate `facetsList` in ./utils/boolean-search.js
  await fetchFacetsList(index)
  // Start the search
  search.start()
}

runApp()
