import mongoose from 'mongoose'
import { Post } from '#models/post.model.js'
import { PostComment } from '#models/post-comment.model.js'

function inTransaction(work) {
  return mongoose.connection.transaction((session) => work(session), {
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority' },
  })
}

/**
 * Sets the post's `commentCount` from its comments as they stand inside the
 * transaction. Every comment write ends with this and so also writes the
 * post: two transactions on the same post's comments conflict and MongoDB
 * retries one with the other's change visible. A reply racing the deletion
 * of the comment it answers therefore either sees it gone (and fails) or is
 * seen by the deletion (which then keeps the thread).
 */
async function recomputeCommentCount(postId, session) {
  const count = await PostComment.countDocuments(
    { postId, deleted: false },
    { session },
  )

  await Post.updateOne(
    { _id: postId },
    { $set: { commentCount: count } },
    { session },
  )
}

/** Removes a deleted first comment whose last reply is gone. */
async function pruneEmptyThread(parentId, session) {
  if (!parentId) return

  const hasReplies = await PostComment.exists({ parentId }).session(session)

  if (!hasReplies) {
    await PostComment.deleteOne({ _id: parentId, deleted: true }, { session })
  }
}

/**
 * One page of a post's threads, oldest first as a conversation reads, each
 * with all its replies.
 */
export async function findThreads({ postId, page, limit }) {
  const filter = { postId, parentId: null }
  const [threads, total] = await Promise.all([
    PostComment.find(filter)
      .sort({ createdAt: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    PostComment.countDocuments(filter),
  ])
  const replies = threads.length
    ? await PostComment.find({
        postId,
        parentId: { $in: threads.map((thread) => thread._id) },
      })
        .sort({ createdAt: 1, _id: 1 })
        .lean()
    : []

  return { threads, replies, total }
}

/**
 * Adds a comment. A reply to a reply joins the same thread. Answers `null`
 * when the comment being answered is gone or deleted.
 */
export function createComment({ postId, parentId, userId, authorName, body }) {
  return inTransaction(async (session) => {
    let threadId = null

    if (parentId) {
      const parent = await PostComment.findOne(
        { _id: parentId, postId, deleted: false },
        { parentId: 1 },
        { session },
      ).lean()

      if (!parent) return null

      threadId = parent.parentId ?? parent._id
    }

    const [created] = await PostComment.create(
      [{ postId, parentId: threadId, userId, authorName, body }],
      { session },
    )

    await recomputeCommentCount(postId, session)

    return created
  })
}

/** Answers the updated comment, or `null` if the reader has no such comment. */
export function updateUserComment({ commentId, postId, userId, body }) {
  return PostComment.findOneAndUpdate(
    { _id: commentId, postId, userId, deleted: false },
    { $set: { body, edited: true } },
    { returnDocument: 'after' },
  ).lean()
}

/**
 * Removes one comment and answers whether the reader had it. A first comment
 * with replies stays as a deleted placeholder so the thread reads on.
 */
export function deleteUserComment({ commentId, postId, userId }) {
  return removeComment({ _id: commentId, postId, userId, deleted: false })
}

/**
 * Removes any comment, as a moderator does, the same way its author would.
 * Answers the removed comment's post id, or `null` when there is none.
 */
export function deleteCommentById(commentId) {
  return removeComment({ _id: commentId, deleted: false }, { answerPost: true })
}

function removeComment(filter, { answerPost = false } = {}) {
  return inTransaction(async (session) => {
    const comment = await PostComment.findOne(
      filter,
      { parentId: 1, postId: 1 },
      { session },
    ).lean()

    if (!comment) return answerPost ? null : false

    const { postId } = comment

    const hasReplies =
      !comment.parentId &&
      (await PostComment.exists({ parentId: comment._id }).session(session))

    if (hasReplies) {
      await PostComment.updateOne(
        { _id: comment._id },
        { $set: { deleted: true, body: '', authorName: '', userId: null } },
        { session },
      )
    } else {
      await PostComment.deleteOne({ _id: comment._id }, { session })
      await pruneEmptyThread(comment.parentId, session)
    }

    await recomputeCommentCount(postId, session)

    return answerPost ? postId : true
  })
}

/**
 * Removes every comment a reader wrote, when they delete their account, the
 * same way they would one by one, and brings each post's count back in line.
 */
export function deleteAllUserComments(userId) {
  return inTransaction(async (session) => {
    const comments = await PostComment.find(
      { userId, deleted: false },
      { postId: 1, parentId: 1 },
      { session },
    ).lean()

    if (!comments.length) return 0

    const replies = comments.filter((comment) => comment.parentId)
    const firsts = comments.filter((comment) => !comment.parentId)

    await PostComment.deleteMany(
      { _id: { $in: replies.map((reply) => reply._id) } },
      { session },
    )

    for (const first of firsts) {
      const hasReplies = await PostComment.exists({
        parentId: first._id,
      }).session(session)

      if (hasReplies) {
        await PostComment.updateOne(
          { _id: first._id },
          { $set: { deleted: true, body: '', authorName: '', userId: null } },
          { session },
        )
      } else {
        await PostComment.deleteOne({ _id: first._id }, { session })
      }
    }

    const threadIds = new Set(replies.map((reply) => String(reply.parentId)))

    for (const threadId of threadIds) {
      await pruneEmptyThread(new mongoose.Types.ObjectId(threadId), session)
    }

    for (const postId of new Set(comments.map((c) => String(c.postId)))) {
      await recomputeCommentCount(new mongoose.Types.ObjectId(postId), session)
    }

    return comments.length
  })
}
