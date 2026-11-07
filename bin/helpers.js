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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSearchExpression = exports.toParamsString = exports.parseListParam = exports.applyPostFilters = exports.computeFacetsFromHits = exports.getPageCount = exports.getTaskID = exports.idToObjectID = exports.getIndex = void 0;
const level_party_1 = __importDefault(require("level-party"));
const search_index_1 = __importDefault(require("search-index"));
const getIndex = () => __awaiter(void 0, void 0, void 0, function* () {
    return yield (0, search_index_1.default)({ db: (0, level_party_1.default)(`.algoliaMockServer`, { valueEncoding: `json` }) });
});
exports.getIndex = getIndex;
const idToObjectID = documents => {
    return documents.map(document => {
        if (!document)
            return null;
        const { _id } = document, rest = __rest(document, ["_id"]);
        return Object.assign({ objectID: _id }, rest);
    });
};
exports.idToObjectID = idToObjectID;
const getTaskID = () => Math.floor(Math.random() * 1000);
exports.getTaskID = getTaskID;
const getPageCount = (total, perPage) => {
    const extra = total % perPage === 0 ? 0 : 1;
    return Math.floor(total / perPage) + extra;
};
exports.getPageCount = getPageCount;
/**
 * Compute facets from filtered hits
 * Returns facet counts for the specified fields
 */
const computeFacetsFromHits = (hits, facetFields) => {
    const facets = {};
    for (const field of facetFields) {
        facets[field] = {};
        for (const hit of hits) {
            const value = hit[field];
            if (Array.isArray(value)) {
                // Handle array fields (like tags)
                for (const item of value) {
                    const key = String(item).toLowerCase();
                    facets[field][key] = (facets[field][key] || 0) + 1;
                }
            }
            else if (value !== undefined && value !== null) {
                // Handle scalar fields (like type)
                const key = String(value).toLowerCase();
                facets[field][key] = (facets[field][key] || 0) + 1;
            }
        }
    }
    return facets;
};
exports.computeFacetsFromHits = computeFacetsFromHits;
const splitFacetFilter = (filter) => {
    const separator = filter.indexOf(':');
    return [filter.slice(0, separator), filter.slice(separator + 1)];
};
const isNegatedFacetFilter = (filter) => typeof filter === `string` && splitFacetFilter(filter)[1].startsWith(`-`);
// search-index never sees objectID: it is stored as `_id`, and tokenising would split a hyphenated id anyway
const isObjectIDFacetFilter = (filter) => typeof filter === `string` && splitFacetFilter(filter)[0] === `objectID`;
// search-index tokenises scalar values on punctuation, so a hyphenated value (a user id, say) never matches itself
const isHyphenatedFacetFilter = (filter) => typeof filter === `string` && splitFacetFilter(filter)[1].includes(`-`);
const needsPostFiltering = (filter) => isNegatedFacetFilter(filter) || isObjectIDFacetFilter(filter) || isHyphenatedFacetFilter(filter);
const hitHasFacetValue = (hit, field, value) => {
    const hitValue = hit[field];
    if (Array.isArray(hitValue)) {
        return hitValue.some(item => String(item) === value);
    }
    return hitValue !== undefined && hitValue !== null && String(hitValue) === value;
};
const hitMatchesFacetFilter = (hit, filter) => {
    const [field, value] = splitFacetFilter(filter);
    return value.startsWith(`-`) ? !hitHasFacetValue(hit, field, value.slice(1)) : hitHasFacetValue(hit, field, value);
};
/**
 * Apply post-filters (objectID, NOT filters and the facetFilter groups search-index can't express) to hits
 * Returns filtered hits array
 */
const applyPostFilters = (hits, objectIDs, notFilters, orGroups = []) => {
    let filtered = hits;
    // Filter by objectID if specified
    if (objectIDs.length > 0) {
        filtered = filtered.filter(hit => objectIDs.includes(hit.objectID));
    }
    // Apply NOT filters (exclude matching documents; documents missing the attribute are kept)
    if (notFilters.length > 0) {
        filtered = filtered.filter(hit => notFilters.every(notFilter => {
            const [field, value] = splitFacetFilter(notFilter);
            return !hitHasFacetValue(hit, field, value);
        }));
    }
    if (orGroups.length > 0) {
        filtered = filtered.filter(hit => orGroups.every(group => group.some(filter => hitMatchesFacetFilter(hit, filter))));
    }
    return filtered;
};
exports.applyPostFilters = applyPostFilters;
/**
 * Algolia accepts list params as JSON strings too, which is how a client replays the `params` it was echoed
 */
const parseListParam = (value) => (typeof value === `string` ? JSON.parse(value) : value);
exports.parseListParam = parseListParam;
/**
 * Encode a request the way Algolia echoes it back in a result's `params`
 */
const toParamsString = (_a) => {
    var { indexName, type } = _a, params = __rest(_a, ["indexName", "type"]);
    return new URLSearchParams(Object.fromEntries(Object.entries(params)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, typeof value === `object` ? JSON.stringify(value) : String(value)]))).toString();
};
exports.toParamsString = toParamsString;
/**
 * Build search expression from query and filters
 * Handles both string filters and array facetFilters
 * Negated (`attr:-value`), objectID and hyphenated facetFilters can't be expressed in search-index, so they are
 * returned for post-filtering: a lone negation becomes a NOT filter, any other group containing one is evaluated whole in `orGroups`
 * A parenthesized `(a:1 OR b:2)` group in a `filters:` string is likewise evaluated whole in `orGroups`, since
 * search-index would otherwise treat the unparsed group as a single literal token lookup
 * Returns { searchExp, objectIDs, notFilters, orGroups }
 */
