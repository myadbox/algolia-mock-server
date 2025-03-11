# Algolia Mock Server

A mock server to mimick Algolia's v5 search index, primarily for e2e testing purposes.

## API endpoints currently covered

### Batch object creation

- \***\*API Endpoint:\*\*** `/1/indexes/:indexName/batch`
- \***\*algoliasearch JS package:\*\*** `index.saveObject()`, `index.saveObjects()`, `index.partialUpdateObject()`, `index.partialUpdateObjects()` and `index.deleteObject()`, `index.deleteObjects()`

### Single index query

- \***\*API Endpoint:\*\*** `/1/indexes/:indexName/query`
- **algoliasearch JS package:** `index.search()`

### Multi index query and filter

- **API Endpoint:** `/1/indexes/*/queries`
- **react-instantsearch-dom JS package:** Search, RefinementList and HierarchicalMenu

### Fetch single object using objectID

- **API Endpoint:** `/1/indexes/:indexName/:objectID`
- **algoliasearch JS package:** `index.getObject()`

### Fetch multiple objects from multiple indexes

- **API Endpoint:** `/1/indexes/*/objects`
- **algoliasearch JS package:** `index.getObjects()`

### (Fake) Task status check

- **API Endpoint:** `/1/indexes/:indexName/task/:taskID`
- **algoliasearch JS package:** `index.[method]().wait()`
