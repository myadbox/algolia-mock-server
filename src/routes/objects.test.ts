import {describe, it, expect, beforeAll, afterAll} from 'vitest'
import request from 'supertest'
import init from '../index'

describe('object retrieval', () => {
  const app = init()
  const indexName = `test_NEBULA`
  const present = {objectID: `present`, name: `Present`, tags: [`Launch`]}

  beforeAll(async () => {
    await request(app).post(`/1/indexes/${indexName}/clear`)
    const res = await request(app)
      .post(`/1/indexes/${indexName}/batch`)
      .send({requests: [{action: `addObject`, body: present}]})
    expect(res.status).toBe(200)
  })

  afterAll(async () => {
    await request(app).post(`/1/indexes/${indexName}/clear`)
  })

  describe('getObjects', () => {
    it('wraps the found objects in results', async () => {
      const res = await request(app)
        .post(`/1/indexes/*/objects`)
        .send({requests: [{indexName, objectID: `present`}]})

      expect(res.status).toBe(200)
      expect(res.body).toEqual({results: [present]})
    })

    it('returns null in the slot of each missing objectID', async () => {
      const res = await request(app)
        .post(`/1/indexes/*/objects`)
        .send({
          requests: [
            {indexName, objectID: `missing`},
            {indexName, objectID: `present`},
            {indexName, objectID: `also-missing`},
          ],
        })

      expect(res.status).toBe(200)
      expect(res.body).toEqual({results: [null, present, null]})
    })
  })

  describe('getObject', () => {
    it('returns the object', async () => {
      const res = await request(app).get(`/1/indexes/${indexName}/present`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual(present)
    })

    it('returns 404 for a missing objectID', async () => {
      const res = await request(app).get(`/1/indexes/${indexName}/missing`)

      expect(res.status).toBe(404)
      expect(res.body).toEqual({message: `ObjectID does not exist`, status: 404})
    })
  })
})
