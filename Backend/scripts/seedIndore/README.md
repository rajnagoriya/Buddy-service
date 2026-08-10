# Indore seed data

Seven fully-onboarded, admin-approved restaurants across real Indore
neighbourhoods, with categories, menu items (variant ladders included), addons,
outlet timings, wallets and commission rules.

Every restaurant lands in the exact state it would reach after
`register → onboarding step 1/2/3 → submit → admin approve`, so **no onboarding
field has to be filled in by hand** before testing.

## Run

```bash
npm run seed:indore          # create / re-seed
npm run seed:indore:clean    # wipe seed data first, then create
npm run seed:indore:fast     # same, but skip image probing + Cloudinary upload
npm run seed:indore:wipe     # remove seed data only
```

Flags (when calling `node scripts/seedIndore/seedIndore.js` directly):

| Flag | Effect |
| --- | --- |
| `--clean` | Delete all seed restaurants and their data before seeding |
| `--wipe-only` | Delete only; create nothing |
| `--skip-existing` | Leave already-seeded restaurants untouched |
| `--offline-images` | Skip URL probing and Cloudinary upload (fast local runs) |

Requires `MONGODB_URI` (or `MONGO_URI` / `SEED_MONGODB_URI`) in `Backend/.env`.
`CLOUDINARY_*` is optional — when set, every image is mirrored into Cloudinary so
seeded records behave like real uploads (`publicId` present, deletable).

## What gets seeded

| # | Restaurant | Area | Diet | Hours | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Sarafa Chaat Junction | Sarafa Bazar | veg | 16:00–23:59 | Evening-only, no GST |
| 2 | Vijay Nagar Tandoor House | Vijay Nagar | mixed | 11:00–23:00 | GST registered, dining on |
| 3 | Guru Kripa Poha Jalebi | New Palasia | veg | 07:00–21:00 | Breakfast-led |
| 4 | Bhawarkuan Biryani Adda | Bhawarkuan | non_veg | 11:00–23:00 | GST registered |
| 5 | Nipania Pizza & Pasta Co. | Nipania | mixed | 11:00–23:00 | GST registered, cafe dining |
| 6 | Saket Wok House | Saket Nagar | mixed | 11:00–23:00 | **Closed Mondays** |
| 7 | Rau Punjabi Rasoi | Rau | veg | 11:00–23:00 | Largest dining capacity |

Roughly **175 menu items** across **35 categories**, with **~274 variants** and
**45 addons**.

Owner phones are `9111100001 … 9111100007` in the order above — deliberately
distinct from `scripts/seedRestaurantOnboarding` (`98100000xx`) so both suites
can share a database. Log in via
`POST /api/v1/auth/restaurant/request-otp` → `verify-otp`.

Also created: the **Indore City** service zone (a polygon that contains all seven
pins) and eight admin/global categories.

## Files

| File | Contents |
| --- | --- |
| `seedIndore.js` | Orchestrator — validation, cleanup, writes |
| `restaurants.data.js` | The 7 restaurant profiles (address, compliance, bank, hours) |
| `menu.data.js` | Categories + items per restaurant |
| `menu.builders.js` | `item()` / `category()` / variant presets — encodes the API's rules |
| `addons.data.js` | Addons per restaurant |
| `globalCategories.data.js` | Admin categories + which restaurant category maps to each |
| `zones.data.js` | Indore City service-zone polygon |
| `config.js` | Phones, city, timing presets, fallback images |
| `helpers.js` | Image resolution/upload, timing shapes, Mongo URI |

## The rules this data respects

These are enforced by `menu.builders.js` and re-checked by
`assertProfilesAreConsistent()` before anything is written.

**Variants** — `src/modules/food/admin/services/foodVariant.service.js`

- A variant needs a non-empty `name` and a `price > 0`.
- When an item has variants, its `price` column is the *display* price and must
  equal `min(variant.price)`. `getFoodDisplayPrice()` computes exactly that, and
  every restaurant/admin write path recomputes it — so the builders derive it
  rather than letting the data files hand-type it.
- Variant prices must be **distinct within an item**. Reorder and legacy carts
  fall back to matching a variant by price when no `variantId` is sent
  (`order-pricing.service.js`), and duplicate prices make that ambiguous.

Presets available: `V.halfFull`, `V.portions`, `V.biryani`, `V.pizza`,
`V.pieces`, `V.glass`, `V.weight`.

**Restaurants**

- A `dietaryType: 'veg'` restaurant must not carry a single `Non-Veg` item — the
  user app trusts `pureVegRestaurant` when filtering. Validated per restaurant.
- Every pin must fall inside its zone polygon, or the real onboarding flow would
  have rejected it (`isPointInPolygon` in `restaurantCreation.service.js`).
- `onboarding.step1/2/3` mirrors the exact shape `saveOnboardingStep()` writes —
  including `zoneId`, the day-keyed `outletTimings` map, and the
  `pan` / `gst` / `fssai` / `bank` blocks with their document images — so the
  onboarding screens rehydrate with every field already answered.

**Categories**

- `foodTypeScope` is derived from the items it holds, never hand-typed.
- Categories with a `restaurantId` are private; the ones in
  `globalCategories.data.js` are admin-owned and shared. An admin category only
  resolves to restaurants when `FoodItem` docs point at it, so
  `GLOBAL_CATEGORY_MAP` files one real category per restaurant under a shared
  category instead of duplicating items.

**Images**

Each item names a curated image. At seed time the URL is probed; if it does not
respond with an image, the seeder falls back to the default for that item's
`tag` (`curry`, `pizza`, `beverage`, …) in `config.js`, then to a global
placeholder. The run summary reports how many of each were used.
