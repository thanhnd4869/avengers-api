export function createSocialLinkService({ socialLinkRepository }) {
  return {
    async listSocialLinks() {
      return { data: await socialLinkRepository.findSocialLinks() }
    },
  }
}
