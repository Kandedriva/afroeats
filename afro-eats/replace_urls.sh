#!/bin/bash

# List of files to update
files=(
  "pages/Login.js"
  "pages/Register.js"
  "pages/OrderDetails.js"
  "pages/CustomerOrders.js"
  "pages/CustomerNotifications.js"
  "pages/OwnerNotifications.js" 
  "pages/OwnerDashboard.js"
  "pages/AddDish.js"
  "pages/Checkout.js"
  "pages/RestaurantList.js"
  "pages/RestaurantDetails.js"
  "Components/OwnerNavbar.jsx"
  "Components/OwnerLogin.js"
  "Components/Navbar.js"
  "Components/DishCard.js"
  "Components/RestaurantCard.js"
  "Components/StripeConnectButton.js"
  "hooks/useOwnerAuth.js"
)

# Add import statement to each file if not already present
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    # Check if import already exists
    if ! grep -q "API_BASE_URL" "$file"; then
      # Add import after the last import line
      sed -i '' '/^import/a\
import { API_BASE_URL } from "../config/api";
' "$file"
    fi
    
    # Replace localhost URLs with template literals
    sed -i '' 's|"http://localhost:5001|`${API_BASE_URL}|g' "$file"
    sed -i '' 's|http://localhost:5001"|${API_BASE_URL}`|g' "$file"
    
    echo "Updated $file"
  fi
done

echo "URL replacement complete!"