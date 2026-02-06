"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queries = void 0;
const helpers_1 = require("../helpers");
/**
 * Search and filter in multiple indexes
 */
const queries = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { body: { requests }, } = req;
    try {
        const db = yield (0, helpers_1.getIndex)();
        const results = [];
        for (const request of requests) {
            const { indexName, query: queryParams, facets: facetsParams, facetFilters: facetFiltersParams, filters: filtersParams, page: pageParam, hitsPerPage: hitsPerPageParams, } = request;
            const page = parseInt(pageParam || `0`, 10);
            const hitsPerPage = parseInt(hitsPerPageParams || `1`, 10);
            // Build search expression and extract post-filters
            const { searchExp, objectIDs, notFilters } = (0, helpers_1.buildSearchExpression)({
                query: queryParams,
                filters: filtersParams,
                facetFilters: facetFiltersParams,
            });
            let hits = [];
            if (searchExp.AND.length > 0) {
                const result = yield db.QUERY(searchExp, {
                    DOCUMENTS: true,
                    PAGE: { NUMBER: page, SIZE: hitsPerPage },
                });
                hits = (0, helpers_1.idToObjectID)(result.RESULT.map((r) => r._doc));
            }
            else {
                const result = yield db.ALL_DOCUMENTS(hitsPerPage);
                hits = (0, helpers_1.idToObjectID)(result.map((r) => r._doc));
            }
            // Apply post-filters (objectID and NOT filters)
            hits = (0, helpers_1.applyPostFilters)(hits, objectIDs, notFilters);
            // Compute facets from filtered hits
            let facets = {};
            if (facetsParams) {
                const facetFields = Array.isArray(facetsParams) ? facetsParams : [facetsParams];
                facets = (0, helpers_1.computeFacetsFromHits)(hits, facetFields);
            }
            const nbPages = (0, helpers_1.getPageCount)(hits.length, hitsPerPage);
            results.push({
                hits,
                page,
                nbHits: hits.length,
                nbPages,
                hitsPerPage,
                processingTimeMS: 1,
                query: queryParams,
                index: indexName,
                facets,
            });
        }
        return res.status(200).send({ results });
    }
    catch (err) {
        console.error(`Error in queries: ${JSON.stringify(err, null, 2)}`);
        return res.status(500).send({ message: JSON.stringify(err) });
    }
});
exports.queries = queries;
//# sourceMappingURL=queries.js.map