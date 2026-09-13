export function createPlatformService({
  platformRepository,
  productRepository,
}) {
  return {
    async listPlatforms() {
      const platforms = await platformRepository.findPublishedPlatforms()

      // Spreading a Mongoose document would drop the `id` virtual, so the
      // document is serialised before the derived count is attached.
      const data = await Promise.all(
        platforms.map(async (platform) => ({
          ...platform.toJSON(),
          productCount:
            await productRepository.countPublishedProductsByPlatform(
              platform.slug,
            ),
        })),
      )

      return { data }
    },
  }
}
