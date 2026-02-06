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
 * Search in a single index
 * index.search()
 */
const search = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { params: { indexName }, body: { query, hitsPerPage: hitsPerPageParam }, } = req;
    try {
        const db = yield (0, helpers_1.getIndex)();
        const hitsPerPage = parseInt(hitsPerPageParam || `20`, 10);
        const result = yield db.QUERY(query, { DOCUMENTS: true });
        const hits = (0, helpers_1.idToObjectID)(result.RESULT.map((r) => r._doc));
        const nbPages = (0, helpers_1.getPageCount)(hits.length, hitsPerPage);
        return res.status(200).send({
            hits,
            nbHits: hits.length,
            nbPages,
            hitsPerPage,
            processingTimeMS: 1,
            page: 0,
            query: query || '',
            index: indexName,
        });
    }
    catch (err) {
        return res.status(500).send({ message: err });
    }
});
exports.search = search;
//# sourceMappingURL=search.js.map