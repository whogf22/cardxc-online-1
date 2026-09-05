/**
 * Customer testimonials.
 *
 * COMPLIANCE: Testimonials must be genuine, verifiable, and used with the
 * customer's consent. Fabricated or unsubstantiated reviews violate the FTC Act
 * (15 U.S.C. 45) and the FTC Rule on the Use of Consumer Reviews and Testimonials
 * (16 CFR Part 465).
 *
 * This array is intentionally empty until real, consented testimonials are
 * collected. Do NOT add invented names, photos, quotes, or ratings.
 * [BUSINESS: supply real customer testimonials with written consent before enabling.]
 */

export interface Testimonial {
  name: string;
  location: string;
  review: string;
  image?: string;
}

export const testimonials: Testimonial[] = [];
