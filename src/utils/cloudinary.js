import { createHash } from 'node:crypto'

const API_BASE = 'https://api.cloudinary.com/v1_1'
const DELIVERY_HOST = 'res.cloudinary.com'
const DESTROY_TIMEOUT_MS = 10_000

export const UPLOAD_RESOURCE_TYPES = Object.freeze(['image', 'video'])

// Signed with the upload, so the browser cannot widen what it may send.
const ALLOWED_FORMATS = Object.freeze({
  image: 'jpg,jpeg,png,webp,gif,avif',
  video: 'mp4,webm,mov',
})

/**
 * Cloudinary's upload signature: the signed fields sorted by name, joined as
 * `name=value` pairs with `&`, the API secret appended, then hashed.
 */
function sign(params, apiSecret) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')

  return createHash('sha1')
    .update(payload + apiSecret)
    .digest('hex')
}

/**
 * The admin uploads straight from the browser to Cloudinary with a signature
 * from here, so files never pass through the API and the secret never leaves
 * it. The API only ever deletes assets inside its own folder.
 *
 * `fetchImpl` is injectable so the delete call can be stood in for.
 */
export function createCloudinaryClient({
  cloudName,
  apiKey,
  apiSecret,
  folder,
  fetchImpl = fetch,
  now = () => Date.now(),
}) {
  const folderPrefix = `${folder}/`
  const folderSegments = folder.split('/')

  return {
    signUpload(resourceType) {
      const params = {
        allowed_formats: ALLOWED_FORMATS[resourceType],
        folder,
        timestamp: String(Math.floor(now() / 1000)),
      }

      return {
        uploadUrl: `${API_BASE}/${encodeURIComponent(cloudName)}/${resourceType}/upload`,
        apiKey,
        params,
        signature: sign(params, apiSecret),
      }
    },

    /**
     * The asset a delivery URL points at, or `null` for anything this API did
     * not upload: other hosts, other clouds, or files outside its folder.
     */
    assetFromUrl(url) {
      let parsed

      try {
        parsed = new URL(url)
      } catch {
        return null
      }

      if (parsed.protocol !== 'https:' || parsed.hostname !== DELIVERY_HOST) {
        return null
      }

      const [, cloud, resourceType, type, ...rest] = decodeURIComponent(
        parsed.pathname,
      ).split('/')

      if (
        cloud !== cloudName ||
        !UPLOAD_RESOURCE_TYPES.includes(resourceType) ||
        type !== 'upload'
      ) {
        return null
      }

      // Transformations and the version come before the public ID; the
      // public ID always starts with the folder uploads are signed for.
      const start = rest.findIndex((_, index) =>
        folderSegments.every(
          (segment, offset) => rest[index + offset] === segment,
        ),
      )

      if (start === -1 || rest.length <= start + folderSegments.length) {
        return null
      }

      return {
        resourceType,
        publicId: rest
          .slice(start)
          .join('/')
          .replace(/\.[A-Za-z0-9]+$/, ''),
      }
    },

    /** Matches every delivery URL of an asset, whatever its transformations. */
    urlPattern({ resourceType, publicId }) {
      const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

      return new RegExp(
        `^https://${escape(DELIVERY_HOST)}/${escape(cloudName)}/${resourceType}/upload/(?:[^?#]*/)?${escape(publicId)}(?:\\.[A-Za-z0-9]+)?(?:[?#].*)?$`,
      )
    },

    /**
     * Deletes an asset and purges it from the CDN. Answers `true` once it is
     * gone, including when Cloudinary no longer had it.
     */
    async destroy({ resourceType, publicId }) {
      if (!publicId.startsWith(folderPrefix)) {
        throw new Error('Refusing to delete an asset outside the upload folder')
      }

      const response = await fetchImpl(
        `${API_BASE}/${encodeURIComponent(cloudName)}/${resourceType}/destroy`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            public_id: publicId,
            invalidate: 'true',
          }),
          signal: AbortSignal.timeout(DESTROY_TIMEOUT_MS),
        },
      )

      if (!response.ok) {
        throw new Error(`Cloudinary destroy answered HTTP ${response.status}`)
      }

      const { result } = await response.json()

      if (result !== 'ok' && result !== 'not found') {
        throw new Error(`Cloudinary destroy answered "${result}"`)
      }

      return true
    },
  }
}
