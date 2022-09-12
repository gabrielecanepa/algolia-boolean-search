import algoliasearch from 'algoliasearch'
import instantsearch from 'instantsearch.js'
import { configure, hits, pagination, panel, refinementList, searchBox } from 'instantsearch.js/es/widgets'

import { fetchFacetsList, isBooleanSearch, useBooleanSearch } from '@/utils/boolean-search'
import { titleizeItems } from '@/utils/string'
import { hit as hitTemplate } from '@/components'

const searchClient = algoliasearch('0UI9MOXMX5', '1d30c6a6ea8a7dfcc9797671c39723db')
const index = searchClient.initIndex('boolean_search')

const runDefaultSearch = (helper, params = {}) => {
  const { filters = '', page = 0 } = params

  helper
    .setQueryParameter('optionalWords', ['and', 'or'])
    .setQueryParameter('advancedSyntax', true)
    .setQueryParameter('filters', filters)
    .setPage(page) // the page needs to be reset
    .search()
}

const runBooleanSearch = async (helper, params = {}) => {
  const { query = '', filters = '', page = 0 } = params

  await helper
    // .setQuery('') // everything is handled by the filters
    .setQueryParameter('optionalWords', query.split(' ')) // all words should be optional, as results are handled by filters
    .setQueryParameter('removeWordsIfNoResults', 'allOptional') // remove if there are no results
    .setQueryParameter('advancedSyntax', false) // already handled by useBooleanSearch
    .setQueryParameter('filters', filters)
    .setPage(page)
    .search()
}

const searchFunction = helper => {
  const { query, page } = helper.getQuery()

  if (isBooleanSearch(query)) {
    const { filters, errorMessage } = useBooleanSearch(query)
    if (!filters || errorMessage) return runDefaultSearch(helper, { page })
    return runBooleanSearch(helper, { query, filters, page })
  }

  return runDefaultSearch(helper, { page })
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
