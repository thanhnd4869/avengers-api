import { parseBoundedInteger } from '#validations/query.validation.js'

export function createGalleryService({ galleryRepository }) {
  return {
    async listGalleries(query) {
      const limit = parseBoundedInteger(query.limit, {
        field: 'limit',
        fallback: 6,
        maximum: 24,
      })

      return { data: await galleryRepository.findPublishedGalleries({ limit }) }
    },
  }
}
