import { Request, Response } from 'express'
import { getIndex, getPageCount, idToObjectID, buildSearchExpression, applyPostFilters } from '../helpers'

/**
 * Search in a single index
 * index.search()
 */
export const search = async (req: Request, res: Response): Promise<Response> => {
  const {
    params: { indexName },
    body: { query, filters, facetFilters, hitsPerPage: hitsPerPageParam },
  } = req

  try {
    const db = await getIndex()
    const hitsPerPage = parseInt((hitsPerPageParam as string) || `20`, 10)

    // Build search expression and extract post-filters
    const { searchExp, objectIDs, notFilters } = buildSearchExpression({
      query,
      filters,
      facetFilters,
    })

    // Execute query
    let result
    if (searchExp.AND.length > 0) {
      result = await db.QUERY(searchExp, { DOCUMENTS: true })
    } else {
      const allDocs = await db.ALL_DOCUMENTS(hitsPerPage)
      result = { RESULT: allDocs.map((doc: unknown) => ({ _doc: doc })) }
    }

    // Extract hits and apply post-filters (objectID, NOT filters)
    let hits = idToObjectID(result.RESULT.map((r: { _doc: unknown }) => r._doc))
    hits = applyPostFilters(hits, objectIDs, notFilters)

    const nbPages = getPageCount(hits.length, hitsPerPage)

    return res.status(200).send({
      hits,
      nbHits: hits.length,
      nbPages,
      hitsPerPage,
      processingTimeMS: 1,
      page: 0,
      query: query || '',
      index: indexName,
    })
  } catch (err) {
    return res.status(500).send({ message: err })
  }
}
