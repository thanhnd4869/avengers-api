import { ServiceUnavailableError } from '#errors/app-error.js'
import { UPLOAD_RESOURCE_TYPES } from '#utils/cloudinary.js'
import { fieldError } from '#validations/query.validation.js'

/** Every image and video URL a document shows, wherever it keeps them. */
export function mediaUrlsOf(document) {
  if (!document) return []

  return [
    document.image?.url,
    document.cover?.url,
    ...(document.gallery ?? []).map((image) => image?.url),
    ...(document.images ?? []).map((image) => image?.url),
    // A media entry's own `url` is its video or full-size picture.
    typeof document.url === 'string' ? document.url : undefined,
  ].filter((url) => typeof url === 'string' && url !== '')
}

/**
 * Uploading to Cloudinary from the admin, and removing uploaded files once
 * nothing shows them any more. Files hosted elsewhere are never touched.
 */
export function createAdminUploadService({
  cloudinary,
  mediaAssetRepository,
  logger,
}) {
  async function removeIfUnused(url) {
    const asset = cloudinary.assetFromUrl(url)

    if (!asset) return

    try {
      if (
        await mediaAssetRepository.isUrlReferenced(cloudinary.urlPattern(asset))
      ) {
        return
      }

      await cloudinary.destroy(asset)
      logger.info({ publicId: asset.publicId }, 'Deleted an unused upload')
    } catch (error) {
      // The edit itself succeeded; a leftover file only costs storage.
      logger.warn(
        { err: error, publicId: asset.publicId },
        'Could not delete an unused upload',
      )
    }
  }

  return {
    isEnabled: () => Boolean(cloudinary),

    createUploadSignature(body = {}) {
      if (!cloudinary) {
        throw new ServiceUnavailableError('File uploads are not configured.')
      }

      const resourceType = body.resourceType ?? 'image'

      if (!UPLOAD_RESOURCE_TYPES.includes(resourceType)) {
        throw fieldError(
          'resourceType',
          `resourceType must be one of: ${UPLOAD_RESOURCE_TYPES.join(', ')}.`,
        )
      }

      return { data: cloudinary.signUpload(resourceType) }
    },

    /**
     * Deletes the uploads `before` showed that `after` no longer does, once
     * no other document uses them either. Never throws.
     */
    async releaseReplaced(before, after) {
      if (!cloudinary || !before) return

      const kept = new Set(mediaUrlsOf(after))
      const dropped = [...new Set(mediaUrlsOf(before))].filter(
        (url) => !kept.has(url),
      )

      await Promise.all(dropped.map(removeIfUnused))
    },
  }
}
