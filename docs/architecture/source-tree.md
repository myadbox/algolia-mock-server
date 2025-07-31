# Source Tree Structure

## Project Root Layout

```
algolia-mock-server/
├── src/                    # TypeScript source files
├── bin/                    # Compiled JavaScript output
├── docs/                   # Project documentation
├── .algoliaMockServer/     # LevelDB storage directory (auto-created)
├── .bmad-core/             # BMAD method framework
├── .claude/                # Claude Code integration
├── .gemini/                # Gemini CLI integration
├── package.json            # Project configuration
├── tsconfig.json           # TypeScript configuration
├── .eslintrc.js            # ESLint configuration
├── .prettierrc.js          # Prettier configuration
└── CLAUDE.md               # Claude Code instructions
```

## Source Code Structure (`src/`)

### Entry Points
- **`cli.ts`** - Command-line interface, starts server on port 9200
- **`index.ts`** - Express app factory with middleware and routing setup

### Core Business Logic
- **`helpers.ts`** - Shared utilities for search index operations, ID transformations, pagination

### API Routes (`src/routes/`)
- **`index.ts`** - Route aggregation and Express router setup
- **`search.ts`** - Single index search endpoint (`/1/indexes/:indexName/query`)
- **`queries.ts`** - Multi-index search endpoint (`/1/indexes/*/queries`)
- **`saveObjects.ts`** - Batch operations endpoint (`/1/indexes/:indexName/batch`)
- **`getObject.ts`** - Single object retrieval (`/1/indexes/:indexName/:objectID`)
- **`getObjects.ts`** - Multiple object retrieval (`/1/indexes/*/objects`)
- **`clear.ts`** - Index clearing endpoint (`/1/indexes/:indexName/clear`)
- **`task.ts`** - Task status endpoint (`/1/indexes/:indexName/task/:taskID`)

### Type Definitions (`src/types/`)
- **`level-party.d.ts`** - TypeScript declarations for level-party module

## Build Output (`bin/`)

Compiled JavaScript files mirroring the `src/` structure:
- Direct 1:1 mapping from TypeScript to JavaScript
- Entry point: `bin/cli.js` (referenced in package.json bin field)
- Used by npm when package is installed globally

## Key Directories

### Documentation (`docs/`)
- **`architecture/`** - BMAD-required architecture documentation
  - `coding-standards.md` - Development standards and conventions
  - `tech-stack.md` - Technology choices and rationale
  - `source-tree.md` - This file, project structure explanation

### Storage (`.algoliaMockServer/`)
- Auto-created by search-index + level-party
- Contains LevelDB database files
- Persists between server restarts
- Should be added to `.gitignore`

### Framework Integration
- **`.bmad-core/`** - BMAD method agents and workflows
- **`.claude/`** - Claude Code commands and contexts
- **`.gemini/`** - Gemini CLI integration

## File Naming Conventions

- **TypeScript files**: camelCase (e.g., `getObject.ts`)
- **Directories**: kebab-case (e.g., `src/routes/`)
- **Config files**: Standard conventions (e.g., `tsconfig.json`, `.eslintrc.js`)

## Import/Export Patterns

- **Routes**: Export default Express router from each route file
- **Helpers**: Named exports for utility functions
- **Types**: Centralized in `src/types/` directory
- **Main modules**: Single responsibility principle, clear interfaces

## Development vs Production

- **Development**: Work in `src/`, run with `ts-node-dev`
- **Production**: Compile to `bin/`, run compiled JavaScript
- **CLI Binary**: Points to compiled `bin/cli.js` for global installation