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

// search-index never sees objectID: it is stored as `_id`, and tokenising would split a hyphenated id anyway
const isObjectIDFacetFilter = (filter: unknown): filter is string =>
  typeof filter === `string` && splitFacetFilter(filter)[0] === `objectID`

// search-index tokenises scalar values on punctuation, so a hyphenated value (a user id, say) never matches itself
const isHyphenatedFacetFilter = (filter: unknown): filter is string =>
  typeof filter === `string` && splitFacetFilter(filter)[1].includes(`-`)

const needsPostFiltering = (filter: unknown): boolean =>
  isNegatedFacetFilter(filter) || isObjectIDFacetFilter(filter) || isHyphenatedFacetFilter(filter)

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
 * Apply post-filters (objectID, NOT filters and the facetFilter groups search-index can't express) to hits
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
 * Algolia accepts list params as JSON strings too, which is how a client replays the `params` it was echoed
 */
export const parseListParam = (value: unknown): unknown => (typeof value === `string` ? JSON.parse(value) : value)

/**
 * Encode a request the way Algolia echoes it back in a result's `params`
 */
export const toParamsString = ({indexName, type, ...params}: Record<string, unknown>): string =>
  new URLSearchParams(
    Object.fromEntries(
      Object.entries(params)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, typeof value === `object` ? JSON.stringify(value) : String(value)])
    )
  ).toString()

/**
 * Build search expression from query and filters
 * Handles both string filters and array facetFilters
 * Negated (`attr:-value`), objectID and hyphenated facetFilters can't be expressed in search-index, so they are
 * returned for post-filtering: a lone negation becomes a NOT filter, any other group containing one is evaluated whole in `orGroups`
 * A parenthesized `(a:1 OR b:2)` group in a `filters:` string is likewise evaluated whole in `orGroups`, since
 * search-index would otherwise treat the unparsed group as a single literal token lookup
 * Returns { searchExp, objectIDs, notFilters, orGroups }
 */
export const buildSearchExpression = (params: {
  query?: string
  filters?: string
  facetFilters?: unknown[] | string
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
    orGroups.push(...parsed.orGroups)

    if (parsed.filterParts.length > 0) {
      searchExp.AND.push({AND: parsed.filterParts})
    }
  }

  // Handle array facetFilters (e.g., [["type:IMAGE"], ["tags:Launch"]])
  if (facetFilters) {
    const andFilters: string[] = []
    for (const filter of parseListParam(facetFilters) as unknown[]) {
      const lone = Array.isArray(filter) && filter.length === 1 ? filter[0] : filter
      if (isNegatedFacetFilter(lone)) {
        const [field, value] = splitFacetFilter(lone)
        notFilters.push(`${field}:${value.slice(1)}`)
      } else if (isObjectIDFacetFilter(lone) || isHyphenatedFacetFilter(lone)) {
        orGroups.push([lone])
      } else if (Array.isArray(filter) && filter.some(needsPostFiltering)) {
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
 * Split a filters: string on a top-level keyword (AND/OR), ignoring occurrences nested inside parentheses
 */
const splitTopLevel = (input: string, keyword: string): string[] => {
  const parts: string[] = []
  const upper = input.toUpperCase()
  const kw = keyword.toUpperCase()
  let depth = 0
  let start = 0
  let i = 0

  while (i < input.length) {
    const char = input[i]
    if (char === '(') depth++
    else if (char === ')') depth--

    if (depth === 0 && upper.startsWith(kw, i)) {
      const boundaryBefore = i === 0 || /\s/.test(input[i - 1])
      const afterIndex = i + kw.length
      const boundaryAfter = afterIndex >= input.length || /\s/.test(input[afterIndex])
      if (boundaryBefore && boundaryAfter) {
        parts.push(input.slice(start, i))
        i = afterIndex
        start = i
        continue
      }
    }
    i++
  }
  parts.push(input.slice(start))

  return parts.map(part => part.trim()).filter(part => part.length > 0)
}

const stripQuotes = (value: string): string => value.replace(/["']/g, '')

/**
 * Normalize one item of a parenthesized OR group into the `field:value` / `field:-value` shape
 * `applyPostFilters`'s `hitMatchesFacetFilter` already understands, so `NOT field:value` becomes `field:-value`
 */
const normalizeOrGroupItem = (item: string): string => {
  const notMatch = item.trim().match(/^NOT\s+(.+)$/i)
  if (!notMatch) return stripQuotes(item.trim())

  const [field, value] = splitFacetFilter(stripQuotes(notMatch[1]))
  return `${field}:-${value}`
}

/**
 * Parse string filters into filter parts, objectIDs, NOT filters and OR groups
 * Note: objectID, NOT filters and parenthesized OR groups are extracted for post-filtering (search-index
 * can only treat an AND array entry as a single literal token lookup, never a nested boolean sub-expression)
 */
const parseStringFilters = (filterString: string) => {
  if (!filterString) {
    return {filterParts: [], objectIDs: [], notFilters: [], orGroups: []}
  }

  const filterParts: string[] = []
  const objectIDs: string[] = []
  const notFilters: string[] = []
  const orGroups: string[][] = []

  for (const clause of splitTopLevel(filterString.trim(), 'AND')) {
    if (clause.startsWith('(') && clause.endsWith(')')) {
      const items = splitTopLevel(clause.slice(1, -1), 'OR').map(normalizeOrGroupItem)
      if (items.length > 0) orGroups.push(items)
      continue
    }

    const notMatch = clause.match(/^NOT\s+([a-zA-Z0-9_]+):(.+)$/i)
    if (notMatch) {
      notFilters.push(`${notMatch[1]}:${stripQuotes(notMatch[2])}`)
      continue
    }

    const objectIDMatch = clause.match(/^objectID:["']?([a-zA-Z0-9_-]+)["']?$/i)
    if (objectIDMatch) {
      objectIDs.push(objectIDMatch[1])
      continue
    }

    filterParts.push(stripQuotes(clause))
  }

  return {filterParts, objectIDs, notFilters, orGroups}
}
