import { HTTP_STATUS } from '@constants/http-status.js'

export function createPostCategoryController({ postCategoryService }) {
  return {
    async listPostCategories(_request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await postCategoryService.listPostCategories())
    },
  }
}
