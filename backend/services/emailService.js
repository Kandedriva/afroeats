import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

// Initialize AWS SES Client
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const FROM_EMAIL = process.env.AWS_SES_FROM_EMAIL || 'noreply@orderdabaly.com';
const FROM_NAME = process.env.AWS_SES_FROM_NAME || 'Order Dabaly';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const SES_CONFIGURATION_SET = process.env.SES_CONFIGURATION_SET || 'orderdabaly-email-events';

let sesClient = null;

// Initialize SES client if credentials are available
if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
  sesClient = new SESClient({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });
  console.log('✅ AWS SES email service initialized');
} else {
  console.warn('⚠️  AWS SES credentials not configured. Email sending will be disabled.');
}

/**
 * Base function to send emails via AWS SES
 */
const sendEmail = async (to, subject, html, text = '') => {
  try {
    // Skip if SES is not configured
    if (!sesClient) {
      console.log(`📧 [Email Skipped - No AWS Credentials] To: ${to}, Subject: ${subject}`);
      return { success: false, message: 'AWS SES not configured' };
    }

    const params = {
      Source: `${FROM_NAME} <${FROM_EMAIL}>`,
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: html,
            Charset: 'UTF-8',
          },
          Text: {
            Data: text || subject,
            Charset: 'UTF-8',
          },
        },
      },
      ConfigurationSetName: SES_CONFIGURATION_SET,
    };

    const command = new SendEmailCommand(params);
    await sesClient.send(command);
    console.log(`✅ Email sent successfully to ${to}: ${subject}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    if (error.$metadata) {
      console.error('AWS SES error metadata:', error.$metadata);
    }
    return { success: false, error: error.message };
  }
};

/**
 * Send welcome email to new user
 */
export const sendUserWelcomeEmail = async (userEmail, userName) => {
  const subject = `Welcome to ${FROM_NAME}! 🎉`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background-color: #16a34a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to ${FROM_NAME}! 🎉</h1>
        </div>
        <div class="content">
          <h2>Hi ${userName}!</h2>
          <p>Thank you for joining ${FROM_NAME}, your trusted food and grocery delivery platform.</p>
          <p>We're excited to have you on board! Here's what you can do:</p>
          <ul>
            <li>🍽️ Order delicious food from local restaurants</li>
            <li>🛒 Shop for fresh groceries and essentials</li>
            <li>🚚 Get fast delivery right to your doorstep</li>
            <li>💳 Secure payments with Stripe</li>
          </ul>
          <div style="text-align: center;">
            <a href="${FRONTEND_URL}" class="button">Start Ordering Now</a>
          </div>
          <p>If you have any questions, feel free to reach out to our support team.</p>
          <p>Happy ordering!</p>
          <p><strong>The ${FROM_NAME} Team</strong></p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${FROM_NAME}. All rights reserved.</p>
          <p>You're receiving this email because you created an account with us.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(userEmail, subject, html);
};

/**
 * Send welcome email to new driver
 */
export const sendDriverWelcomeEmail = async (driverEmail, driverName) => {
  const subject = `Welcome to ${FROM_NAME} Driver Team! 🚗`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to the ${FROM_NAME} Driver Team! 🚗</h1>
        </div>
        <div class="content">
          <h2>Hi ${driverName}!</h2>
          <p>Congratulations! Your driver account has been successfully created.</p>
          <p>You're now part of our delivery network. Here's what's next:</p>
          <ul>
            <li>📱 Log in to your driver dashboard</li>
            <li>📋 Complete your profile and vehicle information</li>
            <li>🎯 Start accepting delivery requests</li>
            <li>💰 Earn money with flexible hours</li>
          </ul>
          <div style="text-align: center;">
            <a href="${FRONTEND_URL}/driver/login" class="button">Go to Driver Dashboard</a>
          </div>
          <p><strong>Important:</strong> Your account may need approval before you can start accepting deliveries. We'll notify you once your account is approved.</p>
          <p>If you have any questions about the driver platform, please contact our driver support team.</p>
          <p>Safe driving!</p>
          <p><strong>The ${FROM_NAME} Team</strong></p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${FROM_NAME}. All rights reserved.</p>
          <p>You're receiving this email because you registered as a driver with us.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(driverEmail, subject, html);
};

/**
 * Send welcome email to new restaurant owner
 */
export const sendRestaurantOwnerWelcomeEmail = async (ownerEmail, ownerName, restaurantName) => {
  const subject = `Welcome to ${FROM_NAME} - Restaurant Partner! 🍽️`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background-color: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to ${FROM_NAME}! 🍽️</h1>
        </div>
        <div class="content">
          <h2>Hi ${ownerName}!</h2>
          <p>Congratulations! Your restaurant <strong>${restaurantName}</strong> has been successfully registered with ${FROM_NAME}.</p>
          <p>We're thrilled to have you as a restaurant partner! Here's what you can do now:</p>
          <ul>
            <li>🍕 Add your menu items and prices</li>
            <li>📸 Upload appetizing photos of your dishes</li>
            <li>📦 Start receiving and managing orders</li>
            <li>💰 Track your earnings and payouts</li>
            <li>📊 View analytics and insights</li>
          </ul>
          <div style="text-align: center;">
            <a href="${FRONTEND_URL}/restaurant/dashboard" class="button">Go to Restaurant Dashboard</a>
          </div>
          <p><strong>Getting Started:</strong></p>
          <ol>
            <li>Complete your restaurant profile</li>
            <li>Set up your operating hours</li>
            <li>Add your menu items</li>
            <li>Configure your delivery settings</li>
          </ol>
          <p>If you need any assistance setting up your restaurant, our support team is here to help!</p>
          <p>Here's to your success!</p>
          <p><strong>The ${FROM_NAME} Team</strong></p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${FROM_NAME}. All rights reserved.</p>
          <p>You're receiving this email because you registered your restaurant with us.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(ownerEmail, subject, html);
};

/**
 * Send welcome email to new grocery store owner
 */
export const sendGroceryOwnerWelcomeEmail = async (ownerEmail, ownerName, storeName) => {
  const subject = `Welcome to ${FROM_NAME} - Grocery Store Partner! 🛒`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background-color: #16a34a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to ${FROM_NAME}! 🛒</h1>
        </div>
        <div class="content">
          <h2>Hi ${ownerName}!</h2>
          <p>Congratulations! Your grocery store <strong>${storeName}</strong> has been successfully registered with ${FROM_NAME}.</p>
          <p>We're thrilled to have you as a grocery store partner! Here's what you can do now:</p>
          <ul>
            <li>🛍️ Add your products and inventory</li>
            <li>📸 Upload photos of your products</li>
            <li>📦 Start receiving and managing orders</li>
            <li>💰 Track your earnings and payouts</li>
            <li>📊 View analytics and insights</li>
          </ul>
          <div style="text-align: center;">
            <a href="${FRONTEND_URL}/grocery-owner/dashboard" class="button">Go to Dashboard</a>
          </div>
          <p><strong>Getting Started:</strong></p>
          <ol>
            <li>Complete your store profile</li>
            <li>Set up your operating hours</li>
            <li>Add your product catalog</li>
            <li>Configure your delivery settings</li>
          </ol>
          <p>If you need any assistance setting up your store, our support team is here to help!</p>
          <p>Here's to your success!</p>
          <p><strong>The ${FROM_NAME} Team</strong></p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${FROM_NAME}. All rights reserved.</p>
          <p>You're receiving this email because you registered your grocery store with us.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(ownerEmail, subject, html);
};

/**
 * Send order confirmation email to customer
 */
export const sendOrderConfirmationEmail = async (customerEmail, customerName, orderDetails) => {
  const { orderId, items, subtotal, deliveryFee, platformFee, total, orderType, deliveryAddress, isGuestOrder } = orderDetails;

  const subject = `Order Confirmation #${orderId} - ${FROM_NAME}`;

  // Generate items list HTML
  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
        ${item.name || item.product_name}${item.restaurant_name ? ` (${item.restaurant_name})` : ''}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">x${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${(item.price * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .order-box { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; }
        .total-row { font-weight: bold; font-size: 18px; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Order Confirmed!</h1>
        </div>
        <div class="content">
          <h2>Hi ${customerName}!</h2>
          <p>Thank you for your ${orderType === 'grocery' ? 'grocery' : 'food'} order! We've received your order and ${orderType === 'grocery' ? 'are preparing it' : 'the restaurant is preparing your food'}.</p>

          <div class="order-box">
            <h3>Order Details</h3>
            <p><strong>Order ID:</strong> #${orderId}</p>
            <p><strong>Order Type:</strong> ${orderType === 'grocery' ? 'Grocery Order 🛒' : 'Food Order 🍽️'}</p>

            <table>
              <thead>
                <tr style="background-color: #f3f4f6;">
                  <th style="padding: 10px; text-align: left;">Item</th>
                  <th style="padding: 10px; text-align: center;">Qty</th>
                  <th style="padding: 10px; text-align: right;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2" style="padding: 10px;">Subtotal:</td>
                  <td style="padding: 10px; text-align: right;">$${subtotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding: 10px;">Platform Fee:</td>
                  <td style="padding: 10px; text-align: right;">$${platformFee.toFixed(2)}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding: 10px;">Delivery Fee:</td>
                  <td style="padding: 10px; text-align: right;">$${deliveryFee.toFixed(2)}</td>
                </tr>
                <tr class="total-row">
                  <td colspan="2" style="padding: 10px; border-top: 2px solid #333;">Total:</td>
                  <td style="padding: 10px; text-align: right; border-top: 2px solid #333; color: #16a34a;">$${total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          ${deliveryAddress ? `
          <div class="order-box">
            <h3>Delivery Address</h3>
            <p>
              ${deliveryAddress.name}<br>
              ${deliveryAddress.address}<br>
              ${deliveryAddress.city}, ${deliveryAddress.state} ${deliveryAddress.zipCode}<br>
              ${deliveryAddress.phone}
            </p>
          </div>
          ` : ''}

          <p><strong>What's Next?</strong></p>
          <ul>
            <li>${orderType === 'grocery' ? '📦 Your order is being prepared' : '🍳 Restaurant is preparing your food'}</li>
            <li>🚚 A driver will deliver your order</li>
            <li>📧 You'll receive updates via email</li>
          </ul>

          ${isGuestOrder ? `
          <div style="text-align: center; margin: 20px 0;">
            <a href="${FRONTEND_URL}/track-order?orderId=${orderId}&email=${encodeURIComponent(customerEmail)}"
               style="display: inline-block; background-color: #16a34a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Track Your Order
            </a>
          </div>
          <p style="text-align: center; color: #6b7280; font-size: 14px;">
            You can track your order status anytime using the link above or by visiting:<br>
            <strong>${FRONTEND_URL}/track-order</strong><br>
            Order ID: <strong>#${orderId}</strong> | Email: <strong>${customerEmail}</strong>
          </p>
          ` : `
          <p>You can track your order status anytime from your account dashboard.</p>
          `}

          <p>Thank you for choosing ${FROM_NAME}!</p>
          <p><strong>The ${FROM_NAME} Team</strong></p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${FROM_NAME}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(customerEmail, subject, html);
};

/**
 * Send new order notification to restaurant owner
 */
export const sendRestaurantOrderNotificationEmail = async (restaurantEmail, restaurantName, orderDetails) => {
  const { orderId, items, subtotal, customerName, deliveryAddress } = orderDetails;

  const subject = `New Order #${orderId} - ${restaurantName}`;

  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">x${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${(item.price * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .order-box { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; }
        .alert { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔔 New Order Received!</h1>
        </div>
        <div class="content">
          <h2>Hello ${restaurantName}!</h2>
          <p>You have received a new order. Please start preparing it as soon as possible.</p>

          <div class="alert">
            ⏰ <strong>Action Required:</strong> Please confirm and start preparing this order immediately.
          </div>

          <div class="order-box">
            <h3>Order Information</h3>
            <p><strong>Order ID:</strong> #${orderId}</p>
            <p><strong>Customer:</strong> ${customerName}</p>

            <table>
              <thead>
                <tr style="background-color: #f3f4f6;">
                  <th style="padding: 10px; text-align: left;">Item</th>
                  <th style="padding: 10px; text-align: center;">Qty</th>
                  <th style="padding: 10px; text-align: right;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
              <tfoot>
                <tr style="font-weight: bold;">
                  <td colspan="2" style="padding: 10px; border-top: 2px solid #333;">Order Total:</td>
                  <td style="padding: 10px; text-align: right; border-top: 2px solid #333;">$${subtotal.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          ${deliveryAddress ? `
          <div class="order-box">
            <h3>Delivery Information</h3>
            <p>
              ${deliveryAddress.name}<br>
              ${deliveryAddress.address}<br>
              ${deliveryAddress.city}, ${deliveryAddress.state} ${deliveryAddress.zipCode}<br>
              ${deliveryAddress.phone}
            </p>
          </div>
          ` : ''}

          <p><strong>Next Steps:</strong></p>
          <ol>
            <li>Confirm the order in your dashboard</li>
            <li>Start preparing the items</li>
            <li>Mark as ready when done</li>
            <li>A driver will be assigned for pickup</li>
          </ol>

          <p>Please log in to your restaurant dashboard to manage this order.</p>

          <p><strong>The ${FROM_NAME} Team</strong></p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${FROM_NAME}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(restaurantEmail, subject, html);
};

/**
 * Send order completion/delivery confirmation email to customer
 */
export const sendOrderDeliveredEmail = async (customerEmail, customerName, orderDetails) => {
  const { orderId, total, orderType, isGuestOrder } = orderDetails;

  const subject = `Order #${orderId} Delivered! - ${FROM_NAME}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .success-box { background-color: #d1fae5; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0; }
        .button { display: inline-block; background-color: #16a34a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Order Delivered Successfully!</h1>
        </div>
        <div class="content">
          <h2>Hi ${customerName}!</h2>

          <div class="success-box">
            ✅ <strong>Your order #${orderId} has been delivered!</strong>
          </div>

          <p>We hope you enjoy your ${orderType === 'grocery' ? 'groceries' : 'meal'}! Your order totaling <strong>$${total.toFixed(2)}</strong> has been successfully delivered.</p>

          <p><strong>How was your experience?</strong></p>
          <p>We'd love to hear your feedback! Your review helps us improve our service and helps other customers make informed decisions.</p>

          ${isGuestOrder ? `
          <div style="text-align: center;">
            <a href="${FRONTEND_URL}/track-order?orderId=${orderId}&email=${encodeURIComponent(customerEmail)}"
               style="display: inline-block; background-color: #16a34a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Order Details
            </a>
          </div>
          <p style="text-align: center; color: #6b7280; font-size: 14px;">
            You can view your complete order details using the link above or by visiting:<br>
            <strong>${FRONTEND_URL}/track-order</strong><br>
            Order ID: <strong>#${orderId}</strong> | Email: <strong>${customerEmail}</strong>
          </p>
          ` : `
          <div style="text-align: center;">
            <a href="${FRONTEND_URL}/my-orders" class="button">View Order & Leave Review</a>
          </div>
          `}

          <p><strong>Order Again:</strong></p>
          <ul>
            <li>🔄 Reorder your favorites with one click</li>
            <li>🎁 Check out our latest deals and promotions</li>
            <li>⭐ Save your favorite restaurants and products</li>
          </ul>

          <p>Thank you for choosing ${FROM_NAME}! We look forward to serving you again soon.</p>

          <p><strong>The ${FROM_NAME} Team</strong></p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${FROM_NAME}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(customerEmail, subject, html);
};

/**
 * Send order completion notification to restaurant owner
 */
export const sendRestaurantOrderCompletedEmail = async (restaurantEmail, restaurantName, orderDetails) => {
  const { orderId, total } = orderDetails;

  const subject = `Order #${orderId} Completed - ${restaurantName}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .success-box { background-color: #d1fae5; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Order Completed!</h1>
        </div>
        <div class="content">
          <h2>Hello ${restaurantName}!</h2>

          <div class="success-box">
            ✅ <strong>Order #${orderId} has been successfully delivered to the customer!</strong>
          </div>

          <p>Great job! The order totaling <strong>$${total.toFixed(2)}</strong> has been completed and delivered.</p>

          <p><strong>Payment Information:</strong></p>
          <ul>
            <li>💰 Your earnings from this order will be processed according to your payout schedule</li>
            <li>📊 View detailed earnings in your restaurant dashboard</li>
            <li>📈 Check your performance metrics and customer reviews</li>
          </ul>

          <p>Keep up the excellent work! Consistent quality and timely preparation help build customer loyalty.</p>

          <p><strong>The ${FROM_NAME} Team</strong></p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${FROM_NAME}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(restaurantEmail, subject, html);
};

/**
 * Send email verification code to user
 */
export const sendEmailVerificationCode = async (userEmail, userName, verificationCode) => {
  const subject = `Verify Your Email - ${FROM_NAME}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .code-box { background-color: #fff; border: 2px dashed #16a34a; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
        .code { font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #16a34a; font-family: monospace; }
        .warning-box { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📧 Verify Your Email</h1>
        </div>
        <div class="content">
          <h2>Hi ${userName}!</h2>
          <p>Thank you for signing up with ${FROM_NAME}! To complete your registration, please verify your email address.</p>

          <div class="code-box">
            <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Your Verification Code:</p>
            <div class="code">${verificationCode}</div>
          </div>

          <p><strong>Enter this code on the verification page to activate your account.</strong></p>

          <div class="warning-box">
            <p style="margin: 0;"><strong>⏰ Important:</strong></p>
            <ul style="margin: 10px 0 0 0; padding-left: 20px;">
              <li>This code will expire in <strong>10 minutes</strong></li>
              <li>For security reasons, do not share this code with anyone</li>
              <li>If you didn't create an account, please ignore this email</li>
            </ul>
          </div>

          <p>Once verified, you'll be able to:</p>
          <ul>
            <li>🍽️ Order delicious food from local restaurants</li>
            <li>🛒 Shop for fresh groceries and essentials</li>
            <li>🚚 Get fast delivery right to your doorstep</li>
          </ul>

          <p>If you have any questions, feel free to reach out to our support team.</p>

          <p><strong>The ${FROM_NAME} Team</strong></p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${FROM_NAME}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(userEmail, subject, html);
};

/**
 * Send new grocery order notification email to grocery store owner
 */
export const sendGroceryOrderNotificationEmail = async (ownerEmail, ownerName, orderDetails) => {
  const { orderId, items, total, customerName, customerPhone, deliveryAddress, deliveryCity, deliveryState, deliveryZip } = orderDetails;

  const subject = `🛒 New Grocery Order #${orderId} - ${FROM_NAME}`;

  // Generate items list HTML
  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
        ${item.product_name || item.name}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        ${item.quantity} ${item.unit || ''}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">
        $${Number(item.total_price || (item.unit_price * item.quantity)).toFixed(2)}
      </td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 30px; }
        .order-info { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        .total-row { font-weight: bold; font-size: 18px; background-color: #f3f4f6; }
        .button { display: inline-block; background-color: #16a34a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .alert { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🛒 New Grocery Order!</h1>
        </div>
        <div class="content">
          <div class="alert">
            <strong>⏰ Action Required!</strong> You have received a new grocery order.
          </div>

          <h2>Hi ${ownerName}!</h2>
          <p>You have received a new grocery order. Please prepare the items for delivery.</p>

          <div class="order-info">
            <h3>Order Details</h3>
            <p><strong>Order ID:</strong> #${orderId}</p>
            <p><strong>Customer:</strong> ${customerName || 'Guest Customer'}</p>
            ${customerPhone ? `<p><strong>Phone:</strong> ${customerPhone}</p>` : ''}

            <h3 style="margin-top: 20px;">Delivery Address</h3>
            <p>
              ${deliveryAddress}<br>
              ${deliveryCity}${deliveryState ? `, ${deliveryState}` : ''}${deliveryZip ? ` ${deliveryZip}` : ''}
            </p>

            <h3 style="margin-top: 20px;">Items Ordered</h3>
            <table class="table">
              <thead>
                <tr style="background-color: #f3f4f6;">
                  <th style="padding: 10px; text-align: left;">Product</th>
                  <th style="padding: 10px; text-align: center;">Quantity</th>
                  <th style="padding: 10px; text-align: right;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
                <tr class="total-row">
                  <td colspan="2" style="padding: 15px; text-align: right;">Total:</td>
                  <td style="padding: 15px; text-align: right;">$${Number(total).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="text-align: center;">
            <a href="${FRONTEND_URL}/grocery-owner/orders" class="button">View Order in Dashboard</a>
          </div>

          <p><strong>Next Steps:</strong></p>
          <ol>
            <li>Review the order details carefully</li>
            <li>Prepare all items from the order</li>
            <li>Package items securely for delivery</li>
            <li>Mark the order as ready when complete</li>
          </ol>

          <p>Thank you for your prompt service!</p>
          <p><strong>The ${FROM_NAME} Team</strong></p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${FROM_NAME}. All rights reserved.</p>
          <p>This is an automated notification for a new grocery order.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(ownerEmail, subject, html);
};

/**
 * Send refund request notification email to grocery store owner
 */
export const sendGroceryRefundRequestEmail = async (ownerEmail, ownerName, refundDetails) => {
  const { orderId, customerName, customerEmail, refundReason, refundAmount, requestDate } = refundDetails;

  const subject = `💰 Refund Request for Order #${orderId} - ${FROM_NAME}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 30px; }
        .refund-info { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
        .button { display: inline-block; background-color: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .alert { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💰 Refund Request</h1>
        </div>
        <div class="content">
          <div class="alert">
            <strong>⚠️ Action Required!</strong> A customer has requested a refund for their order.
          </div>

          <h2>Hi ${ownerName}!</h2>
          <p>A customer has submitted a refund request for one of your orders. Please review and take appropriate action.</p>

          <div class="refund-info">
            <h3>Refund Request Details</h3>
            <p><strong>Order ID:</strong> #${orderId}</p>
            <p><strong>Customer:</strong> ${customerName}</p>
            <p><strong>Email:</strong> ${customerEmail}</p>
            <p><strong>Refund Amount:</strong> $${Number(refundAmount).toFixed(2)}</p>
            <p><strong>Request Date:</strong> ${new Date(requestDate).toLocaleDateString()}</p>

            <h3 style="margin-top: 20px;">Reason for Refund</h3>
            <p style="background-color: #f3f4f6; padding: 15px; border-radius: 6px;">
              ${refundReason || 'No reason provided'}
            </p>
          </div>

          <div style="text-align: center;">
            <a href="${FRONTEND_URL}/grocery-owner/notifications" class="button">Review Refund Request</a>
          </div>

          <p><strong>What to do next:</strong></p>
          <ol>
            <li>Review the refund request details carefully</li>
            <li>Check your order records and policies</li>
            <li>Contact the customer if additional information is needed</li>
            <li>Approve or decline the refund request</li>
          </ol>

          <p><strong>Important:</strong> Please respond to refund requests within 24-48 hours to maintain good customer service.</p>

          <p>Thank you for your attention to this matter.</p>
          <p><strong>The ${FROM_NAME} Team</strong></p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${FROM_NAME}. All rights reserved.</p>
          <p>This is an automated notification for a refund request.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(ownerEmail, subject, html);
};

export default {
  sendUserWelcomeEmail,
  sendDriverWelcomeEmail,
  sendRestaurantOwnerWelcomeEmail,
  sendGroceryOwnerWelcomeEmail,
  sendOrderConfirmationEmail,
  sendRestaurantOrderNotificationEmail,
  sendOrderDeliveredEmail,
  sendRestaurantOrderCompletedEmail,
  sendEmailVerificationCode,
  sendGroceryOrderNotificationEmail,
  sendGroceryRefundRequestEmail,
};
