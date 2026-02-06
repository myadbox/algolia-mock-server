import level from 'level-party'
import si from 'search-index'

export const getIndex = async () => {
  return await si({ db: level(`.algoliaMockServer`, { valueEncoding: `json` }) })
}

export const idToObjectID = (documents) => {
  return documents.map(({ _id, ...rest }) => ({ objectID: _id, ...rest }))
}

export const getTaskID = (): number => Math.floor(Math.random() * 1000)

export const getPageCount = (total: number, perPage: number): number => {
  const extra = total % perPage === 0 ? 0 : 1
  return Math.floor(total / perPage) + extra
}

/**
 * Parse Algolia filter string into filter parts and objectIDs
 * Returns { filterParts, objectIDs }
 *
 * Note: objectID filters cannot be part of the search-index query because
 * search-index doesn't support filtering by document _id. We extract objectID
 * filters here and apply them as post-filters after the search.
 */
export const parseFilters = (filterString: string) => {
  if (!filterString) {
    return { filterParts: [], objectIDs: [] }
  }

  // Extract objectIDs - must be handled separately (search-index limitation)
  const objectIDs: string[] = []
  const objectIDRegex = /objectID:["']?([a-zA-Z0-9_-]+)["']?/gi
  for (const match of filterString.matchAll(objectIDRegex)) {
    objectIDs.push(match[1])
  }

  // Remove objectID filters from the string
  const withoutObjectIDs = filterString
    .replace(/\s*AND\s+objectID:["']?[a-zA-Z0-9_-]+["']?/gi, '')
    .replace(/objectID:["']?[a-zA-Z0-9_-]+["']?\s*AND\s*/gi, '')
    .replace(/objectID:["']?[a-zA-Z0-9_-]+["']?/gi, '')
    .trim()

  // Split by AND, remove parentheses and quotes
  const filterParts = withoutObjectIDs
    .split(/\s+AND\s+/i)
    .map((part) =>
      part
        .trim()
        .replace(/^\(|\)$/g, '')
        .replace(/["']/g, ''),
    )
    .filter((part) => part.length > 0)

  return { filterParts, objectIDs }
}
