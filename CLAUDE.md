# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Algolia v5 mock server built with Express.js and TypeScript, designed for e2e testing. It mimics Algolia's search index API using `search-index` library with `level-party` for persistent storage.

## Development Commands

- **Build**: `npm run build` - Compiles TypeScript from `src/` to `bin/`
- **Development**: `npm run dev` - Runs with hot reload using ts-node-dev
- **Lint**: `npm run lint` - ESLint with auto-fix for TypeScript files
- **Start**: `node bin/cli.js` or use the CLI binary `algolia-mock-server`

## Architecture

### Core Structure
- **Entry Points**: 
  - `src/cli.ts` - CLI executable that starts server on port 9200
  - `src/index.ts` - Main Express app factory with routing setup
- **Storage**: Uses `search-index` with `level-party` backend, stored in `.algoliaMockServer` directory
- **Routing**: Modular route handlers in `src/routes/` for different Algolia API endpoints

### API Endpoints
The server implements these Algolia v5 endpoints:
- `/1/indexes/:indexName/batch` - Batch operations (saveObjects, deleteObjects)
- `/1/indexes/:indexName/query` - Single index search
- `/1/indexes/*/queries` - Multi-index search and filtering
- `/1/indexes/:indexName/:objectID` - Get single object
- `/1/indexes/*/objects` - Get multiple objects
- `/1/indexes/:indexName/task/:taskID` - Task status (fake implementation)
- `/1/indexes/:indexName/clear` - Clear index

### Key Utilities (`src/helpers.ts`)
- `getIndex()` - Returns configured search-index instance
- `idToObjectID()` - Transforms internal `_id` to Algolia's `objectID`
- `getTaskID()` - Generates random task IDs for API compatibility
- `getPageCount()` - Pagination helper

### Build Process
TypeScript compiles from `src/` to `bin/` directory. The compiled `bin/cli.js` serves as the npm binary entry point.

## Development Notes

- Database files are stored locally in `.algoliaMockServer/` directory
- The server runs on port 9200 by default
- All routes expect JSON payloads and return JSON responses
- Error handling returns 500 status with error details
- Uses CORS middleware for cross-origin requests