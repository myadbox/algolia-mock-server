import {describe, it, expect} from 'vitest'
import request from 'supertest'
import init from './index'

describe('server', () => {
  const app = init()

  it('GET / returns welcome message', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Welcome to Algolia Mock Server')
  })
})
