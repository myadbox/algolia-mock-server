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
        const db = yield (0, helpers_1.getIndex)();
        const results = [];
        for (const request of requests) {
            const { indexName, params } = request;
            const { query: queryParams, facets: facetsParams, facetFilters: facetFiltersParams, page: pageParam, hitsPerPage: hitsPerPageParams, } = qs_1.default.parse(params);
            const page = parseInt(pageParam || `0`, 10);
            const hitsPerPage = parseInt(hitsPerPageParams || `1`, 10);
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
            if (searchExp.AND.length) {
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
            let facets = {};
            if (facetsParams) {
                const facetsParamsArray = (0, helpers_1.converStrToArray)(facetsParams);
                const values = yield db.FACETS({ FIELD: facetsParamsArray });
                facets = values.reduce((aggr, cur) => {
                    const facet = cur.FIELD;
                    aggr[facet] = Object.assign(Object.assign({}, aggr[facet]), { [cur.VALUE]: cur._id.length });
                    return aggr;
                }, {});
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
                params,
                index: indexName,
                facets,
            });
        }
        return res.status(200).send({ results });
    }
    catch (err) {
        return res.status(500).send({ message: err });
    }
});
exports.queries = queries;
//# sourceMappingURL=queries.js.map