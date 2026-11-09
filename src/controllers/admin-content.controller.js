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

    async createPostCategory(request, response) {
      response
        .status(HTTP_STATUS.CREATED)
        .json(await adminContentService.createPostCategory(request.body))
    },

    async updatePostCategory(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await adminContentService.updatePostCategory(
            request.params.id,
            request.body,
          ),
        )
    },

    async deletePostCategory(request, response) {
      await adminContentService.deletePostCategory(request.params.id)
      response.status(HTTP_STATUS.NO_CONTENT).end()
    },

    async listPages(_request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await adminContentService.listPages())
    },

    async updatePage(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await adminContentService.updatePage(
            request.params.slug,
            request.body,
          ),
        )
    },

    async listGalleries(_request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await adminContentService.listGalleries())
    },

    async createGallery(request, response) {
      response
        .status(HTTP_STATUS.CREATED)
        .json(await adminContentService.createGallery(request.body))
    },

    async updateGallery(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await adminContentService.updateGallery(
            request.params.id,
            request.body,
          ),
        )
    },

    async deleteGallery(request, response) {
      await adminContentService.deleteGallery(request.params.id)
      response.status(HTTP_STATUS.NO_CONTENT).end()
    },

    async listMedia(_request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await adminContentService.listMedia())
    },

    async createMedia(request, response) {
      response
        .status(HTTP_STATUS.CREATED)
        .json(await adminContentService.createMedia(request.body))
    },

    async updateMedia(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await adminContentService.updateMedia(
            request.params.id,
            request.body,
          ),
        )
    },

    async deleteMedia(request, response) {
      await adminContentService.deleteMedia(request.params.id)
      response.status(HTTP_STATUS.NO_CONTENT).end()
    },

    async listSocialLinks(_request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await adminContentService.listSocialLinks())
    },

    async createSocialLink(request, response) {
      response
        .status(HTTP_STATUS.CREATED)
        .json(await adminContentService.createSocialLink(request.body))
    },

    async updateSocialLink(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await adminContentService.updateSocialLink(
            request.params.id,
            request.body,
          ),
        )
    },

    async deleteSocialLink(request, response) {
      await adminContentService.deleteSocialLink(request.params.id)
      response.status(HTTP_STATUS.NO_CONTENT).end()
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
