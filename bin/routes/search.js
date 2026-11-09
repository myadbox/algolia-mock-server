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
exports.search = void 0;
const helpers_1 = require("../helpers");
const securedApiKey_1 = require("../securedApiKey");
/**
 * Search in a single index
 * index.search()
 */
const search = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { params: { indexName }, body: { query, filters, facetFilters, hitsPerPage: hitsPerPageParam, page: pageParam }, } = req;
    try {
        const db = yield (0, helpers_1.getIndex)();
        const hitsPerPage = parseInt(hitsPerPageParam || `20`, 10);
        const page = parseInt(pageParam || `0`, 10);
        // Build search expression and extract post-filters
        const { searchExp, objectIDs, notFilters, orGroups } = (0, helpers_1.buildSearchExpression)({
            query,
            filters: (0, securedApiKey_1.withSecuredApiKeyFilters)(req, filters),
            facetFilters,
        });
        // Execute query
        const matched = searchExp.AND.length > 0 ? (yield db.QUERY(searchExp, { DOCUMENTS: true })).RESULT : yield db.ALL_DOCUMENTS();
        // Post-filters run in JS, so the total and the page slice must come from the full filtered set
        const filtered = (0, helpers_1.applyPostFilters)((0, helpers_1.idToObjectID)(matched.map(r => r._doc)), objectIDs, notFilters, orGroups);
        const startIndex = page * hitsPerPage;
        return res.status(200).send({
            hits: filtered.slice(startIndex, startIndex + hitsPerPage),
            nbHits: filtered.length,
            nbPages: (0, helpers_1.getPageCount)(filtered.length, hitsPerPage),
            hitsPerPage,
            processingTimeMS: 1,
            page,
            query: query || '',
            index: indexName,
            params: (0, helpers_1.toParamsString)(req.body),
        });
    }
    catch (err) {
        return res.status(500).send({ message: err });
    }
});
exports.search = search;
//# sourceMappingURL=search.js.map