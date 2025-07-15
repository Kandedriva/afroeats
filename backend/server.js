import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import pgSession from "connect-pg-simple";
import pool from "./db.js";
import authRoutes from "./routes/authRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import restaurantRoutes from "./routes/restaurantRoutes.js";
import ownerRoutes from "./routes/ownerRoutes.js";
import ownerAuthRoutes from "./routes/ownerAuthRoutes.js";



dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(express.json());

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
}));

app.use("/uploads", express.static("uploads"));


// Session store setup
const PgSession = pgSession(session);

app.use(session({
  store: new PgSession({
    pool: pool,                // Connection pool
    tableName: 'session'       // Use default 'session' table
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    httpOnly: true,
    secure: false,               // Set true if using HTTPS
    sameSite: "lax",
  },
}));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api", restaurantRoutes);
app.use("/api/owners", ownerRoutes);
app.use("/api/auth", ownerAuthRoutes);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
