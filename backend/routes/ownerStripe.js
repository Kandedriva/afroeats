// // backend/routes/ownerStripe.js
// import express from "express";
// import stripe from "../stripe.js";
// import pool from "../db.js";

// const router = express.Router();

// // POST /api/owners/stripe/account-status --> Create or retrieve onboarding link
// router.post("/account-status", async (req, res) => {
//   try {
//     const ownerId = req.session.ownerId;
//     if (!ownerId) return res.status(401).json({ error: "Not authenticated" });

//     const result = await pool.query(
//       "SELECT stripe_account_id FROM restaurant_owners WHERE id = $1",
//       [ownerId]
//     );

//     let accountId = result.rows[0]?.stripe_account_id;

//     if (!accountId) {
//       const account = await stripe.accounts.create({
//         type: "express",
//         country: "US",
//         capabilities: {
//           card_payments: { requested: true },
//           transfers: { requested: true },
//         },
//       });

//       accountId = account.id;

//       await pool.query(
//         "UPDATE restaurant_owners SET stripe_account_id = $1 WHERE id = $2",
//         [accountId, ownerId]
//       );
//     }

//     const accountLink = await stripe.accountLinks.create({
//       account: accountId,
//       refresh_url: `${process.env.CLIENT_URL}/owner/dashboard`,
//       return_url: `${process.env.CLIENT_URL}/owner/dashboard`,
//       type: "account_onboarding",
//     });

//     res.json({ url: accountLink.url });
//   } catch (err) {
//     console.error("Stripe onboarding error:", err.message);
//     res.status(500).json({ error: "Stripe onboarding failed" });
//   }
// });

// // GET /api/owners/stripe/account-status --> Check if onboarding completed
// router.get("/account-status", async (req, res) => {
//   try {
//     const ownerId = req.session.ownerId;
//     if (!ownerId) return res.status(401).json({ error: "Not authenticated" });

//     const result = await pool.query(
//       "SELECT stripe_account_id FROM restaurant_owners WHERE id = $1",
//       [ownerId]
//     );

//     const accountId = result.rows[0]?.stripe_account_id;
//     if (!accountId) return res.status(401).json({ error: "Stripe account not found" });

//     const account = await stripe.accounts.retrieve(accountId);

//     res.json({
//       payouts_enabled: account.payouts_enabled,
//       details_submitted: account.details_submitted,
//       charges_enabled: account.charges_enabled,
//     });
//   } catch (err) {
//     console.error("Stripe status check error:", err.message);
//     res.status(500).json({ error: "Could not check Stripe status" });
//   }
// });

// // POST /api/owners/stripe/create-payment-intent --> For customer checkout
// router.post("/create-payment-intent", async (req, res) => {
//   try {
//     const { amount, restaurantOwnerId } = req.body;

//     const result = await pool.query(
//       "SELECT stripe_account_id FROM restaurant_owners WHERE id = $1",
//       [restaurantOwnerId]
//     );

//     const stripeAccount = result.rows[0]?.stripe_account_id;
//     if (!stripeAccount) return res.status(404).json({ error: "Stripe account not found" });

//     const applicationFeeAmount = Math.round(amount * 0.05); // 5% platform fee

//     const paymentIntent = await stripe.paymentIntents.create({
//       amount,
//       currency: "usd",
//       payment_method_types: ["card"],
//       application_fee_amount: applicationFeeAmount,
//       transfer_data: { destination: stripeAccount },
//     });

//     res.json({ clientSecret: paymentIntent.client_secret });
//   } catch (err) {
//     console.error("Create PaymentIntent error:", err.message);
//     res.status(500).json({ error: "Failed to create PaymentIntent" });
//   }
// });

// export default router;
