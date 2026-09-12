import { registerHooks } from 'node:module'

/**
 * Resolves `@layer/*` import specifiers to files under `src/layer/*`.
 *
 * Node has no built-in support for `@` aliases, so this hook translates them
 * before the default resolver runs. It is loaded via `node --import`, which
 * means every entry point (server, scripts, migrations) must include that flag.
 *
 * Keep this list in sync with the "paths" entries in jsconfig.json and with the
 * layer groups in eslint.config.js.
 */
const ALIASED_LAYERS = new Set([
  'config',
  'constants',
  'controllers',
  'errors',
  'middlewares',
  'models',
  'repositories',
  'routes',
  'services',
  'utils',
  'validations',
])

const SOURCE_ROOT = new URL('./src/', import.meta.url)
const ALIAS_PATTERN = /^@([a-z-]+)\/(.+)$/

registerHooks({
  resolve(specifier, context, nextResolve) {
    const match = ALIAS_PATTERN.exec(specifier)

    // Unknown scopes fall through so real scoped packages (@babel/core) still work.
    if (!match || !ALIASED_LAYERS.has(match[1])) {
      return nextResolve(specifier, context)
    }

    const [, layer, subpath] = match
    const target = new URL(`${layer}/${subpath}`, SOURCE_ROOT)

    return nextResolve(target.href, context)
  },
})
