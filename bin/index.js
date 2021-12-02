"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const express_1 = __importStar(require("express"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = require("./routes");
const init = () => {
    const app = (0, express_1.default)();
    const router = (0, express_1.Router)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json({ type: '*/*' }));
    app.use(express_1.default.urlencoded({ extended: true }));
    app.use(`/1/indexes`, router);
    app.get(`/`, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        return res.status(200).send({
            message: `Welcome to Algolia Mock Server`,
        });
    }));
    router.post(`/:indexName/batch`, routes_1.saveObjects);
    router.post(`/:indexName/query`, routes_1.search);
    router.post(`/*/queries`, routes_1.queries);
    router.get(`/:indexName/:objectID`, routes_1.getObject);
    router.post(`/*/objects`, routes_1.getObjects);
    router.get(`/:indexName/task/:taskID`, routes_1.task);
    router.post(`/:indexName/clear`, routes_1.clear);
    return app;
};
exports.default = init;
//# sourceMappingURL=index.js.map