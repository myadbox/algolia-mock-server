import express, {Application, Request, Response, Router} from 'express'
import cors from 'cors'

import {getObject, getObjects, search, queries, saveObjects, task, clear} from './routes'

const init = () => {
  const app: Application = express()
  const router = Router()

  app.use(cors())
  app.use(express.json({type: '*/*'}))
  app.use(express.urlencoded({extended: true}))
  app.use(`/1/indexes`, router)

  app.get(`/`, async (req: Request, res: Response): Promise<Response> => {
    return res.status(200).send({
      message: `Welcome to Algolia Mock Server`,
    })
  })

  router.post(`/:indexName/batch`, saveObjects)
  router.post(`/:indexName`, (req: Request, res: Response) => {
    req.body = {
      requests: [
        {
          action: `addObject`,
          body: req.body,
        },
      ],
    }
    return saveObjects(req, res)
  })
  router.post(`/:indexName/:objectID/partial`, (req: Request, res: Response) => {
    req.body = {
      requests: [
        {
          action: `partialUpdateObjectNoCreate`,
          body: {objectID: req.params.objectID, ...req.body},
        },
      ],
    }
    return saveObjects(req, res)
  })
  router.delete(`/:indexName/:objectID`, (req: Request, res: Response) => {
    req.body = {
      requests: [
        {
          action: `deleteObject`,
          body: {objectID: req.params.objectID},
        },
      ],
    }
    return saveObjects(req, res)
  })
  router.post(`/:indexName/query`, search)
  router.post(`/*/queries`, queries)
  router.get(`/:indexName/:objectID`, getObject)
  router.post(`/*/objects`, getObjects)
  router.get(`/:indexName/task/:taskID`, task)
  router.post(`/:indexName/clear`, clear)

  return app
}

export default init
