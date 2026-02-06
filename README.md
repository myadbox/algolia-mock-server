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

## Filter Support

The mock server supports a subset of [Algolia's filter syntax](https://www.algolia.com/doc/api-reference/api-parameters/filters) for the `filters` parameter in search requests.

### Supported Filter Features

- ✅ **Facet filters**: `field:value` (e.g., `type:IMAGE`)
- ✅ **AND operator**: Combine multiple conditions (e.g., `type:IMAGE AND tags:Launch`)
- ✅ **Parentheses grouping**: Group conditions (e.g., `(field1:value1)`)
- ✅ **Quoted values**: Handle spaces and special characters (e.g., `tags:"Launch Event"`)
- ✅ **ObjectID filtering**: Filter by objectID (e.g., `objectID:abc123`)

**Example:**

```json
{
  "query": "",
  "filters": "type:IMAGE AND (tags:\"Launch\") AND objectID:a946ed4f1f88da82f41acc96"
}
```

### Unsupported Filter Features

The following Algolia filter features are **not yet implemented**:

- ❌ **OR operator**: `field1:value1 OR field1:value2`
- ❌ **NOT operator**: `NOT field:value`
- ❌ **Numeric comparisons**: `price > 100`, `price >= 10`, `price < 50`
- ❌ **Numeric ranges**: `price:10 TO 100`
- ❌ **Boolean filters**: `available:true`, `inStock:false`
- ❌ **Tag filters**: `_tags:published`

> **Note:** The mock server is designed for e2e testing with common filter patterns. If we need additional filter features, we can add them as needed.
