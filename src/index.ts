import express, { Application, Request, Response } from 'express'

const app: Application = express()
const port = 9200

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get(`/`, async (req: Request, res: Response): Promise<Response> => {
  return res.status(200).send({
    message: `Hello world!`,
  })
})

try {
  app.listen(port, (): void => {
    console.log(`Connected successfully on port ${port}`)
  })
} catch (err) {
  console.error(`Error occured: ${err.message}`)
}
