import { renderHook, act, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../AuthContext';

// Mock the API config
jest.mock('../../config/api', () => ({
  API_BASE_URL: 'http://localhost:5001'
}));

// Mock react-router-dom navigation
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

// Mock fetch
global.fetch = jest.fn();

const wrapper = ({ children }) => (
  <BrowserRouter>
    <AuthProvider>{children}</AuthProvider>
  </BrowserRouter>
);

describe('AuthContext', () => {
  beforeEach(() => {
    fetch.mockClear();
    mockNavigate.mockClear();
    
    // Mock document visibility API
    Object.defineProperty(document, 'visibilityState', {
      writable: true,
      value: 'visible'
    });
  });

  describe('Initial authentication check', () => {
    test('sets loading to true initially', async () => {
      fetch.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      expect(result.current.loading).toBe(true);
      expect(result.current.user).toBe(null);
      expect(result.current.error).toBe(null);
    });

    test('authenticates user successfully on mount', async () => {
      const mockUser = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com'
      };

      // Mock successful health check
      fetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200
        })
        // Mock successful auth check
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockUser)
        });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.error).toBe(null);
    });

    test('handles unauthenticated user (401)', async () => {
      // Mock successful health check
      fetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200
        })
        // Mock 401 response
        .mockResolvedValueOnce({
          ok: false,
          status: 401
        });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBe(null);
      expect(result.current.error).toBe(null);
    });

    test('handles network errors with retry', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock health check failure
      fetch
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        // Mock retry success
        .mockResolvedValueOnce({
          ok: true,
          status: 200
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: 1, name: 'John' })
        });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 10000 });

      expect(result.current.error).toContain('Unable to connect to server');
      
      consoleSpy.mockRestore();
    });

    test('handles timeout errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock successful health check
      fetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200
        })
        // Mock timeout (AbortError)
        .mockImplementation(() => {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          return Promise.reject(error);
        });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toContain('Connection timeout');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Logout functionality', () => {
    test('logs out user successfully', async () => {
      const mockUser = { id: 1, name: 'John Doe', email: 'john@example.com' };

      // Mock initial auth
      fetch
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockUser)
        })
        // Mock logout
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ message: 'Logout successful' })
        });

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for initial auth
      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      // Logout
      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBe(null);
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    test('clears user state even if logout request fails', async () => {
      const mockUser = { id: 1, name: 'John Doe', email: 'john@example.com' };

      // Mock initial auth
      fetch
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockUser)
        })
        // Mock logout failure
        .mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for initial auth
      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      // Logout
      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBe(null);
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  describe('Visibility change handling', () => {
    test('refreshes auth when page becomes visible', async () => {
      const mockUser = { id: 1, name: 'John Doe', email: 'john@example.com' };

      // Mock initial auth
      fetch
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockUser)
        })
        // Mock visibility refresh
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockUser)
        });

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for initial auth
      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      // Simulate page becoming visible
      act(() => {
        Object.defineProperty(document, 'visibilityState', {
          writable: true,
          value: 'visible'
        });
        
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Should make additional auth request
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(3); // Initial health + auth + visibility refresh
      });
    });

    test('clears user if auth fails on visibility change', async () => {
      const mockUser = { id: 1, name: 'John Doe', email: 'john@example.com' };

      // Mock initial auth
      fetch
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockUser)
        })
        // Mock 401 on visibility refresh
        .mockResolvedValueOnce({
          ok: false,
          status: 401
        });

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for initial auth
      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      // Simulate page becoming visible
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // User should be cleared
      await waitFor(() => {
        expect(result.current.user).toBe(null);
      });
    });
  });

  describe('Mobile and connectivity handling', () => {
    test('handles basic connectivity test', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Mock health check
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Testing basic fetch capabilities')
        );
      });

      consoleSpy.mockRestore();
    });

    test('logs connection success', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const mockUser = { id: 1, name: 'John Doe' };

      fetch
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockUser)
        });

      renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          '✅ Backend connection successful, user authenticated:',
          mockUser
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Context provider', () => {
    test('provides all required context values', async () => {
      const mockUser = { id: 1, name: 'John Doe', email: 'john@example.com' };

      fetch
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockUser)
        });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      // Check all context values are provided
      expect(result.current).toHaveProperty('user');
      expect(result.current).toHaveProperty('setUser');
      expect(result.current).toHaveProperty('logout');
      expect(result.current).toHaveProperty('loading');
      expect(result.current).toHaveProperty('error');

      expect(typeof result.current.setUser).toBe('function');
      expect(typeof result.current.logout).toBe('function');
    });

    test('allows manual user updates via setUser', async () => {
      fetch
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({ ok: false, status: 401 });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const newUser = { id: 2, name: 'Jane Doe', email: 'jane@example.com' };

      act(() => {
        result.current.setUser(newUser);
      });

      expect(result.current.user).toEqual(newUser);
    });
  });
});