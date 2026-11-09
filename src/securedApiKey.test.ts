import {createHmac} from 'node:crypto'
import {describe, it, expect, beforeAll, afterAll} from 'vitest'
import request from 'supertest'
import init from './index'
import {decodeSecuredApiKey} from './securedApiKey'

const accountId = `6d8749c4fe00b757c1bc1c37`
const member = `c74a6bd0-3e4f-4618-9819-51b498ddc48c`
const owner = `874a6bd0-3e4f-4618-9819-51b498ddc48e`
const team = `eea679eefb5a9c6e2c4bcf62`

const memberFilters =
  `accountId:"${accountId}" AND ` +
  `(createdById:"${member}" OR visibleTo:"u:${member}" OR visibleTo:"t:${team}") AND ` +
  `(createdById:"${member}" OR NOT hiddenTo:"u:${member}")`

const memberRestrictions = {
  validUntil: 4102444800,
  userToken: member,
  filters: memberFilters,
  searchParams: {analyticsTags: [`account:${accountId}`, `actor:member`], clickAnalytics: true},
}

// Minted by algoliasearch 5.49.2: generateSecuredApiKey({parentApiKey: `parent-search-key`, restrictions: memberRestrictions})
const keyMintedByAlgoliasearch = `NmI5ODk4Yzc2YWI0MDA1MDYzOGQ4ZGQ1ODg0ODViNzNiNTBiMWE0YzJjNWI3MGZlNTI0NGUyNDYwYTQ5M2UzOGFuYWx5dGljc1RhZ3M9YWNjb3VudCUzQTZkODc0OWM0ZmUwMGI3NTdjMWJjMWMzNyUyQ2FjdG9yJTNBbWVtYmVyJmNsaWNrQW5hbHl0aWNzPXRydWUmZmlsdGVycz1hY2NvdW50SWQlM0ElMjI2ZDg3NDljNGZlMDBiNzU3YzFiYzFjMzclMjIlMjBBTkQlMjAoY3JlYXRlZEJ5SWQlM0ElMjJjNzRhNmJkMC0zZTRmLTQ2MTgtOTgxOS01MWI0OThkZGM0OGMlMjIlMjBPUiUyMHZpc2libGVUbyUzQSUyMnUlM0FjNzRhNmJkMC0zZTRmLTQ2MTgtOTgxOS01MWI0OThkZGM0OGMlMjIlMjBPUiUyMHZpc2libGVUbyUzQSUyMnQlM0FlZWE2NzllZWZiNWE5YzZlMmM0YmNmNjIlMjIpJTIwQU5EJTIwKGNyZWF0ZWRCeUlkJTNBJTIyYzc0YTZiZDAtM2U0Zi00NjE4LTk4MTktNTFiNDk4ZGRjNDhjJTIyJTIwT1IlMjBOT1QlMjBoaWRkZW5UbyUzQSUyMnUlM0FjNzRhNmJkMC0zZTRmLTQ2MTgtOTgxOS01MWI0OThkZGM0OGMlMjIpJnVzZXJUb2tlbj1jNzRhNmJkMC0zZTRmLTQ2MTgtOTgxOS01MWI0OThkZGM0OGMmdmFsaWRVbnRpbD00MTAyNDQ0ODAw`

/**
 * The same encoding as algoliasearch v5's `generateSecuredApiKey`: search params flattened in, keys sorted, arrays
 * comma-joined, each value URI-encoded, then base64 of the hex HMAC followed by that query string
 */
const mintSecuredApiKey = (parentApiKey: string, {searchParams = {}, ...restrictions}: Record<string, unknown>) => {
  const merged: Record<string, unknown> = {...restrictions, ...(searchParams as Record<string, unknown>)}
  const queryString = Object.keys(merged)
    .sort()
    .map(key => {
      const value = merged[key]
      return `${key}=${encodeURIComponent(Array.isArray(value) ? value.join(`,`) : String(value))}`
    })
    .join(`&`)
  const hmac = createHmac(`sha256`, parentApiKey).update(queryString).digest(`hex`)
  return Buffer.from(hmac + queryString).toString(`base64`)
}

describe(`decodeSecuredApiKey`, () => {
  it(`mints test keys exactly as algoliasearch does`, () => {
    expect(mintSecuredApiKey(`parent-search-key`, memberRestrictions)).toBe(keyMintedByAlgoliasearch)
  })

  it(`reads the filters and user token embedded in a key minted by algoliasearch`, () => {
    const restrictions = decodeSecuredApiKey(keyMintedByAlgoliasearch)

    expect(restrictions?.get(`filters`)).toBe(memberFilters)
    expect(restrictions?.get(`userToken`)).toBe(member)
  })

  it.each([
    [`a plain hex search key`, `4bb592d927f6925837260908180b02a1`],
    [`a short admin key`, `KEY`],
    [`a value that is not base64`, `not a key!`],
    [`an empty string`, ``],
    [`no key`, undefined],
    [`a repeated query parameter`, [keyMintedByAlgoliasearch, keyMintedByAlgoliasearch]],
  ])(`returns null for %s`, (_, apiKey) => {
    expect(decodeSecuredApiKey(apiKey)).toBeNull()
  })
})

