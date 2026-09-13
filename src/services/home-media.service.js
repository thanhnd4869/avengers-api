const MAX_SCREENSHOTS = 6

export function createHomeMediaService({ homeMediaRepository }) {
  return {
    async getHomeMedia() {
      const media = await homeMediaRepository.findHomeMedia()

      return {
        data: {
          socialLinks: media?.socialLinks ?? [],
          latestVideo: media?.latestVideo ?? null,
          screenshots: (media?.screenshots ?? [])
            .slice(0, MAX_SCREENSHOTS)
            .map((screenshot, index) => ({ id: index + 1, ...screenshot })),
        },
      }
    },
  }
}
