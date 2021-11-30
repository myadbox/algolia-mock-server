import { Request, Response } from 'express'
import qs from 'qs'
import { getIndex, idToObjectID } from '../helpers'

/**
 * Search and filter in multiple indexes
 */
export const queries = async (req: Request, res: Response): Promise<Response> => {
  const {
    body: { requests },
  } = req

  try {
    const { indexName, params } = requests[0]
    const { query: queryParams, facets: facetsParams, facetFilters: facetFiltersParams } = qs.parse(params)

    const searchExp = { AND: [] }

    if (queryParams) {
      searchExp.AND.push({ SEARCH: (queryParams as string).split(' ') })
    }

    if (facetFiltersParams) {
      const facetFilters = JSON.parse(facetFiltersParams as string)
      const orFilters = []
      for (const filter of facetFilters) {
        if (Array.isArray(filter)) {
          searchExp.AND.push({ AND: filter })
        } else {
          orFilters.push(filter)
        }
      }
      if (orFilters.length) {
        searchExp.AND.push({ OR: orFilters })
      }
    }

    let hits = []

    const db = await getIndex()

    if (searchExp.AND.length) {
      const result = await db.QUERY(searchExp, { DOCUMENTS: true })
      hits = idToObjectID(result.RESULT.map((r) => r._doc))
    } else {
      const result = await db.ALL_DOCUMENTS()
      hits = idToObjectID(result.map((r) => r._doc))
    }

    const facets = {}
    if (facetsParams) {
      const facetsParamsArray = JSON.parse(facetsParams as string)
      for (const facet of facetsParamsArray) {
        const docs = await db.FACETS({ FIELD: facet })
        if (docs?.length < 1) continue

        facets[facet] = docs.reduce((aggr, cur) => {
          aggr[cur.VALUE as string] = cur._id.length
          return aggr
        }, {})
      }
    }

    // Explicility close the underlying leveldown store
    await db.INDEX.STORE.close()

    const results = [
      {
        hits,
        page: 0,
        nbHits: hits.length,
        nbPages: 1,
        hitsPerPage: 20,
        processingTimeMS: 1,
        query: queryParams,
        params,
        index: indexName,
        facets,
      },
    ]

    return res.status(200).send({ results })
  } catch (err) {
    return res.status(500).send({ message: err })
  }
}
