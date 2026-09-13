/**
 * Serialises documents the way the public API contract expects: the `id`
 * virtual replaces Mongo's `_id`, and the internal version key is dropped.
 *
 * Express calls `JSON.stringify` on the response, which reaches this transform
 * even for documents nested inside a `{ data, meta }` envelope. Queries must
 * therefore return hydrated documents rather than `.lean()` results.
 */
export function publicJsonPlugin(schema) {
  schema.set('toJSON', {
    virtuals: ['id'],
    versionKey: false,
    transform(_document, converted) {
      delete converted._id

      return converted
    },
  })
}
