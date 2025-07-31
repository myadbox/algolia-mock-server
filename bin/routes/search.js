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
 * Parse Algolia params string into search parameters
 */
const parseParamsString = (params) => {
    const parsedParams = {};
    // Split by & to get individual parameters
    const paramPairs = params.split('&');
    for (const pair of paramPairs) {
        const [key, value] = pair.split('=');
        if (key && value !== undefined) {
            const decodedKey = decodeURIComponent(key.trim());
            const decodedValue = decodeURIComponent(value.trim());
            // Handle special cases
            if (decodedKey === 'hitsPerPage' || decodedKey === 'page') {
                parsedParams[decodedKey] = parseInt(decodedValue, 10);
            }
            else {
                parsedParams[decodedKey] = decodedValue;
            }
        }
    }
    return parsedParams;
};
/**
 * Parse filters string into numeric filters array
 */
const parseFiltersString = (filters) => {
    // Simple parsing for now - split by ' AND ' and ' OR '
    // This is a basic implementation, Algolia's actual parsing is more complex
    return [filters]; // Return as single filter for now
};
/**
 * Search in a single index
 * index.search()
 */
const search = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { body: { query, params }, } = req;
    try {
        const db = yield (0, helpers_1.getIndex)();
        let searchExp = { AND: [] };
        let page = 0;
        let hitsPerPage = 20;
        // Handle legacy query format
        if (query && !params) {
            const result = yield db.QUERY(query, { DOCUMENTS: true });
            const documents = (0, helpers_1.idToObjectID)(result.RESULT.map((r) => r._doc));
            return res.status(200).send({ message: documents });
        }
        // Handle Algolia params string format
        if (params) {
            const parsedParams = parseParamsString(params);
            // Extract pagination parameters
            if (parsedParams.page !== undefined) {
                page = parsedParams.page;
            }
            if (parsedParams.hitsPerPage !== undefined) {
                hitsPerPage = parsedParams.hitsPerPage;
            }
            // Handle query parameter
            if (parsedParams.query) {
                searchExp.AND.push({ SEARCH: parsedParams.query.split(' ') });
            }
            // Handle filters (numeric filters)
            if (parsedParams.filters) {
                const filterStrings = parseFiltersString(parsedParams.filters);
                for (const filterString of filterStrings) {
                    const numericFilter = parseNumericFilter(filterString);
                    searchExp.AND.push(numericFilter);
                }
            }
        }
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
        const nbPages = (0, helpers_1.getPageCount)(hits.length, hitsPerPage);
        const response = {
            hits,
            page,
            nbHits: hits.length,
            nbPages,
            hitsPerPage,
            processingTimeMS: 1,
            query: params ? parseParamsString(params).query || '' : '',
            params: params || '',
            exhaustiveNbHits: true,
            exhaustiveTypo: true,
            exhaustive: { nbHits: true, typo: true }
        };
        return res.status(200).send(response);
    }
    catch (err) {
        console.error(`Error in search: ${JSON.stringify(err, null, 2)}`);
        // Return 400 for client errors (invalid filters, etc.)
        if (err.message && (err.message.includes('Invalid numeric') || err.message.includes('Unsupported numeric'))) {
            return res.status(400).send({
                message: err.message,
                error: 'Invalid request parameters'
            });
        }
        // Return 500 for server errors
        return res.status(500).send({ message: JSON.stringify(err) });
    }
});
exports.search = search;
//# sourceMappingURL=search.js.map