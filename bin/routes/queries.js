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
 * Parse a single numeric filter string into search-index format
 */
const parseNumericFilter = (filterString) => {
    const match = filterString.match(/^(.+?)(>=|<=|>|<|=)(.+)$/);
    if (!match) {
        throw new Error(`Invalid numeric filter: ${filterString}`);
    }
    const [, field, operator, value] = match;
    const trimmedValue = value.trim();
    // Handle null values by using a sentinel value (Number.MAX_SAFE_INTEGER)
    let processedValue;
    if (trimmedValue === 'null') {
        processedValue = Number.MAX_SAFE_INTEGER.toString();
    }
    else {
        const numericValue = parseFloat(trimmedValue);
        if (isNaN(numericValue)) {
            throw new Error(`Invalid numeric value: ${trimmedValue}`);
        }
        processedValue = numericValue.toString();
    }
    // For strict inequalities with null values, we need special handling
    const isNullValue = trimmedValue === 'null';
    switch (operator) {
        case '>=':
            return {
                FIELD: field.trim(),
                VALUE: { GTE: processedValue, LTE: Number.MAX_SAFE_INTEGER.toString() },
            };
        case '<=':
            return {
                FIELD: field.trim(),
                VALUE: { GTE: Number.MIN_SAFE_INTEGER.toString(), LTE: processedValue },
            };
        case '>':
            if (isNullValue) {
                // For null values, > null should return no results (nothing is greater than null)
                return {
                    FIELD: field.trim(),
                    VALUE: { GTE: (Number.MAX_SAFE_INTEGER + 1).toString(), LTE: Number.MAX_SAFE_INTEGER.toString() },
                };
            }
            else {
                // Use next integer for integer values, or add small increment for floats
                const numericValue = parseFloat(trimmedValue);
                const nextValue = Number.isInteger(numericValue) ? numericValue + 1 : numericValue + Number.EPSILON;
                return {
                    FIELD: field.trim(),
                    VALUE: { GTE: nextValue.toString(), LTE: Number.MAX_SAFE_INTEGER.toString() },
                };
            }
        case '<':
            if (isNullValue) {
                // All values are less than null (using our sentinel system)
                return {
                    FIELD: field.trim(),
                    VALUE: { GTE: Number.MIN_SAFE_INTEGER.toString(), LTE: (Number.MAX_SAFE_INTEGER - 1).toString() },
                };
            }
            else {
                // Use previous integer for integer values, or subtract small increment for floats
                const numericValue = parseFloat(trimmedValue);
                const prevValue = Number.isInteger(numericValue) ? numericValue - 1 : numericValue - Number.EPSILON;
                return {
                    FIELD: field.trim(),
                    VALUE: { GTE: Number.MIN_SAFE_INTEGER.toString(), LTE: prevValue.toString() },
                };
            }
        case '=':
            return {
                FIELD: field.trim(),
                VALUE: { GTE: processedValue, LTE: processedValue },
            };
        default:
            throw new Error(`Unsupported numeric operator: ${operator}`);
    }
};
/**
 * Parse Algolia numericFilters into search-index format
 */
const parseNumericFilters = (numericFilters) => {
    const filters = [];
    for (const filter of numericFilters) {
        if (Array.isArray(filter)) {
            // OR condition - array of filters
            const orFilters = filter.map(parseNumericFilter);
            filters.push({ OR: orFilters });
        }
        else {
            // AND condition - single filter
            filters.push(parseNumericFilter(filter));
        }
    }
    return filters;
};
/**
 * Search and filter in multiple indexes
 */
const queries = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { body: { requests }, } = req;
    try {
        const db = yield (0, helpers_1.getIndex)();
        const results = [];
        for (const request of requests) {
            const { indexName, query: queryParams, facets: facetsParams, facetFilters: facetFiltersParams, numericFilters: numericFiltersParams, page: pageParam, hitsPerPage: hitsPerPageParams, } = request;
            const page = parseInt(pageParam || `0`, 10);
            const hitsPerPage = parseInt(hitsPerPageParams || `1`, 10);
            const searchExp = { AND: [] };
            if (queryParams) {
                searchExp.AND.push({ SEARCH: queryParams.split(' ') });
            }
            if (facetFiltersParams) {
                const andFilters = [];
                for (const filter of facetFiltersParams) {
                    if (Array.isArray(filter)) {
                        searchExp.AND.push({ OR: filter });
                    }
                    else {
                        andFilters.push(filter);
                    }
                }
                if (andFilters.length) {
                    searchExp.AND.push({ AND: andFilters });
                }
            }
            if (numericFiltersParams) {
                const numericFilters = parseNumericFilters(numericFiltersParams);
                searchExp.AND.push(...numericFilters);
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
                const values = yield db.FACETS({ FIELD: facetsParams });
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