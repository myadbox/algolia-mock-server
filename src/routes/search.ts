import {Request, Response} from 'express'
import {getIndex, getPageCount, idToObjectID, buildSearchExpression, applyPostFilters, toParamsString} from '../helpers'
import {withSecuredApiKeyFilters} from '../securedApiKey'

/**
 * Search in a single index
 * index.search()
 */
export const search = async (req: Request, res: Response): Promise<Response> => {
  const {
    params: {indexName},
    body: {query, filters, facetFilters, hitsPerPage: hitsPerPageParam, page: pageParam},
  } = req

  try {
    const db = await getIndex()
    const hitsPerPage = parseInt((hitsPerPageParam as string) || `20`, 10)
    const page = parseInt((pageParam as string) || `0`, 10)

    // Build search expression and extract post-filters
    const {searchExp, objectIDs, notFilters, orGroups} = buildSearchExpression({
      query,
      filters: withSecuredApiKeyFilters(req, filters),
      facetFilters,
    })

    // Execute query
    const matched =
      searchExp.AND.length > 0 ? (await db.QUERY(searchExp, {DOCUMENTS: true})).RESULT : await db.ALL_DOCUMENTS()

    // Post-filters run in JS, so the total and the page slice must come from the full filtered set
    const filtered = applyPostFilters(idToObjectID(matched.map(r => r._doc)), objectIDs, notFilters, orGroups)
    const startIndex = page * hitsPerPage

    return res.status(200).send({
      hits: filtered.slice(startIndex, startIndex + hitsPerPage),
      nbHits: filtered.length,
      nbPages: getPageCount(filtered.length, hitsPerPage),
      hitsPerPage,
      processingTimeMS: 1,
      page,
      query: query || '',
      index: indexName,
      params: toParamsString(req.body),
    })
  } catch (err) {
    return res.status(500).send({message: err})
  }
}
