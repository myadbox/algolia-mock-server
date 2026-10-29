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

describe('negated facetFilters', () => {
  const app = init()
  const indexName = `test_NEBULA`
  const documents = [
    {objectID: `template-original`, name: `Original`, type: `TEMPLATE`, isDerived: false},
    {objectID: `template-legacy`, name: `Legacy`, type: `TEMPLATE`},
    {objectID: `template-derived`, name: `Derived`, type: `TEMPLATE`, isDerived: true},
    {objectID: `image`, name: `Image`, type: `IMAGE`, isDerived: false},
  ]

  beforeAll(async () => {
    await request(app).post(`/1/indexes/${indexName}/clear`)
    const res = await request(app)
      .post(`/1/indexes/${indexName}/batch`)
      .send({requests: documents.map(body => ({action: `addObject`, body}))})
    expect(res.status).toBe(200)
  })

  afterAll(async () => {
    await request(app).post(`/1/indexes/${indexName}/clear`)
  })

  const query = async (params: Record<string, unknown>) => {
    const res = await request(app)
      .post(`/1/indexes/*/queries`)
      .send({requests: [{indexName, query: ``, hitsPerPage: 20, ...params}]})
    expect(res.status).toBe(200)
    return res.body.results[0]
  }

  const objectIDs = (hits: Array<{objectID: string}>): string[] => hits.map(hit => hit.objectID).sort()

  it(`excludes records whose attribute equals the negated value and keeps records missing it`, async () => {
    const result = await query({facetFilters: [[`type:TEMPLATE`], [`isDerived:-true`]]})

    expect(objectIDs(result.hits)).toEqual([`template-legacy`, `template-original`])
    expect(result.nbHits).toBe(2)
    expect(result.nbPages).toBe(1)
  })

  it(`treats an OR group mixing negated and positive values as either matching`, async () => {
    const result = await query({facetFilters: [[`type:TEMPLATE`], [`isDerived:-true`, `isDerived:true`]]})

    expect(objectIDs(result.hits)).toEqual([`template-derived`, `template-legacy`, `template-original`])
    expect(result.nbHits).toBe(3)
  })

  it(`excludes values negated by a top-level string facetFilter`, async () => {
    const result = await query({facetFilters: [`type:-TEMPLATE`]})

    expect(objectIDs(result.hits)).toEqual([`image`])
    expect(result.nbHits).toBe(1)
  })

  it(`pages, totals and facets the post-filtered results`, async () => {
    const pages = await Promise.all(
      [0, 1].map(page => query({facetFilters: [[`isDerived:-true`]], facets: [`type`], hitsPerPage: 2, page}))
    )

    for (const page of pages) {
      expect(page.nbHits).toBe(3)
      expect(page.nbPages).toBe(2)
      expect(page.facets).toEqual({type: {template: 2, image: 1}})
    }
    expect(pages[0].hits.length).toBe(2)
    expect(pages[1].hits.length).toBe(1)
    expect(objectIDs([...pages[0].hits, ...pages[1].hits])).toEqual([`image`, `template-legacy`, `template-original`])
  })

  it(`applies negated facetFilters on single-index search`, async () => {
    const res = await request(app)
      .post(`/1/indexes/${indexName}/query`)
      .send({facetFilters: [[`type:TEMPLATE`], [`isDerived:-true`]]})

    expect(res.status).toBe(200)
    expect(objectIDs(res.body.hits)).toEqual([`template-legacy`, `template-original`])
    expect(res.body.nbHits).toBe(2)
  })

  it(`applies a negated facetFilter on single-index search without other filters`, async () => {
    const res = await request(app)
      .post(`/1/indexes/${indexName}/query`)
      .send({facetFilters: [`type:-TEMPLATE`]})

    expect(res.status).toBe(200)
    expect(objectIDs(res.body.hits)).toEqual([`image`])
  })
})
