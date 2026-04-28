import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./Components/Navbar";
import OwnerNavbar from "./Components/OwnerNavbar";
import GroceryOwnerNavbar from "./Components/GroceryOwnerNavbar";
import RestaurantsPage from "./pages/RestaurantsPage";
import RestaurantDetails from "./pages/RestaurantDetails";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import RegisterOwner from "./pages/RegisterOwner";
import RegisterGroceryOwner from "./pages/RegisterGroceryOwner";
import OwnerDashboard from "./pages/OwnerDashboard";
import AddDish from "./pages/AddDish";
import CompletedOrders from "./pages/CompletedOrders";
import OwnerNotifications from "./pages/OwnerNotifications";
import OwnerOrders from "./pages/OwnerOrders";
import Login from "./pages/Login";
import { AuthProvider, AuthContext } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { ChatProvider } from "./context/ChatContext";
import { GroceryCartProvider } from "./context/GroceryCartContext";
import CartPage from "./pages/CartPage";
import DeliveryOptions from "./pages/DeliveryOptions";
import Checkout from "./pages/Checkout";
import { useContext } from "react";
import OwnerLogin from "./Components/OwnerLogin";
import GroceryOwnerLogin from "./pages/GroceryOwnerLogin";
import OwnerPasswordUpdate from "./pages/OwnerPasswordUpdate";
import UserPasswordUpdate from "./pages/UserPasswordUpdate";
import CustomerOrders from "./pages/CustomerOrders";
import CustomerProfile from "./pages/CustomerProfile";
import CustomerNotifications from "./pages/CustomerNotifications";
import OrderDetails from "./pages/OrderDetails";
import OrderSuccessWrapper from "./pages/OrderSuccessWrapper";
import GuestCheckout from "./pages/GuestCheckout";
import ProtectedOwnerRoute from "./Components/ProtectedOwnerRoute";
import ProtectedGroceryOwnerRoute from "./Components/ProtectedGroceryOwnerRoute";
import ProtectedRoute from "./Components/ProtectedRoute";
import { OwnerAuthProvider } from "./context/OwnerAuthContext";
import { GroceryOwnerAuthProvider, GroceryOwnerAuthContext } from "./context/GroceryOwnerAuthContext";
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
import CustomerRefunds from "./pages/CustomerRefunds";
import MarketplaceHome from "./pages/MarketplaceHome";
import GroceryStorePage from "./pages/GroceryStorePage";
import ProductDetails from "./pages/ProductDetails";
import GroceryCart from "./pages/GroceryCart";
import GroceryCheckout from "./pages/GroceryCheckout";
import TrackGuestOrder from "./pages/TrackGuestOrder";
import OwnerGroceryOrders from "./pages/OwnerGroceryOrders";
import GroceryOwnerDashboard from "./pages/GroceryOwnerDashboard";
import GroceryOwnerProducts from "./pages/GroceryOwnerProducts";
import GroceryOwnerStoreSettings from "./pages/GroceryOwnerStoreSettings";
import GroceryOwnerAddProduct from "./pages/GroceryOwnerAddProduct";
import GroceryOwnerEditProduct from "./pages/GroceryOwnerEditProduct";
import GroceryOwnerNotifications from "./pages/GroceryOwnerNotifications";
import GroceryOwnerReports from "./pages/GroceryOwnerReports";


function AppContent() {
  const { user } = useContext(AuthContext);
  const { groceryOwner } = useContext(GroceryOwnerAuthContext);
  const location = useLocation();
  const isOwnerRoute = location.pathname.startsWith("/owner") && !location.pathname.startsWith("/owner/grocery");
  const isGroceryOwnerRoute = location.pathname.startsWith("/grocery-owner");
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isDriverRoute = location.pathname.startsWith("/driver");

  // Public grocery owner routes (no navbar needed)
  const groceryOwnerPublicRoutes = ["/grocery-owner/login", "/register-grocery-owner", "/grocery-owner/password-update"];
  const isGroceryOwnerPublicRoute = groceryOwnerPublicRoutes.includes(location.pathname);

  return (
    <>
      {!isOwnerRoute && !isGroceryOwnerRoute && !isAdminRoute && !isDriverRoute && <Navbar />}
      {isOwnerRoute && <OwnerNavbar />}
      {isGroceryOwnerRoute && !isGroceryOwnerPublicRoute && groceryOwner && <GroceryOwnerNavbar />}
      {isDriverRoute && <DriverNavbar />}
      {/* Admin routes don't show any navbar */}

      {/* Floating Chat Button - Show on non-admin and non-driver routes */}
      {!isAdminRoute && !isDriverRoute && <ChatButton />}

      <Routes>
        <Route path="/" element={<MarketplaceHome />} />
        <Route path="/restaurants" element={<RestaurantsPage />} />
        <Route path="/marketplace" element={<MarketplaceHome />} />
        <Route path="/marketplace/product/:productId" element={<ProductDetails />} />
        <Route path="/grocery-cart" element={<GroceryCart />} />
        <Route path="/grocery-checkout" element={<GroceryCheckout />} />
        <Route path="/restaurants/:id" element={<RestaurantDetails />} />
        <Route path="/store/:storeSlug" element={<GroceryStorePage />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/password-update" element={<UserPasswordUpdate />} />
        <Route path="/track-order" element={<TrackGuestOrder />} />
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
          path="/my-refunds"
          element={
            <ProtectedRoute>
              <CustomerRefunds />
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
        <Route path="/register-grocery-owner" element={<RegisterGroceryOwner />} />
        <Route path="/owner/login" element={<OwnerLogin />} />
        <Route path="/grocery-owner/login" element={<GroceryOwnerLogin />} />
        <Route path="/owner/password-update" element={<OwnerPasswordUpdate />} />
        <Route
          path="/order-success"
          element={
            <ErrorBoundary>
              <OrderSuccessWrapper />
            </ErrorBoundary>
          }
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

        {/* Grocery Owner Routes */}
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
        <Route
          path="/grocery-owner/products"
          element={
            <ProtectedGroceryOwnerRoute>
              <GroceryOwnerProducts />
            </ProtectedGroceryOwnerRoute>
          }
        />
        <Route
          path="/grocery-owner/store"
          element={
            <ProtectedGroceryOwnerRoute>
              <GroceryOwnerStoreSettings />
            </ProtectedGroceryOwnerRoute>
          }
        />
        <Route
          path="/grocery-owner/products/add"
          element={
            <ProtectedGroceryOwnerRoute>
              <GroceryOwnerAddProduct />
            </ProtectedGroceryOwnerRoute>
          }
        />
        <Route
          path="/grocery-owner/products/edit/:productId"
          element={
            <ProtectedGroceryOwnerRoute>
              <GroceryOwnerEditProduct />
            </ProtectedGroceryOwnerRoute>
          }
        />
        <Route
          path="/grocery-owner/notifications"
          element={
            <ProtectedGroceryOwnerRoute>
              <GroceryOwnerNotifications />
            </ProtectedGroceryOwnerRoute>
          }
        />
        <Route
          path="/grocery-owner/reports"
          element={
            <ProtectedGroceryOwnerRoute>
              <GroceryOwnerReports />
            </ProtectedGroceryOwnerRoute>
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
        
        {/* Catch-all route for 404 - redirect to marketplace */}
        <Route path="*" element={<MarketplaceHome />} />
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
              <GroceryOwnerAuthProvider>
                <DriverAuthProvider>
                  <GuestProvider>
                    <CartProvider>
                      <GroceryCartProvider>
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
                      </GroceryCartProvider>
                    </CartProvider>
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

export default App;
