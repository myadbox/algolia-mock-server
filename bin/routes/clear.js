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
exports.clear = void 0
const helpers_1 = require('../helpers')
/**
 * Delete index's content
 * index.clearObjects()
 */
const clear = (req, res) =>
  __awaiter(void 0, void 0, void 0, function* () {
    try {
      const db = yield (0, helpers_1.getIndex)()
      // @ts-ignore
      yield db.FLUSH()
      return res.status(200).send({
        updatedAt: new Date(),
        taskID: (0, helpers_1.getTaskID)(),
      })
    } catch (err) {
      return res.status(500).send({ message: err })
    }
  })
exports.clear = clear
//# sourceMappingURL=clear.js.map
