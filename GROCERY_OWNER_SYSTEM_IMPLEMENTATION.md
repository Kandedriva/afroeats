# Grocery Store Owner System Implementation Guide

## ✅ Completed Components

### 1. Frontend Components Created
- ✅ `/afro-eats/src/pages/RegisterGroceryOwner.js` - Registration page
- ✅ `/afro-eats/src/pages/GroceryOwnerLogin.js` - Login page
- ✅ `/afro-eats/src/context/GroceryOwnerAuthContext.js` - Authentication context
- ✅ `/afro-eats/src/Components/ProtectedGroceryOwnerRoute.js` - Route protection

### 2. Backend Routes Created
- ✅ `/backend/routes/groceryOwnerRoutes.js` - Complete authentication routes
- ✅ Added to `server.js` - Routes registered

## 🚧 Remaining Implementation Steps

### STEP 1: Create Database Tables

Create a new migration file: `/backend/migrations/create_grocery_owner_tables.sql`

```sql
-- Create grocery_store_owners table
CREATE TABLE IF NOT EXISTS grocery_store_owners (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  secret_word VARCHAR(255) NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Create grocery_stores table
CREATE TABLE IF NOT EXISTS grocery_stores (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  image_url VARCHAR(500),
  owner_id INTEGER REFERENCES grocery_store_owners(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_grocery_store_owners_email ON grocery_store_owners(email);
CREATE INDEX idx_grocery_stores_owner_id ON grocery_stores(owner_id);
CREATE INDEX idx_grocery_stores_location ON grocery_stores(latitude, longitude);
```

**Run the migration:**
```bash
PGPASSWORD='your_password' psql "your_connection_string" -f backend/migrations/create_grocery_owner_tables.sql
```

### STEP 2: Create Grocery Owner Navbar

Create: `/afro-eats/src/Components/GroceryOwnerNavbar.jsx`

