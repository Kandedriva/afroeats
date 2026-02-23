import axios from 'axios';
import pool from '../db.js';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const BASE_DELIVERY_FEE = 3.00; // Base fee for any delivery
const PRICE_PER_MILE = 1.50; // Additional fee per mile
const DRIVER_COMMISSION_RATE = 0.85; // Driver gets 85% of delivery fee
const PLATFORM_COMMISSION_RATE = 0.15; // Platform gets 15%

/**
 * Geocode an address to latitude/longitude
 * @param {string} address - Full address to geocode
 * @returns {object|null} - { latitude, longitude, formatted_address } or null
 */
export async function geocodeAddress(address) {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('⚠️ Google Maps API key not configured');
    return null;
  }

  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          address: address,
          key: GOOGLE_MAPS_API_KEY
        }
      }
    );

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      return {
        latitude: location.lat,
        longitude: location.lng,
        formatted_address: response.data.results[0].formatted_address
      };
    }

    console.warn('Geocoding failed:', response.data.status);
    return null;
  } catch (error) {
    console.error('Geocoding error:', error.message);
    return null;
  }
}

/**
 * Calculate distance between two locations using Google Distance Matrix API
 * @param {string} origin - Origin address or "lat,lng"
 * @param {string} destination - Destination address or "lat,lng"
 * @returns {object|null} - Distance data or null
 */
export async function calculateDistance(origin, destination) {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('⚠️ Google Maps API key not configured');
    return null;
  }

  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/distancematrix/json',
      {
        params: {
          origins: origin, // Can be address or "lat,lng"
          destinations: destination,
          units: 'imperial', // miles
          key: GOOGLE_MAPS_API_KEY
        }
      }
    );

    if (response.data.status === 'OK' &&
        response.data.rows.length > 0 &&
        response.data.rows[0].elements.length > 0) {

      const element = response.data.rows[0].elements[0];

      if (element.status === 'OK') {
        return {
          distance_miles: (element.distance.value / 1609.34).toFixed(2), // meters to miles
          distance_text: element.distance.text,
          duration_seconds: element.duration.value,
          duration_text: element.duration.text
        };
      }
    }

    console.warn('Distance calculation failed:', response.data.status);
    return null;
  } catch (error) {
    console.error('Distance calculation error:', error.message);
    return null;
  }
}

/**
 * Calculate delivery fee based on distance
 * @param {number} distanceMiles - Distance in miles
 * @returns {object} - Fee breakdown
 */
export function calculateDeliveryFee(distanceMiles) {
  const distance = parseFloat(distanceMiles);

  // Base fee + distance-based fee
  const distanceFee = distance * PRICE_PER_MILE;
  const totalFee = BASE_DELIVERY_FEE + distanceFee;

  // Calculate driver payout and platform commission
  const driverPayout = totalFee * DRIVER_COMMISSION_RATE;
  const platformCommission = totalFee * PLATFORM_COMMISSION_RATE;

  return {
    base_fee: parseFloat(BASE_DELIVERY_FEE.toFixed(2)),
    distance_fee: parseFloat(distanceFee.toFixed(2)),
    total_delivery_fee: parseFloat(totalFee.toFixed(2)),
    driver_payout: parseFloat(driverPayout.toFixed(2)),
    platform_commission: parseFloat(platformCommission.toFixed(2)),
    distance_miles: parseFloat(distance.toFixed(2))
  };
}

/**
 * Calculate distance and fee for an order
 * @param {string} restaurantAddress - Restaurant address
 * @param {string} customerAddress - Customer delivery address
 * @returns {object} - Complete distance and fee data
 */
export async function calculateDistanceAndFee(restaurantAddress, customerAddress) {
  try {
    // Geocode addresses if needed
    const origin = await geocodeAddress(restaurantAddress);
    const destination = await geocodeAddress(customerAddress);

    if (!origin || !destination) {
      throw new Error('Failed to geocode addresses');
    }

    // Calculate distance
    const distanceData = await calculateDistance(
      `${origin.latitude},${origin.longitude}`,
      `${destination.latitude},${destination.longitude}`
    );

    if (!distanceData) {
      throw new Error('Failed to calculate distance');
    }

    // Calculate fees
    const feeData = calculateDeliveryFee(distanceData.distance_miles);

    return {
      ...distanceData,
      ...feeData,
      origin_coordinates: {
        latitude: origin.latitude,
        longitude: origin.longitude
      },
      destination_coordinates: {
        latitude: destination.latitude,
        longitude: destination.longitude
      }
    };
  } catch (error) {
    console.error('Distance and fee calculation error:', error);
    throw error;
  }
}

/**
 * Batch geocode restaurant addresses (for migration/setup)
 * Run this once to populate existing restaurant coordinates
 */
export async function geocodeRestaurants() {
  try {
    const restaurants = await pool.query(
      "SELECT id, name, address FROM restaurants WHERE address_geocoded = FALSE OR address_geocoded IS NULL"
    );

    console.log(`🗺️ Geocoding ${restaurants.rows.length} restaurants...`);

    let successCount = 0;
    let failCount = 0;

    for (const restaurant of restaurants.rows) {
      const geocoded = await geocodeAddress(restaurant.address);

      if (geocoded) {
        await pool.query(
          `UPDATE restaurants
           SET latitude = $1, longitude = $2, address_geocoded = TRUE, geocoded_at = NOW()
           WHERE id = $3`,
          [geocoded.latitude, geocoded.longitude, restaurant.id]
        );

        console.log(`✓ Geocoded ${restaurant.name}`);
        successCount++;
      } else {
        console.warn(`✗ Failed to geocode ${restaurant.name}: ${restaurant.address}`);
        failCount++;
      }

      // Rate limiting: wait 200ms between requests to avoid API quota issues
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`\n✅ Geocoding complete: ${successCount} succeeded, ${failCount} failed`);
    return { successCount, failCount };
  } catch (error) {
    console.error('Batch geocoding error:', error);
    throw error;
  }
}

/**
 * Geocode a single restaurant (for new restaurant creation)
 * @param {number} restaurantId - Restaurant ID
 * @returns {object|null} - Geocoded coordinates or null
 */
export async function geocodeRestaurant(restaurantId) {
  try {
    const result = await pool.query(
      "SELECT address FROM restaurants WHERE id = $1",
      [restaurantId]
    );

    if (result.rows.length === 0) {
      throw new Error('Restaurant not found');
    }

    const address = result.rows[0].address;
    const geocoded = await geocodeAddress(address);

    if (geocoded) {
      await pool.query(
        `UPDATE restaurants
         SET latitude = $1, longitude = $2, address_geocoded = TRUE, geocoded_at = NOW()
         WHERE id = $3`,
        [geocoded.latitude, geocoded.longitude, restaurantId]
      );

      return geocoded;
    }

    return null;
  } catch (error) {
    console.error(`Failed to geocode restaurant ${restaurantId}:`, error);
    return null;
  }
}

export default {
  geocodeAddress,
  calculateDistance,
  calculateDeliveryFee,
  calculateDistanceAndFee,
  geocodeRestaurants,
  geocodeRestaurant
};
