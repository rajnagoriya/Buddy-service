const item = (name, foodType, price, imageUrl, description = '') => ({
    name,
    foodType,
    price,
    imageUrl,
    description: description || `House specialty ${name.toLowerCase()}, prepared fresh to order.`,
});

const expandItems = (baseItems, count = 8) => {
    const result = [];
    for (let i = 0; i < count; i++) {
        const base = baseItems[i % baseItems.length];
        const suffix = i >= baseItems.length ? ` (${Math.floor(i / baseItems.length) + 1})` : '';
        result.push({
            ...base,
            name: `${base.name}${suffix}`,
            price: base.price + (i % 3) * 15,
        });
    }
    return result;
};

const cat = (name, foodTypeScope, imageUrl, baseItems, itemCount = 8) => ({
    name,
    foodTypeScope,
    imageUrl,
    items: expandItems(baseItems, itemCount),
});

export const CUISINE_MENUS = {
    north_indian: {
        categories: [
            cat('Tandoori Starters', 'Both', 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&auto=format&fit=crop&q=80', [
                item('Paneer Tikka', 'Veg', 249, 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&auto=format&fit=crop&q=80'),
                item('Chicken Seekh Kebab', 'Non-Veg', 299, 'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=800&auto=format&fit=crop&q=80'),
                item('Malai Tikka', 'Non-Veg', 319, 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=800&auto=format&fit=crop&q=80'),
                item('Hara Bhara Kebab', 'Veg', 219, 'https://images.unsplash.com/photo-1585937421612-70a008296f36?w=800&auto=format&fit=crop&q=80'),
            ]),
            cat('Curry Classics', 'Both', 'https://images.unsplash.com/photo-1585937421612-70a008296f36?w=800&auto=format&fit=crop&q=80', [
                item('Butter Chicken', 'Non-Veg', 329, 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&auto=format&fit=crop&q=80'),
                item('Paneer Butter Masala', 'Veg', 279, 'https://images.unsplash.com/photo-1631452180519-c014fe4bc9e4?w=800&auto=format&fit=crop&q=80'),
                item('Dal Makhani', 'Veg', 229, 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80'),
                item('Chicken Curry', 'Non-Veg', 299, 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&auto=format&fit=crop&q=80'),
            ]),
            cat('Breads & Rice', 'Veg', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=80', [
                item('Butter Naan', 'Veg', 49, 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=80'),
                item('Garlic Naan', 'Veg', 59, 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=800&auto=format&fit=crop&q=80'),
                item('Jeera Rice', 'Veg', 149, 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800&auto=format&fit=crop&q=80'),
                item('Veg Pulao', 'Veg', 179, 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800&auto=format&fit=crop&q=80'),
            ]),
            cat('Thali & Platters', 'Both', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80', [
                item('Veg Thali', 'Veg', 249, 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80'),
                item('Non-Veg Thali', 'Non-Veg', 349, 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80'),
                item('Family Feast Platter', 'Non-Veg', 799, 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Raita & Salads', 'Veg', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80', [
                item('Boondi Raita', 'Veg', 79, 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80'),
                item('Green Salad', 'Veg', 99, 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80'),
                item('Cucumber Raita', 'Veg', 69, 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('House Specials', 'Both', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80', [
                item('Chef Special Kadhai Paneer', 'Veg', 289, 'https://images.unsplash.com/photo-1631452180519-c014fe4bc9e4?w=800&auto=format&fit=crop&q=80'),
                item('Mutton Rogan Josh', 'Non-Veg', 399, 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&auto=format&fit=crop&q=80'),
            ], 8),
        ],
    },
    seafood: {
        categories: [
            cat('Grilled Fish', 'Non-Veg', 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&auto=format&fit=crop&q=80', [
                item('Grilled Pomfret', 'Non-Veg', 449, 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&auto=format&fit=crop&q=80'),
                item('Tandoori Prawns', 'Non-Veg', 499, 'https://images.unsplash.com/photo-1559847844-d7214261f2d4?w=800&auto=format&fit=crop&q=80'),
                item('Butter Garlic Fish', 'Non-Veg', 399, 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&auto=format&fit=crop&q=80'),
            ]),
            cat('Curries & Stews', 'Non-Veg', 'https://images.unsplash.com/photo-1559847844-d7214261f2d4?w=800&auto=format&fit=crop&q=80', [
                item('Goan Fish Curry', 'Non-Veg', 349, 'https://images.unsplash.com/photo-1559847844-d7214261f2d4?w=800&auto=format&fit=crop&q=80'),
                item('Malabar Prawn Curry', 'Non-Veg', 429, 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&auto=format&fit=crop&q=80'),
                item('Coastal Crab Masala', 'Non-Veg', 549, 'https://images.unsplash.com/photo-1559847844-d7214261f2d4?w=800&auto=format&fit=crop&q=80'),
            ]),
            cat('Fried & Crispy', 'Non-Veg', 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&auto=format&fit=crop&q=80', [
                item('Calamari Rings', 'Non-Veg', 299, 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&auto=format&fit=crop&q=80'),
                item('Fish Fry', 'Non-Veg', 279, 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Rice & Noodles', 'Both', 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&auto=format&fit=crop&q=80', [
                item('Prawn Fried Rice', 'Non-Veg', 289, 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800&auto=format&fit=crop&q=80'),
                item('Seafood Noodles', 'Non-Veg', 319, 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Coastal Starters', 'Non-Veg', 'https://images.unsplash.com/photo-1559847844-d7214261f2d4?w=800&auto=format&fit=crop&q=80', [
                item('Crab Lollipop', 'Non-Veg', 349, 'https://images.unsplash.com/photo-1559847844-d7214261f2d4?w=800&auto=format&fit=crop&q=80'),
                item('Fish Tikka', 'Non-Veg', 329, 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Coastal Combos', 'Non-Veg', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80', [
                item('Coastal Feast Combo', 'Non-Veg', 699, 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80'),
                item('Prawn Lover Combo', 'Non-Veg', 599, 'https://images.unsplash.com/photo-1559847844-d7214261f2d4?w=800&auto=format&fit=crop&q=80'),
            ], 8),
        ],
    },
    healthy: {
        categories: [
            cat('Fresh Salads', 'Veg', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80', [
                item('Avocado Quinoa Salad', 'Veg', 189, 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80'),
                item('Mediterranean Chickpea Salad', 'Veg', 159, 'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Healthy Bowls', 'Veg', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80', [
                item('Pesto Tofu Rice Bowl', 'Veg', 229, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80'),
                item('Spicy Buddha Bowl', 'Veg', 219, 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Fresh Juices', 'Veg', 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=800&auto=format&fit=crop&q=80', [
                item('Super Green Detox Juice', 'Veg', 129, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=800&auto=format&fit=crop&q=80'),
                item('ABC Juice', 'Veg', 119, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Smoothie Bowls', 'Veg', 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800&auto=format&fit=crop&q=80', [
                item('Berry Acai Bowl', 'Veg', 199, 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800&auto=format&fit=crop&q=80'),
                item('Mango Coconut Bowl', 'Veg', 189, 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Protein Meals', 'Veg', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80', [
                item('Grilled Paneer Protein Plate', 'Veg', 249, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80'),
                item('Tofu Power Bowl', 'Veg', 239, 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Wraps & Sandwiches', 'Veg', 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&auto=format&fit=crop&q=80', [
                item('Hummus Veg Wrap', 'Veg', 169, 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&auto=format&fit=crop&q=80'),
                item('Avocado Toast', 'Veg', 149, 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=800&auto=format&fit=crop&q=80'),
            ], 7),
        ],
    },
    italian_bakery: {
        categories: [
            cat('Signature Lasagnas', 'Both', 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800&auto=format&fit=crop&q=80', [
                item('Paneer Fusion Lasagna', 'Veg', 249, 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800&auto=format&fit=crop&q=80'),
                item('Chicken Bolognese Lasagna', 'Non-Veg', 289, 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Gourmet Mac n Cheese', 'Both', 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=800&auto=format&fit=crop&q=80', [
                item('Four Cheese Mac', 'Veg', 229, 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=800&auto=format&fit=crop&q=80'),
                item('Chicken Mac n Cheese', 'Non-Veg', 269, 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Baked Quesadillas', 'Both', 'https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?w=800&auto=format&fit=crop&q=80', [
                item('Cheese Veg Quesadilla', 'Veg', 189, 'https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?w=800&auto=format&fit=crop&q=80'),
                item('Chicken Quesadilla', 'Non-Veg', 219, 'https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Garlic Breads & Sides', 'Both', 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=800&auto=format&fit=crop&q=80', [
                item('Classic Garlic Bread', 'Veg', 119, 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=800&auto=format&fit=crop&q=80'),
                item('Chicken Cheese Garlic Bread', 'Non-Veg', 159, 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Indulgent Desserts', 'Veg', 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&auto=format&fit=crop&q=80', [
                item('Chocolate Lava Cake', 'Veg', 149, 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&auto=format&fit=crop&q=80'),
                item('Tiramisu Cup', 'Veg', 169, 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Fresh Pastries', 'Veg', 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&auto=format&fit=crop&q=80', [
                item('Croissant', 'Veg', 99, 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800&auto=format&fit=crop&q=80'),
                item('Blueberry Muffin', 'Veg', 89, 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&auto=format&fit=crop&q=80'),
            ], 7),
        ],
    },
    biryani: {
        categories: [
            cat('Hyderabadi Biryani', 'Both', 'https://images.unsplash.com/photo-1563379091339-03246963d96a?w=800&auto=format&fit=crop&q=80', [
                item('Chicken Dum Biryani', 'Non-Veg', 299, 'https://images.unsplash.com/photo-1563379091339-03246963d96a?w=800&auto=format&fit=crop&q=80'),
                item('Veg Dum Biryani', 'Veg', 249, 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800&auto=format&fit=crop&q=80'),
                item('Mutton Biryani', 'Non-Veg', 399, 'https://images.unsplash.com/photo-1563379091339-03246963d96a?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Kebabs & Sides', 'Both', 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&auto=format&fit=crop&q=80', [
                item('Galouti Kebab', 'Non-Veg', 279, 'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=800&auto=format&fit=crop&q=80'),
                item('Paneer Tikka', 'Veg', 229, 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Curries', 'Both', 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&auto=format&fit=crop&q=80', [
                item('Mirchi Ka Salan', 'Veg', 129, 'https://images.unsplash.com/photo-1631452180519-c014fe4bc9e4?w=800&auto=format&fit=crop&q=80'),
                item('Chicken Curry', 'Non-Veg', 279, 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Raita & Salads', 'Veg', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80', [
                item('Onion Raita', 'Veg', 59, 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80'),
                item('Boondi Raita', 'Veg', 69, 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Family Packs', 'Both', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80', [
                item('Family Biryani Pack', 'Non-Veg', 799, 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80'),
                item('Party Veg Biryani Pack', 'Veg', 649, 'https://images.unsplash.com/photo-1563379091339-03246963d96a?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Desserts', 'Veg', 'https://images.unsplash.com/photo-1587334207828-f5e83c4e6d61?w=800&auto=format&fit=crop&q=80', [
                item('Double Ka Meetha', 'Veg', 99, 'https://images.unsplash.com/photo-1587334207828-f5e83c4e6d61?w=800&auto=format&fit=crop&q=80'),
                item('Qubani Ka Meetha', 'Veg', 119, 'https://images.unsplash.com/photo-1587334207828-f5e83c4e6d61?w=800&auto=format&fit=crop&q=80'),
            ], 7),
        ],
    },
    punjabi: {
        categories: [
            cat('Paratha & Kulcha', 'Veg', 'https://images.unsplash.com/photo-1601050690597-df0565f50fee?w=800&auto=format&fit=crop&q=80', [
                item('Aloo Paratha', 'Veg', 89, 'https://images.unsplash.com/photo-1601050690597-df0565f50fee?w=800&auto=format&fit=crop&q=80'),
                item('Paneer Paratha', 'Veg', 109, 'https://images.unsplash.com/photo-1601050690597-df0565f50fee?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Dhaba Curries', 'Both', 'https://images.unsplash.com/photo-1585937421612-70a008296f36?w=800&auto=format&fit=crop&q=80', [
                item('Sarson Da Saag', 'Veg', 199, 'https://images.unsplash.com/photo-1585937421612-70a008296f36?w=800&auto=format&fit=crop&q=80'),
                item('Butter Chicken', 'Non-Veg', 329, 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Tandoori', 'Both', 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&auto=format&fit=crop&q=80', [
                item('Tandoori Chicken', 'Non-Veg', 349, 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&auto=format&fit=crop&q=80'),
                item('Paneer Tikka', 'Veg', 249, 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Lassi & Beverages', 'Veg', 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&auto=format&fit=crop&q=80', [
                item('Sweet Lassi', 'Veg', 79, 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&auto=format&fit=crop&q=80'),
                item('Mango Lassi', 'Veg', 99, 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Combo Meals', 'Both', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80', [
                item('Punjabi Veg Thali', 'Veg', 249, 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80'),
                item('Non-Veg Dhaba Thali', 'Non-Veg', 349, 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Snacks', 'Veg', 'https://images.unsplash.com/photo-1606491956689-2ea866880f44?w=800&auto=format&fit=crop&q=80', [
                item('Samosa (2 Pcs)', 'Veg', 49, 'https://images.unsplash.com/photo-1606491956689-2ea866880f44?w=800&auto=format&fit=crop&q=80'),
                item('Chole Bhature', 'Veg', 129, 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&auto=format&fit=crop&q=80'),
            ], 7),
        ],
    },
    south_indian: {
        categories: [
            cat('Dosas', 'Veg', 'https://images.unsplash.com/photo-1630384060420-cbbada5f5a57?w=800&auto=format&fit=crop&q=80', [
                item('Masala Dosa', 'Veg', 99, 'https://images.unsplash.com/photo-1630384060420-cbbada5f5a57?w=800&auto=format&fit=crop&q=80'),
                item('Paper Roast Dosa', 'Veg', 119, 'https://images.unsplash.com/photo-1630384060420-cbbada5f5a57?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Idli & Vada', 'Veg', 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800&auto=format&fit=crop&q=80', [
                item('Idli Sambar (3 Pcs)', 'Veg', 79, 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800&auto=format&fit=crop&q=80'),
                item('Medu Vada (2 Pcs)', 'Veg', 69, 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Chettinad Specials', 'Both', 'https://images.unsplash.com/photo-1585937421612-70a008296f36?w=800&auto=format&fit=crop&q=80', [
                item('Chettinad Chicken', 'Non-Veg', 329, 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&auto=format&fit=crop&q=80'),
                item('Mushroom Chettinad', 'Veg', 249, 'https://images.unsplash.com/photo-1631452180519-c014fe4bc9e4?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Rice Meals', 'Both', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80', [
                item('South Indian Meals', 'Veg', 199, 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80'),
                item('Curd Rice', 'Veg', 99, 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Filter Coffee', 'Veg', 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&auto=format&fit=crop&q=80', [
                item('Filter Coffee', 'Veg', 49, 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&auto=format&fit=crop&q=80'),
                item('Cold Coffee', 'Veg', 89, 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Uttapam & Appam', 'Veg', 'https://images.unsplash.com/photo-1630384060420-cbbada5f5a57?w=800&auto=format&fit=crop&q=80', [
                item('Onion Uttapam', 'Veg', 109, 'https://images.unsplash.com/photo-1630384060420-cbbada5f5a57?w=800&auto=format&fit=crop&q=80'),
                item('Appam with Stew', 'Veg', 129, 'https://images.unsplash.com/photo-1630384060420-cbbada5f5a57?w=800&auto=format&fit=crop&q=80'),
            ], 8),
        ],
    },
    street_food: {
        categories: [
            cat('Vada Pav & Burgers', 'Veg', 'https://images.unsplash.com/photo-1606491956689-2ea866880f44?w=800&auto=format&fit=crop&q=80', [
                item('Classic Vada Pav', 'Veg', 49, 'https://images.unsplash.com/photo-1606491956689-2ea866880f44?w=800&auto=format&fit=crop&q=80'),
                item('Cheese Vada Pav', 'Veg', 69, 'https://images.unsplash.com/photo-1606491956689-2ea866880f44?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Pav Bhaji & Rolls', 'Veg', 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&auto=format&fit=crop&q=80', [
                item('Pav Bhaji', 'Veg', 129, 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&auto=format&fit=crop&q=80'),
                item('Frankie Roll', 'Veg', 99, 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Chaat Corner', 'Veg', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=80', [
                item('Pani Puri (6 Pcs)', 'Veg', 59, 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=80'),
                item('Bhel Puri', 'Veg', 79, 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Sandwiches', 'Veg', 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&auto=format&fit=crop&q=80', [
                item('Bombay Masala Sandwich', 'Veg', 89, 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&auto=format&fit=crop&q=80'),
                item('Grilled Cheese Sandwich', 'Veg', 99, 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Chinese Street', 'Both', 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&auto=format&fit=crop&q=80', [
                item('Veg Manchurian', 'Veg', 149, 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&auto=format&fit=crop&q=80'),
                item('Chicken Lollipop', 'Non-Veg', 199, 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Shakes & Coolers', 'Veg', 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=800&auto=format&fit=crop&q=80', [
                item('Mango Shake', 'Veg', 99, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=800&auto=format&fit=crop&q=80'),
                item('Chocolate Shake', 'Veg', 109, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=800&auto=format&fit=crop&q=80'),
            ], 7),
        ],
    },
    mughlai: {
        categories: [
            cat('Kebabs & Tikka', 'Non-Veg', 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&auto=format&fit=crop&q=80', [
                item('Seekh Kebab', 'Non-Veg', 299, 'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=800&auto=format&fit=crop&q=80'),
                item('Galouti Kebab', 'Non-Veg', 329, 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Mughlai Curries', 'Both', 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&auto=format&fit=crop&q=80', [
                item('Nihari', 'Non-Veg', 399, 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&auto=format&fit=crop&q=80'),
                item('Paneer Korma', 'Veg', 279, 'https://images.unsplash.com/photo-1631452180519-c014fe4bc9e4?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Biryani & Rice', 'Both', 'https://images.unsplash.com/photo-1563379091339-03246963d96a?w=800&auto=format&fit=crop&q=80', [
                item('Lucknowi Biryani', 'Non-Veg', 349, 'https://images.unsplash.com/photo-1563379091339-03246963d96a?w=800&auto=format&fit=crop&q=80'),
                item('Veg Pulao', 'Veg', 199, 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Breads', 'Veg', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=80', [
                item('Roomali Roti', 'Veg', 39, 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=80'),
                item('Sheermal', 'Veg', 59, 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Royal Platters', 'Non-Veg', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80', [
                item('Royal Kebab Platter', 'Non-Veg', 699, 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80'),
                item('Family Mughlai Feast', 'Non-Veg', 999, 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Desserts', 'Veg', 'https://images.unsplash.com/photo-1587334207828-f5e83c4e6d61?w=800&auto=format&fit=crop&q=80', [
                item('Shahi Tukda', 'Veg', 129, 'https://images.unsplash.com/photo-1587334207828-f5e83c4e6d61?w=800&auto=format&fit=crop&q=80'),
                item('Phirni', 'Veg', 99, 'https://images.unsplash.com/photo-1587334207828-f5e83c4e6d61?w=800&auto=format&fit=crop&q=80'),
            ], 7),
        ],
    },
    pizza: {
        categories: [
            cat('Classic Pizzas', 'Both', 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&auto=format&fit=crop&q=80', [
                item('Margherita', 'Veg', 199, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&auto=format&fit=crop&q=80'),
                item('Farmhouse Veg', 'Veg', 249, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&auto=format&fit=crop&q=80'),
                item('Chicken Supreme', 'Non-Veg', 299, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Gourmet Pizzas', 'Both', 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=80', [
                item('Truffle Mushroom', 'Veg', 349, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=80'),
                item('BBQ Chicken', 'Non-Veg', 329, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Pastas', 'Both', 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&auto=format&fit=crop&q=80', [
                item('Alfredo Pasta', 'Veg', 229, 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&auto=format&fit=crop&q=80'),
                item('Chicken Arrabiata', 'Non-Veg', 269, 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Garlic Bread', 'Veg', 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=800&auto=format&fit=crop&q=80', [
                item('Cheese Garlic Bread', 'Veg', 149, 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=800&auto=format&fit=crop&q=80'),
                item('Stuffed Garlic Bread', 'Veg', 179, 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Salads', 'Veg', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80', [
                item('Caesar Salad', 'Veg', 199, 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80'),
                item('Greek Salad', 'Veg', 219, 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Desserts', 'Veg', 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&auto=format&fit=crop&q=80', [
                item('Choco Lava Cake', 'Veg', 149, 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&auto=format&fit=crop&q=80'),
                item('Tiramisu', 'Veg', 179, 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800&auto=format&fit=crop&q=80'),
            ], 8),
        ],
    },
    chinese: {
        categories: [
            cat('Noodles', 'Both', 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&auto=format&fit=crop&q=80', [
                item('Veg Hakka Noodles', 'Veg', 179, 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&auto=format&fit=crop&q=80'),
                item('Chicken Chow Mein', 'Non-Veg', 219, 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Fried Rice', 'Both', 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800&auto=format&fit=crop&q=80', [
                item('Veg Fried Rice', 'Veg', 169, 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800&auto=format&fit=crop&q=80'),
                item('Chicken Fried Rice', 'Non-Veg', 199, 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Manchurian & Starters', 'Both', 'https://images.unsplash.com/photo-1617098059517-087037d5c4d4?w=800&auto=format&fit=crop&q=80', [
                item('Veg Manchurian', 'Veg', 189, 'https://images.unsplash.com/photo-1617098059517-087037d5c4d4?w=800&auto=format&fit=crop&q=80'),
                item('Chicken Lollipop', 'Non-Veg', 229, 'https://images.unsplash.com/photo-1617098059517-087037d5c4d4?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Soups', 'Both', 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&auto=format&fit=crop&q=80', [
                item('Hot & Sour Soup', 'Veg', 129, 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&auto=format&fit=crop&q=80'),
                item('Chicken Clear Soup', 'Non-Veg', 149, 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Main Course', 'Both', 'https://images.unsplash.com/photo-1582878826629-29ae7a0613d5?w=800&auto=format&fit=crop&q=80', [
                item('Kung Pao Paneer', 'Veg', 249, 'https://images.unsplash.com/photo-1582878826629-29ae7a0613d5?w=800&auto=format&fit=crop&q=80'),
                item('Chilli Chicken', 'Non-Veg', 279, 'https://images.unsplash.com/photo-1582878826629-29ae7a0613d5?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Combo Meals', 'Both', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80', [
                item('Veg Chinese Combo', 'Veg', 299, 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80'),
                item('Non-Veg Chinese Combo', 'Non-Veg', 349, 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80'),
            ], 7),
        ],
    },
    kerala: {
        categories: [
            cat('Fish Curries', 'Non-Veg', 'https://images.unsplash.com/photo-1559847844-d7214261f2d4?w=800&auto=format&fit=crop&q=80', [
                item('Kerala Fish Curry', 'Non-Veg', 349, 'https://images.unsplash.com/photo-1559847844-d7214261f2d4?w=800&auto=format&fit=crop&q=80'),
                item('Meen Pollichathu', 'Non-Veg', 399, 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Appam & Stew', 'Both', 'https://images.unsplash.com/photo-1630384060420-cbbada5f5a57?w=800&auto=format&fit=crop&q=80', [
                item('Appam with Veg Stew', 'Veg', 149, 'https://images.unsplash.com/photo-1630384060420-cbbada5f5a57?w=800&auto=format&fit=crop&q=80'),
                item('Appam with Chicken Stew', 'Non-Veg', 199, 'https://images.unsplash.com/photo-1630384060420-cbbada5f5a57?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Sadya Specials', 'Veg', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80', [
                item('Kerala Sadya Meal', 'Veg', 299, 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80'),
                item('Avial', 'Veg', 129, 'https://images.unsplash.com/photo-1585937421612-70a008296f36?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Beef & Chicken', 'Non-Veg', 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&auto=format&fit=crop&q=80', [
                item('Kerala Beef Fry', 'Non-Veg', 329, 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&auto=format&fit=crop&q=80'),
                item('Chicken Roast', 'Non-Veg', 299, 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Puttu & Kadala', 'Veg', 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800&auto=format&fit=crop&q=80', [
                item('Puttu Kadala Curry', 'Veg', 119, 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800&auto=format&fit=crop&q=80'),
                item('Idiyappam with Curry', 'Veg', 129, 'https://images.unsplash.com/photo-1630384060420-cbbada5f5a57?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Payasam & Desserts', 'Veg', 'https://images.unsplash.com/photo-1587334207828-f5e83c4e6d61?w=800&auto=format&fit=crop&q=80', [
                item('Ada Pradhaman', 'Veg', 99, 'https://images.unsplash.com/photo-1587334207828-f5e83c4e6d61?w=800&auto=format&fit=crop&q=80'),
                item('Palada Payasam', 'Veg', 89, 'https://images.unsplash.com/photo-1587334207828-f5e83c4e6d61?w=800&auto=format&fit=crop&q=80'),
            ], 8),
        ],
    },
    rajasthani: {
        categories: [
            cat('Dal Baati & Churma', 'Veg', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80', [
                item('Dal Baati Churma', 'Veg', 249, 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80'),
                item('Gatte Ki Sabzi', 'Veg', 199, 'https://images.unsplash.com/photo-1585937421612-70a008296f36?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Rajasthani Thali', 'Veg', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80', [
                item('Royal Veg Thali', 'Veg', 299, 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80'),
                item('Mini Thali', 'Veg', 199, 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Snacks & Chaat', 'Veg', 'https://images.unsplash.com/photo-1606491956689-2ea866880f44?w=800&auto=format&fit=crop&q=80', [
                item('Pyaaz Kachori', 'Veg', 49, 'https://images.unsplash.com/photo-1606491956689-2ea866880f44?w=800&auto=format&fit=crop&q=80'),
                item('Mirchi Bada', 'Veg', 39, 'https://images.unsplash.com/photo-1606491956689-2ea866880f44?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Curries', 'Veg', 'https://images.unsplash.com/photo-1631452180519-c014fe4bc9e4?w=800&auto=format&fit=crop&q=80', [
                item('Ker Sangri', 'Veg', 219, 'https://images.unsplash.com/photo-1631452180519-c014fe4bc9e4?w=800&auto=format&fit=crop&q=80'),
                item('Panchmel Dal', 'Veg', 179, 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Breads', 'Veg', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=80', [
                item('Missi Roti', 'Veg', 49, 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=80'),
                item('Bajra Roti', 'Veg', 39, 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Sweets', 'Veg', 'https://images.unsplash.com/photo-1587334207828-f5e83c4e6d61?w=800&auto=format&fit=crop&q=80', [
                item('Ghevar', 'Veg', 129, 'https://images.unsplash.com/photo-1587334207828-f5e83c4e6d61?w=800&auto=format&fit=crop&q=80'),
                item('Malpua', 'Veg', 99, 'https://images.unsplash.com/photo-1587334207828-f5e83c4e6d61?w=800&auto=format&fit=crop&q=80'),
            ], 8),
        ],
    },
    cafe: {
        categories: [
            cat('Coffee & Espresso', 'Veg', 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&auto=format&fit=crop&q=80', [
                item('Cappuccino', 'Veg', 149, 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&auto=format&fit=crop&q=80'),
                item('Cold Brew', 'Veg', 169, 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Tea & Infusions', 'Veg', 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&auto=format&fit=crop&q=80', [
                item('Masala Chai', 'Veg', 79, 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&auto=format&fit=crop&q=80'),
                item('Green Tea', 'Veg', 89, 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Sandwiches & Toast', 'Veg', 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&auto=format&fit=crop&q=80', [
                item('Club Sandwich', 'Veg', 179, 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&auto=format&fit=crop&q=80'),
                item('Avocado Toast', 'Veg', 199, 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Pastries & Cakes', 'Veg', 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&auto=format&fit=crop&q=80', [
                item('Red Velvet Slice', 'Veg', 129, 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&auto=format&fit=crop&q=80'),
                item('Chocolate Mousse', 'Veg', 149, 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Breakfast', 'Veg', 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&auto=format&fit=crop&q=80', [
                item('English Breakfast', 'Veg', 249, 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&auto=format&fit=crop&q=80'),
                item('Pancakes Stack', 'Veg', 199, 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Smoothies', 'Veg', 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=800&auto=format&fit=crop&q=80', [
                item('Berry Blast Smoothie', 'Veg', 169, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=800&auto=format&fit=crop&q=80'),
                item('Mango Smoothie', 'Veg', 159, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=800&auto=format&fit=crop&q=80'),
            ], 8),
        ],
    },
    pan_asian: {
        categories: [
            cat('Sushi & Rolls', 'Both', 'https://images.unsplash.com/photo-1617098059517-087037d5c4d4?w=800&auto=format&fit=crop&q=80', [
                item('California Roll', 'Veg', 299, 'https://images.unsplash.com/photo-1617098059517-087037d5c4d4?w=800&auto=format&fit=crop&q=80'),
                item('Salmon Avocado Roll', 'Non-Veg', 399, 'https://images.unsplash.com/photo-1617098059517-087037d5c4d4?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Ramen & Soups', 'Both', 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&auto=format&fit=crop&q=80', [
                item('Veg Ramen Bowl', 'Veg', 279, 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&auto=format&fit=crop&q=80'),
                item('Chicken Ramen', 'Non-Veg', 329, 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Bowls', 'Both', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80', [
                item('Teriyaki Tofu Bowl', 'Veg', 249, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80'),
                item('Korean BBQ Chicken Bowl', 'Non-Veg', 299, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Dim Sum', 'Both', 'https://images.unsplash.com/photo-1582878826629-29ae7a0613d5?w=800&auto=format&fit=crop&q=80', [
                item('Veg Dumplings', 'Veg', 199, 'https://images.unsplash.com/photo-1582878826629-29ae7a0613d5?w=800&auto=format&fit=crop&q=80'),
                item('Chicken Dim Sum', 'Non-Veg', 229, 'https://images.unsplash.com/photo-1582878826629-29ae7a0613d5?w=800&auto=format&fit=crop&q=80'),
            ], 7),
            cat('Stir Fry', 'Both', 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&auto=format&fit=crop&q=80', [
                item('Thai Basil Tofu', 'Veg', 239, 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&auto=format&fit=crop&q=80'),
                item('Kung Pao Chicken', 'Non-Veg', 269, 'https://images.unsplash.com/photo-1582878826629-29ae7a0613d5?w=800&auto=format&fit=crop&q=80'),
            ], 8),
            cat('Desserts', 'Veg', 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&auto=format&fit=crop&q=80', [
                item('Mochi Ice Cream', 'Veg', 149, 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&auto=format&fit=crop&q=80'),
                item('Matcha Cheesecake', 'Veg', 179, 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&auto=format&fit=crop&q=80'),
            ], 7),
        ],
    },
};

export const getMenuForCuisine = (cuisineKey) => {
    const menu = CUISINE_MENUS[cuisineKey];
    if (!menu) {
        return CUISINE_MENUS.north_indian;
    }
    return menu;
};
