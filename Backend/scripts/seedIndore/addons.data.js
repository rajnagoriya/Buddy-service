/**
 * Addons per restaurant, keyed by `menuKey`.
 *
 * FoodAddon stores an editable `draft` and a customer-visible `published` copy.
 * The seeder writes the same payload to both and marks them approved, which is
 * the state an addon lands in after admin approval.
 */
export const ADDONS = {
    sarafa_chaat: [
        { name: 'Extra Indori Sev', description: 'A second handful of fine besan sev on top', price: 15 },
        { name: 'Extra Dahi', description: 'Additional bowl of chilled sweet curd', price: 25 },
        { name: 'Tikha Masala Sprinkle', description: 'House jeeravan masala, extra hot', price: 10 },
        { name: 'Imli Chutney Cup', description: 'Sweet-sour tamarind chutney portion', price: 15 },
        { name: 'Extra Jalebi (2 Pcs)', description: 'Two hot desi ghee jalebis on the side', price: 45 },
        { name: 'Malai Topping', description: 'Fresh cream layer for lassi and shakes', price: 20 },
    ],
    vijay_nagar_tandoor: [
        { name: 'Extra Butter Naan', description: 'One more naan straight from the tandoor', price: 55 },
        { name: 'Extra Makhani Gravy', description: 'Additional portion of butter gravy', price: 69 },
        { name: 'Paneer Topping', description: 'Extra grilled paneer cubes in your curry', price: 79 },
        { name: 'Boondi Raita', description: 'Cooling curd raita with roasted cumin', price: 49 },
        { name: 'Green Chutney', description: 'Fresh mint-coriander chutney cup', price: 15 },
        { name: 'Masala Papad', description: 'Roasted papad topped with onion and tomato', price: 39 },
        { name: 'Extra Butter', description: 'White butter cube for dal or naan', price: 20 },
    ],
    guru_kripa_breakfast: [
        { name: 'Extra Jalebi (2 Pcs)', description: 'Two pieces of desi ghee jalebi', price: 45 },
        { name: 'Extra Sev Topping', description: 'More ratlami sev on your poha', price: 15 },
        { name: 'Usal Gravy Side', description: 'Spicy white pea gravy portion', price: 35 },
        { name: 'Fresh Curd Bowl', description: 'Set curd to go with parathas', price: 30 },
        { name: 'White Butter Cube', description: 'Home-churned makkhan for parathas', price: 20 },
        { name: 'Achaar Portion', description: 'Mixed Indian pickle', price: 10 },
    ],
    bhawarkuan_biryani: [
        { name: 'Extra Chicken Pieces (2)', description: 'Two additional biryani chicken pieces', price: 99 },
        { name: 'Mirchi Ka Salan Cup', description: 'The traditional biryani side gravy', price: 49 },
        { name: 'Boondi Raita', description: 'Whisked curd with soaked boondi', price: 49 },
        { name: 'Extra Biryani Rice', description: 'Additional portion of dum rice', price: 79 },
        { name: 'Onion Lachcha Salad', description: 'Sliced onion with lemon and chaat masala', price: 39 },
        { name: 'Boiled Egg (1)', description: 'One masala-rubbed boiled egg', price: 25 },
        { name: 'Extra Rumali Roti', description: 'One additional handkerchief roti', price: 35 },
    ],
    nipania_pizza: [
        { name: 'Extra Cheese', description: 'Double mozzarella layer on your pizza', price: 69 },
        { name: 'Cheese Burst Crust', description: 'Upgrade to a stuffed cheese crust', price: 99 },
        { name: 'Jalapeno Topping', description: 'Pickled jalapeno slices', price: 39 },
        { name: 'Grilled Chicken Topping', description: 'Extra seasoned chicken on your pizza', price: 89 },
        { name: 'Peri Peri Dust', description: 'Spicy peri peri seasoning sachet', price: 15 },
        { name: 'Garlic Dip', description: 'Creamy garlic dipping sauce', price: 29 },
        { name: 'Extra Garlic Bread Slice', description: 'One more toasted garlic bread slice', price: 35 },
    ],
    saket_wok: [
        { name: 'Extra Schezwan Sauce', description: 'House schezwan paste, extra hot', price: 25 },
        { name: 'Extra Momo Chutney', description: 'Fiery red chilli-garlic momo chutney', price: 15 },
        { name: 'Fried Egg Topping', description: 'One sunny-side-up egg on your rice or noodles', price: 30 },
        { name: 'Crispy Noodle Garnish', description: 'Fried noodle crisps for soups', price: 20 },
        { name: 'Manchurian Gravy Side', description: 'Extra manchurian gravy portion', price: 59 },
        { name: 'Mayo Dip', description: 'Creamy tandoori mayo dip', price: 25 },
    ],
    rau_punjabi: [
        { name: 'Extra Tandoori Roti', description: 'One more whole wheat tandoori roti', price: 30 },
        { name: 'White Makkhan', description: 'Home-churned butter for saag or roti', price: 25 },
        { name: 'Extra Dal Makhani', description: 'Additional half portion of dal makhani', price: 99 },
        { name: 'Papad & Pickle', description: 'Roasted papad with mixed pickle', price: 25 },
        { name: 'Masala Chaas Glass', description: 'Spiced buttermilk on the side', price: 39 },
        { name: 'Extra Gulab Jamun', description: 'One warm gulab jamun', price: 35 },
    ],
};

export const getAddonsFor = (menuKey) => ADDONS[menuKey] || [];
