import { HTTP_STATUS } from '#constants/http-status.js'

export function createPostController({ postService }) {
  return {
    async listPosts(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await postService.listPosts(request.query))
    },

    async getPost(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await postService.getPost(request.params.slug))
    },
  }
}
