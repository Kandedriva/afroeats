
const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
          
          <div className="prose prose-lg max-w-none">
            <div className="space-y-8 text-gray-700 leading-relaxed">
              
              <div className="bg-green-50 border-l-4 border-green-400 p-6 rounded-r-lg">
                <p className="text-lg font-semibold text-green-900 mb-2">Your Privacy Matters</p>
                <p className="text-green-800">
                  OrderDabaly (&quot;the Platform,&quot; &quot;we,&quot; &quot;our,&quot; &quot;us&quot;) respects your privacy. This Privacy Policy explains how we collect, use, share, and protect your personal data when you use our website, mobile applications, and services. By using our services, you agree to this Privacy Policy. If you do not agree, please stop using the Platform.
                </p>
              </div>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-gray-200 pb-2">1. Information We Collect</h2>
                <p className="mb-4 text-gray-700">We collect the following types of data:</p>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">a- Information You Provide</h3>
                    <ul className="space-y-1 list-disc list-inside ml-4 text-gray-700">
                      <li><strong>Customers:</strong> Name, email, phone number, delivery address, payment details</li>
                      <li><strong>Restaurant Owners:</strong> Business name, address, contact details, ID verification documents, Stripe account information</li>
                      <li><strong>Guest Users:</strong> Limited browsing data (e.g., IP address, cookies)</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">b- Automatically Collected Data</h3>
                    <ul className="space-y-1 list-disc list-inside ml-4 text-gray-700">
                      <li>Device type, browser, IP address, and location</li>
                      <li>Log data about how you use our app (pages visited, time spent)</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">c- Payment Information</h3>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <ul className="space-y-1 list-disc list-inside text-blue-800">
                        <li>Payments are processed securely via Stripe Connect</li>
                        <li>We do not store credit/debit card numbers</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-gray-200 pb-2">2. How We Use Your Information</h2>
                <p className="mb-3 text-gray-700">We use the collected data to:</p>
                <ul className="space-y-2 list-disc list-inside text-gray-700">
                  <li>Provide and improve our services</li>
                  <li>Process food orders and payments</li>
                  <li>Connect customers with restaurants</li>
                  <li>Verify restaurant owner identities</li>
                  <li>Communicate with you about your orders or account</li>
                  <li>Prevent fraud and ensure platform security</li>
                  <li>Comply with legal obligations (e.g., tax reporting)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-gray-200 pb-2">3. Sharing of Information</h2>
                <p className="mb-3 text-gray-700">We may share your data only in these situations:</p>
                <ul className="space-y-2 list-disc list-inside text-gray-700">
                  <li><strong>With Restaurants:</strong> To fulfill your food orders (name, delivery address, contact info)</li>
                  <li><strong>With Stripe:</strong> For payment processing and account verification</li>
                  <li><strong>With Service Providers:</strong> For hosting, analytics, or technical support</li>
                  <li><strong>For Legal Reasons:</strong> To comply with law, court orders, or prevent fraud</li>
                </ul>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                  <p className="text-green-800 font-medium">✅ We do not sell or rent your personal data to third parties.</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-gray-200 pb-2">4. Data Retention</h2>
                <ul className="space-y-2 list-disc list-inside text-gray-700">
                  <li>Customer data is retained as long as your account is active or as required by law</li>
                  <li>Restaurant owner data is retained as long as the business is active on our platform</li>
                  <li>You may request deletion of your data by contacting us (except where retention is legally required)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-gray-200 pb-2">5. Cookies & Tracking</h2>
                <ul className="space-y-2 list-disc list-inside text-gray-700">
                  <li>We use cookies and tracking technologies to improve user experience and analyze traffic</li>
                  <li>You may disable cookies in your browser, but some features may not work properly</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-gray-200 pb-2">6. Your Rights</h2>
                <p className="mb-3 text-gray-700">Depending on your location (U.S., EU, California, etc.), you may have rights to:</p>
                <ul className="space-y-2 list-disc list-inside text-gray-700">
                  <li>Access, update, or delete your personal data</li>
                  <li>Opt out of marketing communications</li>
                  <li>Request a copy of your data</li>
                </ul>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                  <p className="text-blue-800">To exercise these rights, contact us using the information provided below.</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-gray-200 pb-2">7. Data Security</h2>
                <ul className="space-y-2 list-disc list-inside text-gray-700">
                  <li>We use encryption (SSL/HTTPS) to protect your data</li>
                  <li>Payments are processed securely by Stripe</li>
                  <li>No system is 100% secure; users are encouraged to protect their own login credentials</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-gray-200 pb-2">8. Children&apos;s Privacy</h2>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800">Our services are not intended for children under 13. We do not knowingly collect data from minors.</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-gray-200 pb-2">9. Account Termination</h2>
                <ul className="space-y-2 list-disc list-inside text-gray-700">
                  <li>Customers and restaurant owners may close their accounts at any time</li>
                  <li>Upon termination, we may retain some data for legal, tax, or fraud prevention purposes</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-gray-200 pb-2">10. Changes to Privacy Policy</h2>
                <p className="text-gray-700">We may update this Privacy Policy from time to time. Updates will be posted on our website and are effective immediately.</p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-gray-200 pb-2">11. Contact Us</h2>
                <p className="mb-4 text-gray-700">If you have questions, complaints, or requests about this Privacy Policy, please contact us:</p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">📧</span>
                      <div>
                        <span className="font-semibold text-gray-800">Email:</span>
                        <a href="mailto:drivanokande4985@gmail.com" className="text-blue-600 hover:text-blue-800 ml-2">
                          drivanokande4985@gmail.com
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">📞</span>
                      <div>
                        <span className="font-semibold text-gray-800">Telephone:</span>
                        <a href="tel:+16464008425" className="text-blue-600 hover:text-blue-800 ml-2">
                          +1 (646) 400-8425
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
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

export default PrivacyPolicy;