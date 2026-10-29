import level from 'level-party'
import si from 'search-index'

export const getIndex = async () => {
  return await si({db: level(`.algoliaMockServer`, {valueEncoding: `json`})})
}

export const idToObjectID = documents => {
  return documents.map(document => {
    if (!document) return null
    const {_id, ...rest} = document
    return {objectID: _id, ...rest}
  })
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
  facetFields: string[]
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

const splitFacetFilter = (filter: string): [string, string] => {
  const separator = filter.indexOf(':')
  return [filter.slice(0, separator), filter.slice(separator + 1)]
}

const isNegatedFacetFilter = (filter: unknown): filter is string =>
  typeof filter === `string` && splitFacetFilter(filter)[1].startsWith(`-`)

const hitHasFacetValue = (hit: Record<string, unknown>, field: string, value: string): boolean => {
  const hitValue = hit[field]
  if (Array.isArray(hitValue)) {
    return hitValue.some(item => String(item) === value)
  }
  return hitValue !== undefined && hitValue !== null && String(hitValue) === value
}

const hitMatchesFacetFilter = (hit: Record<string, unknown>, filter: string): boolean => {
  const [field, value] = splitFacetFilter(filter)
  return value.startsWith(`-`) ? !hitHasFacetValue(hit, field, value.slice(1)) : hitHasFacetValue(hit, field, value)
}

/**
 * Apply post-filters (objectID, NOT filters and facetFilter OR groups containing negations) to hits
 * Returns filtered hits array
 */
export const applyPostFilters = (
  hits: Array<Record<string, unknown>>,
  objectIDs: string[],
  notFilters: string[],
  orGroups: string[][] = []
): Array<Record<string, unknown>> => {
  let filtered = hits

  // Filter by objectID if specified
  if (objectIDs.length > 0) {
    filtered = filtered.filter(hit => objectIDs.includes(hit.objectID as string))
  }

  // Apply NOT filters (exclude matching documents; documents missing the attribute are kept)
  if (notFilters.length > 0) {
    filtered = filtered.filter(hit =>
      notFilters.every(notFilter => {
        const [field, value] = splitFacetFilter(notFilter)
        return !hitHasFacetValue(hit, field, value)
      })
    )
  }

  if (orGroups.length > 0) {
    filtered = filtered.filter(hit => orGroups.every(group => group.some(filter => hitMatchesFacetFilter(hit, filter))))
  }

  return filtered
}

type SearchToken = string | {SEARCH: string[]} | {AND: string[]} | {OR: string[]}

interface SearchExpression {
  AND: SearchToken[]
}

/**
 * Build search expression from query and filters
 * Handles both string filters and array facetFilters
 * Negated facetFilters (`attr:-value`) can't be expressed in search-index, so they are returned for post-filtering:
 * a lone negation becomes a NOT filter, an OR group containing one is evaluated whole in `orGroups`
 * Returns { searchExp, objectIDs, notFilters, orGroups }
 */
export const buildSearchExpression = (params: {
  query?: string
  filters?: string
  facetFilters?: unknown[]
}): {searchExp: SearchExpression; objectIDs: string[]; notFilters: string[]; orGroups: string[][]} => {
  const {query, filters, facetFilters} = params
  const searchExp: SearchExpression = {AND: []}
  let objectIDs: string[] = []
  let notFilters: string[] = []
  const orGroups: string[][] = []

  // Add text query if present
  if (query) {
    searchExp.AND.push({SEARCH: (query as string).split(' ')})
  }

  // Handle string filters (e.g., "type:IMAGE AND tags:Launch")
  if (filters) {
    const parsed = parseStringFilters(filters as string)
    objectIDs = parsed.objectIDs
    notFilters = parsed.notFilters

    if (parsed.filterParts.length > 0) {
      searchExp.AND.push({AND: parsed.filterParts})
    }
  }

  // Handle array facetFilters (e.g., [["type:IMAGE"], ["tags:Launch"]])
  if (facetFilters) {
    const andFilters: string[] = []
    for (const filter of facetFilters) {
      const lone = Array.isArray(filter) && filter.length === 1 ? filter[0] : filter
      if (isNegatedFacetFilter(lone)) {
        const [field, value] = splitFacetFilter(lone)
        notFilters.push(`${field}:${value.slice(1)}`)
      } else if (Array.isArray(filter) && filter.some(isNegatedFacetFilter)) {
        orGroups.push(filter as string[])
      } else if (Array.isArray(filter)) {
        searchExp.AND.push({OR: filter})
      } else {
        andFilters.push(filter as string)
      }
    }
    if (andFilters.length > 0) {
      searchExp.AND.push({AND: andFilters})
    }
  }

  return {searchExp, objectIDs, notFilters, orGroups}
}

/**
 * Parse string filters into filter parts, objectIDs, and NOT filters
 * Note: objectID and NOT filters are extracted for post-filtering (search-index limitation)
 */
const parseStringFilters = (filterString: string) => {
  if (!filterString) {
    return {filterParts: [], objectIDs: [], notFilters: []}
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
    return {filterParts: [], objectIDs, notFilters}
  }

  // Split by AND, clean up
  const filterParts = cleaned
    .split(/\s+AND\s+/i)
    .map(part =>
      part
        .trim()
        .replace(/^\(|\)$/g, '')
        .replace(/["']/g, '')
    )
    .filter(part => part.length > 0)

  return {filterParts, objectIDs, notFilters}
}