const buildSearchExpression = (params) => {
    const { query, filters, facetFilters } = params;
    const searchExp = { AND: [] };
    let objectIDs = [];
    let notFilters = [];
    const orGroups = [];
    // Add text query if present
    if (query) {
        searchExp.AND.push({ SEARCH: query.split(' ') });
    }
    // Handle string filters (e.g., "type:IMAGE AND tags:Launch")
    if (filters) {
        const parsed = parseStringFilters(filters);
        objectIDs = parsed.objectIDs;
        notFilters = parsed.notFilters;
        orGroups.push(...parsed.orGroups);
        if (parsed.filterParts.length > 0) {
            searchExp.AND.push({ AND: parsed.filterParts });
        }
    }
    // Handle array facetFilters (e.g., [["type:IMAGE"], ["tags:Launch"]])
    if (facetFilters) {
        const andFilters = [];
        for (const filter of (0, exports.parseListParam)(facetFilters)) {
            const lone = Array.isArray(filter) && filter.length === 1 ? filter[0] : filter;
            if (isNegatedFacetFilter(lone)) {
                const [field, value] = splitFacetFilter(lone);
                notFilters.push(`${field}:${value.slice(1)}`);
            }
            else if (isObjectIDFacetFilter(lone) || isHyphenatedFacetFilter(lone)) {
                orGroups.push([lone]);
            }
            else if (Array.isArray(filter) && filter.some(needsPostFiltering)) {
                orGroups.push(filter);
            }
            else if (Array.isArray(filter)) {
                searchExp.AND.push({ OR: filter });
            }
            else {
                andFilters.push(filter);
            }
        }
        if (andFilters.length > 0) {
            searchExp.AND.push({ AND: andFilters });
        }
    }
    return { searchExp, objectIDs, notFilters, orGroups };
};
exports.buildSearchExpression = buildSearchExpression;
/**
 * Split a filters: string on a top-level keyword (AND/OR), ignoring occurrences nested inside parentheses
 */
const splitTopLevel = (input, keyword) => {
    const parts = [];
    const upper = input.toUpperCase();
    const kw = keyword.toUpperCase();
    let depth = 0;
    let start = 0;
    let i = 0;
    while (i < input.length) {
        const char = input[i];
        if (char === '(')
            depth++;
        else if (char === ')')
            depth--;
        if (depth === 0 && upper.startsWith(kw, i)) {
            const boundaryBefore = i === 0 || /\s/.test(input[i - 1]);
            const afterIndex = i + kw.length;
            const boundaryAfter = afterIndex >= input.length || /\s/.test(input[afterIndex]);
            if (boundaryBefore && boundaryAfter) {
                parts.push(input.slice(start, i));
                i = afterIndex;
                start = i;
                continue;
            }
        }
        i++;
    }
    parts.push(input.slice(start));
    return parts.map(part => part.trim()).filter(part => part.length > 0);
};
const stripQuotes = (value) => value.replace(/["']/g, '');
/**
 * Normalize one item of a parenthesized OR group into the `field:value` / `field:-value` shape
 * `applyPostFilters`'s `hitMatchesFacetFilter` already understands, so `NOT field:value` becomes `field:-value`
 */
const normalizeOrGroupItem = (item) => {
    const notMatch = item.trim().match(/^NOT\s+(.+)$/i);
    if (!notMatch)
        return stripQuotes(item.trim());
    const [field, value] = splitFacetFilter(stripQuotes(notMatch[1]));
    return `${field}:-${value}`;
};
/**
 * Parse string filters into filter parts, objectIDs, NOT filters and OR groups
 * Note: objectID, NOT filters and parenthesized OR groups are extracted for post-filtering (search-index
 * can only treat an AND array entry as a single literal token lookup, never a nested boolean sub-expression)
 */
const parseStringFilters = (filterString) => {
    if (!filterString) {
        return { filterParts: [], objectIDs: [], notFilters: [], orGroups: [] };
    }
    const filterParts = [];
    const objectIDs = [];
    const notFilters = [];
    const orGroups = [];
    for (const clause of splitTopLevel(filterString.trim(), 'AND')) {
        if (clause.startsWith('(') && clause.endsWith(')')) {
            const items = splitTopLevel(clause.slice(1, -1), 'OR').map(normalizeOrGroupItem);
            if (items.length > 0)
                orGroups.push(items);
            continue;
        }
        const notMatch = clause.match(/^NOT\s+([a-zA-Z0-9_]+):(.+)$/i);
        if (notMatch) {
            notFilters.push(`${notMatch[1]}:${stripQuotes(notMatch[2])}`);
            continue;
        }
        const objectIDMatch = clause.match(/^objectID:["']?([a-zA-Z0-9_-]+)["']?$/i);
        if (objectIDMatch) {
            objectIDs.push(objectIDMatch[1]);
            continue;
        }
        filterParts.push(stripQuotes(clause));
    }
    return { filterParts, objectIDs, notFilters, orGroups };
};
//# sourceMappingURL=helpers.js.map