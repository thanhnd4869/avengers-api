import { ERROR_CODE } from '#constants/error-code.js'
import { KEY_STATUS } from '#constants/order.js'
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '#errors/app-error.js'
import { validateAdminProductListQuery } from '#validations/admin.validation.js'
import {
  validateId,
  validateKeysBody,
  validateProductBody,
  validateVariantBody,
} from '#validations/admin-catalogue.validation.js'
import {
  validatePlatformBody,
  validateTaxonomyBody,
} from '#validations/admin-cms.validation.js'
import { toPaginatedResponse } from './pagination.js'

const EMPTY_KEY_COUNTS = Object.freeze({
  [KEY_STATUS.AVAILABLE]: 0,
  [KEY_STATUS.RESERVED]: 0,
  [KEY_STATUS.SOLD]: 0,
})

function toAdminVariant(variant, keyCounts = EMPTY_KEY_COUNTS) {
  return {
    id: String(variant._id),
    platform: variant.platform
      ? {
          id: String(variant.platform._id),
          name: variant.platform.name,
          slug: variant.platform.slug,
        }
      : null,
    edition: variant.edition,
    price: variant.price,
    originalPrice: variant.originalPrice,
    currency: variant.currency,
    // The counter the shop sells from; `keys` is what is actually stocked.
    availableKeys: variant.availableKeys,
    keys: { ...EMPTY_KEY_COUNTS, ...keyCounts },
  }
}

function toAdminProduct(product, variants = [], keyCounts = new Map()) {
  return {
    id: String(product._id),
    slug: product.slug,
    name: product.name,
    shortDescription: product.shortDescription,
    description: product.description,
    image: product.image,
    categoryIds: (product.categoryIds ?? []).map(String),
    releaseDate: product.releaseDate,
    isPreorder: product.isPreorder,
    published: product.published,
    ratingAverage: product.ratingAverage,
    ratingCount: product.ratingCount,
    salesCount: product.salesCount,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    variants: variants.map((variant) =>
      toAdminVariant(variant, keyCounts.get(String(variant._id))),
    ),
    availableKeys: variants.reduce(
      (sum, variant) => sum + variant.availableKeys,
      0,
    ),
  }
}

function slugTaken() {
  return new ConflictError('Another product already uses this slug.', {
    code: ERROR_CODE.SLUG_TAKEN,
    details: [{ field: 'slug', message: 'This slug is already in use.' }],
  })
}

function variantExists() {
  return new ConflictError(
    'This game is already sold on that platform in that edition.',
    {
      code: ERROR_CODE.VARIANT_EXISTS,
      details: [
        { field: 'edition', message: 'Pick another platform or edition.' },
      ],
    },
  )
}

function slugConflict(resource) {
  return new ConflictError(`Another ${resource} already uses that slug.`, {
    code: ERROR_CODE.SLUG_TAKEN,
    details: [{ field: 'slug', message: 'This slug is already in use.' }],
  })
}

function toAdminPlatform(platform) {
  return {
    id: String(platform._id),
    name: platform.name,
    slug: platform.slug,
    image: platform.image,
    sortOrder: platform.sortOrder,
    published: platform.published,
  }
}

function toAdminCategory(category) {
  return {
    id: String(category._id),
    name: category.name,
    slug: category.slug,
    sortOrder: category.sortOrder,
  }
}

