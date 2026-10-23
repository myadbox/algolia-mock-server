import {Request, Response} from 'express'
import {getIndex, idToObjectID} from '../helpers'

/**
 * Get an object from a specific index
 * index.getObject()
 */
export const getObject = async (req: Request, res: Response): Promise<Response> => {
  const {
    params: {objectID},
  } = req

  try {
    const db = await getIndex()

    const result = await db.DOCUMENTS([objectID])
    const [document] = idToObjectID(result)

    if (!document) {
      return res.status(404).send({message: `ObjectID does not exist`, status: 404})
    }

    return res.status(200).send(document)
  } catch (err) {
    return res.status(500).send({message: err})
  }
}
