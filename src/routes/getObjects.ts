import { Request, Response } from 'express'
import { getIndex, idToObjectID } from '../helpers'

/**
 * Get objects from multiple indexes
 * index.getObjects()
 */
export const getObjects = async (req: Request, res: Response): Promise<Response> => {
  const {
    body: { requests },
  } = req

  const objectIDs = requests.map((r) => r.objectID)
  try {
    const db = await getIndex()
    const result = await db.DOCUMENTS(objectIDs)
    // Explicility close the underlying leveldown store
    await db.INDEX.STORE.close()
    const documents = idToObjectID(result)
    return res.status(200).send(documents)
  } catch (err) {
    return res.status(500).send({ message: err })
  }
}
