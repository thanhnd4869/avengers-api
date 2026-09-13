import { validateBannerListQuery } from '@validations/banner.validation.js'

export function createBannerService({ bannerRepository }) {
  return {
    async listBanners(query) {
      const { limit } = validateBannerListQuery(query)

      return { data: await bannerRepository.findPublishedBanners({ limit }) }
    },
  }
}
