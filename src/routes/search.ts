import { Request, Response } from 'express'
import { getIndex, getPageCount, idToObjectID, parseFilters } from '../helpers'

interface SearchExpression {
  AND: Array<string | { SEARCH: string[] } | { AND: string[] }>
}

/**
 * Search in a single index
 * index.search()
 */
export const search = async (req: Request, res: Response): Promise<Response> => {
  const {
    params: { indexName },
    body: { query, filters, hitsPerPage: hitsPerPageParam },
  } = req

  try {
    const db = await getIndex()
    const hitsPerPage = parseInt((hitsPerPageParam as string) || `20`, 10)

    // Build search expression
    const searchExp: SearchExpression = { AND: [] }

    // Add text query if present
    if (query) {
      searchExp.AND.push({ SEARCH: (query as string).split(' ') })
    }

    // Parse filters (extracts objectIDs and remaining filter parts)
    const { filterParts, objectIDs: objectIDsToMatch } = parseFilters(filters)

    // Add filter parts to search expression
    if (filterParts.length > 0) {
      searchExp.AND.push({ AND: filterParts })
    }

    // Execute query
    let result
    if (searchExp.AND.length > 0) {
      result = await db.QUERY(searchExp, { DOCUMENTS: true })
    } else {
      const allDocs = await db.ALL_DOCUMENTS(hitsPerPage)
      result = { RESULT: allDocs.map((doc: unknown) => ({ _doc: doc })) }
    }

    // Extract hits
    let hits = idToObjectID(result.RESULT.map((r: { _doc: unknown }) => r._doc))

    // Post-filter by objectID if specified
    // Note: search-index can't filter by _id, so we filter results after the query
    if (objectIDsToMatch.length > 0) {
      hits = hits.filter((hit: { objectID: string }) => objectIDsToMatch.includes(hit.objectID))
    }

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
