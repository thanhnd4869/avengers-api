# Avengers API

The backend API for a MERN-stack e-commerce platform that sells licensed video
games, similar to Steam and the Epic Games Store.

The API is written in plain JavaScript, uses Express and native ECMAScript
modules, and runs on Node.js 24. The codebase follows a strict Layered
Architecture organized by technical responsibility.

## Technology Stack

- MongoDB for persistent data storage (planned)
- Express for the HTTP API
- React for the separate frontend application
- Node.js 24 for the backend runtime

## Requirements

- Node.js `>=24.11.0 <25`
- npm `>=11`

## Getting Started

Install the locked dependencies:

```sh
npm ci
```

Create a local environment file from the provided example:

```sh
cp .env.example .env
```

On Windows Command Prompt, use `copy .env.example .env` instead. The application
also runs without a `.env` file by using its default values.

Start the development server:

```sh
npm run dev
```

The API is available at `http://localhost:8000` by default.

## Environment Variables

| Variable | Default     | Description                      |
| -------- | ----------- | -------------------------------- |
| `HOST`   | `localhost` | Hostname used by the HTTP server |
| `PORT`   | `8000`      | Port used by the HTTP server     |

`PORT` must be an integer between `1` and `65535`.

## API Endpoints

| Method | Path | Description                     |
| ------ | ---- | ------------------------------- |
| `GET`  | `/`  | Returns a JSON welcome response |

## Available Scripts

All scripts are compatible with Windows, Ubuntu, and macOS.

| Command                                       | Description                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| `npm start`                                   | Starts the application                                                           |
| `npm run dev`                                 | Runs ESLint and starts Nodemon; repeats validation after source changes          |
| `npm run dev:server`                          | Runs ESLint and starts the application without the file watcher                  |
| `npm test`                                    | Runs tests with the built-in Node.js test runner                                 |
| `npm run lint`                                | Checks JavaScript files with ESLint                                              |
| `npm run lint:fix`                            | Fixes automatically repairable ESLint issues                                     |
| `npm run format`                              | Formats supported project files with Prettier                                    |
| `npm run format:check`                        | Checks formatting without modifying files                                        |
| `npm run commitlint -- --edit <message-file>` | Validates a commit message file                                                  |
| `npm run prepare`                             | Installs the project-managed Husky hooks; normally runs automatically on install |

## Development Workflow

Nodemon watches JavaScript and JSON files in `src`. Before every start or
restart, it runs ESLint. Lint errors are printed in the terminal, and the server
starts only after linting succeeds.

ESLint and Prettier provide static analysis and consistent formatting. The
configurations are located in `eslint.config.js` and `.prettierrc.json`.

ESLint also enforces the dependency direction between architectural layers
without additional plugins. Dynamic imports are prohibited because they can
bypass these static dependency restrictions.

## Architecture

The project uses a strict Layered Architecture. A normal request follows this
dependency direction:

```text
Route -> Controller -> Service -> Repository -> Model -> MongoDB
```

Each layer has one primary responsibility:

| Layer         | Responsibility                                                       |
| ------------- | -------------------------------------------------------------------- |
| Routes        | Declare endpoints and attach middleware, validation, and controllers |
| Controllers   | Translate HTTP requests and responses                                |
| Services      | Implement business rules and application use cases                   |
| Repositories  | Encapsulate database queries and persistence details                 |
| Models        | Define database schemas, indexes, and structural constraints         |
| Validations   | Validate request parameters, query strings, and request bodies       |
| Middlewares   | Implement reusable HTTP pipeline behavior                            |
| Orchestrators | Coordinate workflows that require multiple independent services      |
| Config        | Load and validate application configuration                          |
| Errors        | Define application errors and error-handling primitives              |
| Constants     | Store stable application-wide constants                              |
| Utils         | Provide small, stateless, reusable utilities                         |

### Dependency Rules

The following restrictions are enforced by ESLint:

- Routes cannot access services, repositories, or models directly.
- Controllers cannot depend on routes, repositories, or models.
- Services cannot depend on routes, controllers, models, or other services.
- Repositories cannot depend on routes, controllers, or services.
- Models cannot depend on repositories or any higher layer.
- Validations cannot access business or persistence layers.
- Services must access stored data through repositories.
- Dynamic imports and duplicate imports are prohibited.

Services are intentionally prohibited from importing other services. Complex
workflows such as checkout, payment completion, and refunds should be
coordinated by an orchestrator:

```text
Controller -> Orchestrator -> Services -> Repositories -> Models
```

An orchestrator coordinates services but must not access repositories or models
directly. Simple use cases should call a service without an orchestrator.

## Git Hooks and Commit Messages

Husky manages the following Git hooks:

- `pre-commit` runs lint-staged, which applies ESLint and Prettier to staged
  files.
- `commit-msg` runs Commitlint against the commit message.

Commit messages must:

- Follow the Conventional Commits format.
- Contain exactly one line.
- Use English ASCII characters only.

Examples:

```text
feat: add game catalog endpoint
fix(checkout): prevent duplicate game purchase
docs: update setup instructions
```

## Project Structure

```text
avengers-api/
|-- .husky/                   # Git hooks
|-- src/
|   |-- config/               # Environment and infrastructure configuration
|   |-- constants/            # Application-wide constants
|   |-- controllers/          # HTTP request and response handling
|   |-- errors/               # Application error definitions
|   |-- middlewares/          # Express middleware
|   |-- models/               # Database schemas and models
|   |-- orchestrators/        # Multi-service workflow coordination
|   |-- repositories/         # Data access and persistence
|   |-- routes/               # API route declarations
|   |-- services/             # Business rules and use cases
|   |-- utils/                # Reusable stateless utilities
|   |-- validations/          # Request validation
|   `-- index.js              # Current Express application entry point
|-- .env.example              # Environment variable template
|-- commitlint.config.js      # Commit message rules
|-- eslint.config.js          # ESLint and layer dependency rules
|-- nodemon.json              # Development watcher configuration
|-- package.json              # Package metadata and scripts
`-- README.md
```

The layer directories currently contain placeholders and will be populated as
features are implemented. The existing application remains in `src/index.js`
until its responsibilities are migrated into the appropriate layers.

## License

This project is licensed under the MIT License.
