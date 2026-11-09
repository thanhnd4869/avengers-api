import { HTTP_STATUS } from '#constants/http-status.js'

export function createAdminCatalogueController({ adminCatalogueService }) {
  return {
    async listProducts(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await adminCatalogueService.listProducts(request.query))
    },

    async getProduct(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await adminCatalogueService.getProduct(request.params.id))
    },

    async createProduct(request, response) {
      response
        .status(HTTP_STATUS.CREATED)
        .json(await adminCatalogueService.createProduct(request.body))
    },

    async updateProduct(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await adminCatalogueService.updateProduct(
            request.params.id,
            request.body,
          ),
        )
    },

    async createVariant(request, response) {
      response
        .status(HTTP_STATUS.CREATED)
        .json(
          await adminCatalogueService.createVariant(
            request.params.id,
            request.body,
          ),
        )
    },

    async updateVariant(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await adminCatalogueService.updateVariant(
            request.params.id,
            request.params.variantId,
            request.body,
          ),
        )
    },

    async deleteVariant(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await adminCatalogueService.deleteVariant(
            request.params.id,
            request.params.variantId,
          ),
        )
    },

    async addKeys(request, response) {
      response
        .status(HTTP_STATUS.CREATED)
        .json(
          await adminCatalogueService.addKeys(
            request.params.id,
            request.params.variantId,
            request.body,
            { adminId: request.auth.userId },
          ),
        )
    },

    async listPlatforms(_request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await adminCatalogueService.listPlatforms())
    },

    async createPlatform(request, response) {
      response
        .status(HTTP_STATUS.CREATED)
        .json(await adminCatalogueService.createPlatform(request.body))
    },

    async updatePlatform(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await adminCatalogueService.updatePlatform(
            request.params.id,
            request.body,
          ),
        )
    },

    async deletePlatform(request, response) {
      await adminCatalogueService.deletePlatform(request.params.id)
      response.status(HTTP_STATUS.NO_CONTENT).end()
    },

    async listCategories(_request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await adminCatalogueService.listCategories())
    },

    async createCategory(request, response) {
      response
        .status(HTTP_STATUS.CREATED)
        .json(await adminCatalogueService.createCategory(request.body))
    },

    async updateCategory(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await adminCatalogueService.updateCategory(
            request.params.id,
            request.body,
          ),
        )
    },

    async deleteCategory(request, response) {
      await adminCatalogueService.deleteCategory(request.params.id)
      response.status(HTTP_STATUS.NO_CONTENT).end()
    },
  }
}
