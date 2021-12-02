import { Request, Response } from 'express'
import { getIndex, getTaskID } from '../helpers'

interface SaveResponse {
  wait: () => Promise<SaveResponse>
  taskID: number
  objectIDs?: string[]
}

/**
 * Add/Update/delete objects in bulk
 * index.saveObject()
 * index.saveObjects()
 * index.partialUpdateObject()
 * index.partialUpdateObjects()
 * index.deleteObject()
 * index.deleteObjects()
 */
export const saveObjects = async (req: Request, res: Response): Promise<Response> => {
  const {
    body: { requests },
  } = req

  try {
    const db = await getIndex()

    const puts = []
    const deletes = []

    for (const request of requests) {
      const {
        action,
        body: { objectID, ...rest },
      } = request

      switch (action) {
        case `updateObject`:
          puts.push({ ...rest, _id: objectID })
          break

        case `partialUpdateObjectNoCreate`:
          const dbTemp = await getIndex()
          const existing = await dbTemp.DOCUMENTS([objectID])
          await dbTemp.INDEX.STORE.close()
          if (existing) {
            puts.push({ ...existing[0], ...rest, _id: objectID })
          }
          break

        case `deleteObject`:
          deletes.push(objectID)
          break

        default:
          throw new Error(`Invalid action`)
      }
    }

    const response: SaveResponse = {
      wait: async (): Promise<SaveResponse> => this,
      taskID: getTaskID(),
    }

    if (puts.length) {
      const result = await db.PUT(puts, { storeVectors: true, doNotIndexField: [], storeRawDocs: true })
      response.objectIDs = result.map((r) => r._id)
    }

    if (deletes.length) {
      await db.DELETE(deletes)
    }

    return res.status(200).send(response)
  } catch (err) {
    return res.status(500).send({
      message: err,
    })
  }
}
