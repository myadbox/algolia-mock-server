import { Request, Response } from 'express'
import { getIndex, idToObjectID } from '../helpers'

/**
 * Search in a single index
 * index.search()
 */
export const search = async (req: Request, res: Response): Promise<Response> => {
  const {
    body: { query },
  } = req

  try {
    const db = await getIndex()

    const result = await db.QUERY(query, { DOCUMENTS: true })
    const documents = idToObjectID(result.RESULT.map((r) => r._doc))

    return res.status(200).send({ message: documents })
  } catch (err) {
    return res.status(500).send({ message: err })
  }
}
