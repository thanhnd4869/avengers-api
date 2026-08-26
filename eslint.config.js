import eslint from '@eslint/js'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

const restrictedImports = (...groups) => [
  'error',
  {
    patterns: groups.map(([group, message]) => ({ group, message })),
  },
]

const routes = ['**/routes/**', './routes/**', '../routes/**']
const controllers = [
  '**/controllers/**',
  './controllers/**',
  '../controllers/**',
]
const services = ['**/services/**', './services/**', '../services/**']
const repositories = [
  '**/repositories/**',
  './repositories/**',
  '../repositories/**',
]
const models = ['**/models/**', './models/**', '../models/**']

export default [
  {
    ignores: ['coverage/**', 'node_modules/**'],
  },
  eslint.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.node,
      sourceType: 'module',
    },
    rules: {
      'no-duplicate-imports': 'error',
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression',
          message:
            'Dynamic imports are prohibited because they can bypass static layer dependency rules.',
        },
      ],
    },
  },
  {
    files: ['src/routes/**/*.js'],
    rules: {
      'no-restricted-imports': restrictedImports(
        [services, 'Routes must access business logic through controllers.'],
        [repositories, 'Routes must not access repositories directly.'],
        [models, 'Routes must not access models directly.'],
      ),
    },
  },
  {
    files: ['src/controllers/**/*.js'],
    rules: {
      'no-restricted-imports': restrictedImports(
        [routes, 'Controllers must not depend on routes.'],
        [repositories, 'Controllers must access data through services.'],
        [models, 'Controllers must not access models directly.'],
      ),
    },
  },
  {
    files: ['src/services/**/*.js'],
    rules: {
      'no-restricted-imports': restrictedImports(
        [routes, 'Services must not depend on routes.'],
        [controllers, 'Services must not depend on controllers.'],
        [models, 'Services must access data through repositories.'],
      ),
    },
  },
  {
    files: ['src/repositories/**/*.js'],
    rules: {
      'no-restricted-imports': restrictedImports(
        [routes, 'Repositories must not depend on routes.'],
        [controllers, 'Repositories must not depend on controllers.'],
        [services, 'Repositories must not depend on services.'],
      ),
    },
  },
  {
    files: ['src/models/**/*.js'],
    rules: {
      'no-restricted-imports': restrictedImports(
        [routes, 'Models must not depend on routes.'],
        [controllers, 'Models must not depend on controllers.'],
        [services, 'Models must not depend on services.'],
        [repositories, 'Models must not depend on repositories.'],
      ),
    },
  },
  {
    files: ['src/validations/**/*.js'],
    rules: {
      'no-restricted-imports': restrictedImports(
        [routes, 'Validations must not depend on routes.'],
        [controllers, 'Validations must not depend on controllers.'],
        [services, 'Validations must not contain business logic.'],
        [repositories, 'Validations must not access repositories.'],
        [models, 'Validations must not access models.'],
      ),
    },
  },
  prettier,
]
