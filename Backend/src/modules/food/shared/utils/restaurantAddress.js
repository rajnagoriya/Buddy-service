export const getRestaurantAddressSummary = (restaurant = {}) => {
    const loc = restaurant.location && typeof restaurant.location === 'object'
        ? restaurant.location
        : {};

    const parts = [];
    const area = String(loc.area || restaurant.area || '').trim();
    const city = String(loc.city || restaurant.city || '').trim();
    const landmark = String(loc.landmark || restaurant.landmark || '').trim();

    if (area) parts.push(area);
    if (city && city.toLowerCase() !== area.toLowerCase()) parts.push(city);
    if (parts.length) return parts.join(', ');

    if (landmark) return landmark;

    const formatted = String(loc.formattedAddress || loc.address || '').trim();
    if (formatted) return formatted;

    const line1 = String(loc.addressLine1 || restaurant.addressLine1 || '').trim();
    if (line1) return line1;

    return '';
};
