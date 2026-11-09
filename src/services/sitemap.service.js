// The shop's public pages that are not built from the database.
const STATIC_PATHS = [
  '/',
  '/shop',
  '/blog',
  '/gallery',
  '/faq',
  '/refund-policy',
  '/terms',
  '/privacy',
]
const CACHE_MS = 60 * 60 * 1000

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * The shop's sitemap: its fixed pages plus every published game and post, so
 * search engines find pages that are only reached through links rendered in
 * the browser. Built at most once an hour.
 */
export function createSitemapService({
  sitemapRepository,
  appUrl,
  now = () => Date.now(),
}) {
  let cached = null

  function url(path, lastModified) {
    const location = `<loc>${escapeXml(`${appUrl}${path}`)}</loc>`
    const modified = lastModified
      ? `<lastmod>${new Date(lastModified).toISOString()}</lastmod>`
      : ''

    return `<url>${location}${modified}</url>`
  }

  async function build() {
    const { products, posts } = await sitemapRepository.findSitemapEntries()
    const slug = (value) => encodeURIComponent(value)

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...STATIC_PATHS.map((path) => url(path)),
      ...products.map((product) =>
        url(`/products/${slug(product.slug)}`, product.updatedAt),
      ),
      ...posts.map((post) => url(`/blog/${slug(post.slug)}`, post.updatedAt)),
      '</urlset>',
    ].join('\n')
  }

  return {
    async getSitemap() {
      if (!cached || now() - cached.builtAt > CACHE_MS) {
        cached = { xml: await build(), builtAt: now() }
      }

      return cached.xml
    },
  }
}
