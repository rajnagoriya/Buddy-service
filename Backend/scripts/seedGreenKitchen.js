import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { FoodRestaurant } from '../src/modules/food/restaurant/models/restaurant.model.js';
import { FoodCategory } from '../src/modules/food/admin/models/category.model.js';
import { FoodItem } from '../src/modules/food/admin/models/food.model.js';

dotenv.config();

async function run() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        throw new Error('MONGODB_URI is not set in environment');
    }
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // Look up the restaurant by exact ID
    const restaurant = await FoodRestaurant.findById("69ff203a2d300423adc848a9").lean();

    if (!restaurant) {
        throw new Error('Restaurant "The Green Kitchen" (ID: 69ff203a2d300423adc848a9) not found.');
    }

    const restaurantId = restaurant._id;
    const zoneId = restaurant.zoneId;

    console.log(`Found restaurant: ${restaurant.restaurantName} (ID: ${restaurantId})`);

    // Clean up existing data for this restaurant to ensure a clean slate
    console.log('Cleaning up existing categories and food items for this restaurant...');
    await FoodCategory.deleteMany({
        $or: [
            { restaurantId },
            { createdByRestaurantId: restaurantId }
        ]
    });
    await FoodItem.deleteMany({ restaurantId });
    console.log('Clean-up completed.');

    // Define categories to create
    const categoriesData = [
        { name: 'Fresh Salads', foodTypeScope: 'Veg', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&auto=format&fit=crop&q=60' },
        { name: 'Healthy Bowls', foodTypeScope: 'Veg', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60' },
        { name: 'Fresh Juices', foodTypeScope: 'Veg', image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=60' }
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

    // Define 5 dummy menu items
    const dummyItems = [
        {
            categoryName: 'Fresh Salads',
            name: 'Avocado Quinoa Salad',
            description: 'A super nutritious salad featuring rich avocado, protein-packed quinoa, cherry tomatoes, cucumbers, fresh parsley, and a zesty lemon-herb vinaigrette.',
            price: 189,
            foodType: 'Veg',
            image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=60'
        },
        {
            categoryName: 'Fresh Salads',
            name: 'Mediterranean Chickpea Salad',
            description: 'Crispy chickpeas, fresh diced bell peppers, red onions, kalamata olives, and fresh mint leaves tossed in extra virgin olive oil and Mediterranean spices.',
            price: 159,
            foodType: 'Veg',
            image: 'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?w=500&auto=format&fit=crop&q=60'
        },
        {
            categoryName: 'Healthy Bowls',
            name: 'Pesto Tofu Rice Bowl',
            description: 'Organic brown rice topped with pan-seared garlic tofu, steamed broccoli, roasted sweet potatoes, and a rich, creamy house-made basil pesto sauce.',
            price: 229,
            foodType: 'Veg',
            image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60'
        },
        {
            categoryName: 'Healthy Bowls',
            name: 'Spicy Buddha Bowl',
            description: 'A vibrant bowl of warm quinoa, shredded red cabbage, edamame, roasted chickpeas, sesame sliced cucumber, and a sweet-spicy peanut sauce drizzle.',
            price: 219,
            foodType: 'Veg',
            image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&auto=format&fit=crop&q=60'
        },
        {
            categoryName: 'Fresh Juices',
            name: 'Super Green Detox Juice',
            description: 'Cold-pressed spinach, green apple, cucumber, celery, fresh ginger, and a splash of key lime juice. High in antioxidants and vitamins.',
            price: 129,
            foodType: 'Veg',
            image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=60'
        }
    ];

    const foodItems = dummyItems.map(item => ({
        restaurantId,
        categoryId: categoryMap[item.categoryName]._id,
        categoryName: item.categoryName,
        name: item.name,
        description: item.description,
        price: item.price,
        variants: [
            { name: 'Regular Size', price: item.price, unit: 'Portion' },
            { name: 'Large Size', price: item.price + 40, unit: 'Portion' }
        ],
        image: item.image,
        foodType: item.foodType,
        isAvailable: true,
        preparationTime: '10-15 mins',
        approvalStatus: 'approved',
        requestedAt: new Date(),
        approvedAt: new Date()
    }));

    console.log(`Inserting ${foodItems.length} food items into the database...`);
    const createdItems = await FoodItem.insertMany(foodItems);
    console.log(`Successfully seeded ${createdItems.length} items.`);

    console.log('--- SEEDING GREEN KITCHEN COMPLETED SUCCESSFULLY ---');
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
