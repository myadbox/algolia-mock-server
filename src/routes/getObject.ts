import { Request, Response } from 'express'
import { getIndex, idToObjectID } from '../helpers'

/**
 * Get an object from a specific index
 * index.getObject()
 */
export const getObject = async (req: Request, res: Response): Promise<Response> => {
  const {
    params: { objectID },
  } = req

  try {
    const db = await getIndex()
    const result = await db.DOCUMENTS([objectID])
    // Explicility close the underlying leveldown store
    await db.INDEX.STORE.close()
    const documents = idToObjectID(result)
    return res.status(200).send(documents[0])
  } catch (err) {
    return res.status(500).send({ message: err })
  }
}
