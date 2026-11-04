import mongoose from 'mongoose'
import { publicJsonPlugin } from './plugins/public-json.plugin.js'

/**
 * A reader's comment on a blog post. Threads are one level deep: `parentId`
 * is null for a comment on the post and names the thread's first comment for
 * every reply, however deep the reply was written.
 *
 * `userId` is set for comments written on the site; the seeded samples have
 * none. `authorName` is the display name at the time of writing.
 *
 * A first comment that still has replies is not removed when deleted, so the
 * replies keep their context: it is marked `deleted` and its text and author
 * are cleared. The post's `commentCount` counts comments not deleted.
 */
const postCommentSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PostComment',
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    authorName: { type: String, default: '', trim: true },
    body: { type: String, default: '' },
    edited: { type: Boolean, default: false },
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'post_comments' },
)

postCommentSchema.index({ postId: 1, parentId: 1, createdAt: 1 })
postCommentSchema.index({ userId: 1 })
postCommentSchema.plugin(publicJsonPlugin)

export const PostComment = mongoose.model('PostComment', postCommentSchema)
