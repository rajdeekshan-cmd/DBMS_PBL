/*
 * Image slots. The site renders typographic chrome plates until you add photos.
 * Drop files into frontend/public/media/ and map them here; nothing else changes.
 *
 * vehicles: key = registration number (exact, as in the database)
 *   e.g. MH12XY1111: '/media/skoda-superb.jpg'      (recommended 1600 x 1000, landscape)
 * branches: key = city
 *   e.g. Mumbai: '/media/mumbai.jpg'                 (recommended 1400 x 900)
 * hero: '/media/hero.jpg'                            (recommended 2000 x 1300)
 */
export const media = {
  hero: null,
  vehicles: {},
  branches: {},
}

export const vehicleImage = (v) => (v && media.vehicles[v.registration_no]) || null
export const branchImage = (city) => media.branches[city] || null
