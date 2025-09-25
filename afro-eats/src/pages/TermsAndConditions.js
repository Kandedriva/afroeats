
const TermsAndConditions = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms and Conditions</h1>
          
          <div className="prose prose-lg max-w-none">
            <div className="space-y-8 text-gray-700 leading-relaxed">
              
              <div className="bg-blue-50 border-l-4 border-blue-400 p-6 rounded-r-lg">
                <p className="text-lg font-semibold text-blue-900 mb-2">Welcome to OrderDabaly</p>
                <p className="text-blue-800">
                  Welcome to OrderDabaly (&quot;the Platform&quot;, &quot;we&quot;, &quot;our&quot;, &quot;us&quot;). These Terms and Conditions govern your use of our website, mobile applications, and services. By accessing, registering, or using OrderDabaly, whether as a guest, customer, or restaurant owner, you agree to these Terms. If you do not agree, you may not use our services.
                </p>
              </div>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-gray-200 pb-2">1. Eligibility</h2>
                <ul className="space-y-2 list-disc list-inside text-gray-700">
                  <li>You must be at least 18 years old to register as a restaurant owner or to place an order as a customer.</li>
                  <li>Guest users may browse publicly available content but must create an account to place orders.</li>
                  <li>By registering, you confirm that all information you provide is true, accurate, and complete.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-gray-200 pb-2">2. Services Provided</h2>
                <ul className="space-y-2 list-disc list-inside text-gray-700">
                  <li>OrderDabaly is an online marketplace that connects customers with local restaurants for food ordering and delivery.</li>
                  <li>We do not prepare, deliver, or sell food. Restaurants are fully responsible for food quality, safety, and delivery.</li>
                  <li>Customers may browse menus, add items to their cart, and complete transactions through Stripe-powered payments.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-gray-200 pb-2">3. Restaurant Owner Accounts</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">Registration Requirements</h3>
                    <ul className="space-y-1 list-disc list-inside ml-4 text-gray-700">
                      <li>Business name, address, and contact details</li>
                      <li>A valid government-issued ID and proof of restaurant ownership if requested</li>
                      <li>A connected Stripe account for payments</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">Responsibilities</h3>
                    <ul className="space-y-1 list-disc list-inside ml-4 text-gray-700">
                      <li>Accuracy of menu items, prices, and delivery fees</li>
                      <li>Fulfilling orders in a timely and professional manner</li>
                      <li>Compliance with local health and safety regulations</li>
                    </ul>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800 font-medium">⚠️ Fraudulent or false registration will result in immediate suspension.</p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-gray-200 pb-2">4. Customer Accounts</h2>
                <p className="mb-3 text-gray-700">Customers must register with a valid email, password, and payment method to place an order.</p>
                <div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">Customer Responsibilities</h3>
                  <ul className="space-y-1 list-disc list-inside ml-4 text-gray-700">
                    <li>Providing accurate delivery information</li>
                    <li>Paying for orders placed through the Platform</li>
                    <li>Not engaging in fraudulent activity (e.g., chargebacks, false claims)</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-gray-200 pb-2">5. Guest Users</h2>
                <ul className="space-y-2 list-disc list-inside text-gray-700">
                  <li>Guests may browse restaurants and menus without registration.</li>
                  <li>To place an order, users must create a valid account and accept these Terms.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-gray-200 pb-2">6. Payments, Fees, and Refunds</h2>
                <ul className="space-y-2 list-disc list-inside text-gray-700">
                  <li>Payments are securely processed through Stripe Connect.</li>
                  <li>Restaurants receive payouts directly to their Stripe account.</li>
                  <li>OrderDabaly charges a commission per order (e.g., $1.20 per completed transaction).</li>
                  <li>Customers are responsible for all applicable taxes and delivery fees, which are determined by the restaurant.</li>
                  <li>Refunds, cancellations, and disputes are subject to the restaurant&apos;s policy, not OrderDabaly. We may assist in resolving disputes but are not liable for refunds.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-gray-200 pb-2">7. Delivery</h2>
                <ul className="space-y-2 list-disc list-inside text-gray-700">
                  <li>Delivery is the sole responsibility of the restaurant.</li>
                  <li>Delivery fees are set by restaurants.</li>
                  <li>OrderDabaly is not responsible for delays, errors, or damages during delivery.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-gray-200 pb-2">8. Data Protection & Privacy</h2>
                <ul className="space-y-2 list-disc list-inside text-gray-700">
                  <li>By using the Platform, you agree that we may collect and process personal data in accordance with our Privacy Policy.</li>
                  <li>We do not store full payment card details. Payments are processed securely by Stripe.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-gray-200 pb-2">9. Prohibited Use</h2>
                <p className="mb-3 text-gray-700">You agree not to:</p>
                <ul className="space-y-2 list-disc list-inside ml-4 text-gray-700">
                  <li>Use the Platform for illegal purposes</li>
                  <li>Register with false or stolen information</li>
                  <li>Interfere with the Platform&apos;s security or functionality</li>
                  <li>Copy, modify, or resell the Platform without authorization</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-gray-200 pb-2">10. Termination</h2>
                <ul className="space-y-2 list-disc list-inside text-gray-700">
                  <li>We reserve the right to suspend or terminate any account (customer or restaurant) that violates these Terms or engages in fraud, abuse, or illegal activity.</li>
                  <li>Users may close their accounts at any time.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-gray-200 pb-2">11. Limitation of Liability</h2>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <ul className="space-y-2 list-disc list-inside text-yellow-800">
                    <li>OrderDabaly is a technology platform, not a restaurant or delivery company.</li>
                    <li>We are not responsible for food preparation, delivery, quality, pricing, or restaurant services.</li>
                    <li>To the fullest extent permitted by law, our liability is limited to the commission fee collected on your order.</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-gray-200 pb-2">12. Changes to Terms</h2>
                <p className="text-gray-700">We may update these Terms from time to time. Updated Terms will be posted on the Platform and effective immediately upon posting.</p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-gray-200 pb-2">13. Governing Law</h2>
                <ul className="space-y-2 list-disc list-inside text-gray-700">
                  <li>These Terms are governed by the laws of the State of New York, USA.</li>
                  <li>Any disputes shall be resolved exclusively in the courts of New York.</li>
                </ul>
              </section>

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