import {describe, it, expect, beforeAll, afterAll} from 'vitest'
import request from 'supertest'
import init from '../index'

describe('queries pagination', () => {
  const app = init()
  const indexName = `test_NEBULA`
  const totalDocs = 100
  const chunkSize = 25
  const hitsPerPage = 48

  const seedDocuments = async (): Promise<void> => {
    for (let start = 0; start < totalDocs; start += chunkSize) {
      const requests = []
      for (let i = start; i < Math.min(start + chunkSize, totalDocs); i++) {
        requests.push({
          action: `addObject`,
          body: {
            objectID: `doc-${i}`,
            name: `Document ${i}`,
            type: `IMAGE`,
          },
        })
      }

      const res = await request(app).post(`/1/indexes/${indexName}/batch`).send({requests})
      expect(res.status).toBe(200)
    }
  }

  beforeAll(async () => {
    await request(app).post(`/1/indexes/${indexName}/clear`)
    await seedDocuments()
  })

  afterAll(async () => {
    await request(app).post(`/1/indexes/${indexName}/clear`)
  })

  interface QueryPage {
    hits: Array<{objectID: string}>
    nbHits: number
    nbPages: number
  }

  const fetchAllPages = async (extraParams: Record<string, unknown> = {}): Promise<QueryPage[]> => {
    const pages: QueryPage[] = []

    for (const page of [0, 1, 2]) {
      const res = await request(app)
        .post(`/1/indexes/*/queries`)
        .send({
          requests: [
            {
              indexName,
              query: ``,
              page,
              hitsPerPage,
              ...extraParams,
            },
          ],
        })

      expect(res.status).toBe(200)
      pages.push(res.body.results[0])
    }

    return pages
  }

  const assertDisjointAcrossPages = (pages: QueryPage[]): void => {
    const seen = new Set<string>()

    for (const page of pages) {
      for (const hit of page.hits) {
        expect(seen.has(hit.objectID)).toBe(false)
        seen.add(hit.objectID)
      }
    }

    expect(seen.size).toBe(totalDocs)
  }

  it(`reports true nbHits/nbPages and serves disjoint pages for an empty query`, async () => {
    const pages = await fetchAllPages()

    for (const page of pages) {
      expect(page.nbHits).toBe(totalDocs)
      expect(page.nbPages).toBe(3)
    }

    expect(pages[0].hits.length).toBe(48)
    expect(pages[1].hits.length).toBe(48)
    expect(pages[2].hits.length).toBe(4)

    assertDisjointAcrossPages(pages)
  })

  it(`reports true nbHits/nbPages and serves disjoint pages for a facetFilters query`, async () => {
    const pages = await fetchAllPages({facetFilters: [[`type:IMAGE`]]})

    for (const page of pages) {
      expect(page.nbHits).toBe(totalDocs)
      expect(page.nbPages).toBe(3)
    }

    expect(pages[0].hits.length).toBe(48)
    expect(pages[1].hits.length).toBe(48)
    expect(pages[2].hits.length).toBe(4)

    assertDisjointAcrossPages(pages)
  })
})
