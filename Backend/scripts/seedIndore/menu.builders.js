/**
 * Builders that encode the platform's menu/variant rules so the data files
 * below can never drift from what the API enforces.
 *
 * VARIANT RULES (see src/modules/food/admin/services/foodVariant.service.js and
 * src/modules/food/orders/services/order-pricing.service.js):
 *
 *   1. A variant needs a non-empty `name` and a `price` strictly greater than 0.
 *   2. When an item has variants, its `price` column is the DISPLAY price and
 *      must equal min(variant.price) — getFoodDisplayPrice() computes exactly
 *      that, and the restaurant/admin update paths recompute it on every write.
 *      We derive it here instead of hand-typing it.
 *   3. Variant prices must be DISTINCT within an item. Reorder and legacy carts
 *      fall back to matching a variant by price when no variantId is sent
 *      (order-pricing.service.js), so duplicate prices make that match ambiguous.
 *   4. `unit` is free text shown next to the variant name in the UI.
 */

/** Round to the nearest ₹10 so seeded menus read like real price boards. */
const roundPrice = (value) => Math.max(10, Math.round(value / 10) * 10);

/**
 * Enforce rule 3 by nudging any collision upward — keeps authored prices
 * intact in the normal case, and guarantees distinctness in the edge case.
 */
const withDistinctPrices = (variants) => {
    const seen = new Set();
    return variants.map((variant) => {
        let price = variant.price;
        while (seen.has(price)) price += 10;
        seen.add(price);
        return { ...variant, price };
    });
};

/* ------------------------------------------------------------------ *
 * Variant presets — one per real-world sizing convention.
 * Each takes the entry-level price and returns the full ladder.
 * ------------------------------------------------------------------ */
export const V = {
    /** Indian curry/sabzi convention. */
    halfFull: (base) =>
        withDistinctPrices([
            { name: 'Half', price: roundPrice(base), unit: 'Plate' },
            { name: 'Full', price: roundPrice(base * 1.75), unit: 'Plate' },
        ]),

    /** Generic three-step portion ladder. */
    portions: (base) =>
        withDistinctPrices([
            { name: 'Regular', price: roundPrice(base), unit: 'Portion' },
            { name: 'Medium', price: roundPrice(base * 1.4), unit: 'Portion' },
            { name: 'Large', price: roundPrice(base * 1.85), unit: 'Portion' },
        ]),

    /** Biryani handi sizing. */
    biryani: (base) =>
        withDistinctPrices([
            { name: 'Single', price: roundPrice(base), unit: 'Serves 1' },
            { name: 'Sharing', price: roundPrice(base * 1.8), unit: 'Serves 2' },
            { name: 'Family Pack', price: roundPrice(base * 3.2), unit: 'Serves 4' },
        ]),

    /** Wood-fired pizza diameters. */
    pizza: (base) =>
        withDistinctPrices([
            { name: 'Small', price: roundPrice(base), unit: '7 inch' },
            { name: 'Medium', price: roundPrice(base * 1.6), unit: '10 inch' },
            { name: 'Large', price: roundPrice(base * 2.3), unit: '13 inch' },
        ]),

    /** Countable items: momos, kebabs, puris. */
    pieces: (base, counts = [6, 10]) =>
        withDistinctPrices(
            counts.map((count, i) => ({
                name: `${count} Pcs`,
                price: roundPrice(base * (i === 0 ? 1 : count / counts[0])),
                unit: 'Pieces',
            })),
        ),

    /** Glass sizes for shakes, lassi and juices. */
    glass: (base) =>
        withDistinctPrices([
            { name: 'Regular', price: roundPrice(base), unit: '300 ml' },
            { name: 'Large', price: roundPrice(base * 1.5), unit: '500 ml' },
        ]),

    /** Sweets sold by weight. */
    weight: (base) =>
        withDistinctPrices([
            { name: '250 gm', price: roundPrice(base), unit: '250 gm' },
            { name: '500 gm', price: roundPrice(base * 1.9), unit: '500 gm' },
            { name: '1 Kg', price: roundPrice(base * 3.6), unit: '1 Kg' },
        ]),
};

/**
 * Build one menu item.
 *
 * @param {object}   def
 * @param {string}   def.name
 * @param {'Veg'|'Non-Veg'} def.foodType
 * @param {number}   def.price        Base price. Ignored when `variants` is given
 *                                   (display price is derived from the ladder).
 * @param {Array}    [def.variants]   Output of a V.* preset.
 * @param {string}   def.tag          Fallback-image family (see config.DEFAULT_IMAGES).
 * @param {string}   [def.image]      Curated image URL.
 * @param {string}   def.description
 * @param {string}   [def.prepTime]
 * @param {boolean}  [def.isAvailable] Defaults true; set false to seed a sold-out item.
 */
export const item = ({
    name,
    foodType,
    price,
    variants = [],
    tag = 'category',
    image = '',
    description,
    prepTime = '15-20 mins',
    isAvailable = true,
}) => {
    if (!name) throw new Error('Menu item requires a name');
    if (!['Veg', 'Non-Veg'].includes(foodType)) {
        throw new Error(`Menu item "${name}" has invalid foodType "${foodType}"`);
    }

    const hasVariants = Array.isArray(variants) && variants.length > 0;
    // Rule 2: display price is min(variant price) whenever a ladder exists.
    const displayPrice = hasVariants
        ? Math.min(...variants.map((v) => Number(v.price)))
        : Number(price);

    if (!Number.isFinite(displayPrice) || displayPrice <= 0) {
        throw new Error(`Menu item "${name}" resolved to an invalid price`);
    }

    return {
        name,
        foodType,
        price: displayPrice,
        variants: hasVariants ? variants : [],
        tag,
        image,
        description: description || `${name} — prepared fresh to order.`,
        prepTime,
        isAvailable,
    };
};

/**
 * Build one restaurant-owned category.
 *
 * `foodTypeScope` is derived from the items so a "Both" category can never
 * contain only-veg items (and vice versa) — the admin UI filters on this field.
 */
export const category = ({ name, image = '', tag = 'category', items = [], foodTypeScope }) => {
    if (!items.length) throw new Error(`Category "${name}" has no items`);

    const hasVeg = items.some((i) => i.foodType === 'Veg');
    const hasNonVeg = items.some((i) => i.foodType === 'Non-Veg');
    const derivedScope = hasVeg && hasNonVeg ? 'Both' : hasVeg ? 'Veg' : 'Non-Veg';

    return {
        name,
        image,
        tag,
        items,
        foodTypeScope: foodTypeScope || derivedScope,
    };
};
