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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queries = void 0;
const qs_1 = __importDefault(require("qs"));
const helpers_1 = require("../helpers");
/**
 * Search and filter in multiple indexes
 */
const queries = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { body: { requests }, } = req;
    try {
        const { indexName, params } = requests[0];
        const { query: queryParams, facets: facetsParams, facetFilters: facetFiltersParams } = qs_1.default.parse(params);
        const searchExp = { AND: [] };
        if (queryParams) {
            searchExp.AND.push({ SEARCH: queryParams.split(' ') });
        }
        if (facetFiltersParams) {
            const facetFilters = JSON.parse(facetFiltersParams);
            const orFilters = [];
            for (const filter of facetFilters) {
                if (Array.isArray(filter)) {
                    searchExp.AND.push({ AND: filter });
                }
                else {
                    orFilters.push(filter);
                }
            }
            if (orFilters.length) {
                searchExp.AND.push({ OR: orFilters });
            }
        }
        let hits = [];
        const db = yield (0, helpers_1.getIndex)();
        if (searchExp.AND.length) {
            const result = yield db.QUERY(searchExp, { DOCUMENTS: true });
            hits = (0, helpers_1.idToObjectID)(result.RESULT.map((r) => r._doc));
        }
        else {
            const result = yield db.ALL_DOCUMENTS();
            hits = (0, helpers_1.idToObjectID)(result.map((r) => r._doc));
        }
        const facets = {};
        if (facetsParams) {
            const facetsParamsArray = JSON.parse(facetsParams);
            for (const facet of facetsParamsArray) {
                const docs = yield db.FACETS({ FIELD: facet });
                if ((docs === null || docs === void 0 ? void 0 : docs.length) < 1)
                    continue;
                facets[facet] = docs.reduce((aggr, cur) => {
                    aggr[cur.VALUE] = cur._id.length;
                    return aggr;
                }, {});
            }
        }
        // Explicility close the underlying leveldown store
        yield db.INDEX.STORE.close();
        const results = [
            {
                hits,
                page: 0,
                nbHits: hits.length,
                nbPages: 1,
                hitsPerPage: 20,
                processingTimeMS: 1,
                query: queryParams,
                params,
                index: indexName,
                facets,
            },
        ];
        return res.status(200).send({ results });
    }
    catch (err) {
        return res.status(500).send({ message: err });
    }
});
exports.queries = queries;
//# sourceMappingURL=queries.js.map