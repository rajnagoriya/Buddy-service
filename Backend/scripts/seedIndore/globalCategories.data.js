/**
 * Admin/global food categories — FoodCategory docs with no `restaurantId`.
 *
 * These are the tiles the user app shows on the food home screen. A tile only
 * resolves to restaurants when FoodItem docs point at it (see
 * search.service.js → searchUnified, categoryId branch), so GLOBAL_CATEGORY_MAP
 * files one real category per restaurant under a shared admin category instead
 * of creating duplicate items.
 *
 * listRestaurantCategories() returns global categories alongside a restaurant's
 * own, so these still show up correctly in the restaurant dashboard.
 */
export const GLOBAL_CATEGORIES = [
    {
        key: 'biryani',
        name: 'Biryani',
        foodTypeScope: 'Both',
        sortOrder: 1,
        imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80',
        tag: 'biryani',
    },
    {
        key: 'pizza',
        name: 'Pizza',
        foodTypeScope: 'Both',
        sortOrder: 2,
        imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=80',
        tag: 'pizza',
    },
    {
        key: 'chinese_momos',
        name: 'Chinese & Momos',
        foodTypeScope: 'Both',
        sortOrder: 3,
        imageUrl: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&auto=format&fit=crop&q=80',
        tag: 'momo',
    },
    {
        key: 'chaat_street',
        name: 'Chaat & Street Food',
        foodTypeScope: 'Veg',
        sortOrder: 4,
        imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&auto=format&fit=crop&q=80',
        tag: 'chaat',
    },
    {
        key: 'thali_meals',
        name: 'Thali & Meals',
        foodTypeScope: 'Both',
        sortOrder: 5,
        imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80',
        tag: 'thali',
    },
    {
        key: 'breakfast',
        name: 'Breakfast',
        foodTypeScope: 'Veg',
        sortOrder: 6,
        imageUrl: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&auto=format&fit=crop&q=80',
        tag: 'breakfast',
    },
    {
        key: 'desserts_sweets',
        name: 'Desserts & Sweets',
        foodTypeScope: 'Veg',
        sortOrder: 7,
        imageUrl: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&auto=format&fit=crop&q=80',
        tag: 'dessert',
    },
    {
        key: 'beverages',
        name: 'Beverages',
        foodTypeScope: 'Veg',
        sortOrder: 8,
        imageUrl: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=800&auto=format&fit=crop&q=80',
        tag: 'beverage',
    },
];

/**
 * menuKey → { <restaurant category name>: <global category key> }
 *
 * Items in a mapped category are created against the shared admin category, so
 * every global tile above resolves to at least one Indore restaurant.
 * Categories not listed here stay private to the restaurant.
 */
export const GLOBAL_CATEGORY_MAP = {
    sarafa_chaat: {
        'Indori Chaat': 'chaat_street',
        'Sarafa Special Sweets': 'desserts_sweets',
    },
    vijay_nagar_tandoor: {
        'Rice & Biryani': 'biryani',
    },
    guru_kripa_breakfast: {
        'Indori Breakfast': 'breakfast',
    },
    bhawarkuan_biryani: {
        'Signature Biryani': 'biryani',
    },
    nipania_pizza: {
        'Wood Fired Pizzas': 'pizza',
    },
    saket_wok: {
        'Momos Station': 'chinese_momos',
    },
    rau_punjabi: {
        'Thali Specials': 'thali_meals',
        'Lassi & Sweets': 'beverages',
    },
};
