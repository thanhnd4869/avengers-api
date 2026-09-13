// The client injects its own All tab and reserves this slug for it.
const RESERVED_SLUGS = ['all']

export function createPostCategoryService({ postCategoryRepository }) {
  return {
    async listPostCategories() {
      return {
        data: await postCategoryRepository.findPostCategories({
          excludedSlugs: RESERVED_SLUGS,
        }),
      }
    },
  }
}
