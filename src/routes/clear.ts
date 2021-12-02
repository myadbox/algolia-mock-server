import { Request, Response } from 'express'
import { getIndex, getTaskID } from '../helpers'

/**
 * Delete index's content
 * index.clearObjects()
 */
export const clear = async (req: Request, res: Response): Promise<Response> => {
  try {
    const db = await getIndex()

    // @ts-ignore
    await db.FLUSH()

    return res.status(200).send({
      updatedAt: new Date(),
      taskID: getTaskID(),
    })
  } catch (err) {
    return res.status(500).send({ message: err })
  }
}
