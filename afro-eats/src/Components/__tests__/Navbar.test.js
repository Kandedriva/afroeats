import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Navbar from '../Navbar';
import { AuthContext } from '../../context/AuthContext';
import { CartContext } from '../../context/CartContext';

// Mock the API config
jest.mock('../../config/api', () => ({
  API_BASE_URL: 'http://localhost:5001'
}));

// Mock fetch
global.fetch = jest.fn();

const renderNavbar = (authValue, cartValue) => {
  const defaultAuthValue = {
    user: null,
    logout: jest.fn(),
    loading: false,
    error: null
  };

  const defaultCartValue = {
    cart: [],
    ...cartValue
  };

  return render(
    <BrowserRouter>
      <AuthContext.Provider value={{ ...defaultAuthValue, ...authValue }}>
        <CartContext.Provider value={defaultCartValue}>
          <Navbar />
        </CartContext.Provider>
      </AuthContext.Provider>
    </BrowserRouter>
  );
};

describe('Navbar Component', () => {
  beforeEach(() => {
    fetch.mockClear();
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ unreadCount: 0 })
    });
  });

  describe('When user is not authenticated', () => {
    test('displays login and register links', () => {
      renderNavbar();
      
      expect(screen.getByText('Login')).toBeInTheDocument();
      expect(screen.getByText('Register')).toBeInTheDocument();
      expect(screen.getByText('Restaurant Owner')).toBeInTheDocument();
    });

    test('does not display user-specific links', () => {
      renderNavbar();
      
      expect(screen.queryByText('Orders')).not.toBeInTheDocument();
      expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
      expect(screen.queryByText('Profile')).not.toBeInTheDocument();
      expect(screen.queryByText('Logout')).not.toBeInTheDocument();
    });

    test('displays cart with zero items', () => {
      renderNavbar();
      
      expect(screen.getByText('🛒 Cart')).toBeInTheDocument();
      expect(screen.queryByText('0')).not.toBeInTheDocument(); // No badge when cart is empty
    });
  });

  describe('When user is authenticated', () => {
    const mockUser = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com'
    };

    test('displays user-specific links', () => {
      renderNavbar({ user: mockUser });
      
      expect(screen.getByText('Orders')).toBeInTheDocument();
      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getByText('Profile')).toBeInTheDocument();
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    test('displays user greeting with first name', () => {
      renderNavbar({ user: mockUser });
      
      expect(screen.getByText('Hi, John')).toBeInTheDocument();
    });

    test('does not display login/register links', () => {
      renderNavbar({ user: mockUser });
      
      expect(screen.queryByText('Login')).not.toBeInTheDocument();
      expect(screen.queryByText('Register')).not.toBeInTheDocument();
    });

    test('calls logout function when logout button is clicked', async () => {
      const mockLogout = jest.fn();
      renderNavbar({ user: mockUser, logout: mockLogout });
      
      const logoutButton = screen.getByText('Logout');
      fireEvent.click(logoutButton);
      
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    test('fetches notification count on mount', async () => {
      renderNavbar({ user: mockUser });
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          'http://localhost:5001/api/auth/notifications',
          expect.objectContaining({
            credentials: 'include'
          })
        );
      });
    });

    test('displays notification count badge when there are unread notifications', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ unreadCount: 3 })
      });

      renderNavbar({ user: mockUser });
      
      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument();
      });
    });

    test('limits notification count display to 9+', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ unreadCount: 15 })
      });

      renderNavbar({ user: mockUser });
      
      await waitFor(() => {
        expect(screen.getByText('9+')).toBeInTheDocument();
      });
    });
  });

  describe('Cart functionality', () => {
    test('displays cart item count when cart has items', () => {
      const cartWithItems = {
        cart: [
          { id: 1, quantity: 2 },
          { id: 2, quantity: 1 },
          { id: 3, quantity: 3 }
        ]
      };

      renderNavbar({}, cartWithItems);
      
      expect(screen.getByText('6')).toBeInTheDocument(); // Total quantity: 2+1+3=6
    });

    test('cart link navigates to cart page', () => {
      renderNavbar();
      
      const cartLinks = screen.getAllByText(/Cart/);
      expect(cartLinks[0].closest('a')).toHaveAttribute('href', '/cart');
    });
  });

  describe('Mobile navigation', () => {
    test('displays mobile menu button', () => {
      renderNavbar();
      
      const menuButton = screen.getByRole('button', { 
        name: /hamburger menu/i 
      });
      expect(menuButton).toBeInTheDocument();
    });

    test('toggles mobile menu when hamburger button is clicked', () => {
      renderNavbar({ user: { id: 1, name: 'John Doe', email: 'john@example.com' }});
      
      // Menu should not be visible initially
      expect(screen.queryByText('📋 My Orders')).not.toBeInTheDocument();
      
      // Click hamburger menu
      const menuButton = screen.getByRole('button');
      fireEvent.click(menuButton);
      
      // Menu should now be visible
      expect(screen.getByText('📋 My Orders')).toBeInTheDocument();
      expect(screen.getByText('🔔 Notifications')).toBeInTheDocument();
      expect(screen.getByText('👤 My Profile')).toBeInTheDocument();
    });

    test('closes mobile menu when menu item is clicked', () => {
      const mockUser = { id: 1, name: 'John Doe', email: 'john@example.com' };
      renderNavbar({ user: mockUser });
      
      // Open menu
      const menuButton = screen.getByRole('button');
      fireEvent.click(menuButton);
      
      // Click on a menu item
      const ordersLink = screen.getByText('📋 My Orders');
      fireEvent.click(ordersLink);
      
      // Menu should close (items should not be visible)
      expect(screen.queryByText('📋 My Orders')).not.toBeInTheDocument();
    });

    test('displays mobile cart icon with item count', () => {
      const cartWithItems = {
        cart: [
          { id: 1, quantity: 2 },
          { id: 2, quantity: 1 }
        ]
      };

      renderNavbar({}, cartWithItems);
      
      // Should have mobile cart icon
      const cartSvg = document.querySelector('svg');
      expect(cartSvg).toBeInTheDocument();
      
      // Should show item count badge
      expect(screen.getByText('3')).toBeInTheDocument(); // 2+1=3
    });
  });

  describe('Brand link', () => {
    test('brand name links to home page', () => {
      renderNavbar();
      
      const brandLink = screen.getByText('A Food Zone');
      expect(brandLink.closest('a')).toHaveAttribute('href', '/');
    });
  });

  describe('Error handling', () => {
    test('handles notification fetch errors gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      renderNavbar({ user: { id: 1, name: 'John', email: 'john@example.com' }});
      
      // Should not crash the component
      await waitFor(() => {
        expect(screen.getByText('A Food Zone')).toBeInTheDocument();
      });
      
      consoleSpy.mockRestore();
    });

    test('handles non-ok response from notifications API', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });
      
      renderNavbar({ user: { id: 1, name: 'John', email: 'john@example.com' }});
      
      // Should not display notification count
      await waitFor(() => {
        expect(screen.queryByText(/\d+/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels for interactive elements', () => {
      renderNavbar();
      
      const cartLink = screen.getByRole('link', { name: /cart/i });
      expect(cartLink).toBeInTheDocument();
    });

    test('hamburger menu button has proper styling for mobile', () => {
      renderNavbar();
      
      const menuButton = screen.getByRole('button');
      expect(menuButton).toHaveStyle('webkit-tap-highlight-color: transparent');
    });
  });
});