# Avengers API

A lightweight Express API written in plain JavaScript and powered by native ECMAScript modules on Node.js 24.

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

On Windows Command Prompt, use `copy .env.example .env` instead. The application also runs without a `.env` file by using its default values.

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

Nodemon watches JavaScript and JSON files in `src`. Before every start or restart, it runs ESLint. Lint errors are printed in the terminal, and the server starts only after linting succeeds.

ESLint and Prettier provide static analysis and consistent formatting. The configurations are located in `eslint.config.js` and `.prettierrc.json`.

## Git Hooks and Commit Messages

Husky manages the following Git hooks:

- `pre-commit` runs lint-staged, which applies ESLint and Prettier to staged files.
- `commit-msg` runs Commitlint against the commit message.

Commit messages must:

- Follow the Conventional Commits format.
- Contain exactly one line.
- Use English ASCII characters only.

Examples:

```text
feat: add hero endpoint
fix(api): handle invalid hero id
docs: update setup instructions
```

## Project Structure

```text
avengers-api/
|-- .husky/                 # Git hooks
|-- src/
|   `-- index.js            # Express application entry point
|-- .env.example            # Environment variable template
|-- commitlint.config.js    # Commit message rules
|-- eslint.config.js        # ESLint flat configuration
|-- nodemon.json            # Development watcher configuration
|-- package.json            # Package metadata and scripts
`-- README.md
```

## License

This project is licensed under the MIT License.
