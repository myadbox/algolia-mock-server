import level from 'level-party'
import si from 'search-index'

export const getIndex = async () => {
  return await si({ db: level(`.algoliaMockServer`, { valueEncoding: `json` }) })
}

export const idToObjectID = (documents) => {
  return documents.map(({ _id, ...rest }) => ({ objectID: _id, ...rest }))
}

export const getTaskID = (): number => Math.floor(Math.random() * 1000)

export const converStrToArray = (params: string): string[] => {
  const isArray = /^\[(.*)\]$/.test(params)
  return isArray ? JSON.parse(params) : [params]
}

export const getPageCount = (total: number, perPage: number): number => {
  const extra = total % perPage === 0 ? 0 : 1
  return Math.floor(total / perPage) + extra
}
