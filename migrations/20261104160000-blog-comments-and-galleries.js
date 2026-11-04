/**
 * What the blog post, gallery and comments pages need from the seed data:
 *
 * - post bodies, for posts that have none yet;
 * - the comments collection, with the sample comments on posts that have no
 *   comments yet, matching the counts the posts already show;
 * - titles for videos, and the extra videos and screenshots;
 * - the galleries collection with its albums.
 *
 * Anything already there is left as it is, so nothing edited since is
 * overwritten and running it twice changes nothing.
 */
import { readFile } from 'node:fs/promises'

async function readSeedData() {
  return JSON.parse(
    await readFile(
      new URL('../scripts/seed-data.json', import.meta.url),
      'utf8',
    ),
  )
}

async function addPostBodies(db, data) {
  const posts = db.collection('posts')

  for (const { slug, content } of data.posts) {
    if (!content) continue

    await posts.updateOne(
      { slug, $or: [{ content: { $exists: false } }, { content: '' }] },
      { $set: { content } },
    )
  }
}

async function addComments(db, data) {
  const comments = db.collection('post_comments')

  await comments.createIndex({ postId: 1, parentId: 1, createdAt: 1 })
  await comments.createIndex({ userId: 1 })

  const posts = db.collection('posts')

  for (const { slug, comments: threads = [] } of data.posts) {
    if (!threads.length) continue

    const post = await posts.findOne({ slug }, { projection: { _id: 1 } })

    if (!post || (await comments.findOne({ postId: post._id }))) continue

    for (const { replies, ...thread } of threads) {
      const toComment = (comment, parentId) => ({
        ...comment,
        postId: post._id,
        parentId,
        userId: null,
        edited: false,
        deleted: false,
        createdAt: new Date(comment.createdAt),
        updatedAt: new Date(comment.createdAt),
      })
      const { insertedId } = await comments.insertOne(toComment(thread, null))

      if (replies.length) {
        await comments.insertMany(
          replies.map((reply) => toComment(reply, insertedId)),
        )
      }
    }

    const count = await comments.countDocuments({
      postId: post._id,
      deleted: false,
    })

    await posts.updateOne({ _id: post._id }, { $set: { commentCount: count } })
  }
}

async function addMedia(db, data) {
  const media = db.collection('media')
  const now = new Date()

  for (const item of data.media) {
    const existing = await media.findOne({ type: item.type, url: item.url })

    if (existing) {
      if (item.title && !existing.title) {
        await media.updateOne(
          { _id: existing._id },
          { $set: { title: item.title } },
        )
      }

      continue
    }

    await media.insertOne({
      title: '',
      ...item,
      published: true,
      createdAt: now,
      updatedAt: now,
    })
  }
}

async function addGalleries(db, data) {
  const galleries = db.collection('galleries')
  const now = new Date()

  await galleries.createIndex({ slug: 1 }, { unique: true })
  await galleries.createIndex({ published: 1, sortOrder: 1 })

  for (const gallery of data.galleries) {
    await galleries.updateOne(
      { slug: gallery.slug },
      {
        $setOnInsert: {
          ...gallery,
          published: true,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    )
  }
}

/** @param db {import('mongodb').Db} */
export async function up(db) {
  const data = await readSeedData()

  await addPostBodies(db, data)
  await addComments(db, data)
  await addMedia(db, data)
  await addGalleries(db, data)
}

/**
 * Drops the comments and galleries, including any written since. Post bodies,
 * comment counts, video titles and the extra media stay: the previous version
 * shows them as it did before.
 *
 * @param db {import('mongodb').Db}
 */
export async function down(db) {
  for (const name of ['post_comments', 'galleries']) {
    const [existing] = await db
      .listCollections({ name }, { nameOnly: true })
      .toArray()

    if (existing) await db.dropCollection(name)
  }
}
