
const TermsAndConditions = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms and Conditions</h1>
          
          <div className="prose prose-lg max-w-none">
            <div className="space-y-6 text-gray-700 leading-relaxed">
              {/* Placeholder for terms content */}
              <p className="text-lg text-gray-500 italic text-center py-12">

              Terms and Conditions of Use – OrderDabaly 

Welcome to OrderDabaly (“the Platform”, “we”, “our”, “us”).
These Terms and Conditions govern your use of our website, mobile applications, and services. By accessing, registering, or using OrderDabaly, whether as a guest, customer, or restaurant owner, you agree to these Terms. If you do not agree, you may not use our services.

1. Eligibility

You must be at least 18 years old to register as a restaurant owner or to place an order as a customer.

Guest users and registered user can browse publicly available content andplace orders.

By registering, you confirm that all information you provide is true, accurate, and complete.

2. Services Provided

OrderDabaly is an online marketplace that connects customers with local restaurants for food ordering and delivery.

We do not prepare, deliver, or sell food. Restaurants are fully responsible for food quality, safety, and delivery.

Customers may browse menus, add items to their cart, and complete transactions through Stripe-powered payments.

3. Restaurant Owner Accounts

To register, restaurant owners must provide:

Business name, address, and contact details.

A valid government-issued ID and proof of restaurant ownership if requested.

A connected Stripe account for payments.

Restaurants are responsible for:

Accuracy of menu items, prices, and delivery fees.

Fulfilling orders in a timely and professional manner.

Compliance with local health and safety regulations.

Fraudulent or false registration will result in immediate suspension.

4. Customer Accounts

Customers must register with a valid email, password, and payment method to place an order.

Customers are responsible for:

Providing accurate delivery information.

Paying for orders placed through the Platform.

Not engaging in fraudulent activity (e.g., chargebacks, false claims).

5. Guest Users

Guests may browse restaurants and menus and place their orders without registration.

To place an order, users must create a valid account and accept these Terms.

6. Payments, Fees, and Refunds

Payments are securely processed through Stripe Connect.

Restaurants receive payouts directly to their Stripe account.

OrderDabaly charges a commission per order (e.g., $1.20 per completed transaction).

Customers are responsible for all applicable taxes and delivery fees, which are determined by the restaurant.

Refunds, cancellations, and disputes are subject to the restaurant&apos;s policy, not OrderDabaly. We may assist in resolving disputes but are not liable for refunds.

7. Delivery

Delivery is the sole responsibility of the restaurant.

Delivery fees are set by restaurants.

OrderDabaly is not responsible for delays, errors, or damages during delivery.

8. Data Protection & Privacy

By using the Platform, you agree that we may collect and process personal data in accordance with our Privacy Policy.

We do not store full payment card details. Payments are processed securely by Stripe.

9. SMS Notifications for Restaurant Owners

9.1 Consent to Receive SMS Notifications

By registering as a restaurant owner on OrderDabaly and providing your mobile phone number, you expressly consent to receive transactional SMS (text message) notifications from OrderDabaly or our authorized service providers (including Twilio Inc.) related to your business operations on the Platform.

9.2 Types of SMS Messages

The SMS notifications you may receive include, but are not limited to:
• New order alerts with customer and order details
• Order status updates and modifications
• Important account notifications
• Time-sensitive business updates
• Platform operational notifications

These are transactional messages necessary for the operation of your restaurant business on our Platform and are not marketing or promotional communications.

9.3 Message Frequency

Message frequency varies based on your restaurant&apos;s order volume. You may receive multiple messages per day during peak business hours when orders are placed.

9.4 Message and Data Rates

Standard message and data rates from your mobile carrier may apply. OrderDabaly is not responsible for any charges you may incur from your mobile carrier for receiving SMS notifications.

9.5 Opt-Out Rights

You may opt out of SMS notifications at any time by:
• Replying STOP to any SMS message you receive from us
• Updating your notification preferences in your restaurant owner dashboard under Settings → Notifications
• Contacting our support team at storeshopify825@gmail.com with your request to opt out

Please note that opting out of SMS notifications may impact your ability to receive timely order notifications, which could affect your restaurant&apos;s service quality and customer satisfaction.

9.6 Privacy and Data Security

Your mobile phone number will be:
• Stored securely in our database with encryption
• Used solely for sending transactional notifications related to your restaurant operations
• Not sold, rented, or shared with third parties for marketing purposes
• Transmitted to our SMS service provider (Twilio) only for the purpose of delivering notifications

9.7 Accuracy of Phone Number

You are responsible for:
• Providing an accurate and active mobile phone number
• Updating your phone number promptly if it changes
• Ensuring you have authority to consent to receive SMS messages at the provided number

9.8 Service Availability

While we strive to deliver all SMS notifications reliably, we cannot guarantee:
• Delivery of every message due to carrier limitations, network issues, or phone settings
• Immediate delivery of time-sensitive notifications
• SMS service availability during system maintenance or outages

OrderDabaly is not liable for any consequences resulting from non-delivery, delayed delivery, or failed delivery of SMS notifications.

9.9 Modifications to SMS Service

We reserve the right to:
• Modify the SMS notification service, including message content and frequency
• Suspend or terminate the SMS service temporarily or permanently
• Change SMS service providers without prior notice

Material changes to SMS notification practices will be communicated through your dashboard or email.

10. Prohibited Use

You agree not to:

Use the Platform for illegal purposes.

Register with false or stolen information.

Interfere with the Platform's security or functionality.

Copy, modify, or resell the Platform without authorization.

11. Termination

We reserve the right to suspend or terminate any account (customer or restaurant) that violates these Terms or engages in fraud, abuse, or illegal activity.

Users may close their accounts at any time.

12. Limitation of Liability

OrderDabaly is a technology platform, not a restaurant or delivery company.

We are not responsible for food preparation, delivery, quality, pricing, or restaurant services.

To the fullest extent permitted by law, our liability is limited to the commission fee collected on your order.

13. Changes to Terms

We may update these Terms from time to time. Updated Terms will be posted on the Platform and effective immediately upon posting.

14. Governing Law

These Terms are governed by the laws of the State of New York, USA.

Any disputes shall be resolved exclusively in the courts of New York.

              </p>
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;