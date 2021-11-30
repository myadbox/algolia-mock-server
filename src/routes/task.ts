import { Request, Response } from 'express'

export const task = async (req: Request, res: Response): Promise<Response> => {
  return res.status(200).send({
    status: 'published',
    pendingTask: false,
  })
}
