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
exports.buildSearchExpression = exports.getPageCount = exports.getTaskID = exports.idToObjectID = exports.getIndex = void 0;
const level_party_1 = __importDefault(require("level-party"));
const search_index_1 = __importDefault(require("search-index"));
const getIndex = () => __awaiter(void 0, void 0, void 0, function* () {
    return yield (0, search_index_1.default)({ db: (0, level_party_1.default)(`.algoliaMockServer`, { valueEncoding: `json` }) });
});
exports.getIndex = getIndex;
const idToObjectID = (documents) => {
    return documents.map((_a) => {
        var { _id } = _a, rest = __rest(_a, ["_id"]);
        return (Object.assign({ objectID: _id }, rest));
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
 * Build search expression from query and filters
 * Handles both string filters and array facetFilters
 * Returns { searchExp, objectIDs }
 */
const buildSearchExpression = (params) => {
    const { query, filters, facetFilters } = params;
    const searchExp = { AND: [] };
    let objectIDs = [];
    // Add text query if present
    if (query) {
        searchExp.AND.push({ SEARCH: query.split(' ') });
    }
    // Handle string filters (e.g., "type:IMAGE AND tags:Launch")
    if (filters) {
        const parsed = parseStringFilters(filters);
        objectIDs = parsed.objectIDs;
        if (parsed.filterParts.length > 0) {
            searchExp.AND.push({ AND: parsed.filterParts });
        }
    }
    // Handle array facetFilters (e.g., [["type:IMAGE"], ["tags:Launch"]])
    if (facetFilters) {
        const andFilters = [];
        for (const filter of facetFilters) {
            if (Array.isArray(filter)) {
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
    return { searchExp, objectIDs };
};
exports.buildSearchExpression = buildSearchExpression;
/**
 * Parse string filters into filter parts and objectIDs
 * Note: objectID filters are extracted separately due to search-index limitation
 */
const parseStringFilters = (filterString) => {
    if (!filterString) {
        return { filterParts: [], objectIDs: [] };
    }
    // Extract objectIDs
    const objectIDs = [];
    const objectIDRegex = /objectID:["']?([a-zA-Z0-9_-]+)["']?/gi;
    for (const match of filterString.matchAll(objectIDRegex)) {
        objectIDs.push(match[1]);
    }
    // Remove objectID filters
    const withoutObjectIDs = filterString
        .replace(/\s*AND\s+objectID:["']?[a-zA-Z0-9_-]+["']?/gi, '')
        .replace(/objectID:["']?[a-zA-Z0-9_-]+["']?\s*AND\s*/gi, '')
        .replace(/objectID:["']?[a-zA-Z0-9_-]+["']?/gi, '')
        .trim();
    // Split by AND, clean up
    const filterParts = withoutObjectIDs
        .split(/\s+AND\s+/i)
        .map((part) => part
        .trim()
        .replace(/^\(|\)$/g, '')
        .replace(/["']/g, ''))
        .filter((part) => part.length > 0);
    return { filterParts, objectIDs };
};
//# sourceMappingURL=helpers.js.map