```javascript
import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGroceryOwnerAuth } from "../context/GroceryOwnerAuthContext";
import { API_BASE_URL } from "../config/api";

const GroceryOwnerNavbar = () => {
  const { groceryOwner, logout } = useGroceryOwnerAuth();
  const [store, setStore] = useState(null);
  const [activeOrderCount, setActiveOrderCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const fetchStore = useCallback(async () => {
    if (groceryOwner) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/grocery-owners/store`, {
          credentials: "include",
        });
        if (res.ok) {
          const storeData = await res.json();
          setStore(storeData);
        }
      } catch (err) {
        // Store fetch failed
      }
    }
  }, [groceryOwner]);

  useEffect(() => {
    fetchStore();
  }, [groceryOwner, fetchStore]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/grocery-owner/login");
    } catch (err) {
      // Error handling
    }
  };

  return (
    <nav className="bg-green-800 text-white">
      <div className="px-4 py-3 flex justify-between items-center">
        {groceryOwner && store && (
          <div className="flex items-center space-x-3">
            {store.image_url && (
              <img
                src={store.image_url}
                alt={store.name}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-gray-300"
              />
            )}
            <Link to="/grocery-owner/dashboard" className="text-lg sm:text-xl font-bold">
              {store.name}
            </Link>
          </div>
        )}

        {groceryOwner && (
          <div className="hidden lg:flex items-center space-x-4">
            <Link to="/grocery-owner/orders" className="hover:underline bg-purple-600 px-3 py-2 rounded transition-colors">
              📋 Orders
            </Link>
            <Link to="/grocery-owner/products" className="hover:underline bg-blue-600 px-3 py-2 rounded transition-colors">
              🛒 Products
            </Link>
            <Link to="/grocery-owner/account" className="hover:underline bg-indigo-600 px-3 py-2 rounded transition-colors">
              ⚙️ Account
            </Link>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 px-3 py-2 rounded transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default GroceryOwnerNavbar;
```

### STEP 3: Create Grocery Owner Dashboard

Create: `/afro-eats/src/pages/GroceryOwnerDashboard.js`

```javascript
import { useState, useEffect, useContext } from 'react';
import { GroceryOwnerAuthContext } from '../context/GroceryOwnerAuthContext';
import { API_BASE_URL } from '../config/api';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';

function GroceryOwnerDashboard() {
  const { groceryOwner } = useContext(GroceryOwnerAuthContext);
  const [store, setStore] = useState(null);
  const [stats, setStats] = useState({
    totalOrders: 0,
    activeOrders: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch store info
      const storeRes = await fetch(`${API_BASE_URL}/api/grocery-owners/store`, {
        credentials: 'include',
      });

      if (storeRes.ok) {
        const storeData = await storeRes.json();
        setStore(storeData);
      }

      // TODO: Fetch orders stats

    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome, {groceryOwner?.name}!</h1>
          <p className="text-gray-600">{store?.name}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Orders</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalOrders}</p>
              </div>
              <div className="text-4xl">📦</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Active Orders</p>
                <p className="text-3xl font-bold text-green-600">{stats.activeOrders}</p>
              </div>
              <div className="text-4xl">🛒</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Revenue</p>
                <p className="text-3xl font-bold text-gray-900">${stats.totalRevenue.toFixed(2)}</p>
              </div>
              <div className="text-4xl">💰</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/grocery-owner/orders"
              className="flex items-center justify-center py-4 px-6 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
            >
              📋 View Orders
            </Link>
            <Link
              to="/grocery-owner/products"
              className="flex items-center justify-center py-4 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              🛒 Manage Products
            </Link>
            <Link
              to="/grocery-owner/account"
              className="flex items-center justify-center py-4 px-6 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
            >
              ⚙️ Account Settings
            </Link>
          </div>
        </div>

        {/* Store Information */}
        {store && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Store Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600 text-sm">Store Name</p>
                <p className="font-semibold">{store.name}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Phone Number</p>
                <p className="font-semibold">{store.phone_number}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-gray-600 text-sm">Address</p>
                <p className="font-semibold">{store.address}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GroceryOwnerDashboard;
```

### STEP 4: Update App.js

Add to imports:
```javascript
import RegisterGroceryOwner from "./pages/RegisterGroceryOwner";
import GroceryOwnerLogin from "./pages/GroceryOwnerLogin";
import GroceryOwnerDashboard from "./pages/GroceryOwnerDashboard";
import GroceryOwnerNavbar from "./Components/GroceryOwnerNavbar";
import ProtectedGroceryOwnerRoute from "./Components/ProtectedGroceryOwnerRoute";
import { GroceryOwnerAuthProvider } from "./context/GroceryOwnerAuthContext";
```

Update AppContent component to show GroceryOwnerNavbar:
```javascript
function AppContent() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const isOwnerRoute = location.pathname.startsWith("/owner");
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isDriverRoute = location.pathname.startsWith("/driver");
  const isGroceryOwnerRoute = location.pathname.startsWith("/grocery-owner");

  return (
    <>
      {!isOwnerRoute && !isAdminRoute && !isDriverRoute && !isGroceryOwnerRoute && <Navbar />}
      {isOwnerRoute && <OwnerNavbar />}
      {isDriverRoute && <DriverNavbar />}
      {isGroceryOwnerRoute && <GroceryOwnerNavbar />}

      {/* ... rest of component */}
    </>
  );
}
```

Add routes before Admin Routes:
```javascript
{/* Grocery Owner Routes */}
<Route path="/register-grocery-owner" element={<RegisterGroceryOwner />} />
<Route path="/grocery-owner/login" element={<GroceryOwnerLogin />} />
<Route
  path="/grocery-owner/dashboard"
  element={
    <ProtectedGroceryOwnerRoute>
      <GroceryOwnerDashboard />
    </ProtectedGroceryOwnerRoute>
  }
/>
<Route
  path="/grocery-owner/orders"
  element={
    <ProtectedGroceryOwnerRoute>
      <OwnerGroceryOrders />
    </ProtectedGroceryOwnerRoute>
  }
/>
```

Wrap App in GroceryOwnerAuthProvider:
```javascript
function App() {
  return (
    <AsyncErrorBoundary>
      <ErrorBoundary level="app">
        <div className="min-h-screen bg-gray-100">
          <AuthProvider>
            <OwnerAuthProvider>
              <GroceryOwnerAuthProvider>
                <DriverAuthProvider>
                  <GuestProvider>
                    {/* ... rest of providers */}
                  </GuestProvider>
                </DriverAuthProvider>
              </GroceryOwnerAuthProvider>
            </OwnerAuthProvider>
          </AuthProvider>
        </div>
      </ErrorBoundary>
    </AsyncErrorBoundary>
  );
}
```

### STEP 5: Update OwnerGroceryOrders.js

Replace the imports and context:
```javascript
import { useState, useEffect, useContext } from 'react';
import { GroceryOwnerAuthContext } from '../context/GroceryOwnerAuthContext';
import { API_BASE_URL } from '../config/api';
import { toast } from 'react-toastify';

const OwnerGroceryOrders = () => {
  const { groceryOwner } = useContext(GroceryOwnerAuthContext);
  // ... rest of component
```

### STEP 6: Add to HomePage.js

Add grocery store registration section (similar to driver section):
```javascript
{/* Become a Grocery Partner Section */}
<div className="bg-gradient-to-r from-green-600 to-blue-600 text-white py-16">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
      <div>
        <h2 className="text-4xl font-bold mb-4">🛒 Partner with Order Dabaly</h2>
        <p className="text-lg mb-6">
          Register your grocery store and reach thousands of customers in your area.
        </p>
        <div className="space-y-4 mb-8">
          <div className="flex items-start gap-3">
            <div className="text-2xl">✅</div>
            <div>
              <h3 className="font-semibold text-lg">Reach More Customers</h3>
              <p>Expand your customer base beyond your neighborhood</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="text-2xl">💰</div>
            <div>
              <h3 className="font-semibold text-lg">Increase Revenue</h3>
              <p>Grow your sales with online ordering</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="text-2xl">📱</div>
            <div>
              <h3 className="font-semibold text-lg">Easy Management</h3>
              <p>Simple dashboard to manage orders and products</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            to="/register-grocery-owner"
            className="inline-block px-8 py-4 bg-white text-green-600 rounded-lg hover:bg-gray-100 transition-colors font-semibold text-lg text-center shadow-lg"
          >
            Register Your Store
          </Link>
          <Link
            to="/grocery-owner/login"
            className="inline-block px-8 py-4 bg-green-800 text-white rounded-lg hover:bg-green-900 transition-colors font-semibold text-lg text-center border-2 border-white"
          >
            Store Owner Login
          </Link>
        </div>
      </div>
      <div className="hidden md:block">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border-2 border-white/20">
          <div className="text-6xl mb-4 text-center">🛒🏪</div>
          <h3 className="text-2xl font-bold text-center mb-4">Join Our Platform</h3>
          <div className="space-y-3">
            <p className="flex items-center gap-2">
              <span className="text-xl">📋</span>
              <span>Quick registration process</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="text-xl">🏪</span>
              <span>Manage your store online</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="text-xl">📦</span>
              <span>Track orders in real-time</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="text-xl">⭐</span>
              <span>Build customer loyalty</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

## 📝 Summary of Changes

### Files Created:
1. `/afro-eats/src/pages/RegisterGroceryOwner.js`
2. `/afro-eats/src/pages/GroceryOwnerLogin.js`
3. `/afro-eats/src/context/GroceryOwnerAuthContext.js`
4. `/afro-eats/src/Components/ProtectedGroceryOwnerRoute.js`
5. `/backend/routes/groceryOwnerRoutes.js`

### Files To Create:
6. `/backend/migrations/create_grocery_owner_tables.sql`
7. `/afro-eats/src/Components/GroceryOwnerNavbar.jsx`
8. `/afro-eats/src/pages/GroceryOwnerDashboard.js`

### Files To Modify:
9. `/backend/server.js` - ✅ Already modified
10. `/afro-eats/src/App.js` - Needs updates
11. `/afro-eats/src/pages/OwnerGroceryOrders.js` - Needs context update
12. `/afro-eats/src/pages/HomePage.js` - Add registration section

## 🚀 Testing Checklist

- [ ] Run database migration
- [ ] Test registration flow
- [ ] Test login flow
- [ ] Test protected routes
- [ ] Test dashboard loads correctly
- [ ] Test orders page shows grocery orders
- [ ] Test logout functionality
- [ ] Test password recovery (if implemented)
- [ ] Test mobile responsiveness

## 🔐 Security Features Implemented

✅ Bcrypt password hashing
✅ Session-based authentication
✅ Protected routes
✅ CSRF protection via session
✅ Input validation
✅ SQL injection prevention (parameterized queries)
✅ File upload security (size limits, type checking)

## 📊 Database Schema

**grocery_store_owners:**
- id, name, email, password, secret_word, active, created_at, deleted_at

**grocery_stores:**
- id, name, address, phone_number, image_url, owner_id, latitude, longitude, active, created_at, closed_at

## 🔗 API Endpoints Created

- `POST /api/grocery-owners/register` - Register new grocery owner
- `POST /api/grocery-owners/login` - Login
- `POST /api/grocery-owners/logout` - Logout
- `GET /api/grocery-owners/me` - Get current user
- `GET /api/grocery-owners/store` - Get store info

## 📌 Next Steps

1. Complete the remaining file modifications
2. Run database migration
3. Test the complete flow
4. Add product management features
5. Add order management features
6. Add analytics dashboard
7. Add email verification
8. Add admin approval workflow (optional)
