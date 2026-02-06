# Algolia Mock Server

A mock server to mimick Algolia's v5 search index, primarily for e2e testing purposes.

## Algolia documentation

- [Search single index (REST API)](https://www.algolia.com/doc/rest-api/search/search-single-index/)
- [Search multiple indices (REST API)](https://www.algolia.com/doc/rest-api/search/search-multiple-indices/)
- [Batch write items (REST API)](https://www.algolia.com/doc/rest-api/search/batch-write-items/)
- [Get object (REST API)](https://www.algolia.com/doc/rest-api/search/get-object/)
- [Get objects (REST API)](https://www.algolia.com/doc/rest-api/search/get-objects/)
- [algoliasearch JS client](https://www.algolia.com/doc/libraries/javascript/)

## API endpoints currently covered

### Batch object creation

- **API Endpoint:** `/1/indexes/:indexName/batch`
- **algoliasearch JS package:** `index.saveObject()`, `index.saveObjects()`, `index.partialUpdateObject()`, `index.partialUpdateObjects()` and `index.deleteObject()`, `index.deleteObjects()`

### Single index query

- **API Endpoint:** `/1/indexes/:indexName/query`
- **algoliasearch JS package:** `index.search()`
- **Response:**

```json
{
  "hits": [{ "objectID": "1", ...attributes }],
  "nbHits": 1,
  "nbPages": 1,
  "hitsPerPage": 20,
  "processingTimeMS": 1,
  "page": 0,
  "query": "search term",
  "index": "indexName"
}
```

### Multi index query and filter

- **API Endpoint:** `/1/indexes/*/queries`
- **react-instantsearch-dom JS package:** Search, RefinementList and HierarchicalMenu
- **Response:**

```json
{
  "results": [
    {
      "hits": [{ "objectID": "1", ...attributes }],
      "nbHits": 1,
      "nbPages": 1,
      "hitsPerPage": 1,
      "processingTimeMS": 1,
      "page": 0,
      "query": "search term",
      "index": "indexName",
      "facets": {}
    }
  ]
}
```

### Fetch single object using objectID

- **API Endpoint:** `/1/indexes/:indexName/:objectID`
- **algoliasearch JS package:** `index.getObject()`

### Fetch multiple objects from multiple indexes

- **API Endpoint:** `/1/indexes/*/objects`
- **algoliasearch JS package:** `index.getObjects()`

### (Fake) Task status check

- **API Endpoint:** `/1/indexes/:indexName/task/:taskID`
- **algoliasearch JS package:** `index.[method]().wait()`
