# Technology Stack

## Runtime Environment
- **Node.js**: JavaScript runtime for server-side execution
- **TypeScript**: Type-safe JavaScript superset for development

## Web Framework
- **Express.js**: Minimal web application framework
- **CORS**: Cross-Origin Resource Sharing middleware

## Search & Storage
- **search-index**: Full-text search engine for Node.js
- **level-party**: Shared LevelDB instances for persistent storage
- **LevelDB**: Key-value storage backend

## Development Tools

### Build & Compilation
- **TypeScript Compiler (tsc)**: Compiles TypeScript to JavaScript
- **ts-node-dev**: Development server with hot reload

### Code Quality
- **ESLint**: JavaScript/TypeScript linting
- **@typescript-eslint**: TypeScript-specific ESLint rules
- **Prettier**: Code formatting
- **eslint-config-prettier**: Integrates ESLint with Prettier

### Git Hooks
- **Husky**: Git hooks management
- **lint-staged**: Run linters on staged files

## Project Structure Decisions

### Why This Stack?
- **Express.js**: Simple, well-documented, perfect for mock API servers
- **search-index**: Pure JavaScript search engine, no external dependencies
- **level-party**: Enables concurrent access to LevelDB from multiple processes
- **TypeScript**: Type safety crucial for API contract adherence

### Storage Choice
- **LevelDB + level-party**: Lightweight, embedded database perfect for mock servers
- **Persistent storage**: Data survives server restarts for consistent testing
- **No external database**: Simplifies deployment and testing setup

## Version Requirements
- **Node.js**: >= 16.x (as specified in @types/node)
- **TypeScript**: ^4.5.2
- **Express**: ^4.17.1

## Build Output
- **Source**: `src/` directory
- **Compiled**: `bin/` directory
- **Entry Point**: `bin/cli.js`