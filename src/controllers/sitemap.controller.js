import { HTTP_STATUS } from '#constants/http-status.js'

export function createSitemapController({ sitemapService }) {
  return {
    async getSitemap(_request, response) {
      response
        .status(HTTP_STATUS.OK)
        .type('application/xml')
        .set('Cache-Control', 'public, max-age=3600')
        .send(await sitemapService.getSitemap())
    },
  }
}
