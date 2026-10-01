import { validateMediaListQuery } from '@validations/media.validation.js'

export function createMediaService({ mediaRepository }) {
  return {
    async listMedia(query) {
      const { type, limit } = validateMediaListQuery(query)

      return { data: await mediaRepository.findPublishedMedia({ type, limit }) }
    },
  }
}
