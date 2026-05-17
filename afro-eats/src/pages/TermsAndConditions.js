
const Section = ({ number, title, children }) => (
  <div className="mb-8">
    <h2 className="text-xl font-bold text-gray-900 mb-3">{number}. {title}</h2>
    <div className="space-y-3 text-gray-700">{children}</div>
  </div>
);

const SubSection = ({ title, children }) => (
  <div className="ml-4 mb-3">
    <h3 className="font-semibold text-gray-800 mb-1">{title}</h3>
    <div className="text-gray-700">{children}</div>
  </div>
);

const TermsAndConditions = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms and Conditions of Use</h1>
          <p className="text-lg font-semibold text-green-700 mb-6">OrderDabaly</p>

          <p className="text-gray-700 mb-8 leading-relaxed">
            Welcome to OrderDabaly (&quot;the Platform&quot;, &quot;we&quot;, &quot;our&quot;, &quot;us&quot;). These Terms and Conditions govern
            your use of our website, mobile applications, and services. By accessing, registering, or using
            OrderDabaly — whether as a guest, customer, restaurant owner, or grocery store owner — you agree
            to these Terms. If you do not agree, you may not use our services.
          </p>

          <div className="space-y-2 text-gray-700 leading-relaxed">

            {/* ── PART I: RESTAURANT MARKETPLACE ── */}
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-gray-900 border-b-2 border-green-200 pb-2 mb-6">
                Part I — Restaurant Marketplace
              </h2>

              <Section number="1" title="Eligibility">
                <p>You must be at least 18 years old to register as a restaurant owner or to place an order as a customer.</p>
                <p>Guest users and registered users can browse publicly available content and place orders.</p>
                <p>By registering, you confirm that all information you provide is true, accurate, and complete.</p>
              </Section>

              <Section number="2" title="Services Provided">
                <p>OrderDabaly is an online marketplace that connects customers with local restaurants for food ordering and delivery.</p>
                <p>We do not prepare, deliver, or sell food. Restaurants are fully responsible for food quality, safety, and delivery.</p>
                <p>Customers may browse menus, add items to their cart, and complete transactions through Stripe-powered payments.</p>
              </Section>

              <Section number="3" title="Restaurant Owner Accounts">
                <p>To register, restaurant owners must provide:</p>
                <ul className="list-disc ml-6 space-y-1">
                  <li>Business name, address, and contact details.</li>
                  <li>A valid government-issued ID and proof of restaurant ownership if requested.</li>
                  <li>A connected Stripe account for payments.</li>
                </ul>
                <p className="mt-2">Restaurants are responsible for:</p>
                <ul className="list-disc ml-6 space-y-1">
                  <li>Accuracy of menu items, prices, and delivery fees.</li>
                  <li>Fulfilling orders in a timely and professional manner.</li>
                  <li>Compliance with local health and safety regulations.</li>
                </ul>
                <p className="mt-2">Fraudulent or false registration will result in immediate suspension.</p>
              </Section>

              <Section number="4" title="Customer Accounts">
                <p>Customers must register with a valid email, password, and payment method to place an order.</p>
                <p>Customers are responsible for:</p>
                <ul className="list-disc ml-6 space-y-1">
                  <li>Providing accurate delivery information.</li>
                  <li>Paying for orders placed through the Platform.</li>
                  <li>Not engaging in fraudulent activity (e.g., chargebacks, false claims).</li>
                </ul>
              </Section>

              <Section number="5" title="Guest Users">
                <p>Guests may browse restaurants and menus and place orders without registration.</p>
                <p>A valid email address is required to complete a guest order and receive order confirmation.</p>
              </Section>

              <Section number="6" title="Payments, Fees, and Refunds — Restaurants">
                <p>Payments are securely processed through Stripe Connect.</p>
                <p>Restaurants receive payouts directly to their connected Stripe account.</p>
                <p>OrderDabaly charges a flat platform fee of <strong>$1.20 per completed restaurant order</strong>, added to the customer&apos;s total. Restaurant owners receive the full food subtotal.</p>
                <p>Customers are responsible for all applicable delivery fees, which are calculated based on distance.</p>
                <p>Refunds, cancellations, and disputes are subject to the restaurant&apos;s policy. OrderDabaly may assist in resolving disputes but is not liable for refunds.</p>
              </Section>

              <Section number="7" title="Delivery — Restaurants">
                <p>Delivery is the sole responsibility of the restaurant.</p>
                <p>Delivery fees are calculated automatically based on the distance between the restaurant and the customer&apos;s delivery address.</p>
                <p>OrderDabaly is not responsible for delays, errors, or damages during delivery.</p>
              </Section>

              <Section number="8" title="SMS Notifications for Restaurant Owners">
                <SubSection title="8.1 Consent to Receive SMS Notifications">
                  <p>By registering as a restaurant owner on OrderDabaly and providing your mobile phone number, you expressly consent to receive transactional SMS notifications from OrderDabaly or our authorized service providers (including Twilio Inc.) related to your business operations on the Platform.</p>
                </SubSection>
                <SubSection title="8.2 Types of SMS Messages">
                  <p>The SMS notifications you may receive include, but are not limited to:</p>
                  <ul className="list-disc ml-6 space-y-1 mt-1">
                    <li>New order alerts with customer and order details</li>
                    <li>Order status updates and modifications</li>
                    <li>Important account notifications</li>
                    <li>Time-sensitive business updates</li>
                    <li>Platform operational notifications</li>
                  </ul>
                  <p className="mt-2">These are transactional messages necessary for the operation of your restaurant business on our Platform and are not marketing or promotional communications.</p>
                </SubSection>
                <SubSection title="8.3 Message Frequency">
                  <p>Message frequency varies based on your restaurant&apos;s order volume. You may receive multiple messages per day during peak business hours when orders are placed.</p>
                </SubSection>
                <SubSection title="8.4 Message and Data Rates">
                  <p>Standard message and data rates from your mobile carrier may apply. OrderDabaly is not responsible for any charges you may incur from your mobile carrier for receiving SMS notifications.</p>
                </SubSection>
                <SubSection title="8.5 Opt-Out Rights">
                  <p>You may opt out of SMS notifications at any time by:</p>
                  <ul className="list-disc ml-6 space-y-1 mt-1">
                    <li>Replying STOP to any SMS message you receive from us</li>
                    <li>Updating your notification preferences in your restaurant owner dashboard under Settings → Notifications</li>
                    <li>Contacting our support team at support@orderdabaly.com with your request to opt out</li>
                  </ul>
                  <p className="mt-2">Please note that opting out of SMS notifications may impact your ability to receive timely order notifications, which could affect your restaurant&apos;s service quality and customer satisfaction.</p>
                </SubSection>
                <SubSection title="8.6 Privacy and Data Security">
                  <p>Your mobile phone number will be:</p>
                  <ul className="list-disc ml-6 space-y-1 mt-1">
                    <li>Stored securely in our database</li>
                    <li>Used solely for sending transactional notifications related to your restaurant operations</li>
                    <li>Not sold, rented, or shared with third parties for marketing purposes</li>
                    <li>Transmitted to our SMS service provider (Twilio) only for the purpose of delivering notifications</li>
                  </ul>
                </SubSection>
                <SubSection title="8.7 Accuracy of Phone Number">
                  <p>You are responsible for providing an accurate and active mobile phone number, updating it promptly if it changes, and ensuring you have authority to consent to receive SMS messages at the provided number.</p>
                </SubSection>
                <SubSection title="8.8 Service Availability">
                  <p>While we strive to deliver all SMS notifications reliably, we cannot guarantee delivery of every message due to carrier limitations, network issues, or phone settings. OrderDabaly is not liable for any consequences resulting from non-delivery or delayed delivery of SMS notifications.</p>
                </SubSection>
              </Section>
            </div>

            {/* ── PART II: GROCERY MARKETPLACE ── */}
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-gray-900 border-b-2 border-green-200 pb-2 mb-6">
                Part II — Grocery Marketplace
              </h2>

              <Section number="9" title="About the Grocery Marketplace">
                <p>OrderDabaly operates an online grocery marketplace that connects independent grocery store owners (&quot;Sellers&quot;) with shoppers (&quot;Customers&quot;). <strong>OrderDabaly is not a grocery store and does not sell, handle, store, or ship any products.</strong> All products listed on the platform are owned and sold exclusively by independent Sellers.</p>
              </Section>

              <Section number="10" title="For Grocery Customers">
                <SubSection title="10.1 Orders and Purchases">
                  <p>When you place a grocery order, you are purchasing directly from the Seller, not from OrderDabaly. Product descriptions, prices, availability, and quality are the sole responsibility of the Seller. OrderDabaly does not guarantee the accuracy of product listings, including weight, freshness, or availability.</p>
                </SubSection>
                <SubSection title="10.2 Payments and Service Fee">
                  <p>Payments are processed securely through Stripe. OrderDabaly charges a service fee of <strong>10% of your product subtotal (minimum $2.00)</strong>, added on top of your product total at checkout. Store owners receive the full product subtotal. The service fee is refundable in the following cases:</p>
                  <ul className="list-disc ml-6 space-y-1 mt-1">
                    <li>The order is cancelled before the Seller begins preparation</li>
                    <li>The Seller fails to fulfill or deliver the order</li>
                    <li>A dispute is resolved in the customer&apos;s favor</li>
                  </ul>
                  <p className="mt-2">The service fee is non-refundable once the order has been prepared and dispatched by the Seller.</p>
                </SubSection>
                <SubSection title="10.3 Delivery">
                  <p><strong>OrderDabaly does not provide delivery or shipping services.</strong> Delivery is arranged and fulfilled entirely by the Seller. Delivery fees are calculated automatically based on the distance between the store and your delivery address using real-time distance data. Neither OrderDabaly nor the Seller sets a fixed delivery fee — it is determined at checkout based on your location. OrderDabaly is not responsible for delayed, damaged, or missing deliveries.</p>
                </SubSection>
                <SubSection title="10.4 Refunds and Cancellations">
                  <p>If you have an issue with your order (wrong items, missing items, poor quality), you must first contact the Seller directly. If a resolution cannot be reached, you may open a dispute with OrderDabaly (see Section 12). Refund eligibility for the product amount is subject to the individual Seller&apos;s policy.</p>
                </SubSection>
                <SubSection title="10.5 Your Responsibilities as a Grocery Customer">
                  <ul className="list-disc ml-6 space-y-1">
                    <li>You must provide an accurate delivery address and reachable contact information.</li>
                    <li>You are responsible for being available to receive your order at the agreed time.</li>
                    <li>You must be of legal age to purchase any age-restricted products.</li>
                  </ul>
                </SubSection>
              </Section>

              <Section number="11" title="For Grocery Store Owners (Sellers)">
                <SubSection title="11.1 Store Registration and Approval">
                  <p>All grocery stores must be reviewed and approved by OrderDabaly before becoming visible to customers. OrderDabaly reserves the right to reject, suspend, or permanently remove any store that violates these terms or applicable laws. You must provide accurate business information during registration.</p>
                </SubSection>
                <SubSection title="11.2 Product Listings">
                  <p>You are solely responsible for the accuracy of your product listings, including names, descriptions, prices, weights, units, and availability. You must not list expired, counterfeit, illegal, or prohibited products. You must keep stock quantities up to date to avoid selling items you cannot fulfill.</p>
                </SubSection>
                <SubSection title="11.3 Delivery Responsibility">
                  <p><strong>You are fully responsible for delivering orders to customers.</strong> OrderDabaly does not provide, arrange, or guarantee any delivery service. You are responsible for packaging, handling, and delivering products in a safe and timely manner. You must be able to deliver to the areas your store serves.</p>
                </SubSection>
                <SubSection title="11.4 Payments">
                  <p>OrderDabaly collects payments from customers on your behalf through Stripe Connect. A platform service fee (10% of the order subtotal, minimum $2.00) is retained by OrderDabaly per order. The remaining amount — the full product subtotal — is transferred directly to your connected Stripe account after each successful order. You are responsible for completing Stripe Connect onboarding to receive payouts. OrderDabaly is not liable for delays caused by incomplete onboarding. Stripe&apos;s own processing fees are separate and governed by Stripe&apos;s terms.</p>
                </SubSection>
                <SubSection title="11.5 Your Responsibilities as a Seller">
                  <ul className="list-disc ml-6 space-y-1">
                    <li>Fulfill all confirmed orders promptly or notify the customer immediately if fulfillment is not possible.</li>
                    <li>Comply with all local food safety, health, and business regulations.</li>
                    <li>Handle customer complaints professionally and in good faith.</li>
                    <li>Not engage in fraudulent pricing, fake reviews, or deceptive practices.</li>
                  </ul>
                </SubSection>
                <SubSection title="11.6 Store Suspension">
                  <p>OrderDabaly may suspend or permanently remove your store for reasons including but not limited to repeated customer complaints, failure to fulfill orders, listing prohibited products, or violations of these terms.</p>
                </SubSection>
              </Section>

              <Section number="12" title="Grocery Dispute Resolution">
                <p>OrderDabaly may act as a neutral facilitator in disputes between Customers and Sellers. To open a dispute, contact OrderDabaly support with your order ID, a description of the issue, and any supporting evidence (photos, messages). OrderDabaly&apos;s decision in disputes is advisory. We may, at our discretion, issue a refund to the customer or take action against the Seller&apos;s account. OrderDabaly is not a party to the transaction and cannot be held liable for losses resulting from a dispute.</p>
              </Section>
            </div>

            {/* ── GENERAL PROVISIONS ── */}
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-gray-900 border-b-2 border-green-200 pb-2 mb-6">
                Part III — General Provisions
              </h2>

              <Section number="13" title="Data Protection & Privacy">
                <p>By using the Platform, you agree that we may collect and process personal data in accordance with our Privacy Policy. We do not store full payment card details. Payments are processed securely by Stripe.</p>
              </Section>

              <Section number="14" title="Prohibited Use">
                <p>You agree not to:</p>
                <ul className="list-disc ml-6 space-y-1 mt-1">
                  <li>Use the Platform for illegal purposes.</li>
                  <li>Register with false or stolen information.</li>
                  <li>Interfere with the Platform&apos;s security or functionality.</li>
                  <li>Copy, modify, or resell the Platform without authorization.</li>
                </ul>
              </Section>

              <Section number="15" title="Termination">
                <p>We reserve the right to suspend or terminate any account that violates these Terms or engages in fraud, abuse, or illegal activity. Users may close their accounts at any time.</p>
              </Section>

              <Section number="16" title="Limitation of Liability">
                <p>OrderDabaly is a technology platform, not a restaurant, grocery store, or delivery company. We are not responsible for food or product preparation, delivery, quality, pricing, or seller services. To the fullest extent permitted by law, our liability is limited to the platform service fee collected on the relevant order.</p>
              </Section>

              <Section number="17" title="Changes to Terms">
                <p>We may update these Terms from time to time. Updated Terms will be posted on the Platform and effective immediately upon posting. Continued use of the Platform after changes constitutes acceptance of the new terms.</p>
              </Section>

              <Section number="18" title="Governing Law">
                <p>These Terms are governed by the laws of the State of New York, USA. Any disputes shall be resolved exclusively in the courts of New York.</p>
              </Section>

              <Section number="19" title="Contact">
                <p>For support or disputes: <strong>support@orderdabaly.com</strong></p>
              </Section>
            </div>

          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">Last updated: May 2026</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;
