import { Router } from 'express'

export function createPostRouter({ postController }) {
  const router = Router()

  router.get('/', postController.listPosts)

  return router
}
