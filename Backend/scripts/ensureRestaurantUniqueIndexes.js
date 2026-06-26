/**
 * Ensures unique indexes on food_restaurants for ownerPhoneLast10 and ownerEmail.
 * Run: node Backend/scripts/ensureRestaurantUniqueIndexes.js
 *
 * Reports duplicate phones/emails before applying indexes.
 */
import mongoose from "mongoose";
import { config } from "../src/config/env.js";
import { FoodRestaurant } from "../src/modules/food/restaurant/models/restaurant.model.js";

const normalizePhoneLast10 = (value) => {
  const digits = String(value || "").replace(/\D/g, "").slice(-15);
  return digits ? digits.slice(-10) : "";
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

async function reportDuplicates() {
  const restaurants = await FoodRestaurant.find(
    {},
    { ownerPhone: 1, ownerPhoneLast10: 1, ownerEmail: 1, restaurantName: 1 },
  ).lean();

  const phoneMap = new Map();
  const emailMap = new Map();

  for (const doc of restaurants) {
    const last10 =
      doc.ownerPhoneLast10 || normalizePhoneLast10(doc.ownerPhone);
    if (last10) {
      const key = last10;
      if (!phoneMap.has(key)) phoneMap.set(key, []);
      phoneMap.get(key).push(doc);
    }

    const email = normalizeEmail(doc.ownerEmail);
    if (email) {
      if (!emailMap.has(email)) emailMap.set(email, []);
      emailMap.get(email).push(doc);
    }
  }

  const duplicatePhones = [...phoneMap.entries()].filter(([, docs]) => docs.length > 1);
  const duplicateEmails = [...emailMap.entries()].filter(([, docs]) => docs.length > 1);

  if (duplicatePhones.length) {
    console.error("Duplicate phone numbers found (resolve before unique index):");
    duplicatePhones.forEach(([phone, docs]) => {
      console.error(`  ${phone}: ${docs.map((d) => `${d._id} (${d.restaurantName})`).join(", ")}`);
    });
    return false;
  }

  if (duplicateEmails.length) {
    console.error("Duplicate emails found (resolve before unique index):");
    duplicateEmails.forEach(([email, docs]) => {
      console.error(`  ${email}: ${docs.map((d) => `${d._id} (${d.restaurantName})`).join(", ")}`);
    });
    return false;
  }

  return true;
}

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log("Connected to MongoDB");

  const ok = await reportDuplicates();
  if (!ok) {
    process.exitCode = 1;
    await mongoose.disconnect();
    return;
  }

  await FoodRestaurant.syncIndexes();
  console.log("Restaurant indexes synced successfully");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
