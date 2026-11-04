import { HTTP_STATUS } from '#constants/http-status.js'

export function createGalleryController({ galleryService }) {
  return {
    async listGalleries(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await galleryService.listGalleries(request.query))
    },
  }
}
