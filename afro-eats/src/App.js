import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./Components/Navbar";
import OwnerNavbar from "./Components/OwnerNavbar";
import RestaurantList from "./pages/RestaurantList";
import RestaurantDetails from "./pages/RestaurantDetails";
import Register from "./pages/Register";
import RegisterOwner from "./pages/RegisterOwner";
import OwnerDashboard from "./pages/OwnerDashboard";
import AddDish from "./pages/AddDish";
import Login from "./pages/Login";
import { AuthProvider, AuthContext } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import CartPage from "./pages/CartPage";
import Checkout from "./pages/Checkout";
import { useContext } from "react";
import OwnerLogin from "./Components/OwnerLogin";
import OwnerSubscribePage from "./pages/OwnerSubscribePage";
import OwnerPasswordUpdate from "./pages/OwnerPasswordUpdate";
import UserPasswordUpdate from "./pages/UserPasswordUpdate";
import CustomerOrders from "./pages/CustomerOrders";
import OrderDetails from "./pages/OrderDetails";
import DemoCheckout from "./pages/DemoCheckout";
import DemoOrderCheckout from "./pages/DemoOrderCheckout";
import OrderSuccess from "./pages/OrderSuccess";
import ProtectedOwnerRoute from "./Components/ProtectedOwnerRoute";
import ProtectedRoute from "./Components/ProtectedRoute";
import { OwnerAuthProvider, OwnerAuthContext } from "./context/OwnerAuthContext";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function AppContent() {
  const { user } = useContext(AuthContext);
  const { owner } = useContext(OwnerAuthContext); // use owner context
  const location = useLocation();
  const isOwnerRoute = location.pathname.startsWith("/owner");

  return (
    <>
      {!isOwnerRoute && <Navbar />}
      {isOwnerRoute && <OwnerNavbar />}
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
              <CustomerOrders />
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
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<Checkout user={user} />} />
        <Route path="/register-owner" element={<RegisterOwner />} />
        <Route path="/owner/login" element={<OwnerLogin />} />
        <Route path="/owner/password-update" element={<OwnerPasswordUpdate />} />
        <Route path="/owner/subscribe" element={<OwnerSubscribePage />} />
        <Route path="/owner/demo-checkout" element={<DemoCheckout />} />
        <Route 
          path="/demo-order-checkout" 
          element={
            <ProtectedRoute>
              <DemoOrderCheckout />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/order-success" 
          element={
            <ProtectedRoute>
              <OrderSuccess />
            </ProtectedRoute>
          } 
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
      </Routes>
    </>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <AuthProvider>
        <OwnerAuthProvider>
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
        </OwnerAuthProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
