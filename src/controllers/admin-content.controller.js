import { HTTP_STATUS } from '#constants/http-status.js'

export function createAdminContentController({ adminContentService }) {
  return {
    async listBanners(_request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await adminContentService.listBanners())
    },

    async createBanner(request, response) {
      response
        .status(HTTP_STATUS.CREATED)
        .json(await adminContentService.createBanner(request.body))
    },

    async updateBanner(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await adminContentService.updateBanner(
            request.params.id,
            request.body,
          ),
        )
    },

    async deleteBanner(request, response) {
      await adminContentService.deleteBanner(request.params.id)
      response.status(HTTP_STATUS.NO_CONTENT).end()
    },

    async listPosts(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await adminContentService.listPosts(request.query))
    },

    async getPost(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await adminContentService.getPost(request.params.id))
    },

    async createPost(request, response) {
      response
        .status(HTTP_STATUS.CREATED)
        .json(await adminContentService.createPost(request.body))
    },

    async updatePost(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await adminContentService.updatePost(request.params.id, request.body),
        )
    },

    async deletePost(request, response) {
      await adminContentService.deletePost(request.params.id, {
        adminId: request.auth.userId,
      })
      response.status(HTTP_STATUS.NO_CONTENT).end()
    },

    async listPostCategories(_request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await adminContentService.listPostCategories())
    },

    async listComments(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await adminContentService.listComments(request.query))
    },

    async deleteComment(request, response) {
      await adminContentService.deleteComment(request.params.id, {
        adminId: request.auth.userId,
      })
      response.status(HTTP_STATUS.NO_CONTENT).end()
    },
  }
}
