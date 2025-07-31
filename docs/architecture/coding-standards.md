# Coding Standards

## TypeScript Standards

### Type Safety
- Always use explicit return types for functions
- Prefer `interface` over `type` for object shapes
- Use strict TypeScript configuration
- No `any` types - use proper typing or `unknown`

### Naming Conventions
- Use camelCase for variables and functions
- Use PascalCase for classes and interfaces
- Use UPPER_SNAKE_CASE for constants
- Use kebab-case for file names

### Code Organisation
- One class/interface per file
- Group related functions in modules
- Export from index files for clean imports
- Separate concerns: routes, business logic, data access

## Node.js/Express Standards

### Error Handling
- Always handle async errors with try/catch
- Return consistent error response format
- Log errors with appropriate level
- Use proper HTTP status codes

### API Design
- RESTful endpoint naming
- Consistent response format with status, data, errors
- Proper HTTP methods (GET, POST, PUT, DELETE)
- Validate input parameters

### Async/Await
- Prefer async/await over promises
- Always handle rejected promises
- Use proper async error boundaries

## Code Quality

### ESLint Configuration
- Follow existing ESLint rules in project
- Run `npm run lint` before commits
- Fix all linting issues - no warnings allowed
- Use Prettier for consistent formatting

### Testing
- Write tests for all business logic
- Mock external dependencies
- Test error scenarios
- Maintain high code coverage

### Documentation
- JSDoc for public functions
- README updates for new features
- Clear variable and function names
- Inline explanations for complex logic only when necessary