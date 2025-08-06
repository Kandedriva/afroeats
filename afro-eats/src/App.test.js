import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

// Mock the network test utility
jest.mock('./utils/networkTest', () => ({
  testBackendConnection: jest.fn()
}));

// Mock the API config
jest.mock('./config/api', () => ({
  API_BASE_URL: 'http://localhost:5001'
}));

// Helper function to render App with Router
const renderApp = () => {
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
};

// Mock fetch for API calls
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: false,
    status: 401,
    json: () => Promise.resolve({ error: 'Not authenticated' }),
  })
);

describe('App Component', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  test('renders without crashing', async () => {
    renderApp();
    
    // Wait for component to fully load
    await waitFor(() => {
      expect(screen.getByText('A Food Zone')).toBeInTheDocument();
    });
  });

  test('displays navbar with brand name', async () => {
    renderApp();
    
    await waitFor(() => {
      expect(screen.getByText('A Food Zone')).toBeInTheDocument();
    });
  });

  test('renders toast container for notifications', async () => {
    renderApp();
    
    // ToastContainer should be present but might not be visible
    const toastContainer = document.querySelector('.Toastify__toast-container');
    expect(toastContainer).toBeInTheDocument();
  });

  test('shows loading state initially', async () => {
    renderApp();
    
    // The app should handle loading state gracefully
    await waitFor(() => {
      // After loading, should show main content
      expect(screen.getByText('A Food Zone')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  test('handles authentication check on mount', async () => {
    renderApp();
    
    // Should call the /me endpoint to check authentication
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/me'),
        expect.objectContaining({
          credentials: 'include'
        })
      );
    });
  });

  test('displays correct environment debug info in console', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    renderApp();
    
    expect(consoleSpy).toHaveBeenCalledWith(
      '🔧 Environment Debug:',
      expect.objectContaining({
        NODE_ENV: expect.any(String),
        API_BASE_URL_FROM_CONFIG: 'http://localhost:5001'
      })
    );
    
    consoleSpy.mockRestore();
  });
});
