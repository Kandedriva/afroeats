/**
 * Notification Service
 * Handles email and SMS notifications for restaurant owners
 */

import nodemailer from 'nodemailer';
import twilio from 'twilio';

class NotificationService {
  constructor() {
    // Email configuration (using nodemailer with multiple provider support)
    this.emailTransporter = null;
    this.initializeEmailService();

    // SMS configuration (using Twilio)
    this.twilioClient = null;
    this.initializeSMSService();
  }

  /**
   * Initialize email service
   */
  initializeEmailService() {
    try {
      // Check which email provider is configured
      const emailProvider = process.env.EMAIL_PROVIDER || 'smtp'; // smtp, sendgrid, mailgun, ses

      if (emailProvider === 'smtp') {
        // Generic SMTP configuration (works with Gmail, Outlook, custom SMTP)
        if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
          this.emailTransporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          });
          console.log('✅ Email service initialized (SMTP)');
        } else {
          console.log('⚠️ Email service not configured (missing SMTP credentials)');
        }
      } else if (emailProvider === 'sendgrid') {
        // SendGrid configuration
        if (process.env.SENDGRID_API_KEY) {
          this.emailTransporter = nodemailer.createTransport({
            host: 'smtp.sendgrid.net',
            port: 587,
            auth: {
              user: 'apikey',
              pass: process.env.SENDGRID_API_KEY,
            },
          });
          console.log('✅ Email service initialized (SendGrid)');
        }
      }
      // Add more providers as needed (Mailgun, AWS SES, etc.)
    } catch (error) {
      console.error('❌ Email service initialization failed:', error.message);
    }
  }

  /**
   * Initialize SMS service (Twilio)
   */
  initializeSMSService() {
    try {
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
        this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        console.log('✅ SMS service initialized (Twilio)');
      } else {
        console.log('⚠️ SMS service not configured (missing Twilio credentials)');
      }
    } catch (error) {
      console.error('❌ SMS service initialization failed:', error.message);
    }
  }

  /**
   * Send new order email notification to restaurant owner
   */
  async sendNewOrderEmail(ownerEmail, ownerName, orderDetails) {
    if (!this.emailTransporter) {
      console.log('⚠️ Email service not configured - skipping email notification');
      return { success: false, reason: 'Email service not configured' };
    }

    try {
      const { orderId, restaurantName, customerName, customerPhone, items, total, deliveryType, deliveryAddress } = orderDetails;

      // Build items list HTML
      const itemsHtml = items
        .map(
          (item) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.quantity}x ${item.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.price.toFixed(2)}</td>
        </tr>
      `
        )
        .join('');

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Order - ${restaurantName}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: #ff6b35; margin: 0 0 10px 0;">🔔 New Order Received!</h1>
    <p style="margin: 0; font-size: 18px; color: #666;">Order #${orderId}</p>
  </div>

  <div style="background-color: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h2 style="color: #333; margin-top: 0;">Restaurant: ${restaurantName}</h2>

    <div style="margin-bottom: 20px;">
      <h3 style="color: #666; margin-bottom: 10px;">Customer Information</h3>
      <p style="margin: 5px 0;"><strong>Name:</strong> ${customerName}</p>
      <p style="margin: 5px 0;"><strong>Phone:</strong> ${customerPhone}</p>
      <p style="margin: 5px 0;"><strong>Delivery Type:</strong> ${deliveryType === 'delivery' ? '🚗 Delivery' : '🏪 Pickup'}</p>
      ${deliveryType === 'delivery' ? `<p style="margin: 5px 0;"><strong>Address:</strong> ${deliveryAddress}</p>` : ''}
    </div>

    <div style="margin-bottom: 20px;">
      <h3 style="color: #666; margin-bottom: 10px;">Order Items</h3>
      <table style="width: 100%; border-collapse: collapse;">
        ${itemsHtml}
        <tr>
          <td style="padding: 12px 8px; font-weight: bold; border-top: 2px solid #333;">Total</td>
          <td style="padding: 12px 8px; font-weight: bold; border-top: 2px solid #333; text-align: right;">$${total.toFixed(2)}</td>
        </tr>
      </table>
    </div>

    <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107;">
      <p style="margin: 0; font-weight: bold;">⏰ Please confirm this order as soon as possible!</p>
    </div>
  </div>

  <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
    <p style="color: #666; font-size: 14px; margin: 5px 0;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/owner/orders"
         style="color: #ff6b35; text-decoration: none; font-weight: bold;">
        View Order in Dashboard →
      </a>
    </p>
    <p style="color: #999; font-size: 12px; margin: 15px 0 5px 0;">
      This is an automated notification from OrderDabaly
    </p>
    <p style="color: #999; font-size: 12px; margin: 5px 0;">
      © ${new Date().getFullYear()} OrderDabaly. All rights reserved.
    </p>
  </div>
</body>
</html>
      `;

      const mailOptions = {
        from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@orderdabaly.com',
        to: ownerEmail,
        subject: `🔔 New Order #${orderId} - ${restaurantName}`,
        html: emailHtml,
        text: `New Order #${orderId}\n\nRestaurant: ${restaurantName}\nCustomer: ${customerName}\nPhone: ${customerPhone}\nDelivery: ${deliveryType}\nTotal: $${total.toFixed(2)}\n\nItems:\n${items.map((item) => `${item.quantity}x ${item.name} - $${item.price.toFixed(2)}`).join('\n')}\n\nPlease confirm this order in your dashboard.`,
      };

      const info = await this.emailTransporter.sendMail(mailOptions);
      console.log(`✅ Email sent to ${ownerEmail} for order #${orderId}: ${info.messageId}`);

      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`❌ Failed to send email to ${ownerEmail}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send new order SMS notification to restaurant owner
   */
  async sendNewOrderSMS(ownerPhone, orderDetails) {
    if (!this.twilioClient) {
      console.log('⚠️ SMS service not configured - skipping SMS notification');
      return { success: false, reason: 'SMS service not configured' };
    }

    try {
      const { orderId, restaurantName, customerName, items, total, deliveryType } = orderDetails;

      // Build concise SMS message (SMS has 160 char limit for standard, 1600 for long)
      const itemsText = items.map((item) => `${item.quantity}x ${item.name}`).join(', ');

      const smsBody = `🔔 NEW ORDER #${orderId}

Restaurant: ${restaurantName}
Customer: ${customerName}
Items: ${itemsText}
Total: $${total.toFixed(2)}
Type: ${deliveryType === 'delivery' ? 'Delivery' : 'Pickup'}

⏰ Please confirm this order ASAP in your dashboard!`;

      const message = await this.twilioClient.messages.create({
        body: smsBody,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: ownerPhone,
      });

      console.log(`✅ SMS sent to ${ownerPhone} for order #${orderId}: ${message.sid}`);

      return { success: true, messageSid: message.sid };
    } catch (error) {
      console.error(`❌ Failed to send SMS to ${ownerPhone}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send order status update email to customer
   */
  async sendOrderStatusUpdateEmail(customerEmail, customerName, orderDetails) {
    if (!this.emailTransporter) {
      return { success: false, reason: 'Email service not configured' };
    }

    try {
      const { orderId, status, restaurantName } = orderDetails;

      const statusMessages = {
        received: '✅ Your order has been received and is being prepared',
        confirmed: '✅ Your order has been confirmed by the restaurant',
        preparing: '👨‍🍳 Your order is being prepared',
        ready: '✅ Your order is ready for pickup/delivery',
        out_for_delivery: '🚗 Your order is out for delivery',
        delivered: '🎉 Your order has been delivered',
      };

      const statusMessage = statusMessages[status] || 'Your order status has been updated';

      const emailHtml = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: #ff6b35; margin: 0 0 10px 0;">Order Update</h1>
    <p style="margin: 0; font-size: 18px;">Order #${orderId}</p>
  </div>

  <div style="background-color: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px;">
    <h2 style="color: #333;">Hi ${customerName},</h2>
    <p style="font-size: 16px; color: #666;">${statusMessage}</p>
    <p style="margin-top: 20px;"><strong>Restaurant:</strong> ${restaurantName}</p>
  </div>

  <div style="text-align: center; margin-top: 20px;">
    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${orderId}"
       style="display: inline-block; background-color: #ff6b35; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
      View Order Details
    </a>
  </div>
</body>
</html>
      `;

      await this.emailTransporter.sendMail({
        from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
        to: customerEmail,
        subject: `Order #${orderId} - ${statusMessage}`,
        html: emailHtml,
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to send order status email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notifications to restaurant owner (both email and SMS)
   */
  async notifyRestaurantOwner(ownerInfo, orderDetails) {
    const results = {
      email: { success: false },
      sms: { success: false },
    };

    // Send email notification
    if (ownerInfo.email) {
      results.email = await this.sendNewOrderEmail(ownerInfo.email, ownerInfo.name, orderDetails);
    }

    // Send SMS notification
    if (ownerInfo.phone) {
      results.sms = await this.sendNewOrderSMS(ownerInfo.phone, orderDetails);
    }

    return results;
  }

  /**
   * Test email configuration
   */
  async testEmailConfig(testEmail) {
    if (!this.emailTransporter) {
      return { success: false, error: 'Email service not configured' };
    }

    try {
      await this.emailTransporter.sendMail({
        from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
        to: testEmail,
        subject: 'OrderDabaly - Email Configuration Test',
        text: 'Your email service is configured correctly!',
        html: '<p>✅ Your email service is configured correctly!</p>',
      });

      return { success: true, message: 'Test email sent successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Test SMS configuration
   */
  async testSMSConfig(testPhone) {
    if (!this.twilioClient) {
      return { success: false, error: 'SMS service not configured' };
    }

    try {
      const message = await this.twilioClient.messages.create({
        body: '✅ Your OrderDabaly SMS service is configured correctly!',
        from: process.env.TWILIO_PHONE_NUMBER,
        to: testPhone,
      });

      return { success: true, messageSid: message.sid };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export default new NotificationService();
