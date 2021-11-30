#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const _1 = __importDefault(require("./"));
const port = 9200;
try {
    (0, _1.default)().listen(port, () => {
        console.log(`Connected successfully on port ${port}`);
    });
}
catch (err) {
    console.error(`Error occured: ${err.message}`);
}
//# sourceMappingURL=cli.js.map