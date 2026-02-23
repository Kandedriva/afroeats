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
import { ChatProvider } from "./context/ChatContext";
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
import { ToastContainer, Slide } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './utils/networkTest';
import ErrorBoundary from "./Components/ErrorBoundary";
import AsyncErrorBoundary from "./Components/AsyncErrorBoundary";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import TermsAndConditions from "./pages/TermsAndConditions";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import DemoOrderCheckout from "./pages/DemoOrderCheckout";
import OwnerAccount from "./pages/OwnerAccount";
import CustomerChat from "./pages/CustomerChat";
import OwnerChat from "./pages/OwnerChat";
import ChatButton from "./Components/ChatButton";
import { DriverAuthProvider } from "./context/DriverAuthContext";
import DriverNavbar from "./Components/DriverNavbar";
import ProtectedDriverRoute from "./Components/ProtectedDriverRoute";
import DriverLogin from "./pages/DriverLogin";
import DriverRegister from "./pages/DriverRegister";
import DriverDashboard from "./pages/DriverDashboard";
import DriverAvailableOrders from "./pages/DriverAvailableOrders";
import DriverMyDeliveries from "./pages/DriverMyDeliveries";
import DriverEarnings from "./pages/DriverEarnings";
import DriverProfile from "./pages/DriverProfile";


function AppContent() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const isOwnerRoute = location.pathname.startsWith("/owner");
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isDriverRoute = location.pathname.startsWith("/driver");

  return (
    <>
      {!isOwnerRoute && !isAdminRoute && !isDriverRoute && <Navbar />}
      {isOwnerRoute && <OwnerNavbar />}
      {isDriverRoute && <DriverNavbar />}
      {/* Admin routes don't show any navbar */}

      {/* Floating Chat Button - Show on non-admin and non-driver routes */}
      {!isAdminRoute && !isDriverRoute && <ChatButton />}

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
          path="/my-chats"
          element={
            <ProtectedRoute>
              <CustomerChat />
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
        <Route 
          path="/demo-order-checkout" 
          element={<DemoOrderCheckout />} 
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
        <Route
          path="/owner/account"
          element={
            <ProtectedOwnerRoute>
              <OwnerAccount />
            </ProtectedOwnerRoute>
          }
        />
        <Route
          path="/owner/chats"
          element={
            <ProtectedOwnerRoute>
              <OwnerChat />
            </ProtectedOwnerRoute>
          }
        />

        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />

        {/* Driver Routes */}
        <Route path="/driver/login" element={<DriverLogin />} />
        <Route path="/driver/register" element={<DriverRegister />} />
        <Route
          path="/driver/dashboard"
          element={
            <ProtectedDriverRoute>
              <DriverDashboard />
            </ProtectedDriverRoute>
          }
        />
        <Route
          path="/driver/available-orders"
          element={
            <ProtectedDriverRoute>
              <DriverAvailableOrders />
            </ProtectedDriverRoute>
          }
        />
        <Route
          path="/driver/my-deliveries"
          element={
            <ProtectedDriverRoute>
              <DriverMyDeliveries />
            </ProtectedDriverRoute>
          }
        />
        <Route
          path="/driver/earnings"
          element={
            <ProtectedDriverRoute>
              <DriverEarnings />
            </ProtectedDriverRoute>
          }
        />
        <Route
          path="/driver/profile"
          element={
            <ProtectedDriverRoute>
              <DriverProfile />
            </ProtectedDriverRoute>
          }
        />

        {/* Legal Pages */}
        <Route path="/terms" element={<TermsAndConditions />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        
        {/* Catch-all route for 404 - redirect to home */}
        <Route path="*" element={<RestaurantList />} />
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
              <DriverAuthProvider>
                <GuestProvider>
                  <CartProvider>
                    <ChatProvider>
                      <AppContent />
                  <ToastContainer
                    position="top-right"
                    autoClose={4000}
                    hideProgressBar={false}
                    newestOnTop={true}
                    closeOnClick
                    rtl={false}
                    pauseOnFocusLoss
                    draggable
                    pauseOnHover
                    theme="colored"
                    transition={Slide}
                    className="toast-container"
                    toastClassName="custom-toast"
                    bodyClassName="custom-toast-body"
                    progressClassName="custom-progress"
                    style={{
                      fontSize: '14px',
                      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}
                  />
                    </ChatProvider>
                  </CartProvider>
                </GuestProvider>
              </DriverAuthProvider>
            </OwnerAuthProvider>
          </AuthProvider>
        </div>
      </ErrorBoundary>
    </AsyncErrorBoundary>
  );
}

export default App;
