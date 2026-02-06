import { Request, Response } from 'express'
import { getIndex, getPageCount, idToObjectID, buildSearchExpression } from '../helpers'

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
        filters: filtersParams,
        page: pageParam,
        hitsPerPage: hitsPerPageParams,
      } = request

      const page = parseInt((pageParam as string) || `0`, 10)
      const hitsPerPage = parseInt((hitsPerPageParams as string) || `1`, 10)

      // Build search expression using shared helper
      const { searchExp, objectIDs: objectIDsToMatch } = buildSearchExpression({
        query: queryParams,
        filters: filtersParams,
        facetFilters: facetFiltersParams,
      })

      let hits = []

      if (searchExp.AND.length > 0) {
        const result = await db.QUERY(searchExp, {
          DOCUMENTS: true,
          PAGE: { NUMBER: page, SIZE: hitsPerPage },
        })

        hits = idToObjectID(result.RESULT.map((r) => r._doc))
      } else {
        const result = await db.ALL_DOCUMENTS(hitsPerPage)
        hits = idToObjectID(result.map((r) => r._doc))
      }

      // Post-filter by objectID if specified
      if (objectIDsToMatch.length > 0) {
        hits = hits.filter((hit: { objectID: string }) => objectIDsToMatch.includes(hit.objectID))
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
