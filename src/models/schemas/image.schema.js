import mongoose from 'mongoose'

/**
 * One canonical URL per image. Responsive variants are derived by the image CDN
 * from transformation parameters in the URL, so no per-size fields are stored.
 */
export const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    alt: { type: String, required: true },
  },
  { _id: false },
)
