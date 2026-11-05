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

describe('objectID facetFilters', () => {
  const app = init()
  const indexName = `test_NEBULA_OBJECT_ID`
  const ids = [`a1b2-c3d4-0001`, `a1b2-c3d4-0002`, `a1b2-c3d4-0003`]

  beforeAll(async () => {
    await request(app).post(`/1/indexes/${indexName}/clear`)
    await request(app)
      .post(`/1/indexes/${indexName}/batch`)
      .send({
        requests: ids.map((objectID, index) => ({
          action: `addObject`,
          body: {objectID, name: `Asset ${index}`, type: index === 2 ? `VIDEO` : `IMAGE`},
        })),
      })
  })

  afterAll(async () => {
    await request(app).post(`/1/indexes/${indexName}/clear`)
  })

  const search = async (body: Record<string, unknown>) => {
    const res = await request(app).post(`/1/indexes/${indexName}/query`).send(body)
    expect(res.status).toBe(200)
    return res.body
  }

  const queried = async (body: Record<string, unknown>) => {
    const res = await request(app)
      .post(`/1/indexes/*/queries`)
      .send({requests: [{indexName, hitsPerPage: 10, ...body}]})
    expect(res.status).toBe(200)
    return res.body.results[0]
  }

  const objectIDs = (result: {hits: Array<{objectID: string}>}) => result.hits.map(hit => hit.objectID).sort()

  it(`matches hyphenated ids in an OR group on single-index search`, async () => {
    const result = await search({facetFilters: [[`objectID:${ids[0]}`, `objectID:${ids[2]}`]]})

    expect(objectIDs(result)).toEqual([ids[0], ids[2]])
  })

  it(`matches hyphenated ids in an OR group on multi-index queries`, async () => {
    const result = await queried({facetFilters: [[`objectID:${ids[1]}`]]})

    expect(objectIDs(result)).toEqual([ids[1]])
    expect(result.nbHits).toBe(1)
  })

  it(`matches an id given as a top-level string facetFilter`, async () => {
    const result = await queried({facetFilters: [`objectID:${ids[1]}`]})

    expect(objectIDs(result)).toEqual([ids[1]])
  })

  it(`ANDs an objectID group with the other facetFilters`, async () => {
    const result = await search({facetFilters: [[`type:IMAGE`], [`objectID:${ids[0]}`, `objectID:${ids[2]}`]]})

    expect(objectIDs(result)).toEqual([ids[0]])
  })

  it(`accepts facetFilters as a JSON string, as Algolia does`, async () => {
    const result = await search({facetFilters: JSON.stringify([[`objectID:${ids[0]}`]])})

    expect(objectIDs(result)).toEqual([ids[0]])
  })
})

