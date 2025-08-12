import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./Components/Navbar";
import OwnerNavbar from "./Components/OwnerNavbar";
import RestaurantList from "./pages/RestaurantList";
import RestaurantDetails from "./pages/RestaurantDetails";
import Register from "./pages/Register";
import RegisterOwner from "./pages/RegisterOwner";
import OwnerDashboard from "./pages/OwnerDashboard";
import AddDish from "./pages/AddDish";
import CompletedOrders from "./pages/CompletedOrders";
import OwnerNotifications from "./pages/OwnerNotifications";
import OwnerOrders from "./pages/OwnerOrders";
import Login from "./pages/Login";
import { AuthProvider, AuthContext } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import CartPage from "./pages/CartPage";
import DeliveryOptions from "./pages/DeliveryOptions";
import Checkout from "./pages/Checkout";
import { useContext } from "react";
import OwnerLogin from "./Components/OwnerLogin";
import OwnerPasswordUpdate from "./pages/OwnerPasswordUpdate";
import UserPasswordUpdate from "./pages/UserPasswordUpdate";
import CustomerOrders from "./pages/CustomerOrders";
import CustomerProfile from "./pages/CustomerProfile";
import CustomerNotifications from "./pages/CustomerNotifications";
import OrderDetails from "./pages/OrderDetails";
import OrderSuccess from "./pages/OrderSuccess";
import GuestCheckout from "./pages/GuestCheckout";
import ProtectedOwnerRoute from "./Components/ProtectedOwnerRoute";
import ProtectedRoute from "./Components/ProtectedRoute";
import { OwnerAuthProvider } from "./context/OwnerAuthContext";
import { GuestProvider } from "./context/GuestContext";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './utils/networkTest';
import ErrorBoundary from "./Components/ErrorBoundary";
import AsyncErrorBoundary from "./Components/AsyncErrorBoundary";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";


function AppContent() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const isOwnerRoute = location.pathname.startsWith("/owner");
  const isAdminRoute = location.pathname.startsWith("/admin");

  return (
    <>
      {!isOwnerRoute && !isAdminRoute && <Navbar />}
      {isOwnerRoute && <OwnerNavbar />}
      {/* Admin routes don't show any navbar */}
      <Routes>
        <Route path="/" element={<RestaurantList />} />
        <Route path="/restaurants/:id" element={<RestaurantDetails />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/password-update" element={<UserPasswordUpdate />} />
        <Route 
          path="/my-orders" 
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <CustomerOrders />
              </ErrorBoundary>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/my-profile" 
          element={
            <ProtectedRoute>
              <CustomerProfile />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/my-notifications" 
          element={
            <ProtectedRoute>
              <CustomerNotifications />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/order-details/:orderId" 
          element={
            <ProtectedRoute>
              <OrderDetails />
            </ProtectedRoute>
          } 
        />
        <Route path="/cart" element={
          <ErrorBoundary>
            <CartPage />
          </ErrorBoundary>
        } />
        <Route 
          path="/delivery-options" 
          element={
            <ProtectedRoute>
              <DeliveryOptions />
            </ProtectedRoute>
          } 
        />
        <Route path="/checkout" element={<Checkout user={user} />} />
        <Route path="/guest-checkout" element={<GuestCheckout />} />
        <Route path="/register-owner" element={<RegisterOwner />} />
        <Route path="/owner/login" element={<OwnerLogin />} />
        <Route path="/owner/password-update" element={<OwnerPasswordUpdate />} />
        <Route 
          path="/order-success" 
          element={<OrderSuccess />} 
        />

        {/* ✅ Protected Owner Routes */}
        <Route
          path="/owner/dashboard"
          element={
            <ProtectedOwnerRoute>
              <OwnerDashboard />
            </ProtectedOwnerRoute>
          }
        />
        <Route
          path="/owner/add-dish"
          element={
            <ProtectedOwnerRoute>
              <AddDish />
            </ProtectedOwnerRoute>
          }
        />
        <Route
          path="/owner/completed-orders"
          element={
            <ProtectedOwnerRoute>
              <CompletedOrders />
            </ProtectedOwnerRoute>
          }
        />
        <Route
          path="/owner/notifications"
          element={
            <ProtectedOwnerRoute>
              <OwnerNotifications />
            </ProtectedOwnerRoute>
          }
        />
        <Route
          path="/owner/orders"
          element={
            <ProtectedOwnerRoute>
              <OwnerOrders />
            </ProtectedOwnerRoute>
          }
        />

        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <AsyncErrorBoundary>
      <ErrorBoundary level="app">
        <div className="min-h-screen bg-gray-100">
          <AuthProvider>
            <OwnerAuthProvider>
              <GuestProvider>
                <CartProvider>
                  <AppContent />
                  <ToastContainer
                    position="top-right"
                    autoClose={5000}
                    hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="light"
              />
            </CartProvider>
          </GuestProvider>
        </OwnerAuthProvider>
      </AuthProvider>
        </div>
      </ErrorBoundary>
    </AsyncErrorBoundary>
  );
}

export default App;
