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

/**
 * Compute facets from filtered hits
 * Returns facet counts for the specified fields
 */
export const computeFacetsFromHits = (
  hits: Array<Record<string, unknown>>,
  facetFields: string[],
): Record<string, Record<string, number>> => {
  const facets: Record<string, Record<string, number>> = {}

  for (const field of facetFields) {
    facets[field] = {}

    for (const hit of hits) {
      const value = hit[field]

      if (Array.isArray(value)) {
        // Handle array fields (like tags)
        for (const item of value) {
          const key = String(item).toLowerCase()
          facets[field][key] = (facets[field][key] || 0) + 1
        }
      } else if (value !== undefined && value !== null) {
        // Handle scalar fields (like type)
        const key = String(value).toLowerCase()
        facets[field][key] = (facets[field][key] || 0) + 1
      }
    }
  }

  return facets
}

/**
 * Apply post-filters (objectID and NOT filters) to hits
 * Returns filtered hits array
 */
export const applyPostFilters = (
  hits: Array<Record<string, unknown>>,
  objectIDs: string[],
  notFilters: string[],
): Array<Record<string, unknown>> => {
  let filtered = hits

  // Filter by objectID if specified
  if (objectIDs.length > 0) {
    filtered = filtered.filter((hit) => objectIDs.includes(hit.objectID as string))
  }

  // Apply NOT filters (exclude matching documents)
  if (notFilters.length > 0) {
    filtered = filtered.filter((hit) => {
      return notFilters.every((notFilter) => {
        const [field, value] = notFilter.split(':')
        const hitValue = hit[field]

        // Check if hit matches the NOT filter (if yes, exclude it)
        if (Array.isArray(hitValue)) {
          return !hitValue.includes(value)
        }
        return hitValue !== value
      })
    })
  }

  return filtered
}

type SearchToken = string | { SEARCH: string[] } | { AND: string[] } | { OR: string[] }

interface SearchExpression {
  AND: SearchToken[]
}

/**
 * Build search expression from query and filters
 * Handles both string filters and array facetFilters
 * Returns { searchExp, objectIDs, notFilters }
 */
export const buildSearchExpression = (params: {
  query?: string
  filters?: string
  facetFilters?: unknown[]
}): { searchExp: SearchExpression; objectIDs: string[]; notFilters: string[] } => {
  const { query, filters, facetFilters } = params
  const searchExp: SearchExpression = { AND: [] }
  let objectIDs: string[] = []
  let notFilters: string[] = []

  // Add text query if present
  if (query) {
    searchExp.AND.push({ SEARCH: (query as string).split(' ') })
  }

  // Handle string filters (e.g., "type:IMAGE AND tags:Launch")
  if (filters) {
    const parsed = parseStringFilters(filters as string)
    objectIDs = parsed.objectIDs
    notFilters = parsed.notFilters

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

  return { searchExp, objectIDs, notFilters }
}

/**
 * Parse string filters into filter parts, objectIDs, and NOT filters
 * Note: objectID and NOT filters are extracted for post-filtering (search-index limitation)
 */
const parseStringFilters = (filterString: string) => {
  if (!filterString) {
    return { filterParts: [], objectIDs: [], notFilters: [] }
  }

  // Extract objectIDs
  const objectIDs: string[] = []
  const objectIDRegex = /objectID:["']?([a-zA-Z0-9_-]+)["']?/gi
  for (const match of filterString.matchAll(objectIDRegex)) {
    objectIDs.push(match[1])
  }

  // Extract NOT filters for post-processing
  const notFilters: string[] = []
  const notRegex = /NOT\s+([a-zA-Z0-9_]+:[^\s)]+)/gi
  for (const match of filterString.matchAll(notRegex)) {
    notFilters.push(match[1].replace(/["']/g, ''))
  }

  // Remove NOT filters from the string
  let cleaned = filterString.replace(/NOT\s+[a-zA-Z0-9_]+:[^\s)]+/gi, '').trim()

  // Remove objectID filters
  cleaned = cleaned
    .replace(/\s*AND\s+objectID:["']?[a-zA-Z0-9_-]+["']?/gi, '')
    .replace(/objectID:["']?[a-zA-Z0-9_-]+["']?\s*AND\s*/gi, '')
    .replace(/objectID:["']?[a-zA-Z0-9_-]+["']?/gi, '')
    .trim()

  // Clean up any leftover AND operators
  cleaned = cleaned.replace(/^\s*AND\s+|\s+AND\s*$/gi, '').trim()

  // If after removing NOT and objectID filters, nothing is left, return empty
  if (!cleaned) {
    return { filterParts: [], objectIDs, notFilters }
  }

  // Split by AND, clean up
  const filterParts = cleaned
    .split(/\s+AND\s+/i)
    .map((part) =>
      part
        .trim()
        .replace(/^\(|\)$/g, '')
        .replace(/["']/g, ''),
    )
    .filter((part) => part.length > 0)

  return { filterParts, objectIDs, notFilters }
}
