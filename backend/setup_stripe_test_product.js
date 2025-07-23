// Script to create a test Stripe product and price
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function setupStripeTestProduct() {
  try {
    console.log('Creating test Stripe product and price...');

    // Create a test product
    const product = await stripe.products.create({
      name: 'Restaurant Owner Subscription - Test',
      description: 'Monthly subscription for restaurant owners (Test Mode)',
    });

    console.log('Created product:', product.id);

    // Create a test price for the product
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 2900, // $29.00 in cents
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
    });

    console.log('Created price:', price.id);
    console.log('\n✅ Stripe Setup Complete!');
    console.log('\n📋 Add this to your .env file:');
    console.log(`STRIPE_SUBSCRIPTION_PRICE_ID=${price.id}`);
    
    return { product, price };
  } catch (error) {
    console.error('Error setting up Stripe:', error.message);
    
    // If using live keys in test, suggest switching
    if (error.message.includes('live') || error.type === 'StripePermissionError') {
      console.log('\n💡 Tip: Make sure you are using TEST keys (sk_test_...) not live keys');
    }
  }
}

setupStripeTestProduct();