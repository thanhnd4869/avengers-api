import { Router } from 'express'

export function createPostCategoryRouter({ postCategoryController }) {
  const router = Router()

  router.get('/', postCategoryController.listPostCategories)

  return router
}
