import { Routes, Route } from "react-router-dom";
import Navbar from "./Components/Navbar";
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

function AppContent() {
  const { user } = useContext(AuthContext);

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<RestaurantList />} />
        <Route path="/restaurants/:id" element={<RestaurantDetails />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<Checkout user={user} />} />
        <Route path="/register-owner" element={<RegisterOwner />} />
        <Route path="/owner/dashboard" element={<OwnerDashboard />} />
        <Route path="/owner/add-dish" element={<AddDish />} />
        {/* <Route path="/owner/dashboard" element={<OwnerDashboard />} /> */}
      </Routes>
    </>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
   
    <AuthProvider>
    <CartProvider>
          <AppContent />
          </CartProvider>
      </AuthProvider>
     
    </div>
  );
}

export default App;
