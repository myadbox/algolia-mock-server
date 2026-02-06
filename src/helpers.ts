import level from 'level-party'
import si from 'search-index'

export const getIndex = async () => {
  return await si({ db: level(`.algoliaMockServer`, { valueEncoding: `json` }) })
}

export const idToObjectID = (documents) => {
  return documents.map(({ _id, ...rest }) => ({ objectID: _id, ...rest }))
}

export const getTaskID = (): number => Math.floor(Math.random() * 1000)

export const getPageCount = (total: number, perPage: number): number => {
  const extra = total % perPage === 0 ? 0 : 1
  return Math.floor(total / perPage) + extra
}

type SearchToken = string | { SEARCH: string[] } | { AND: string[] } | { OR: string[] }

interface SearchExpression {
  AND: SearchToken[]
}

/**
 * Build search expression from query and filters
 * Handles both string filters and array facetFilters
 * Returns { searchExp, objectIDs }
 */
export const buildSearchExpression = (params: {
  query?: string
  filters?: string
  facetFilters?: unknown[]
}): { searchExp: SearchExpression; objectIDs: string[] } => {
  const { query, filters, facetFilters } = params
  const searchExp: SearchExpression = { AND: [] }
  let objectIDs: string[] = []

  // Add text query if present
  if (query) {
    searchExp.AND.push({ SEARCH: (query as string).split(' ') })
  }

  // Handle string filters (e.g., "type:IMAGE AND tags:Launch")
  if (filters) {
    const parsed = parseStringFilters(filters as string)
    objectIDs = parsed.objectIDs

    if (parsed.filterParts.length > 0) {
      searchExp.AND.push({ AND: parsed.filterParts })
    }
  }

  // Handle array facetFilters (e.g., [["type:IMAGE"], ["tags:Launch"]])
  if (facetFilters) {
    const andFilters: string[] = []
    for (const filter of facetFilters) {
      if (Array.isArray(filter)) {
        searchExp.AND.push({ OR: filter })
      } else {
        andFilters.push(filter as string)
      }
    }
    if (andFilters.length > 0) {
      searchExp.AND.push({ AND: andFilters })
    }
  }

  return { searchExp, objectIDs }
}

/**
 * Parse string filters into filter parts and objectIDs
 * Note: objectID filters are extracted separately due to search-index limitation
 */
const parseStringFilters = (filterString: string) => {
  if (!filterString) {
    return { filterParts: [], objectIDs: [] }
  }

  // Extract objectIDs
  const objectIDs: string[] = []
  const objectIDRegex = /objectID:["']?([a-zA-Z0-9_-]+)["']?/gi
  for (const match of filterString.matchAll(objectIDRegex)) {
    objectIDs.push(match[1])
  }

  // Remove objectID filters
  const withoutObjectIDs = filterString
    .replace(/\s*AND\s+objectID:["']?[a-zA-Z0-9_-]+["']?/gi, '')
    .replace(/objectID:["']?[a-zA-Z0-9_-]+["']?\s*AND\s*/gi, '')
    .replace(/objectID:["']?[a-zA-Z0-9_-]+["']?/gi, '')
    .trim()

  // Split by AND, clean up
  const filterParts = withoutObjectIDs
    .split(/\s+AND\s+/i)
    .map((part) =>
      part
        .trim()
        .replace(/^\(|\)$/g, '')
        .replace(/["']/g, ''),
    )
    .filter((part) => part.length > 0)

  return { filterParts, objectIDs }
}
