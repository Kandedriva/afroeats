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
   * Send order status update SMS to customer
   */
  async sendOrderStatusUpdateSMS(customerPhone, orderDetails) {
    if (!customerPhone) {
      return { success: false, reason: 'No phone number provided' };
    }

    if (!this.twilioClient) {
      console.warn('Twilio not configured - SMS not sent');
      return { success: false, reason: 'Twilio not configured' };
    }

    try {
      const { orderId, status, restaurantName } = orderDetails;

      const statusMessages = {
        received: '✅ Order received and being prepared',
        confirmed: '✅ Order confirmed by restaurant',
        preparing: '👨‍🍳 Your order is being prepared',
        ready: '✅ Order ready for pickup/delivery!',
        out_for_delivery: '🚗 Order is out for delivery',
        delivered: '🎉 Order delivered! Enjoy your meal!',
      };

      const statusMessage = statusMessages[status] || 'Order status updated';

      const message = `${statusMessage}

Order #${orderId}
Restaurant: ${restaurantName}

Track your order: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/order-details/${orderId}`;

      const result = await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: customerPhone,
      });

      console.log(`✅ Order status SMS sent to ${customerPhone} for order #${orderId}`);
      return { success: true, messageSid: result.sid };
    } catch (error) {
      console.error('Failed to send order status SMS:', error);
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

  /**
   * Send refund request submitted email to customer
   */
  async sendRefundRequestEmail(userEmail, userName, refundDetails) {
    if (!this.emailTransporter) {
      console.log('⚠️ Email service not configured - skipping refund request email');
      return { success: false, reason: 'Email service not configured' };
    }

    try {
      const { refundId, orderId, amount, reason, status } = refundDetails;

      const reasonText = {
        'quality_issue': 'Quality Issue',
        'wrong_item': 'Wrong Item',
        'late_delivery': 'Late Delivery',
        'item_unavailable': 'Item Unavailable',
        'customer_request': 'Customer Request',
        'order_cancelled': 'Order Cancelled',
        'other': 'Other'
      }[reason] || reason;

      const mailOptions = {
        from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
        to: userEmail,
        subject: `Refund Request Submitted - Order #${orderId}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #fff; padding: 30px; border: 1px solid #ddd; border-top: none; }
              .details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
              .detail-row:last-child { border-bottom: none; }
              .label { font-weight: bold; color: #666; }
              .value { color: #333; }
              .amount { font-size: 24px; font-weight: bold; color: #764ba2; }
              .status-badge { display: inline-block; padding: 8px 16px; background: #fef3c7; color: #92400e; border-radius: 20px; font-weight: bold; }
              .info-box { background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; }
              .button { display: inline-block; padding: 12px 30px; background: #764ba2; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">💰 Refund Request Submitted</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">OrderDabaly Platform</p>
              </div>
              <div class="content">
                <p>Hi ${userName},</p>
                <p>We've received your refund request and our team will review it shortly.</p>

                <div class="details">
                  <div class="detail-row">
                    <span class="label">Refund ID:</span>
                    <span class="value">#${refundId}</span>
                  </div>
                  <div class="detail-row">
                    <span class="label">Order ID:</span>
                    <span class="value">#${orderId}</span>
                  </div>
                  <div class="detail-row">
                    <span class="label">Amount:</span>
                    <span class="amount">$${parseFloat(amount).toFixed(2)}</span>
                  </div>
                  <div class="detail-row">
                    <span class="label">Reason:</span>
                    <span class="value">${reasonText}</span>
                  </div>
                  <div class="detail-row">
                    <span class="label">Status:</span>
                    <span class="status-badge">${status.toUpperCase()}</span>
                  </div>
                </div>

                <div class="info-box">
                  <strong>What happens next?</strong>
                  <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                    <li>Our team will review your request within 24-48 hours</li>
                    <li>You'll receive an email once your request is approved or if we need more information</li>
                    <li>Approved refunds are processed within 5-7 business days</li>
                    <li>The refund will be credited to your original payment method</li>
                  </ul>
                </div>

                <center>
                  <a href="${process.env.FRONTEND_URL}/my-refunds" class="button">View Refund Status</a>
                </center>

                <p style="margin-top: 30px;">If you have any questions, please don't hesitate to contact our support team.</p>

                <p>Thank you for your patience!</p>
                <p><strong>The OrderDabaly Team</strong></p>
              </div>
              <div class="footer">
                <p>This is an automated email from OrderDabaly. Please do not reply to this email.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      await this.emailTransporter.sendMail(mailOptions);
      console.log(`✅ Refund request email sent to ${userEmail}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to send refund request email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send refund approved email to customer
   */
  async sendRefundApprovedEmail(userEmail, userName, refundDetails) {
    if (!this.emailTransporter) {
      console.log('⚠️ Email service not configured - skipping refund approved email');
      return { success: false, reason: 'Email service not configured' };
    }

    try {
      const { refundId, orderId, amount } = refundDetails;

      const mailOptions = {
        from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
        to: userEmail,
        subject: `Refund Approved - $${parseFloat(amount).toFixed(2)} for Order #${orderId}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #fff; padding: 30px; border: 1px solid #ddd; border-top: none; }
              .success-icon { font-size: 60px; margin: 20px 0; }
              .amount { font-size: 36px; font-weight: bold; color: #10b981; margin: 20px 0; }
              .details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
              .detail-row:last-child { border-bottom: none; }
              .label { font-weight: bold; color: #666; }
              .value { color: #333; }
              .info-box { background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; }
              .button { display: inline-block; padding: 12px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="success-icon">✅</div>
                <h1 style="margin: 0;">Refund Approved!</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Your refund is being processed</p>
              </div>
              <div class="content">
                <p>Hi ${userName},</p>
                <p>Great news! Your refund request has been approved and is now being processed.</p>

                <center>
                  <div class="amount">$${parseFloat(amount).toFixed(2)}</div>
                </center>

                <div class="details">
                  <div class="detail-row">
                    <span class="label">Refund ID:</span>
                    <span class="value">#${refundId}</span>
                  </div>
                  <div class="detail-row">
                    <span class="label">Order ID:</span>
                    <span class="value">#${orderId}</span>
                  </div>
                  <div class="detail-row">
                    <span class="label">Refund Amount:</span>
                    <span class="value" style="font-weight: bold; color: #10b981;">$${parseFloat(amount).toFixed(2)}</span>
                  </div>
                </div>

                <div class="info-box">
                  <strong>When will I receive my refund?</strong>
                  <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                    <li>The refund will be processed to your original payment method</li>
                    <li>It typically takes 5-7 business days to appear in your account</li>
                    <li>The exact timing depends on your bank or card issuer</li>
                    <li>You'll receive a confirmation once the refund is completed</li>
                  </ul>
                </div>

                <center>
                  <a href="${process.env.FRONTEND_URL}/my-refunds" class="button">View Refund Status</a>
                </center>

                <p style="margin-top: 30px;">Thank you for your patience and for being a valued customer!</p>

                <p><strong>The OrderDabaly Team</strong></p>
              </div>
              <div class="footer">
                <p>This is an automated email from OrderDabaly. Please do not reply to this email.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      await this.emailTransporter.sendMail(mailOptions);
      console.log(`✅ Refund approved email sent to ${userEmail}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to send refund approved email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send refund completed email to customer
   */
  async sendRefundCompletedEmail(userEmail, userName, refundDetails) {
    if (!this.emailTransporter) {
      console.log('⚠️ Email service not configured - skipping refund completed email');
      return { success: false, reason: 'Email service not configured' };
    }

    try {
      const { refundId, orderId, amount } = refundDetails;

      const mailOptions = {
        from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
        to: userEmail,
        subject: `Refund Completed - $${parseFloat(amount).toFixed(2)} Refunded`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #fff; padding: 30px; border: 1px solid #ddd; border-top: none; }
              .success-icon { font-size: 60px; margin: 20px 0; }
              .amount { font-size: 36px; font-weight: bold; color: #10b981; margin: 20px 0; }
              .details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
              .detail-row:last-child { border-bottom: none; }
              .label { font-weight: bold; color: #666; }
              .value { color: #333; }
              .info-box { background: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; }
              .button { display: inline-block; padding: 12px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="success-icon">🎉</div>
                <h1 style="margin: 0;">Refund Completed!</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Your money is on its way</p>
              </div>
              <div class="content">
                <p>Hi ${userName},</p>
                <p>Your refund has been successfully processed!</p>

                <center>
                  <div class="amount">$${parseFloat(amount).toFixed(2)}</div>
                  <p style="color: #10b981; font-weight: bold;">REFUNDED</p>
                </center>

                <div class="details">
                  <div class="detail-row">
                    <span class="label">Refund ID:</span>
                    <span class="value">#${refundId}</span>
                  </div>
                  <div class="detail-row">
                    <span class="label">Order ID:</span>
                    <span class="value">#${orderId}</span>
                  </div>
                  <div class="detail-row">
                    <span class="label">Refund Amount:</span>
                    <span class="value" style="font-weight: bold; color: #10b981;">$${parseFloat(amount).toFixed(2)}</span>
                  </div>
                  <div class="detail-row">
                    <span class="label">Completed:</span>
                    <span class="value">${new Date().toLocaleDateString()}</span>
                  </div>
                </div>

                <div class="info-box">
                  <strong>✅ Refund Successfully Processed</strong>
                  <p style="margin: 10px 0 0 0;">The refund has been credited to your original payment method. Depending on your bank or card issuer, it may take 3-5 business days to appear in your account.</p>
                </div>

                <center>
                  <a href="${process.env.FRONTEND_URL}" class="button">Order Again</a>
                </center>

                <p style="margin-top: 30px;">We hope to serve you again soon!</p>

                <p><strong>The OrderDabaly Team</strong></p>
              </div>
              <div class="footer">
                <p>This is an automated email from OrderDabaly. Please do not reply to this email.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      await this.emailTransporter.sendMail(mailOptions);
      console.log(`✅ Refund completed email sent to ${userEmail}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to send refund completed email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send refund failed email to customer
   */
  async sendRefundFailedEmail(userEmail, userName, refundDetails) {
    if (!this.emailTransporter) {
      console.log('⚠️ Email service not configured - skipping refund failed email');
      return { success: false, reason: 'Email service not configured' };
    }

    try {
      const { refundId, orderId, amount } = refundDetails;

      const mailOptions = {
        from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
        to: userEmail,
        subject: `Action Required - Refund Processing Issue for Order #${orderId}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #fff; padding: 30px; border: 1px solid #ddd; border-top: none; }
              .warning-icon { font-size: 60px; margin: 20px 0; }
              .details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
              .detail-row:last-child { border-bottom: none; }
              .label { font-weight: bold; color: #666; }
              .value { color: #333; }
              .warning-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; }
              .button { display: inline-block; padding: 12px 30px; background: #ef4444; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="warning-icon">⚠️</div>
                <h1 style="margin: 0;">Refund Processing Issue</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Action required</p>
              </div>
              <div class="content">
                <p>Hi ${userName},</p>
                <p>We encountered an issue while processing your refund. Our support team has been notified and will contact you shortly to resolve this.</p>

                <div class="details">
                  <div class="detail-row">
                    <span class="label">Refund ID:</span>
                    <span class="value">#${refundId}</span>
                  </div>
                  <div class="detail-row">
                    <span class="label">Order ID:</span>
                    <span class="value">#${orderId}</span>
                  </div>
                  <div class="detail-row">
                    <span class="label">Amount:</span>
                    <span class="value">$${parseFloat(amount).toFixed(2)}</span>
                  </div>
                </div>

                <div class="warning-box">
                  <strong>What should I do?</strong>
                  <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                    <li>Our support team will reach out to you within 24 hours</li>
                    <li>Please check that your payment method is still active</li>
                    <li>You can also contact us directly for immediate assistance</li>
                  </ul>
                </div>

                <center>
                  <a href="${process.env.FRONTEND_URL}/my-refunds" class="button">View Refund Status</a>
                </center>

                <p style="margin-top: 30px;">We apologize for any inconvenience and will resolve this as quickly as possible.</p>

                <p><strong>The OrderDabaly Team</strong></p>
              </div>
              <div class="footer">
                <p>This is an automated email from OrderDabaly. Please do not reply to this email.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      await this.emailTransporter.sendMail(mailOptions);
      console.log(`✅ Refund failed email sent to ${userEmail}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to send refund failed email:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export default new NotificationService();
