/** Admin/global categories — no restaurantId; visible to all approved restaurants. */
export const GLOBAL_CATEGORIES = [
    {
        name: 'Beverages',
        foodTypeScope: 'Veg',
        type: 'global',
        sortOrder: 1,
        imageUrl: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=800&auto=format&fit=crop&q=80',
    },
    {
        name: 'Desserts',
        foodTypeScope: 'Veg',
        type: 'global',
        sortOrder: 2,
        imageUrl: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&auto=format&fit=crop&q=80',
    },
    {
        name: 'Combos & Meals',
        foodTypeScope: 'Both',
        type: 'global',
        sortOrder: 3,
        imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80',
    },
    {
        name: 'Sides & Extras',
        foodTypeScope: 'Both',
        type: 'global',
        sortOrder: 4,
        imageUrl: 'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=800&auto=format&fit=crop&q=80',
    },
    {
        name: 'Breakfast Specials',
        foodTypeScope: 'Both',
        type: 'global',
        sortOrder: 5,
        imageUrl: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&auto=format&fit=crop&q=80',
    },
    {
        name: 'Jain Friendly',
        foodTypeScope: 'Veg',
        type: 'global',
        sortOrder: 6,
        imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80',
    },
];

export const GLOBAL_MENU_ITEMS = {
    Beverages: [
        { name: 'Fresh Lime Soda', foodType: 'Veg', price: 79, imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=800&auto=format&fit=crop&q=80' },
        { name: 'Masala Chai', foodType: 'Veg', price: 49, imageUrl: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&auto=format&fit=crop&q=80' },
    ],
    Desserts: [
        { name: 'Gulab Jamun (2 Pcs)', foodType: 'Veg', price: 89, imageUrl: 'https://images.unsplash.com/photo-1587334207828-f5e83c4e6d61?w=800&auto=format&fit=crop&q=80' },
        { name: 'Chocolate Brownie', foodType: 'Veg', price: 129, imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&auto=format&fit=crop&q=80' },
    ],
    'Combos & Meals': [
        { name: 'Chef Special Thali', foodType: 'Veg', price: 249, imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80' },
        { name: 'Family Feast Combo', foodType: 'Non-Veg', price: 599, imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80' },
    ],
};