describe('hyphenated facetFilters', () => {
  const app = init()
  const indexName = `test_NEBULA`
  const mine = `874a6bd0-3e4f-4618-9819-51b498ddc48e`
  const theirs = `1f2e3d4c-5b6a-4798-8695-a4b3c2d1e0f9`
  const documents = [
    {objectID: `mine-image`, type: `IMAGE`, createdById: mine, tags: [`co-op`]},
    {objectID: `mine-video`, type: `VIDEO`, createdById: mine, tags: [`launch`]},
    {objectID: `theirs-image`, type: `IMAGE`, createdById: theirs, tags: [`launch`]},
    {objectID: `nobodys-image`, type: `IMAGE`, tags: []},
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

  it(`matches a hyphenated value in a lone-value group, and reports the true total`, async () => {
    const result = await query({facetFilters: [[`createdById:${mine}`]]})

    expect(objectIDs(result.hits)).toEqual([`mine-image`, `mine-video`])
    expect(result.nbHits).toBe(2)
  })

  it(`matches a hyphenated value given as a top-level string`, async () => {
    const result = await query({facetFilters: [`createdById:${theirs}`]})

    expect(objectIDs(result.hits)).toEqual([`theirs-image`])
  })

  it(`matches either hyphenated value in an OR group, leaving out records missing the attribute`, async () => {
    const result = await query({facetFilters: [[`createdById:${mine}`, `createdById:${theirs}`]]})

    expect(objectIDs(result.hits)).toEqual([`mine-image`, `mine-video`, `theirs-image`])
  })

  it(`matches a hyphenated value inside an array attribute`, async () => {
    const result = await query({facetFilters: [[`tags:co-op`]]})

    expect(objectIDs(result.hits)).toEqual([`mine-image`])
  })

  it(`ANDs a hyphenated value with the other facetFilters`, async () => {
    const result = await query({facetFilters: [[`createdById:${mine}`], [`type:VIDEO`]]})

    expect(objectIDs(result.hits)).toEqual([`mine-video`])
  })

  it(`does not take a negation for a hyphenated value`, async () => {
    const result = await query({facetFilters: [[`createdById:-${mine}`]]})

    expect(objectIDs(result.hits)).toEqual([`nobodys-image`, `theirs-image`])
  })
})

describe('echoed search params', () => {
  const app = init()
  const indexName = `test_NEBULA_PARAMS`

  beforeAll(async () => {
    await request(app).post(`/1/indexes/${indexName}/clear`)
    await request(app)
      .post(`/1/indexes/${indexName}/batch`)
      .send({
        requests: [0, 1, 2, 3, 4].map(index => ({
          action: `addObject`,
          body: {objectID: `doc-${index}`, name: `Doc ${index}`, type: `IMAGE`},
        })),
      })
  })

  afterAll(async () => {
    await request(app).post(`/1/indexes/${indexName}/clear`)
  })

  it(`echoes each request as a URL-encoded params string`, async () => {
    const facetFilters = [[`type:IMAGE`]]
    const res = await request(app)
      .post(`/1/indexes/*/queries`)
      .send({requests: [{indexName, query: ``, page: 0, hitsPerPage: 2, facetFilters}]})

    const echoed = Object.fromEntries(new URLSearchParams(res.body.results[0].params))

    expect(echoed).toEqual({query: ``, page: `0`, hitsPerPage: `2`, facetFilters: JSON.stringify(facetFilters)})
  })

  it(`serves the requested page of a single-index search and reports the true total`, async () => {
    const pageOf = async (page: number) => {
      const res = await request(app).post(`/1/indexes/${indexName}/query`).send({page, hitsPerPage: 2})
      return res.body
    }

    const [first, second, third] = await Promise.all([pageOf(0), pageOf(1), pageOf(2)])
    const seen = [first, second, third].flatMap(result => result.hits.map((hit: {objectID: string}) => hit.objectID))

    expect(new Set(seen).size).toBe(5)
    expect(first.nbHits).toBe(5)
    expect(first.nbPages).toBe(3)
    expect(second.page).toBe(1)
  })
})

describe('NOT objectID filters', () => {
  const app = init()
  const indexName = `test_NEBULA_NOT_OBJECT_ID`
  const ids = [`0336a07194ea33b4a5555d73`, `0336a07194ea33b4a5555d74`, `a1b2-c3d4-0003`]

  beforeAll(async () => {
    await request(app).post(`/1/indexes/${indexName}/clear`)
    await request(app)
      .post(`/1/indexes/${indexName}/batch`)
      .send({
        requests: ids.map((objectID, index) => ({
          action: `addObject`,
          body: {objectID, name: `Asset ${index}`, type: index === 1 ? `VIDEO` : `IMAGE`},
        })),
      })
  })

  afterAll(async () => {
    await request(app).post(`/1/indexes/${indexName}/clear`)
  })

  const search = async (filters: string) => {
    const res = await request(app).post(`/1/indexes/${indexName}/query`).send({filters})
    expect(res.status).toBe(200)
    return res.body
  }

  const queried = async (filters: string) => {
    const res = await request(app)
      .post(`/1/indexes/*/queries`)
      .send({requests: [{indexName, hitsPerPage: 10, filters}]})
    expect(res.status).toBe(200)
    return res.body.results[0]
  }

  const objectIDs = (result: {hits: Array<{objectID: string}>}) => result.hits.map(hit => hit.objectID).sort()

  it(`excludes only the negated id on single-index search`, async () => {
    const result = await search(`NOT objectID:${ids[0]}`)

    expect(objectIDs(result)).toEqual([ids[1], ids[2]])
  })

  it(`excludes only the negated id on multi-index queries`, async () => {
    const result = await queried(`NOT objectID:${ids[0]}`)

    expect(objectIDs(result)).toEqual([ids[1], ids[2]])
    expect(result.nbHits).toBe(2)
  })

  it(`excludes every id in an AND chain of negations`, async () => {
    const result = await queried(`NOT objectID:${ids[0]} AND NOT objectID:${ids[2]}`)

    expect(objectIDs(result)).toEqual([ids[1]])
  })

  it(`excludes a quoted hyphenated id`, async () => {
    const result = await queried(`NOT objectID:"${ids[2]}"`)

    expect(objectIDs(result)).toEqual([ids[0], ids[1]])
  })

  it(`ANDs a negated id with another facet`, async () => {
    const result = await queried(`type:IMAGE AND NOT objectID:${ids[0]}`)

    expect(objectIDs(result)).toEqual([ids[2]])
  })

  it(`ANDs a negated id with a positive id`, async () => {
    const result = await queried(`objectID:${ids[1]} AND NOT objectID:${ids[0]}`)

    expect(objectIDs(result)).toEqual([ids[1]])
  })
})
