import si from 'search-index'

export const getIndex = async () => {
  return await si({ name: `.algoliaMockServer` })
}

export const idToObjectID = (documents) => {
  return documents.map(({ _id, ...rest }) => ({ objectID: _id, ...rest }))
}

export const getTaskID = (): number => Math.floor(Math.random() * 1000)
