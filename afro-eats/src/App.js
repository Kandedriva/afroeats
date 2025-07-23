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
import { OwnerAuthProvider, OwnerAuthContext } from "./context/OwnerAuthContext"; // if you set this up separately

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
        <Route path="/my-orders" element={<CustomerOrders />} />
        <Route path="/order-details/:orderId" element={<OrderDetails />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<Checkout user={user} />} />
        <Route path="/register-owner" element={<RegisterOwner />} />
        <Route path="/owner/login" element={<OwnerLogin />} />
        <Route path="/owner/password-update" element={<OwnerPasswordUpdate />} />
        <Route path="/owner/subscribe" element={<OwnerSubscribePage />} />
        <Route path="/owner/demo-checkout" element={<DemoCheckout />} />
        <Route path="/demo-order-checkout" element={<DemoOrderCheckout />} />
        <Route path="/order-success" element={<OrderSuccess />} />

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
          </CartProvider>
        </OwnerAuthProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