describe(`secured API key filters`, () => {
  const app = init()
  const indexName = `test_NEBULA_SECURED_KEY`

  const documents = [
    {
      objectID: `excluded`,
      type: `IMAGE`,
      accountId,
      createdById: owner,
      visibleTo: [`t:${team}`],
      hiddenTo: [`u:${member}`],
    },
    {objectID: `team-shared`, type: `IMAGE`, accountId, createdById: owner, visibleTo: [`t:${team}`], hiddenTo: []},
    {objectID: `own-video`, type: `VIDEO`, accountId, createdById: member, visibleTo: [], hiddenTo: []},
    {objectID: `unshared`, type: `IMAGE`, accountId, createdById: owner, visibleTo: [], hiddenTo: []},
    {objectID: `other-account`, type: `IMAGE`, accountId: `other`, createdById: member, visibleTo: [], hiddenTo: []},
  ]
  const everyObjectID = documents.map(document => document.objectID).sort()

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

  const objectIDs = (hits: Array<{objectID: string}>): string[] => hits.map(hit => hit.objectID).sort()

  const queries = (params: Record<string, unknown> = {}, apiKey?: string, via: `query` | `header` = `query`) => {
    const req = request(app).post(`/1/indexes/*/queries`)
    if (apiKey && via === `query`) req.query({'x-algolia-api-key': apiKey, 'x-algolia-application-id': `APPID`})
    if (apiKey && via === `header`) req.set(`x-algolia-api-key`, apiKey)
    return req.send({requests: [{indexName, hitsPerPage: 10, ...params}]})
  }

  it(`drops a hit the key's filters hide, when the browser client sends the key as a query parameter`, async () => {
    const res = await queries({}, keyMintedByAlgoliasearch)

    expect(res.status).toBe(200)
    expect(objectIDs(res.body.results[0].hits)).toEqual([`own-video`, `team-shared`])
    expect(res.body.results[0].nbHits).toBe(2)
  })

  it(`drops a hit the key's filters hide, when the Node client sends the key as a header`, async () => {
    const res = await queries({}, keyMintedByAlgoliasearch, `header`)

    expect(objectIDs(res.body.results[0].hits)).toEqual([`own-video`, `team-shared`])
  })

  it(`applies the key's filters on single-index search`, async () => {
    const res = await request(app)
      .post(`/1/indexes/${indexName}/query`)
      .set(`x-algolia-api-key`, keyMintedByAlgoliasearch)
      .send({})

    expect(res.status).toBe(200)
    expect(objectIDs(res.body.hits)).toEqual([`own-video`, `team-shared`])
    expect(res.body.nbHits).toBe(2)
  })

  it(`ANDs the key's filters with the request's own filters, so a request can narrow them but not widen them`, async () => {
    const res = await queries({filters: `type:IMAGE`}, keyMintedByAlgoliasearch)

    expect(objectIDs(res.body.results[0].hits)).toEqual([`team-shared`])
  })

  it(`ANDs the key's filters with the request's facetFilters`, async () => {
    const res = await queries({facetFilters: [[`type:IMAGE`]]}, keyMintedByAlgoliasearch)

    expect(objectIDs(res.body.results[0].hits)).toEqual([`team-shared`])
  })

  it(`counts facets over the hits the key's filters leave`, async () => {
    const res = await queries({facets: [`type`]}, keyMintedByAlgoliasearch)

    expect(res.body.results[0].facets).toEqual({type: {image: 1, video: 1}})
  })

  it(`leaves a search with a key that embeds no filters unfiltered`, async () => {
    const key = mintSecuredApiKey(`parent-search-key`, {validUntil: 4102444800, userToken: member})
    const res = await queries({}, key)

    expect(objectIDs(res.body.results[0].hits)).toEqual(everyObjectID)
  })

  it.each([
    [`a plain search key`, `4bb592d927f6925837260908180b02a1`],
    [`a plain admin key`, `KEY`],
    [`no key`, undefined],
  ])(`leaves a search with %s unfiltered`, async (_, apiKey) => {
    const res = await queries({}, apiKey)

    expect(objectIDs(res.body.results[0].hits)).toEqual(everyObjectID)
  })
})
