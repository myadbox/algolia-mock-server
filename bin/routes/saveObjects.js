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
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveObjects = void 0;
const helpers_1 = require("../helpers");
/**
 * Add/Update/delete objects in bulk
 * index.saveObject()
 * index.saveObjects()
 * index.partialUpdateObject()
 * index.partialUpdateObjects()
 * index.deleteObject()
 * index.deleteObjects()
 */
const saveObjects = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { body: { requests }, } = req;
    try {
        const puts = [];
        const deletes = [];
        for (const request of requests) {
            const { action } = request, _a = request.body, { objectID } = _a, rest = __rest(_a, ["objectID"]);
            switch (action) {
                case `updateObject`:
                    puts.push(Object.assign(Object.assign({}, rest), { _id: objectID }));
                    break;
                case `partialUpdateObjectNoCreate`:
                    const dbTemp = yield (0, helpers_1.getIndex)();
                    const existing = yield dbTemp.DOCUMENTS([objectID]);
                    yield dbTemp.INDEX.STORE.close();
                    if (existing) {
                        puts.push(Object.assign(Object.assign(Object.assign({}, existing[0]), rest), { _id: objectID }));
                    }
                    break;
                case `deleteObject`:
                    deletes.push(objectID);
                    break;
                default:
                    throw new Error(`Invalid action`);
            }
        }
        const db = yield (0, helpers_1.getIndex)();
        const response = {
            wait: () => __awaiter(void 0, void 0, void 0, function* () { return this; }),
            taskID: (0, helpers_1.getTaskID)(),
        };
        if (puts.length) {
            const result = yield db.PUT(puts, { storeVectors: true, doNotIndexField: [], storeRawDocs: true });
            response.objectIDs = result.map((r) => r._id);
        }
        if (deletes.length) {
            yield db.DELETE(deletes);
        }
        // Explicility close the underlying leveldown store
        yield db.INDEX.STORE.close();
        return res.status(200).send(response);
    }
    catch (err) {
        return res.status(500).send({
            message: err,
        });
    }
});
exports.saveObjects = saveObjects;
//# sourceMappingURL=saveObjects.js.map