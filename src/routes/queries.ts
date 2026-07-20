import {Request, Response} from 'express'
import {
  getIndex,
  getPageCount,
  idToObjectID,
  buildSearchExpression,
  applyPostFilters,
  computeFacetsFromHits,
} from '../helpers'

/**
 * Search and filter in multiple indexes
 */
export const queries = async (req: Request, res: Response): Promise<Response> => {
  const {
    body: {requests},
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

      // Build search expression and extract post-filters
      const {searchExp, objectIDs, notFilters} = buildSearchExpression({
        query: queryParams,
        filters: filtersParams,
        facetFilters: facetFiltersParams,
      })

      let hits = []
      let totalCount = 0

      if (searchExp.AND.length > 0) {
        const result = await db.QUERY(searchExp, {
          DOCUMENTS: true,
          PAGE: {NUMBER: page, SIZE: hitsPerPage},
        })

        hits = idToObjectID(result.RESULT.map(r => r._doc))
        totalCount = typeof result.RESULT_LENGTH === `number` ? result.RESULT_LENGTH : hits.length
      } else {
        const all = idToObjectID((await db.ALL_DOCUMENTS()).map(r => r._doc))
        totalCount = all.length
        const startIndex = page * hitsPerPage
        hits = all.slice(startIndex, startIndex + hitsPerPage)
      }

      // Apply post-filters (objectID and NOT filters)
      const hasPostFilters = objectIDs.length > 0 || notFilters.length > 0
      hits = applyPostFilters(hits, objectIDs, notFilters)

      // Compute facets from filtered hits
      let facets = {}
      if (facetsParams) {
        const facetFields = Array.isArray(facetsParams) ? facetsParams : [facetsParams]
        facets = computeFacetsFromHits(hits, facetFields)
      }

      const effectiveTotal = hasPostFilters ? hits.length : totalCount
      const nbPages = getPageCount(effectiveTotal, hitsPerPage)

      results.push({
        hits,
        page,
        nbHits: effectiveTotal,
        nbPages,
        hitsPerPage,
        processingTimeMS: 1,
        query: queryParams,
        index: indexName,
        facets,
      })
    }

    return res.status(200).send({results})
  } catch (err) {
    console.error(`Error in queries: ${JSON.stringify(err, null, 2)}`)
    return res.status(500).send({message: JSON.stringify(err)})
  }
}
