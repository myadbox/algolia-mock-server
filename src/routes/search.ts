import { Request, Response } from 'express'
import { getIndex, getPageCount, idToObjectID } from '../helpers'

/**
 * Search in a single index
 * index.search()
 */
export const search = async (req: Request, res: Response): Promise<Response> => {
  const {
    params: { indexName },
    body: { query, hitsPerPage: hitsPerPageParam },
  } = req

  try {
    const db = await getIndex()
    const hitsPerPage = parseInt((hitsPerPageParam as string) || `20`, 10)

    const result = await db.QUERY(query, { DOCUMENTS: true })
    const hits = idToObjectID(result.RESULT.map((r) => r._doc))
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
