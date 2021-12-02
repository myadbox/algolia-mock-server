import { Request, Response } from 'express'
import qs from 'qs'
import { getIndex, idToObjectID, converStrToArray, getPageCount } from '../helpers'

/**
 * Search and filter in multiple indexes
 */
export const queries = async (req: Request, res: Response): Promise<Response> => {
  const {
    body: { requests },
  } = req

  try {
    const db = await getIndex()

    const results = []

    for (const request of requests) {
      const { indexName, params } = request
      const {
        query: queryParams,
        facets: facetsParams,
        facetFilters: facetFiltersParams,
        page: pageParam,
        hitsPerPage: hitsPerPageParams,
      } = qs.parse(params)

      const page = parseInt((pageParam as string) || `0`, 10)
      const hitsPerPage = parseInt((hitsPerPageParams as string) || `1`, 10)
      const searchExp = { AND: [] }

      if (queryParams) {
        searchExp.AND.push({ SEARCH: (queryParams as string).split(' ') })
      }

      if (facetFiltersParams) {
        const facetFilters = JSON.parse(facetFiltersParams as string)
        const andFilters = []
        for (const filter of facetFilters) {
          if (Array.isArray(filter)) {
            searchExp.AND.push({ OR: filter })
          } else {
            andFilters.push(filter)
          }
        }
        if (andFilters.length) {
          searchExp.AND.push({ AND: andFilters })
        }
      }

      let hits = []

      if (searchExp.AND.length) {
        const result = await db.QUERY(searchExp, {
          DOCUMENTS: true,
          PAGE: { NUMBER: page, SIZE: hitsPerPage },
        })

        hits = idToObjectID(result.RESULT.map((r) => r._doc))
      } else {
        const result = await db.ALL_DOCUMENTS(hitsPerPage)
        hits = idToObjectID(result.map((r) => r._doc))
      }

      let facets = {}
      if (facetsParams) {
        const facetsParamsArray = converStrToArray(facetsParams as string)
        const values = await db.FACETS({ FIELD: facetsParamsArray })

        facets = values.reduce((aggr, cur) => {
          const facet = cur.FIELD as string
          aggr[facet] = { ...aggr[facet], [cur.VALUE as string]: cur._id.length }
          return aggr
        }, {})
      }

      const nbPages = getPageCount(hits.length, hitsPerPage)

      results.push({
        hits,
        page,
        nbHits: hits.length,
        nbPages,
        hitsPerPage,
        processingTimeMS: 1,
        query: queryParams,
        params,
        index: indexName,
        facets,
      })
    }

    return res.status(200).send({ results })
  } catch (err) {
    return res.status(500).send({ message: err })
  }
}
