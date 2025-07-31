import { Request, Response } from 'express'
import { getIndex, getPageCount, idToObjectID } from '../helpers'

/**
 * Parse a single numeric filter string into search-index format
 */
const parseNumericFilter = (filterString: string) => {
  const match = filterString.match(/^(.+?)(>=|<=|>|<|=)(.+)$/)
  if (!match) {
    throw new Error(`Invalid numeric filter: ${filterString}`)
  }

  const [, field, operator, value] = match
  const numericValue = parseFloat(value.trim())

  // Handle null values by using a sentinel value (Number.MAX_SAFE_INTEGER)
  const processedValue = value.trim() === 'null' ? Number.MAX_SAFE_INTEGER.toString() : numericValue.toString()

  switch (operator) {
    case '>=':
      return {
        FIELD: field.trim(),
        VALUE: { GTE: processedValue, LTE: Number.MAX_SAFE_INTEGER.toString() },
      }
    case '<=':
      return {
        FIELD: field.trim(),
        VALUE: { GTE: Number.MIN_SAFE_INTEGER.toString(), LTE: processedValue },
      }
    case '>':
      // Simulate > by using a slightly higher value
      return {
        FIELD: field.trim(),
        VALUE: { GTE: (numericValue + 0.000001).toString(), LTE: Number.MAX_SAFE_INTEGER.toString() },
      }
    case '<':
      // Simulate < by using a slightly lower value
      return {
        FIELD: field.trim(),
        VALUE: { GTE: Number.MIN_SAFE_INTEGER.toString(), LTE: (numericValue - 0.000001).toString() },
      }
    case '=':
      return {
        FIELD: field.trim(),
        VALUE: { GTE: processedValue, LTE: processedValue },
      }
    default:
      throw new Error(`Unsupported numeric operator: ${operator}`)
  }
}

/**
 * Parse Algolia numericFilters into search-index format
 */
const parseNumericFilters = (numericFilters: any[]) => {
  const filters = []

  for (const filter of numericFilters) {
    if (Array.isArray(filter)) {
      // OR condition - array of filters
      const orFilters = filter.map(parseNumericFilter)
      filters.push({ OR: orFilters })
    } else {
      // AND condition - single filter
      filters.push(parseNumericFilter(filter))
    }
  }

  return filters
}

/**
 * Search and filter in multiple indexes
 */
export const queries = async (req: Request, res: Response): Promise<Response> => {
  const {
    body: { requests },
  } = req

  try {
    const db = await getIndex()

    const results = []

    for (const request of requests) {
      const {
        indexName,
        query: queryParams,
        facets: facetsParams,
        facetFilters: facetFiltersParams,
        numericFilters: numericFiltersParams,
        page: pageParam,
        hitsPerPage: hitsPerPageParams,
      } = request

      const page = parseInt((pageParam as string) || `0`, 10)
      const hitsPerPage = parseInt((hitsPerPageParams as string) || `1`, 10)
      const searchExp = { AND: [] }

      if (queryParams) {
        searchExp.AND.push({ SEARCH: (queryParams as string).split(' ') })
      }

      if (facetFiltersParams) {
        const andFilters = []
        for (const filter of facetFiltersParams) {
          if (Array.isArray(filter)) {
            searchExp.AND.push({ OR: filter })
          } else {
            andFilters.push(filter)
          }
        }
        if (andFilters.length) {
          searchExp.AND.push({ AND: andFilters })
        }
      }

      if (numericFiltersParams) {
        const numericFilters = parseNumericFilters(numericFiltersParams)
        searchExp.AND.push(...numericFilters)
      }

      let hits = []

      if (searchExp.AND.length) {
        const result = await db.QUERY(searchExp, {
          DOCUMENTS: true,
          PAGE: { NUMBER: page, SIZE: hitsPerPage },
        })

        hits = idToObjectID(result.RESULT.map((r) => r._doc))
      } else {
        const result = await db.ALL_DOCUMENTS(hitsPerPage)
        hits = idToObjectID(result.map((r) => r._doc))
      }

      let facets = {}
      if (facetsParams) {
        const values = await db.FACETS({ FIELD: facetsParams })

        facets = values.reduce((aggr, cur) => {
          const facet = cur.FIELD as string
          aggr[facet] = { ...aggr[facet], [cur.VALUE as string]: cur._id.length }
          return aggr
        }, {})
      }

      const nbPages = getPageCount(hits.length, hitsPerPage)

      results.push({
        hits,
        page,
        nbHits: hits.length,
        nbPages,
        hitsPerPage,
        processingTimeMS: 1,
        query: queryParams,
        index: indexName,
        facets,
      })
    }

    return res.status(200).send({ results })
  } catch (err) {
    console.error(`Error in queries: ${JSON.stringify(err, null, 2)}`)
    return res.status(500).send({ message: JSON.stringify(err) })
  }
}
