import { SocialLink } from '@models/social-link.model.js'

export function findSocialLinks() {
  return SocialLink.find()
    .sort({ sortOrder: 1, _id: 1 })
    .select('network label url')
}
