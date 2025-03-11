'use strict'
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value)
          })
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value))
        } catch (e) {
          reject(e)
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value))
        } catch (e) {
          reject(e)
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected)
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next())
    })
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.getObject = void 0
const helpers_1 = require('../helpers')
/**
 * Get an object from a specific index
 * index.getObject()
 */
const getObject = (req, res) =>
  __awaiter(void 0, void 0, void 0, function* () {
    const {
      params: { objectID },
    } = req
    try {
      const db = yield (0, helpers_1.getIndex)()
      const result = yield db.DOCUMENTS([objectID])
      const documents = (0, helpers_1.idToObjectID)(result)
      return res.status(200).send(documents[0])
    } catch (err) {
      return res.status(500).send({ message: err })
    }
  })
exports.getObject = getObject
//# sourceMappingURL=getObject.js.map
