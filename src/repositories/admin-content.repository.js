import mongoose from 'mongoose'
import { Banner } from '#models/banner.model.js'
import { Post } from '#models/post.model.js'
import { PostCategory } from '#models/post-category.model.js'
import { PostComment } from '#models/post-comment.model.js'
import { Page } from '#models/page.model.js'
import { Gallery } from '#models/gallery.model.js'
import { Media } from '#models/media.model.js'
import { SocialLink } from '#models/social-link.model.js'

export { deleteCommentById } from './post-comment.repository.js'

const DUPLICATE_KEY = 11000
const UPDATE_OPTIONS = Object.freeze({
  returnDocument: 'after',
  runValidators: true,
  lean: true,
})

export function isDuplicateKeyError(error) {
  return error?.code === DUPLICATE_KEY
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Banners: few enough to list whole, in the order the shop shows them.

export function findBanners() {
  return Banner.find().sort({ sortOrder: 1, _id: 1 }).lean()
}

export async function createBanner(banner) {
  return (await Banner.create(banner)).toObject()
}

export function updateBanner(bannerId, changes) {
  return Banner.findByIdAndUpdate(bannerId, { $set: changes }, UPDATE_OPTIONS)
}

export async function deleteBanner(bannerId) {
  return (await Banner.deleteOne({ _id: bannerId })).deletedCount === 1
}

// Posts.

export async function findPosts({
  page,
  limit,
  search,
  published,
  categoryId,
}) {
  const filter = {}

  if (search) {
    const pattern = new RegExp(escapeRegExp(search), 'i')

    filter.$or = [{ title: pattern }, { slug: pattern }]
  }
  if (published !== undefined) filter.published = published
  if (categoryId) filter.categoryId = categoryId

  const [posts, total] = await Promise.all([
    Post.find(filter)
      .sort({ publishedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-content')
      .lean(),
    Post.countDocuments(filter),
  ])

  return { posts, total }
}

export function findPostById(postId) {
  return Post.findById(postId).lean()
}

export async function createPost(post) {
  return (await Post.create(post)).toObject()
}

export function updatePost(postId, changes) {
  return Post.findByIdAndUpdate(postId, { $set: changes }, UPDATE_OPTIONS)
}

/** Deletes a post with its comments, so no thread is left without a post. */
export function deletePost(postId) {
  return mongoose.connection.transaction(async (session) => {
    const result = await Post.deleteOne({ _id: postId }, { session })

    if (result.deletedCount !== 1) return false

    await PostComment.deleteMany({ postId }, { session })

    return true
  })
}

/** Title and slug of each given post, by id. */
export async function findPostTitles(postIds) {
  const posts = await Post.find(
    { _id: { $in: postIds } },
    { title: 1, slug: 1, published: 1 },
  ).lean()

  return new Map(posts.map((post) => [String(post._id), post]))
}

export function findPostCategories() {
  return PostCategory.find().sort({ sortOrder: 1, _id: 1 }).lean()
}

export function findPostCategoryById(categoryId) {
  return PostCategory.findById(categoryId).lean()
}

export function countPostsForCategory(categoryId) {
  return Post.countDocuments({ categoryId })
}

export async function createPostCategory(category) {
  return (await PostCategory.create(category)).toObject()
}

export function updatePostCategory(categoryId, changes) {
  return PostCategory.findByIdAndUpdate(
    categoryId,
    { $set: changes },
    UPDATE_OPTIONS,
  )
}

export async function deletePostCategory(categoryId) {
  return (await PostCategory.deleteOne({ _id: categoryId })).deletedCount === 1
}

// Editable site pages have a fixed, application-defined set of slugs.
export function findPages() {
  return Page.find().sort({ slug: 1 }).lean()
}

export function updatePageBySlug(slug, changes) {
  return Page.findOneAndUpdate({ slug }, { $set: changes }, UPDATE_OPTIONS)
}

// Gallery albums.
export function findGalleries() {
  return Gallery.find().sort({ sortOrder: 1, _id: 1 }).lean()
}

export async function createGallery(gallery) {
  return (await Gallery.create(gallery)).toObject()
}

export function updateGallery(galleryId, changes) {
  return Gallery.findByIdAndUpdate(galleryId, { $set: changes }, UPDATE_OPTIONS)
}

export async function deleteGallery(galleryId) {
  return (await Gallery.deleteOne({ _id: galleryId })).deletedCount === 1
}

// Individual media entries.
export function findMedia() {
  return Media.find().sort({ sortOrder: 1, _id: 1 }).lean()
}

export async function createMedia(media) {
  return (await Media.create(media)).toObject()
}

export function updateMedia(mediaId, changes) {
  return Media.findByIdAndUpdate(mediaId, { $set: changes }, UPDATE_OPTIONS)
}

export async function deleteMedia(mediaId) {
  return (await Media.deleteOne({ _id: mediaId })).deletedCount === 1
}

// Social links.
export function findSocialLinks() {
  return SocialLink.find().sort({ sortOrder: 1, _id: 1 }).lean()
}

export async function createSocialLink(link) {
  return (await SocialLink.create(link)).toObject()
}

export function updateSocialLink(linkId, changes) {
  return SocialLink.findByIdAndUpdate(linkId, { $set: changes }, UPDATE_OPTIONS)
}

export async function deleteSocialLink(linkId) {
  return (await SocialLink.deleteOne({ _id: linkId })).deletedCount === 1
}

// Comments, newest first across every post, for moderation.

export async function findComments({ page, limit, search, postId }) {
  const filter = { deleted: false }

  if (postId) filter.postId = postId
  if (search) {
    const pattern = new RegExp(escapeRegExp(search), 'i')

    filter.$or = [{ body: pattern }, { authorName: pattern }]
  }

  const [comments, total] = await Promise.all([
    PostComment.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    PostComment.countDocuments(filter),
  ])

  return { comments, total }
}
