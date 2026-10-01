export function createPlatformService({ platformRepository }) {
  return {
    async listPlatforms() {
      return {
        data: await platformRepository.findPublishedPlatformsWithProductCount(),
      }
    },
  }
}