export function createAdminCatalogueService({
  adminCatalogueRepository: repository,
  adminUploadService,
  keyCipher,
  logger,
}) {
  async function loadProduct(productId) {
    const product = await repository.findProductById(productId)

    if (!product) throw new NotFoundError('Product not found.')

    return product
  }

  /** A product as the admin sees it, with variants and their key counts. */
  async function present(product) {
    const variants = await repository.findVariantsForProducts([product._id])
    const keyCounts = await repository.countKeysByStatus(
      variants.map((variant) => variant._id),
    )

    return toAdminProduct(product, variants, keyCounts)
  }

  async function checkCategories(categoryIds) {
    if (!categoryIds?.length) return

    if (
      (await repository.countCategories(categoryIds)) !== categoryIds.length
    ) {
      throw new ValidationError('Some categories do not exist.', {
        details: [
          { field: 'categoryIds', message: 'Some categories do not exist.' },
        ],
      })
    }
  }

  async function checkPlatform(platformId) {
    if (!(await repository.findPlatformById(platformId))) {
      throw new ValidationError('That platform does not exist.', {
        details: [
          { field: 'platformId', message: 'That platform does not exist.' },
        ],
      })
    }
  }

  async function loadVariant(productId, variantId) {
    const variant = await repository.findVariantById(variantId)

    if (!variant || String(variant.productId) !== productId) {
      throw new NotFoundError('Variant not found.')
    }

    return variant
  }

  return {
    async listProducts(query) {
      const { page, limit, search, published } =
        validateAdminProductListQuery(query)
      const { products, total } = await repository.findProducts({
        page,
        limit,
        search,
        published,
      })
      const variants = products.length
        ? await repository.findVariantsForProducts(products.map((p) => p._id))
        : []
      const keyCounts = variants.length
        ? await repository.countKeysByStatus(variants.map((v) => v._id))
        : new Map()
      const byProduct = new Map()

      for (const variant of variants) {
        const id = String(variant.productId)
        byProduct.set(id, [...(byProduct.get(id) ?? []), variant])
      }

      return toPaginatedResponse(
        products.map((product) =>
          toAdminProduct(
            product,
            byProduct.get(String(product._id)),
            keyCounts,
          ),
        ),
        { page, limit, total },
      )
    },

    async getProduct(rawId) {
      return { data: await present(await loadProduct(validateId(rawId))) }
    },

    /** New games start hidden, so they can be finished before going live. */
    async createProduct(body) {
      const input = validateProductBody(body)

      await checkCategories(input.categoryIds)

      try {
        const product = await repository.createProduct({
          published: false,
          ...input,
        })

        return { data: await present(product) }
      } catch (error) {
        if (repository.isDuplicateKeyError(error)) throw slugTaken()
        throw error
      }
    },

    async updateProduct(rawId, body) {
      const id = validateId(rawId)
      const changes = validateProductBody(body, { partial: true })

      await checkCategories(changes.categoryIds)

      try {
        const before = await repository.findProductById(id)
        const product = await repository.updateProduct(id, changes)

        if (!product) throw new NotFoundError('Product not found.')

        await adminUploadService.releaseReplaced(before, product)

        return { data: await present(product) }
      } catch (error) {
        if (repository.isDuplicateKeyError(error)) throw slugTaken()
        throw error
      }
    },

    async createVariant(rawProductId, body) {
      const product = await loadProduct(validateId(rawProductId, 'productId'))
      const input = validateVariantBody(body)

      await checkPlatform(input.platformId)

      try {
        await repository.createVariant({
          ...input,
          productId: product._id,
          availableKeys: 0,
        })
      } catch (error) {
        if (repository.isDuplicateKeyError(error)) throw variantExists()
        throw error
      }

      return { data: await present(product) }
    },

    async updateVariant(rawProductId, rawVariantId, body) {
      const productId = validateId(rawProductId, 'productId')
      const variant = await loadVariant(
        productId,
        validateId(rawVariantId, 'variantId'),
      )
      const changes = validateVariantBody(body, { partial: true })
      const nextPrice = changes.price ?? variant.price
      const nextOriginal =
        changes.originalPrice === undefined
          ? variant.originalPrice
          : changes.originalPrice

      // Checked against the stored price too, so lowering only the
      // original price below the price is refused as well.
      if (nextOriginal != null && nextOriginal <= nextPrice) {
        throw new ValidationError(
          'originalPrice must be above price, or empty when there is no discount.',
          {
            details: [
              {
                field: 'originalPrice',
                message: 'Must be above the price, or empty.',
              },
            ],
          },
        )
      }

      if (changes.platformId) await checkPlatform(changes.platformId)

      try {
        await repository.updateVariant(variant._id, changes)
      } catch (error) {
        if (repository.isDuplicateKeyError(error)) throw variantExists()
        throw error
      }

      return { data: await present(await loadProduct(productId)) }
    },

    async deleteVariant(rawProductId, rawVariantId) {
      const productId = validateId(rawProductId, 'productId')
      const variant = await loadVariant(
        productId,
        validateId(rawVariantId, 'variantId'),
      )
      const result = await repository.deleteVariantWithoutKeys(variant._id)

      if (result === 'has_keys') {
        throw new ConflictError(
          'This variant has keys, so it stays for the orders that used them. Raise its price or hide the game instead.',
          { code: ERROR_CODE.VARIANT_HAS_KEYS },
        )
      }

      if (result === 'not_found') throw new NotFoundError('Variant not found.')

      return { data: await present(await loadProduct(productId)) }
    },

    /**
     * Stocks new codes for a variant. Codes are encrypted before they reach
     * the database and never echoed back; a batch with any code already in
     * stock is refused as a whole, naming how many repeat.
     */
    async addKeys(rawProductId, rawVariantId, body, { adminId }) {
      const productId = validateId(rawProductId, 'productId')
      const variant = await loadVariant(
        productId,
        validateId(rawVariantId, 'variantId'),
      )
      const { codes, repeated } = validateKeysBody(body)
      const keys = codes.map((code) => ({
        codeEncrypted: keyCipher.encrypt(code),
        codeHash: keyCipher.hash(code),
      }))
      const existing = await repository.findExistingKeyHashes(
        keys.map((key) => key.codeHash),
      )

      if (existing.size > 0) {
        throw new ConflictError(
          `${existing.size} of these codes are already in stock. Remove them and try again.`,
          {
            code: ERROR_CODE.DUPLICATE_KEYS,
            details: [{ field: 'codes', duplicates: existing.size }],
          },
        )
      }

      let added

      try {
        added = await repository.addProductKeys(variant._id, keys)
      } catch (error) {
        // Stocked by someone else between the check and the insert.
        if (repository.isDuplicateKeyError(error)) {
          throw new ConflictError(
            'Some of these codes were stocked a moment ago. Reload and try again.',
            { code: ERROR_CODE.DUPLICATE_KEYS },
          )
        }
        throw error
      }

      logger.info(
        { variantId: String(variant._id), added, adminId },
        'Admin stocked keys',
      )

      return {
        data: {
          added,
          skippedRepeats: repeated,
          product: await present(await loadProduct(productId)),
        },
      }
    },

    async listPlatforms() {
      const platforms = await repository.findPlatforms()

      return { data: platforms.map(toAdminPlatform) }
    },

    async createPlatform(body) {
      try {
        const input = validatePlatformBody(body)
        return {
          data: toAdminPlatform(
            await repository.createPlatform({
              ...input,
              published: input.published ?? false,
            }),
          ),
        }
      } catch (error) {
        if (repository.isDuplicateKeyError(error)) {
          throw slugConflict('platform')
        }
        throw error
      }
    },

    async updatePlatform(rawId, body) {
      const id = validateId(rawId)
      try {
        const changes = validatePlatformBody(body, { partial: true })
        const before = await repository.findPlatformById(id)
        const platform = await repository.updatePlatform(id, changes)
        if (!platform) throw new NotFoundError('Platform not found.')
        await adminUploadService.releaseReplaced(before, platform)
        return { data: toAdminPlatform(platform) }
      } catch (error) {
        if (repository.isDuplicateKeyError(error)) {
          throw slugConflict('platform')
        }
        throw error
      }
    },

    async deletePlatform(rawId) {
      const id = validateId(rawId)
      const platform = await repository.findPlatformById(id)
      if (!platform) {
        throw new NotFoundError('Platform not found.')
      }
      if (await repository.countVariantsForPlatform(id)) {
        throw new ConflictError(
          'This platform is used by product variants. Move those variants before deleting it.',
        )
      }
      if (!(await repository.deletePlatform(id))) {
        throw new NotFoundError('Platform not found.')
      }
      await adminUploadService.releaseReplaced(platform, null)
    },

    async listCategories() {
      const categories = await repository.findCategories()

      return { data: categories.map(toAdminCategory) }
    },

    async createCategory(body) {
      try {
        return {
          data: toAdminCategory(
            await repository.createCategory(validateTaxonomyBody(body)),
          ),
        }
      } catch (error) {
        if (repository.isDuplicateKeyError(error)) {
          throw slugConflict('category')
        }
        throw error
      }
    },

    async updateCategory(rawId, body) {
      const id = validateId(rawId)
      try {
        const category = await repository.updateCategory(
          id,
          validateTaxonomyBody(body, { partial: true }),
        )
        if (!category) throw new NotFoundError('Category not found.')
        return { data: toAdminCategory(category) }
      } catch (error) {
        if (repository.isDuplicateKeyError(error)) {
          throw slugConflict('category')
        }
        throw error
      }
    },

    async deleteCategory(rawId) {
      const id = validateId(rawId)
      if (!(await repository.findCategoryById(id))) {
        throw new NotFoundError('Category not found.')
      }
      if (await repository.countProductsForCategory(id)) {
        throw new ConflictError(
          'This category is used by products. Remove it from those products before deleting it.',
        )
      }
      if (!(await repository.deleteCategory(id))) {
        throw new NotFoundError('Category not found.')
      }
    },
  }
}
