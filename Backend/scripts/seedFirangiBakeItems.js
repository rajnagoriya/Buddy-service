import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { FoodRestaurant } from '../src/modules/food/restaurant/models/restaurant.model.js';
import { FoodCategory } from '../src/modules/food/admin/models/category.model.js';
import { FoodItem } from '../src/modules/food/admin/models/food.model.js';
import { FoodAddon } from '../src/modules/food/restaurant/models/foodAddon.model.js';

dotenv.config({ path: './Backend/.env' });

async function run() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        throw new Error('MONGODB_URI is not set in environment');
    }
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // Look up the restaurant by phone number
    const ownerPhone = '9810000026';
    const restaurant = await FoodRestaurant.findOne({
        $or: [
            { ownerPhone },
            { ownerPhoneDigits: ownerPhone },
            { ownerPhoneLast10: ownerPhone.slice(-10) },
            { primaryContactNumber: ownerPhone }
        ]
    }).lean();

    if (!restaurant) {
        throw new Error(`Restaurant with phone number ${ownerPhone} not found. Please register the restaurant first.`);
    }

    const restaurantId = restaurant._id;
    const zoneId = restaurant.zoneId;

    console.log(`Found restaurant: ${restaurant.restaurantName} (ID: ${restaurantId})`);

    // Clean up existing data for this restaurant to ensure a clean slate
    console.log('Cleaning up existing categories, food items, and addons for this restaurant...');
    await FoodCategory.deleteMany({
        $or: [
            { restaurantId },
            { createdByRestaurantId: restaurantId }
        ]
    });
    await FoodItem.deleteMany({ restaurantId });
    await FoodAddon.deleteMany({ restaurantId });
    console.log('Clean-up completed.');

    // Define categories to create
    const categoriesData = [
        { name: 'Signature Lasagnas', foodTypeScope: 'Both', image: 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=500&auto=format&fit=crop&q=60' },
        { name: 'Gourmet Mac n Cheese', foodTypeScope: 'Both', image: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=500&auto=format&fit=crop&q=60' },
        { name: 'Craveable Rice Bowls', foodTypeScope: 'Both', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&auto=format&fit=crop&q=60' },
        { name: 'Freshly Baked Quesadillas', foodTypeScope: 'Both', image: 'https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?w=500&auto=format&fit=crop&q=60' },
        { name: 'Garlic Breads & Sides', foodTypeScope: 'Both', image: 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=500&auto=format&fit=crop&q=60' },
        { name: 'Indulgent Desserts', foodTypeScope: 'Veg', image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&auto=format&fit=crop&q=60' },
        { name: 'Refreshing Beverages', foodTypeScope: 'Veg', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=60' }
    ];

    const categoryMap = {};
    for (let i = 0; i < categoriesData.length; i++) {
        const cat = categoriesData[i];
        const doc = await FoodCategory.create({
            name: cat.name,
            image: cat.image,
            foodTypeScope: cat.foodTypeScope,
            restaurantId,
            createdByRestaurantId: restaurantId,
            approvalStatus: 'approved',
            isApproved: true,
            isActive: true,
            zoneId,
            sortOrder: i + 1
        });
        categoryMap[cat.name] = doc;
        console.log(`Created category: ${cat.name} (ID: ${doc._id})`);
    }

    // Define addons to create
    const addonsData = [
        { name: 'Extra Melted Mozzarella', description: 'Double layer of premium gooey mozzarella cheese', price: 49 },
        { name: 'Fiery Jalapeno Slices', description: 'Hot and tangy sliced pickled jalapenos', price: 29 },
        { name: 'Grilled Chicken Shreds', description: 'Seasoned shredded chicken breast for extra protein', price: 59 },
        { name: 'Tangy Tomato Salsa', description: 'House-made zesty tomato salsa with fresh herbs', price: 19 },
        { name: 'Creamy Garlic Mayo Dip', description: 'Rich, smooth garlic-infused mayonnaise', price: 25 },
        { name: 'Crushed Red Pepper Flakes', description: 'Spicy chili flakes to kick up the heat', price: 10 },
        { name: 'Sautéed Sweet Corn & Capsicum', description: 'Butter-tossed crunchy sweet corn and bell peppers', price: 35 },
        { name: 'Extra Garlic Bread Slice (1 pc)', description: 'One slice of freshly toasted garlic bread', price: 20 }
    ];

    for (const addon of addonsData) {
        await FoodAddon.create({
            restaurantId,
            draft: {
                name: addon.name,
                description: addon.description,
                price: addon.price,
                image: '',
                images: []
            },
            published: {
                name: addon.name,
                description: addon.description,
                price: addon.price,
                image: '',
                images: []
            },
            approvalStatus: 'approved',
            isAvailable: true,
            isDeleted: false,
            requestedAt: new Date(),
            approvedAt: new Date()
        });
        console.log(`Created addon: ${addon.name}`);
    }

    // Generate 100 food items
    console.log('Generating 100 food items...');
    const foodItems = [];

    const vegFlavors = [
        'Tandoori Paneer', 'Corn & Peppers', 'Spicy Jalapeno Veg', 'Smoky Chipotle Paneer',
        'Makhani Paneer', 'Garden Veggie', 'Mushroom & Spinach', 'Double Cheese Veg',
        'Fiesta Corn', 'Peri Peri Veg', 'Cheesy Sweet Corn', 'Paneer Tikka',
        'Zesty Jalapeno Paneer', 'Alfredo Mushroom', 'Kadai Spiced Paneer', 'Barbecue Mushroom',
        'Szechuan Pepper Paneer', 'Italian Gardenia Veg', 'Garlic Tomato Basil Veg', 'Four Cheese Classic Veg'
    ];

    const nonVegFlavors = [
        'Butter Chicken', 'Keema Bolognese', 'BBQ Chicken', 'Chicken Tikka',
        'Peri Peri Chicken', 'Smoked Chicken Sausage', 'Chicken Meatball', 'Chilli Garlic Chicken',
        'Schezwan Chicken', 'Chicken Pepperoni', 'Chicken Sausage Supreme', 'Chicken Kheema Masala',
        'Alfredo Smoked Chicken', 'Tandoori Chicken Tikka', 'Chipotle Chicken', 'Pepper Chicken Keema',
        'Herbed Chicken & Olive', 'Fiery Szechuan Chicken', 'Classic Chicken Bolognese', 'Garlic Chicken & Onion'
    ];

    // Helper to generate a unique item list
    const generateCategoryItems = (categoryName, isVeg, count) => {
        const catDoc = categoryMap[categoryName];
        const categoryId = catDoc._id;
        const image = catDoc.image;
        const flavors = isVeg ? vegFlavors : nonVegFlavors;

        for (let idx = 0; idx < count; idx++) {
            const flavor = flavors[idx % flavors.length];
            // Add variety to names based on category
            let itemName = '';
            let description = '';
            let price = 0;
            let variants = [];

            if (categoryName === 'Signature Lasagnas') {
                itemName = `${flavor} Fusion Lasagna`;
                description = `An elegant fusion lasagna layered with sheets of fresh pasta, rich tomato & bechamel sauce, loaded with gourmet ${flavor.toLowerCase()} stuffing, topped with bubbly cheese and baked to perfection.`;
                price = isVeg ? 249 + (idx * 5) : 289 + (idx * 5);
                variants = [
                    { name: 'Regular Size', price: price, unit: 'Serving' },
                    { name: 'Shareable Size', price: price + 120, unit: 'Serving' }
                ];
            } else if (categoryName === 'Gourmet Mac n Cheese') {
                itemName = `${flavor} Baked Mac n Cheese`;
                description = `Classic elbow macaroni folded in a super creamy four-cheese sauce, mixed with savoury ${flavor.toLowerCase()} toppings, baked with a crispy herb-breadcrumb crust.`;
                price = isVeg ? 229 + (idx * 4) : 269 + (idx * 4);
                variants = [
                    { name: 'Regular Size', price: price, unit: 'Serving' },
                    { name: 'Double Size', price: price + 100, unit: 'Serving' }
                ];
            } else if (categoryName === 'Craveable Rice Bowls') {
                itemName = `${flavor} Cheesy Rice Bowl`;
                description = `Fragrant long-grain herb rice layered with spicy marinara, sautéed veggies, juicy chunks of ${flavor.toLowerCase()}, smothered with molten cheese and baked gold.`;
                price = isVeg ? 199 + (idx * 4) : 239 + (idx * 4);
                variants = [
                    { name: 'Single Bowl', price: price, unit: 'Portion' },
                    { name: 'Shareable Tub', price: price + 110, unit: 'Portion' }
                ];
            } else if (categoryName === 'Freshly Baked Quesadillas') {
                itemName = `${flavor} Fusion Quesadilla`;
                description = `Soft flour tortillas stuffed with melting mozzarella, fresh bell peppers, onions, and ${flavor.toLowerCase()} tossed in Mexican-Indian spices, grilled till crisp.`;
                price = isVeg ? 189 + (idx * 3) : 219 + (idx * 3);
                variants = [
                    { name: 'Regular (4 Pcs)', price: price, unit: 'Plate' },
                    { name: 'Jumbo (8 Pcs)', price: price + 90, unit: 'Plate' }
                ];
            }

            foodItems.push({
                restaurantId,
                categoryId,
                categoryName,
                name: itemName,
                description,
                price: price,
                variants,
                image,
                foodType: isVeg ? 'Veg' : 'Non-Veg',
                isAvailable: true,
                preparationTime: '15-20 mins',
                approvalStatus: 'approved',
                requestedAt: new Date(),
                approvedAt: new Date()
            });
        }
    };

    // 1. Signature Lasagnas: 20 items (10 Veg, 10 Non-Veg)
    generateCategoryItems('Signature Lasagnas', true, 10);
    generateCategoryItems('Signature Lasagnas', false, 10);

    // 2. Gourmet Mac n Cheese: 20 items (10 Veg, 10 Non-Veg)
    generateCategoryItems('Gourmet Mac n Cheese', true, 10);
    generateCategoryItems('Gourmet Mac n Cheese', false, 10);

    // 3. Craveable Rice Bowls: 20 items (10 Veg, 10 Non-Veg)
    generateCategoryItems('Craveable Rice Bowls', true, 10);
    generateCategoryItems('Craveable Rice Bowls', false, 10);

    // 4. Freshly Baked Quesadillas: 20 items (10 Veg, 10 Non-Veg)
    generateCategoryItems('Freshly Baked Quesadillas', true, 10);
    generateCategoryItems('Freshly Baked Quesadillas', false, 10);

    // 5. Garlic Breads & Sides: 10 items (5 Veg, 5 Non-Veg)
    const sidesVeg = [
        'Classic Garlic Bread (3 Pcs)', 'Cheese Garlic Bread (3 Pcs)', 'Corn & Cheese Garlic Bread',
        'Baked Crinkle Fries', 'Cheesy Baked Potato Wedges'
    ];
    const sidesNonVeg = [
        'Chicken Cheese Garlic Bread', 'Smoked Chicken Garlic Bread', 'Crispy Chicken Strips (4 Pcs)',
        'Baked Chicken Sausage Fries', 'Meatball Marinara Cups'
    ];
    const sidesCatDoc = categoryMap['Garlic Breads & Sides'];

    for (let i = 0; i < 5; i++) {
        // Veg Side
        foodItems.push({
            restaurantId,
            categoryId: sidesCatDoc._id,
            categoryName: sidesCatDoc.name,
            name: sidesVeg[i],
            description: `Fresh garlic bread or appetizer baked to perfection. A great side companion for your main meal.`,
            price: 119 + (i * 15),
            variants: [],
            image: sidesCatDoc.image,
            foodType: 'Veg',
            isAvailable: true,
            preparationTime: '10-12 mins',
            approvalStatus: 'approved',
            requestedAt: new Date(),
            approvedAt: new Date()
        });

        // Non-Veg Side
        foodItems.push({
            restaurantId,
            categoryId: sidesCatDoc._id,
            categoryName: sidesCatDoc.name,
            name: sidesNonVeg[i],
            description: `Meaty and delicious appetizer baked with chicken chunks, cheese, and seasoning.`,
            price: 159 + (i * 15),
            variants: [],
            image: sidesCatDoc.image,
            foodType: 'Non-Veg',
            isAvailable: true,
            preparationTime: '10-12 mins',
            approvalStatus: 'approved',
            requestedAt: new Date(),
            approvedAt: new Date()
        });
    }

    // 6. Indulgent Desserts: 5 items (Veg)
    const desserts = [
        { name: 'Choco Lava Cake', description: 'Warm chocolate cake with a gooey, molten chocolate center.', price: 99 },
        { name: 'Baked Caramel Custard', description: 'Creamy baked custard with a sweet caramel glaze.', price: 129 },
        { name: 'Warm Chocolate Brownie', description: 'Fudgy chocolate brownie topped with chocolate chips.', price: 109 },
        { name: 'Red Velvet Pastry Slice', description: 'Soft red velvet sponge layered with cream cheese frosting.', price: 119 },
        { name: 'Nutella Stuffed Cookie', description: 'Warm giant cookie stuffed with delicious hazelnut Nutella spread.', price: 89 }
    ];
    const dessertsCatDoc = categoryMap['Indulgent Desserts'];
    for (const d of desserts) {
        foodItems.push({
            restaurantId,
            categoryId: dessertsCatDoc._id,
            categoryName: dessertsCatDoc.name,
            name: d.name,
            description: d.description,
            price: d.price,
            variants: [],
            image: dessertsCatDoc.image,
            foodType: 'Veg',
            isAvailable: true,
            preparationTime: '5-8 mins',
            approvalStatus: 'approved',
            requestedAt: new Date(),
            approvedAt: new Date()
        });
    }

    // 7. Refreshing Beverages: 5 items (Veg)
    const beverages = [
        { name: 'Classic Lemon Iced Tea', description: 'Refreshing brewed tea served chilled with lemon juice.', price: 79 },
        { name: 'Mint Mojito Mocktail', description: 'Cool mix of fresh mint, lime juice, sugar, and sparkling soda.', price: 89 },
        { name: 'Creamy Cold Coffee', description: 'Perfectly blended thick and sweet milk coffee with ice cream.', price: 109 },
        { name: 'Spiced Mango Cooler', description: 'Fruity mango pulp mixed with Indian spices and soda.', price: 89 },
        { name: 'Mineral Water (500ml)', description: 'Chilled packaged drinking water.', price: 20 }
    ];
    const beveragesCatDoc = categoryMap['Refreshing Beverages'];
    for (const b of beverages) {
        foodItems.push({
            restaurantId,
            categoryId: beveragesCatDoc._id,
            categoryName: beveragesCatDoc.name,
            name: b.name,
            description: b.description,
            price: b.price,
            variants: [
                { name: 'Regular Size', price: b.price, unit: 'ml' },
                { name: 'Large Size', price: b.price + 30, unit: 'ml' }
            ],
            image: beveragesCatDoc.image,
            foodType: 'Veg',
            isAvailable: true,
            preparationTime: '3-5 mins',
            approvalStatus: 'approved',
            requestedAt: new Date(),
            approvedAt: new Date()
        });
    }

    console.log(`Inserting ${foodItems.length} food items into the database...`);
    const createdItems = await FoodItem.insertMany(foodItems);
    console.log(`Successfully seeded ${createdItems.length} items.`);

    console.log('--- SEEDING COMPLETED SUCCESSFULLY ---');
    await mongoose.disconnect();
}

run().catch(async (err) => {
    console.error('Seeding script failed:', err.message || err);
    try {
        await mongoose.disconnect();
    } catch {
        // ignore
    }
    process.exit(1);
});
