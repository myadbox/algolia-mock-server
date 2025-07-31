import { Request, Response } from 'express'
import { search } from '../routes/search'
import { getIndex, idToObjectID, getPageCount } from '../helpers'

// Mock the dependencies
jest.mock('../helpers', () => ({
  getIndex: jest.fn(),
  idToObjectID: jest.fn((docs) => docs.map((doc) => ({ ...doc, objectID: doc._id }))),
  getPageCount: jest.fn((total, perPage) => Math.ceil(total / perPage)),
}))

const mockGetIndex = getIndex as jest.MockedFunction<typeof getIndex>
const mockIdToObjectID = idToObjectID as jest.MockedFunction<typeof idToObjectID>

describe('search route', () => {
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let mockDb: any

  beforeEach(() => {
    mockRequest = {
      body: {},
    }
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    }

    mockDb = {
      QUERY: jest.fn(),
      ALL_DOCUMENTS: jest.fn(),
    }

    mockGetIndex.mockResolvedValue(mockDb)
    mockIdToObjectID.mockImplementation((docs) => docs.map((doc) => ({ ...doc, objectID: doc._id })))

    jest.clearAllMocks()
  })

  describe('E2E Query Format Support', () => {
    it('should handle E2E query with numeric filter and hitsPerPage', async () => {
      const testData = [
        { _id: '1', _doc: { objectID: '1', expiryTimestamp: 1000000000, name: 'Asset 1' } },
        { _id: '2', _doc: { objectID: '2', expiryTimestamp: 2000000000, name: 'Asset 2' } },
      ]

      mockDb.QUERY.mockResolvedValue({
        RESULT: testData,
      })

      mockRequest.body = {
        params: 'filters=expiryTimestamp < 1734567890&hitsPerPage=10',
      }

      await search(mockRequest as Request, mockResponse as Response)

      expect(mockResponse.status).toHaveBeenCalledWith(200)
      expect(mockDb.QUERY).toHaveBeenCalledWith(
        {
          AND: [
            {
              FIELD: 'expiryTimestamp',
              VALUE: {
                GTE: '9007199254740991', // Number.MIN_SAFE_INTEGER as string
                LTE: '1734567889', // 1734567890 - 1
              },
            },
          ],
        },
        {
          DOCUMENTS: true,
          PAGE: { NUMBER: 0, SIZE: 10 },
        },
      )
    })

    it('should handle realistic Unix timestamps without errors', async () => {
      const currentTimestamp = Math.floor(Date.now() / 1000) // ~1734567890

      mockDb.QUERY.mockResolvedValue({
        RESULT: [{ _id: '1', _doc: { objectID: '1', expiryTimestamp: currentTimestamp - 1000 } }],
      })

      mockRequest.body = {
        params: `filters=expiryTimestamp < ${currentTimestamp}&hitsPerPage=10`,
      }

      await search(mockRequest as Request, mockResponse as Response)

      expect(mockResponse.status).toHaveBeenCalledWith(200)
      expect(mockResponse.status).not.toHaveBeenCalledWith(500)
    })

    it('should handle null expiry timestamp values', async () => {
      mockDb.QUERY.mockResolvedValue({
        RESULT: [{ _id: '1', _doc: { objectID: '1', expiryTimestamp: null, name: 'Never expires' } }],
      })

      mockRequest.body = {
        params: 'filters=expiryTimestamp < null&hitsPerPage=10',
      }

      await search(mockRequest as Request, mockResponse as Response)

      expect(mockResponse.status).toHaveBeenCalledWith(200)
      expect(mockDb.QUERY).toHaveBeenCalledWith(
        {
          AND: [
            {
              FIELD: 'expiryTimestamp',
              VALUE: {
                GTE: '9007199254740991', // Number.MIN_SAFE_INTEGER as string
                LTE: '9007199254740990', // Number.MAX_SAFE_INTEGER - 1
              },
            },
          ],
        },
        {
          DOCUMENTS: true,
          PAGE: { NUMBER: 0, SIZE: 10 },
        },
      )
    })

    it('should handle whitespace in numeric filters', async () => {
      mockDb.QUERY.mockResolvedValue({ RESULT: [] })

      const testCases = [
        'filters=expiryTimestamp < 1734567890&hitsPerPage=10',
        'filters=expiryTimestamp<1734567890&hitsPerPage=10',
        'filters= expiryTimestamp < 1734567890 &hitsPerPage=10',
      ]

      for (const params of testCases) {
        mockRequest.body = { params }
        await search(mockRequest as Request, mockResponse as Response)
        expect(mockResponse.status).toHaveBeenCalledWith(200)
      }
    })

    it('should handle multiple query parameters correctly', async () => {
      mockDb.QUERY.mockResolvedValue({
        RESULT: [{ _id: '1', _doc: { objectID: '1', expiryTimestamp: 1000000000, name: 'Asset 1' } }],
      })

      mockRequest.body = {
        params: 'query=test&filters=expiryTimestamp >= 1000000000&hitsPerPage=5&page=1',
      }

      await search(mockRequest as Request, mockResponse as Response)

      expect(mockResponse.status).toHaveBeenCalledWith(200)
      expect(mockDb.QUERY).toHaveBeenCalledWith(
        {
          AND: [
            { SEARCH: ['test'] },
            {
              FIELD: 'expiryTimestamp',
              VALUE: {
                GTE: '1000000000',
                LTE: '9007199254740991', // Number.MAX_SAFE_INTEGER as string
              },
            },
          ],
        },
        {
          DOCUMENTS: true,
          PAGE: { NUMBER: 1, SIZE: 5 },
        },
      )
    })
  })

  describe('Error Handling', () => {
    it('should return 400 for invalid numeric values instead of 500', async () => {
      mockRequest.body = {
        params: 'filters=expiryTimestamp < notanumber&hitsPerPage=10',
      }

      await search(mockRequest as Request, mockResponse as Response)

      expect(mockResponse.status).toHaveBeenCalledWith(400)
      expect(mockResponse.send).toHaveBeenCalledWith({
        message: 'Invalid numeric value: notanumber',
        error: 'Invalid request parameters',
      })
    })

    it('should return 400 for invalid filter format instead of 500', async () => {
      mockRequest.body = {
        params: 'filters=invalidformat&hitsPerPage=10',
      }

      await search(mockRequest as Request, mockResponse as Response)

      expect(mockResponse.status).toHaveBeenCalledWith(400)
      expect(mockResponse.send).toHaveBeenCalledWith({
        message: 'Invalid numeric filter: invalidformat',
        error: 'Invalid request parameters',
      })
    })

    it('should return 400 for unsupported operators instead of 500', async () => {
      mockRequest.body = {
        params: 'filters=expiryTimestamp != 1234567890&hitsPerPage=10',
      }

      await search(mockRequest as Request, mockResponse as Response)

      expect(mockResponse.status).toHaveBeenCalledWith(400)
      expect(mockResponse.send).toHaveBeenCalledWith({
        message: 'Unsupported numeric operator: !=',
        error: 'Invalid request parameters',
      })
    })

    it('should return proper 500 for database errors', async () => {
      mockDb.QUERY.mockRejectedValue(new Error('Database connection failed'))

      mockRequest.body = {
        params: 'filters=expiryTimestamp < 1734567890&hitsPerPage=10',
      }

      await search(mockRequest as Request, mockResponse as Response)

      expect(mockResponse.status).toHaveBeenCalledWith(500)
    })
  })

  describe('Legacy Format Support', () => {
    it('should still handle legacy query format', async () => {
      const testQuery = { SEARCH: ['test'] }
      mockDb.QUERY.mockResolvedValue({
        RESULT: [{ _id: '1', _doc: { objectID: '1', name: 'Test' } }],
      })

      mockRequest.body = { query: testQuery }

      await search(mockRequest as Request, mockResponse as Response)

      expect(mockResponse.status).toHaveBeenCalledWith(200)
      expect(mockDb.QUERY).toHaveBeenCalledWith(testQuery, { DOCUMENTS: true })
    })
  })

  describe('Numeric Operators', () => {
    const operators = [
      { op: '>=', value: '1000000000', expectedGTE: '1000000000', expectedLTE: '9007199254740991' },
      { op: '<=', value: '1000000000', expectedGTE: '9007199254740991', expectedLTE: '1000000000' },
      { op: '>', value: '1000000000', expectedGTE: '1000000001', expectedLTE: '9007199254740991' },
      { op: '<', value: '1000000000', expectedGTE: '9007199254740991', expectedLTE: '999999999' },
      { op: '=', value: '1000000000', expectedGTE: '1000000000', expectedLTE: '1000000000' },
    ]

    operators.forEach(({ op, value, expectedGTE, expectedLTE }) => {
      it(`should handle ${op} operator correctly`, async () => {
        mockDb.QUERY.mockResolvedValue({ RESULT: [] })

        mockRequest.body = {
          params: `filters=expiryTimestamp ${op} ${value}&hitsPerPage=10`,
        }

        await search(mockRequest as Request, mockResponse as Response)

        expect(mockResponse.status).toHaveBeenCalledWith(200)
        expect(mockDb.QUERY).toHaveBeenCalledWith(
          {
            AND: [
              {
                FIELD: 'expiryTimestamp',
                VALUE: { GTE: expectedGTE, LTE: expectedLTE },
              },
            ],
          },
          {
            DOCUMENTS: true,
            PAGE: { NUMBER: 0, SIZE: 10 },
          },
        )
      })
    })
  })

  describe('Response Format', () => {
    it('should return proper Algolia-compatible response format', async () => {
      const testData = [
        { _id: '1', _doc: { objectID: '1', expiryTimestamp: 1000000000, name: 'Asset 1' } },
        { _id: '2', _doc: { objectID: '2', expiryTimestamp: 2000000000, name: 'Asset 2' } },
      ]

      mockDb.QUERY.mockResolvedValue({
        RESULT: testData,
      })

      mockRequest.body = {
        params: 'filters=expiryTimestamp < 1734567890&hitsPerPage=10&page=0',
      }

      await search(mockRequest as Request, mockResponse as Response)

      expect(mockResponse.send).toHaveBeenCalledWith({
        hits: expect.arrayContaining([
          expect.objectContaining({ objectID: '1' }),
          expect.objectContaining({ objectID: '2' }),
        ]),
        page: 0,
        nbHits: 2,
        nbPages: 1,
        hitsPerPage: 10,
        processingTimeMS: 1,
        query: '',
        params: 'filters=expiryTimestamp < 1734567890&hitsPerPage=10&page=0',
        exhaustiveNbHits: true,
        exhaustiveTypo: true,
        exhaustive: { nbHits: true, typo: true },
      })
    })
  })
})
