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
            const { searchExp, objectIDs, notFilters, orGroups } = (0, helpers_1.buildSearchExpression)({
                query: queryParams,
                filters: filtersParams,
                facetFilters: facetFiltersParams,
            });
            const facetFields = facetsParams ? (Array.isArray(facetsParams) ? facetsParams : [facetsParams]) : [];
            const hasPostFilters = objectIDs.length > 0 || notFilters.length > 0 || orGroups.length > 0;
            const startIndex = page * hitsPerPage;
            let hits = [];
            let totalCount = 0;
            let facets = {};
            if (hasPostFilters) {
                // Post-filters run in JS, so totals, facets and the page slice must come from the full filtered set
                const matched = searchExp.AND.length > 0 ? (yield db.QUERY(searchExp, { DOCUMENTS: true })).RESULT : yield db.ALL_DOCUMENTS();
                const filtered = (0, helpers_1.applyPostFilters)((0, helpers_1.idToObjectID)(matched.map(r => r._doc)), objectIDs, notFilters, orGroups);
                totalCount = filtered.length;
                hits = filtered.slice(startIndex, startIndex + hitsPerPage);
                facets = (0, helpers_1.computeFacetsFromHits)(filtered, facetFields);
            }
            else {
                if (searchExp.AND.length > 0) {
                    const result = yield db.QUERY(searchExp, {
                        DOCUMENTS: true,
                        PAGE: { NUMBER: page, SIZE: hitsPerPage },
                    });
                    hits = (0, helpers_1.idToObjectID)(result.RESULT.map(r => r._doc));
                    totalCount = typeof result.RESULT_LENGTH === `number` ? result.RESULT_LENGTH : hits.length;
                }
                else {
                    const all = (0, helpers_1.idToObjectID)((yield db.ALL_DOCUMENTS()).map(r => r._doc));
                    totalCount = all.length;
                    hits = all.slice(startIndex, startIndex + hitsPerPage);
                }
                facets = (0, helpers_1.computeFacetsFromHits)(hits, facetFields);
            }
            const nbPages = (0, helpers_1.getPageCount)(totalCount, hitsPerPage);
            results.push({
                hits,
                page,
                nbHits: totalCount,
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