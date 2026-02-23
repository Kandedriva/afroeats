// React import removed as it's not needed in React 17+
import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { showToast } from '../utils/toast';
import PropTypes from 'prop-types';
import { API_BASE_URL } from '../config/api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

const AdminDashboard = () => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [supportMessages, setSupportMessages] = useState([]);
  const [supportStats, setSupportStats] = useState(null);
  const [restaurantContacts, setRestaurantContacts] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [logsModal, setLogsModal] = useState(null);
  const [logsFilter, setLogsFilter] = useState('');
  const [logsLevelFilter, setLogsLevelFilter] = useState('all');

  // Check admin authentication
  useEffect(() => {
    checkAdminAuth();
  }, []);

  // Load dashboard data when authenticated
  useEffect(() => {
    if (admin) {
      loadDashboardData();
      loadAnalytics();
      loadSystemHealth();
      
      // Auto-refresh dashboard overview every 30 seconds
      const dashboardInterval = setInterval(() => {
        loadDashboardData(false); // Don't show refresh indicator for auto-refresh
      }, 30000);
      
      // Auto-refresh analytics every 2 minutes
      const analyticsInterval = setInterval(() => {
        if (activeTab === 'analytics') {
          loadAnalytics(false); // Don't show refresh indicator for auto-refresh
        }
      }, 120000);
      
      // Auto-refresh system health every 30 seconds (faster for health monitoring)
      const systemInterval = setInterval(() => {
        if (activeTab === 'system') {
          loadSystemHealth(false); // Don't show refresh indicator for auto-refresh
        }
      }, 30000);
      
      // Check authentication every 5 minutes
      const authCheckInterval = setInterval(() => {
        checkAdminAuth();
      }, 300000); // 5 minutes
      
      return () => {
        clearInterval(dashboardInterval);
        clearInterval(analyticsInterval);
        clearInterval(systemInterval);
        clearInterval(authCheckInterval);
      };
    }
    return undefined;
  }, [admin, activeTab]);

  const checkAdminAuth = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/me`, {
        credentials: 'include'
      });
      
      if (res.ok) {
        const data = await res.json();
        setAdmin(data);
      } else {
        // Authentication failed - clear any existing admin state
        setAdmin(null);
        setDashboardData(null);
        setAnalytics(null);
        setUsers([]);
        setRestaurants([]);
        setOrders([]);
        setSystemHealth(null);
        
        // If response is 401 (unauthorized), show message
        if (res.status === 401) {
          showToast.authentication('Session expired. Please log in again.');
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Admin auth check failed:', error);
      // Clear admin state on network error
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async (showRefreshIndicator = true) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      }
      
      const res = await fetch(`${API_BASE_URL}/api/admin/dashboard`, {
        credentials: 'include'
      });
      
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
        setLastUpdated(new Date());
      } else if (res.status === 401) {
        // Session expired during data loading
        setAdmin(null);
        showToast.authentication('Session expired. Please log in again.');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load dashboard data:', error);
    } finally {
      if (showRefreshIndicator) {
        setTimeout(() => setIsRefreshing(false), 1000); // Show indicator for at least 1 second
      }
    }
  };

  const loadAnalytics = async (showRefreshIndicator = true) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      }
      
      const res = await fetch(`${API_BASE_URL}/api/admin/analytics?period=30`, {
        credentials: 'include'
      });
      
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
        setLastUpdated(new Date());
      }
    } catch (error) {
      // console.error('Failed to load analytics:', error);
    } finally {
      if (showRefreshIndicator) {
        setTimeout(() => setIsRefreshing(false), 1000);
      }
    }
  };

  const loadSystemHealth = async (showRefreshIndicator = true) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      }
      
      const res = await fetch(`${API_BASE_URL}/api/admin/system`, {
        credentials: 'include'
      });
      
      if (res.ok) {
        const data = await res.json();
        setSystemHealth(data);
        setLastUpdated(new Date());
      }
    } catch (error) {
      // console.error('Failed to load system health:', error);
    } finally {
      if (showRefreshIndicator) {
        setTimeout(() => setIsRefreshing(false), 1000);
      }
    }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        credentials: 'include'
      });
      
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch (error) {
      // console.error('Failed to load users:', error);
    }
  };

  const loadRestaurants = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/restaurants`, {
        credentials: 'include'
      });
      
      if (res.ok) {
        const data = await res.json();
        setRestaurants(data.restaurants);
      }
    } catch (error) {
      // console.error('Failed to load restaurants:', error);
    }
  };

  const loadOrders = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/orders`, {
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders);
      }
    } catch (error) {
      // console.error('Failed to load orders:', error);
    }
  };

  const loadDrivers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/drivers`, {
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        setDrivers(data.drivers);
      }
    } catch (error) {
      // console.error('Failed to load drivers:', error);
    }
  };

  const loadSupportMessages = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/support-messages`, {
        credentials: 'include'
      });
      
      if (res.ok) {
        const data = await res.json();
        setSupportMessages(data.messages);
      }
    } catch (error) {
      // console.error('Failed to load support messages:', error);
    }
  };

  const loadSupportStats = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/support-stats`, {
        credentials: 'include'
      });
      
      if (res.ok) {
        const data = await res.json();
        setSupportStats(data.stats);
      }
    } catch (error) {
      // console.error('Failed to load support stats:', error);
    }
  };

  const loadRestaurantContacts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/restaurant-contacts`, {
        credentials: 'include'
      });
      
      if (res.ok) {
        const data = await res.json();
        setRestaurantContacts(data.contacts);
      }
    } catch (error) {
      // console.error('Failed to load restaurant contacts:', error);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    
    // Load data for specific tab
    switch (tab) {
      case 'users':
        if (users.length === 0) {
          loadUsers();
        }
        break;
      case 'restaurants':
        if (restaurants.length === 0) {
          loadRestaurants();
        }
        break;
      case 'drivers':
        if (drivers.length === 0) {
          loadDrivers();
        }
        break;
      case 'orders':
        if (orders.length === 0) {
          loadOrders();
        }
        break;
      case 'support':
        if (supportMessages.length === 0) {
          loadSupportMessages();
        }
        if (!supportStats) {
          loadSupportStats();
        }
        break;
      case 'contacts':
        if (restaurantContacts.length === 0) {
          loadRestaurantContacts();
        }
        break;
      default:
        break;
    }
  };

  const logout = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        // Clear admin state
        setAdmin(null);
        
        // Clear all dashboard data
        setDashboardData(null);
        setAnalytics(null);
        setUsers([]);
        setRestaurants([]);
        setOrders([]);
        setSystemHealth(null);
        
        // Reset to overview tab
        setActiveTab('overview');
        
        // Show success message
        showToast.authentication('Logged out successfully');
        
        // Force page reload to clear any cached data
        setTimeout(() => {
          window.location.href = '/admin/login';
        }, 1000);
      } else {
        showToast.error('Logout failed. Please try again.');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Logout failed:', error);
      showToast.error('Logout failed. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/admin/login" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-4">
            <div className="flex items-center mb-4 sm:mb-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">🍽️ Order Dabaly Admin</h1>
              <span className="ml-2 sm:ml-4 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                {admin.role}
              </span>
              {isRefreshing && (
                <div className="ml-2 sm:ml-3 flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="ml-1 text-xs text-blue-600 hidden sm:inline">Updating...</span>
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-2 sm:space-y-0">
              {lastUpdated && (
                <span className="text-xs text-gray-500">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              <span className="text-sm text-gray-600">Welcome, {admin.username}</span>
              <button
                onClick={logout}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 hover:shadow-lg transition-all duration-200 w-full sm:w-auto transform hover:scale-105"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-2 sm:space-x-8 overflow-x-auto scrollbar-hide">
            {[
              { id: 'overview', label: '📊 Overview' },
              { id: 'analytics', label: '📈 Analytics' },
              { id: 'users', label: '👥 Users' },
              { id: 'restaurants', label: '🏪 Restaurants' },
              { id: 'drivers', label: '🚗 Drivers' },
              { id: 'orders', label: '📋 Orders' },
              { id: 'support', label: '🎧 Support' },
              { id: 'contacts', label: '📞 Contacts' },
              { id: 'system', label: '⚙️ System' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap flex-shrink-0 transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {activeTab === 'overview' && (
          <OverviewTab 
            dashboardData={dashboardData} 
            onSystemAction={handleSystemAction}
          />
        )}
        
        {activeTab === 'analytics' && (
          <AnalyticsTab 
            analytics={analytics} 
            onRefresh={() => loadAnalytics(true)}
            isRefreshing={isRefreshing}
          />
        )}
        
        {activeTab === 'users' && (
          <UsersTab users={users} />
        )}
        
        {activeTab === 'restaurants' && (
          <RestaurantsTab restaurants={restaurants} />
        )}

        {activeTab === 'drivers' && (
          <DriversTab drivers={drivers} onDriverUpdate={loadDrivers} />
        )}

        {activeTab === 'orders' && (
          <OrdersTab orders={orders} />
        )}
        
        {activeTab === 'support' && (
          <SupportTab 
            supportMessages={supportMessages} 
            supportStats={supportStats}
            onUpdateMessage={loadSupportMessages}
            onDeleteMessage={handleDeleteMessage}
          />
        )}
        
        {activeTab === 'contacts' && (
          <RestaurantContactsTab restaurantContacts={restaurantContacts} />
        )}
        
        {activeTab === 'system' && (
          <SystemTab 
            systemHealth={systemHealth} 
            onRefresh={() => loadSystemHealth(true)}
            isRefreshing={isRefreshing}
            onSystemAction={handleSystemAction}
          />
        )}
      </main>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full shadow-2xl border border-gray-200">
            <div className="p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="p-3 rounded-full bg-yellow-100">
                  <span className="text-3xl">⚠️</span>
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                Confirm Action
              </h3>
              
              <p className="text-gray-600 text-center mb-6">
                {confirmAction.message}
              </p>
              
              <div className="flex space-x-3">
                <button
                  onClick={confirmAction.onCancel}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md font-medium hover:bg-gray-400 hover:shadow-md transition-all duration-200 transform hover:scale-105"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAction.onConfirm}
                  className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md font-medium hover:bg-red-700 hover:shadow-md transition-all duration-200 transform hover:scale-105"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Logs Modal */}
      {logsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] shadow-2xl border border-gray-200 flex flex-col">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                    <span className="text-3xl mr-3">📁</span>
                    System Logs
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Showing {logsModal.returned_count} of {logsModal.total_count} log entries
                  </p>
                </div>
                <button
                  onClick={() => setLogsModal(null)}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-all duration-200"
                >
                  <span className="text-xl">✕</span>
                </button>
              </div>
            </div>
            
            {/* Filters */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search logs by message, source, or content..."
                    value={logsFilter}
                    onChange={(e) => setLogsFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
                <div className="sm:w-48">
                  <select
                    value={logsLevelFilter}
                    onChange={(e) => setLogsLevelFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="all">All Levels</option>
                    <option value="error">🔴 Error</option>
                    <option value="warn">🟡 Warning</option>
                    <option value="info">🔵 Info</option>
                    <option value="debug">🟣 Debug</option>
                    <option value="trace">⚪ Trace</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {(() => {
                  if (!logsModal.logs || logsModal.logs.length === 0) {
                    return (
                      <div className="text-center py-12 text-gray-500">
                        <span className="text-6xl mb-4 block">📋</span>
                        <p className="text-lg">No log entries found</p>
                      </div>
                    );
                  }

                  // Filter logs based on search and level with error handling
                  const filteredLogs = logsModal.logs.filter(log => {
                    try {
                      // Skip invalid log entries
                      if (!log || typeof log !== 'object') {
                        return false;
                      }

                      // Level filter
                      if (logsLevelFilter !== 'all') {
                        const logLevel = String(log.level || log.severity || 'info').toLowerCase();
                        if (logLevel !== logsLevelFilter.toLowerCase()) {
                          return false;
                        }
                      }

                      // Text filter
                      if (logsFilter.trim() !== '') {
                        const searchTerm = logsFilter.toLowerCase();
                        const logMessage = String(log.message || log.msg || log.text || '').toLowerCase();
                        const logSource = String(log.source || log.module || log.component || log.service || '').toLowerCase();
                        const logLevel = String(log.level || log.severity || '').toLowerCase();
                        
                        try {
                          const logString = JSON.stringify(log).toLowerCase();
                          return logMessage.includes(searchTerm) || 
                                 logSource.includes(searchTerm) || 
                                 logLevel.includes(searchTerm) ||
                                 logString.includes(searchTerm);
                        } catch {
                          // If JSON.stringify fails, just use the message and level
                          return logMessage.includes(searchTerm) || 
                                 logSource.includes(searchTerm) || 
                                 logLevel.includes(searchTerm);
                        }
                      }

                      return true;
                    } catch (error) {
                      // If there's any error filtering this log, exclude it
                      // eslint-disable-next-line no-console
                      console.warn('Error filtering log entry:', error);
                      return false;
                    }
                  });

                  if (filteredLogs.length === 0) {
                    return (
                      <div className="text-center py-12 text-gray-500">
                        <span className="text-6xl mb-4 block">🔍</span>
                        <p className="text-lg">No logs match your filters</p>
                        <p className="text-sm">Try adjusting your search or level filter</p>
                      </div>
                    );
                  }

                  return filteredLogs.map((log, index) => (
                    <LogEntry key={index} log={log} index={index} />
                  ));
                })()}
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  {(() => {
                    if (!logsModal.logs || logsModal.logs.length === 0) {
                      return `Total log entries: ${logsModal.total_count}`;
                    }
                    
                    const filteredCount = logsModal.logs.filter(log => {
                      try {
                        if (!log || typeof log !== 'object') {
                          return false;
                        }

                        if (logsLevelFilter !== 'all') {
                          const logLevel = String(log.level || log.severity || 'info').toLowerCase();
                          if (logLevel !== logsLevelFilter.toLowerCase()) {
                            return false;
                          }
                        }

                        if (logsFilter.trim() !== '') {
                          const searchTerm = logsFilter.toLowerCase();
                          const logMessage = String(log.message || log.msg || log.text || '').toLowerCase();
                          const logSource = String(log.source || log.module || log.component || log.service || '').toLowerCase();
                          const logLevel = String(log.level || log.severity || '').toLowerCase();
                          
                          try {
                            const logString = JSON.stringify(log).toLowerCase();
                            return logMessage.includes(searchTerm) || 
                                   logSource.includes(searchTerm) || 
                                   logLevel.includes(searchTerm) ||
                                   logString.includes(searchTerm);
                          } catch {
                            return logMessage.includes(searchTerm) || 
                                   logSource.includes(searchTerm) || 
                                   logLevel.includes(searchTerm);
                          }
                        }

                        return true;
                      } catch {
                        return false;
                      }
                    }).length;
                    
                    return `Showing ${filteredCount} of ${logsModal.returned_count} entries (${logsModal.total_count} total)`;
                  })()}
                </div>
                <button
                  onClick={() => setLogsModal(null)}
                  className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 hover:shadow-md transition-all duration-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Helper functions moved to inside component for access to state
  function handleSystemAction(action) {
    let endpoint, method = 'GET';
    
    switch (action) {
      case 'clear-cache':
        endpoint = '/api/admin/system/clear-cache';
        method = 'POST';
        break;
      case 'generate-report':
        endpoint = '/api/admin/system/report';
        method = 'GET';
        break;
      case 'restart':
        endpoint = '/api/admin/system/restart';
        method = 'POST';
        break;
      case 'view-logs':
        endpoint = '/api/admin/system/logs';
        method = 'GET';
        break;
      default:
        return;
    }

    // Show confirmation modal
    setConfirmAction({
      message: `Are you sure you want to ${action.replace('-', ' ')}?`,
      action: action,
      endpoint: endpoint,
      method: method,
      onConfirm: () => executeSystemAction(action, endpoint, method),
      onCancel: () => setConfirmAction(null)
    });
  }

  function handleDeleteMessage(messageId) {
    setConfirmAction({
      message: 'Are you sure you want to delete this support message? This action cannot be undone.',
      action: 'delete-message',
      onConfirm: () => executeDeleteMessage(messageId),
      onCancel: () => setConfirmAction(null)
    });
  }

  async function executeDeleteMessage(messageId) {
    setConfirmAction(null);
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/support-messages/${messageId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await res.json();

      if (res.ok) {
        showToast.dataUpdate('Support message deleted successfully');
        loadSupportMessages(); // Refresh the messages list
      } else {
        showToast.error(data.error || 'Failed to delete support message');
      }
    } catch (error) {
      showToast.error('An error occurred while deleting the message');
    }
  }

  async function executeSystemAction(action, endpoint, method) {
    setConfirmAction(null);
    
    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();

      if (res.ok) {
        if (action === 'generate-report') {
          // Download the report as JSON file
          const blob = new Blob([JSON.stringify(data.report, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `system-report-${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showToast.adminAction('System report generated and downloaded');
        } else if (action === 'view-logs') {
          // Show logs in a modal
          setLogsModal({
            logs: data.logs,
            returned_count: data.returned_count,
            total_count: data.total_count
          });
          // Reset filters when new logs are loaded
          setLogsFilter('');
          setLogsLevelFilter('all');
          showToast.systemHealth('System logs loaded successfully');
        } else {
          showToast.adminAction(data.message);
          // Refresh system health after actions
          if (activeTab === 'system') {
            loadSystemHealth(true);
          }
        }
      } else {
        showToast.error(data.error || 'Action failed');
      }
    } catch (error) {
      showToast.error('An error occurred while performing the action');
    }
  }
};

// LogEntry Component for formatted log display
const LogEntry = ({ log, index }) => {
  // Error boundary for malformed log data
  try {
    if (!log || typeof log !== 'object') {
      return (
        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
          <div className="text-red-800 text-sm">
            <span className="font-medium">Invalid log entry #{index + 1}:</span> {JSON.stringify(log)}
          </div>
        </div>
      );
    }
  const getLogLevelColor = (level) => {
    switch (level?.toLowerCase()) {
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      case 'warn': 
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'debug': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'trace': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getLogLevelIcon = (level) => {
    switch (level?.toLowerCase()) {
      case 'error': return '🔴';
      case 'warn': 
      case 'warning': return '🟡';
      case 'info': return '🔵';
      case 'debug': return '🟣';
      case 'trace': return '⚪';
      default: return '📄';
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) {
      return 'No timestamp';
    }
    try {
      // Handle object timestamps
      if (typeof timestamp === 'object') {
        timestamp = timestamp.toString();
      }
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return String(timestamp);
      }
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch {
      return String(timestamp);
    }
  };

  // Handle different log formats with proper string conversion
  const logLevel = String(log.level || log.severity || 'info');
  const logMessage = (() => {
    const msg = log.message || log.msg || log.text;
    if (msg !== null && msg !== undefined) {
      return typeof msg === 'string' ? msg : JSON.stringify(msg);
    }
    return JSON.stringify(log);
  })();
  const logTimestamp = log.timestamp || log.time || log.date || log.created_at;
  const logSource = (() => {
    const src = log.source || log.module || log.component || log.service;
    return src && typeof src === 'object' ? JSON.stringify(src) : String(src || '');
  })();
  const logMeta = { ...log };
  delete logMeta.level;
  delete logMeta.severity;
  delete logMeta.message;
  delete logMeta.msg;
  delete logMeta.text;
  delete logMeta.timestamp;
  delete logMeta.time;
  delete logMeta.date;
  delete logMeta.created_at;
  delete logMeta.source;
  delete logMeta.module;
  delete logMeta.component;
  delete logMeta.service;

  const hasMeta = Object.keys(logMeta).length > 0;

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200 bg-white">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div className="flex-shrink-0 mt-1">
            <span className="text-lg">{getLogLevelIcon(logLevel)}</span>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3 mb-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getLogLevelColor(logLevel)}`}>
                {logLevel.toUpperCase()}
              </span>
              
              {logSource && (
                <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
                  📦 {logSource}
                </span>
              )}
              
              <span className="text-xs text-gray-500">
                #{index + 1}
              </span>
            </div>
            
            <div className="mb-2">
              <p className="text-sm text-gray-900 leading-relaxed break-words">
                {logMessage}
              </p>
            </div>
            
            {hasMeta && (
              <div className="mb-2">
                <details className="group">
                  <summary className="cursor-pointer text-xs text-blue-600 hover:text-blue-800 font-medium">
                    📋 View Additional Data ({Object.keys(logMeta).length} fields)
                  </summary>
                  <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                      {JSON.stringify(logMeta, null, 2)}
                    </pre>
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex-shrink-0 text-right ml-4">
          <div className="text-xs text-gray-500">
            {formatTimestamp(logTimestamp)}
          </div>
        </div>
      </div>
    </div>
  );
  } catch (error) {
    // Catch any rendering errors and display error message
    return (
      <div className="border border-red-200 rounded-lg p-4 bg-red-50">
        <div className="text-red-800 text-sm">
          <span className="font-medium">Error displaying log entry #{index + 1}:</span>
          <br />
          <span className="text-xs font-mono">{error.message}</span>
          <br />
          <span className="text-xs">Raw data: {JSON.stringify(log)}</span>
        </div>
      </div>
    );
  }
};

// Overview Tab Component
const OverviewTab = ({ dashboardData, onSystemAction }) => {
  if (!dashboardData) {
    return <div className="text-center py-8">Loading overview...</div>;
  }

  const { overview, realtime, top_restaurants, system } = dashboardData;

  return (
    <div className="space-y-6">
      {/* Real-time Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <MetricCard
          title="Online Now"
          value={realtime.current_online || 0}
          change={`+${realtime.visitor_growth || 0}%`}
          color="blue"
          icon="👥"
        />
        <MetricCard
          title="Today's Visitors"
          value={realtime.visitors_today || 0}
          change="vs yesterday"
          color="green"
          icon="👁️"
        />
        <MetricCard
          title="Today's Orders"
          value={realtime.orders_today || 0}
          change="live"
          color="purple"
          icon="📋"
        />
        <MetricCard
          title="Today's Revenue"
          value={`$${realtime.revenue_today?.toFixed(2) || '0.00'}`}
          change="real-time"
          color="yellow"
          icon="💰"
        />
      </div>

      {/* Total Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <MetricCard
          title="Total Users"
          value={overview.total_users}
          change={`+${overview.users_today} today`}
          color="blue"
          icon="👤"
        />
        <MetricCard
          title="Total Restaurants"
          value={overview.total_restaurants}
          change={`+${overview.restaurants_today} today`}
          color="green"
          icon="🏪"
        />
        <MetricCard
          title="Total Orders"
          value={overview.total_orders}
          change={`+${overview.orders_today} today`}
          color="purple"
          icon="📋"
        />
        <MetricCard
          title="Total Revenue"
          value={`$${overview.total_revenue?.toFixed(2) || '0.00'}`}
          change={`$${overview.platform_fees_today?.toFixed(2) || '0.00'} fees today`}
          color="yellow"
          icon="💰"
        />
      </div>

      {/* Top Restaurants */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h3 className="text-lg font-semibold mb-4">🏆 Top Performing Restaurants</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Restaurant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Orders
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Customers
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {top_restaurants?.map((restaurant, index) => (
                <tr key={restaurant.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-900">
                        {index + 1}. {restaurant.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {restaurant.total_orders}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${parseFloat(restaurant.total_revenue || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {restaurant.unique_customers}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-lg font-medium mb-4">🔄 Queue Status</h4>
          {Object.entries(system.queues || {}).map(([queue, stats]) => (
            <div key={queue} className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600 capitalize">{queue}</span>
              <div className="flex space-x-2 text-xs">
                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                  {stats.waiting} waiting
                </span>
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {stats.active} active
                </span>
              </div>
            </div>
          ))}
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-lg font-medium mb-4">💾 Cache Status</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Redis</span>
              <span className="text-sm font-medium text-green-600">Connected</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Database</span>
              <span className="text-sm font-medium text-green-600">Connected</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-lg font-medium mb-4">🎯 Quick Actions</h4>
          <div className="space-y-2">
            <button 
              onClick={() => onSystemAction('clear-cache')}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition-all duration-200 transform hover:scale-105"
            >
              Clear Cache
            </button>
            <button 
              onClick={() => onSystemAction('generate-report')}
              className="w-full bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition-all duration-200 transform hover:scale-105"
            >
              Export Data
            </button>
            <button 
              onClick={() => onSystemAction('restart')}
              className="w-full bg-yellow-600 text-white px-4 py-2 rounded text-sm hover:bg-yellow-700 transition-all duration-200 transform hover:scale-105"
            >
              System Backup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Metric Card Component
const MetricCard = ({ title, value, change, color, icon }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    yellow: 'bg-yellow-50 text-yellow-600'
  };

  return (
    <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-4 sm:p-6 border border-gray-100">
      <div className="flex items-center">
        <div className={`p-2 sm:p-3 rounded-full ${colorClasses[color]} mr-3 sm:mr-4 transition-transform hover:scale-105`}>
          <span className="text-xl sm:text-2xl">{icon}</span>
        </div>
        <div>
          <p className="text-xs sm:text-sm font-medium text-gray-600">{title}</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{change}</p>
        </div>
      </div>
    </div>
  );
};

// Analytics Tab Component with real-time charts
const AnalyticsTab = ({ analytics, onRefresh, isRefreshing }) => {
  if (!analytics || !analytics.analytics) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading analytics data...</p>
          </div>
        </div>
      </div>
    );
  }

  const { daily_stats, summary } = analytics.analytics;

  // Prepare data for charts
  const dailyLabels = daily_stats.map(stat => new Date(stat.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  
  const visitorsData = {
    labels: dailyLabels,
    datasets: [
      {
        label: 'Unique Visitors',
        data: daily_stats.map(stat => stat.visitors),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Page Views',
        data: daily_stats.map(stat => stat.page_views),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
      }
    ],
  };

  const revenueData = {
    labels: dailyLabels,
    datasets: [
      {
        label: 'Daily Revenue ($)',
        data: daily_stats.map(stat => stat.revenue),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 1,
      }
    ],
  };

  const ordersData = {
    labels: dailyLabels,
    datasets: [
      {
        label: 'Orders',
        data: daily_stats.map(stat => stat.orders),
        backgroundColor: 'rgba(168, 85, 247, 0.8)',
        borderColor: 'rgb(168, 85, 247)',
        borderWidth: 1,
      },
      {
        label: 'New Users',
        data: daily_stats.map(stat => stat.registrations),
        backgroundColor: 'rgba(251, 146, 60, 0.8)',
        borderColor: 'rgb(251, 146, 60)',
        borderWidth: 1,
      }
    ],
  };

  const summaryData = {
    labels: ['Total Visitors', 'Total Orders', 'Total Revenue', 'Total Users'],
    datasets: [
      {
        data: [
          summary.total_visitors,
          summary.total_orders,
          summary.total_revenue,
          summary.total_registrations
        ],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(168, 85, 247, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(251, 146, 60, 0.8)'
        ],
        borderColor: [
          'rgb(59, 130, 246)',
          'rgb(168, 85, 247)',
          'rgb(34, 197, 94)',
          'rgb(251, 146, 60)'
        ],
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
      x: {
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Header with Refresh Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">📈 Analytics Dashboard</h2>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <div className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}>
            🔄
          </div>
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-4 sm:p-6 border border-gray-100">
          <div className="flex items-center">
            <div className="p-2 sm:p-3 rounded-full bg-blue-50 text-blue-600 mr-3 sm:mr-4">
              <span className="text-xl sm:text-2xl">👥</span>
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600">Total Visitors</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{summary.total_visitors?.toLocaleString() || 0}</p>
              <p className="text-xs text-gray-500">All time</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-4 sm:p-6 border border-gray-100">
          <div className="flex items-center">
            <div className="p-2 sm:p-3 rounded-full bg-purple-50 text-purple-600 mr-3 sm:mr-4">
              <span className="text-xl sm:text-2xl">📋</span>
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600">Total Orders</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{summary.total_orders?.toLocaleString() || 0}</p>
              <p className="text-xs text-gray-500">All time</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-4 sm:p-6 border border-gray-100">
          <div className="flex items-center">
            <div className="p-2 sm:p-3 rounded-full bg-green-50 text-green-600 mr-3 sm:mr-4">
              <span className="text-xl sm:text-2xl">💰</span>
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">${summary.total_revenue?.toFixed(2) || '0.00'}</p>
              <p className="text-xs text-gray-500">All time</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-4 sm:p-6 border border-gray-100">
          <div className="flex items-center">
            <div className="p-2 sm:p-3 rounded-full bg-orange-50 text-orange-600 mr-3 sm:mr-4">
              <span className="text-xl sm:text-2xl">👤</span>
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600">New Users</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{summary.total_registrations?.toLocaleString() || 0}</p>
              <p className="text-xs text-gray-500">All time</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visitors and Page Views Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">📊 Traffic Overview</h3>
          <div className="h-80">
            <Line data={visitorsData} options={chartOptions} />
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">💵 Daily Revenue</h3>
          <div className="h-80">
            <Bar data={revenueData} options={chartOptions} />
          </div>
        </div>

        {/* Orders and Registrations Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">📈 Orders & New Users</h3>
          <div className="h-80">
            <Bar data={ordersData} options={chartOptions} />
          </div>
        </div>

        {/* Summary Doughnut Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">🎯 Summary Distribution</h3>
          <div className="h-80">
            <Doughnut data={summaryData} options={doughnutOptions} />
          </div>
        </div>
      </div>

      {/* Period Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <span className="text-2xl">📅</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Analytics Period</h3>
            <div className="text-sm text-blue-700">
              {analytics.period ? (
                <span>From {new Date(analytics.period.start).toLocaleDateString()} to {new Date(analytics.period.end).toLocaleDateString()}</span>
              ) : (
                <span>Last 7 days</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Users Tab Component (simplified)
const UsersTab = ({ users }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <h3 className="text-lg font-semibold mb-4">👥 Users Management</h3>
    <p className="text-gray-600">User management interface would go here.</p>
    <p className="text-sm text-gray-500 mt-2">Total users: {users.length}</p>
  </div>
);

// Restaurants Tab Component (simplified)
const RestaurantsTab = ({ restaurants }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <h3 className="text-lg font-semibold mb-4">🏪 Restaurants Management</h3>
    <p className="text-gray-600">Restaurant management interface would go here.</p>
    <p className="text-sm text-gray-500 mt-2">Total restaurants: {restaurants.length}</p>
  </div>
);

// Orders Tab Component (simplified)
const OrdersTab = ({ orders }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <h3 className="text-lg font-semibold mb-4">📋 Orders Management</h3>
    <p className="text-gray-600">Order management interface would go here.</p>
    <p className="text-sm text-gray-500 mt-2">Total orders: {orders.length}</p>
  </div>
);

// Drivers Tab Component
const DriversTab = ({ drivers, onDriverUpdate }) => {
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApproveDriver = async (driverId) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/drivers/${driverId}/approve`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        showToast.success('Driver approved successfully');
        setSelectedDriver(null);
        onDriverUpdate();
      } else {
        const data = await res.json();
        showToast.error(data.error || 'Failed to approve driver');
      }
    } catch (error) {
      showToast.error('An error occurred while approving driver');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectDriver = async (driverId) => {
    if (!rejectionReason.trim()) {
      showToast.warning('Please provide a rejection reason');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/drivers/${driverId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ reason: rejectionReason }),
      });

      if (res.ok) {
        showToast.success('Driver rejected');
        setSelectedDriver(null);
        setRejectionReason('');
        onDriverUpdate();
      } else {
        const data = await res.json();
        showToast.error(data.error || 'Failed to reject driver');
      }
    } catch (error) {
      showToast.error('An error occurred while rejecting driver');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredDrivers = drivers.filter((driver) => {
    if (filterStatus === 'all') {
      return true;
    }
    return driver.approval_status === filterStatus;
  });

  return (
    <div className="space-y-6">
      {/* Filter Buttons */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({drivers.length})
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === 'pending'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Pending ({drivers.filter(d => d.approval_status === 'pending').length})
          </button>
          <button
            onClick={() => setFilterStatus('approved')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === 'approved'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Approved ({drivers.filter(d => d.approval_status === 'approved').length})
          </button>
          <button
            onClick={() => setFilterStatus('rejected')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === 'rejected'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Rejected ({drivers.filter(d => d.approval_status === 'rejected').length})
          </button>
        </div>
      </div>

      {/* Drivers List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <h3 className="text-lg font-semibold text-gray-800">🚗 Delivery Drivers</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stats</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDrivers.map((driver) => (
                <tr key={driver.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{driver.name}</div>
                      <div className="text-sm text-gray-500">ID: {driver.id}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{driver.email}</div>
                    <div className="text-sm text-gray-500">{driver.phone}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {driver.vehicle_make} {driver.vehicle_model}
                    </div>
                    <div className="text-sm text-gray-500">
                      {driver.vehicle_color} • {driver.license_plate}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        driver.approval_status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : driver.approval_status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : driver.approval_status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {driver.approval_status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {driver.completed_deliveries || 0} deliveries
                    </div>
                    <div className="text-sm text-gray-500">
                      ⭐ {driver.average_rating && typeof driver.average_rating === 'number'
                        ? driver.average_rating.toFixed(1)
                        : (driver.average_rating ? parseFloat(driver.average_rating).toFixed(1) : 'N/A')}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedDriver(driver)}
                      className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredDrivers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <span className="text-4xl mb-2 block">🚗</span>
            No drivers found
          </div>
        )}
      </div>

      {/* Driver Details Modal */}
      {selectedDriver && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Driver Details</h3>
                <button
                  onClick={() => {
                    setSelectedDriver(null);
                    setRejectionReason('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>

              <div className="space-y-4">
                {/* Personal Info */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Personal Information</h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <p><span className="font-medium">Name:</span> {selectedDriver.name}</p>
                    <p><span className="font-medium">Email:</span> {selectedDriver.email}</p>
                    <p><span className="font-medium">Phone:</span> {selectedDriver.phone}</p>
                    <p>
                      <span className="font-medium">Status:</span>{' '}
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          selectedDriver.approval_status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : selectedDriver.approval_status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {selectedDriver.approval_status}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Vehicle Info */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Vehicle Information</h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <p><span className="font-medium">Type:</span> {selectedDriver.vehicle_type}</p>
                    <p>
                      <span className="font-medium">Make/Model:</span>{' '}
                      {selectedDriver.vehicle_make} {selectedDriver.vehicle_model} ({selectedDriver.vehicle_year})
                    </p>
                    <p><span className="font-medium">Color:</span> {selectedDriver.vehicle_color}</p>
                    <p><span className="font-medium">License Plate:</span> {selectedDriver.license_plate}</p>
                  </div>
                </div>

                {/* Driver's License */}
                {selectedDriver.drivers_license_url && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Driver&apos;s License</h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <a
                        href={selectedDriver.drivers_license_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-900 underline"
                      >
                        View License Document
                      </a>
                    </div>
                  </div>
                )}

                {/* Performance Stats */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Performance</h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <p><span className="font-medium">Total Deliveries:</span> {selectedDriver.total_deliveries || 0}</p>
                    <p><span className="font-medium">Completed:</span> {selectedDriver.completed_deliveries || 0}</p>
                    <p><span className="font-medium">Cancelled:</span> {selectedDriver.cancelled_deliveries || 0}</p>
                    <p>
                      <span className="font-medium">Average Rating:</span> ⭐{' '}
                      {selectedDriver.average_rating && typeof selectedDriver.average_rating === 'number'
                        ? selectedDriver.average_rating.toFixed(1)
                        : (selectedDriver.average_rating ? parseFloat(selectedDriver.average_rating).toFixed(1) : 'N/A')}
                    </p>
                    <p>
                      <span className="font-medium">Total Earnings:</span> $
                      {selectedDriver.total_earnings && typeof selectedDriver.total_earnings === 'number'
                        ? selectedDriver.total_earnings.toFixed(2)
                        : (selectedDriver.total_earnings ? parseFloat(selectedDriver.total_earnings).toFixed(2) : '0.00')}
                    </p>
                  </div>
                </div>

                {/* Rejection Reason (if rejected) */}
                {selectedDriver.rejection_reason && (
                  <div>
                    <h4 className="font-medium text-red-900 mb-2">Rejection Reason</h4>
                    <div className="bg-red-50 rounded-lg p-4">
                      <p className="text-red-800">{selectedDriver.rejection_reason}</p>
                    </div>
                  </div>
                )}

                {/* Actions for pending drivers */}
                {selectedDriver.approval_status === 'pending' && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-900 mb-3">Actions</h4>

                    {/* Approve Button */}
                    <button
                      onClick={() => handleApproveDriver(selectedDriver.id)}
                      disabled={isProcessing}
                      className="w-full mb-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                    >
                      {isProcessing ? 'Processing...' : '✓ Approve Driver'}
                    </button>

                    {/* Reject Section */}
                    <div>
                      <label htmlFor="rejectionReason" className="block text-sm font-medium text-gray-700 mb-2">
                        Rejection Reason
                      </label>
                      <textarea
                        id="rejectionReason"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Enter reason for rejection..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        rows="3"
                      />
                      <button
                        onClick={() => handleRejectDriver(selectedDriver.id)}
                        disabled={isProcessing || !rejectionReason.trim()}
                        className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                      >
                        {isProcessing ? 'Processing...' : '✗ Reject Driver'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

DriversTab.propTypes = {
  drivers: PropTypes.array.isRequired,
  onDriverUpdate: PropTypes.func.isRequired,
};

  // Restaurant Contacts Tab Component
const RestaurantContactsTab = ({ restaurantContacts }) => {
  if (!restaurantContacts || restaurantContacts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading restaurant contacts...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">📞 Restaurant Contacts</h2>
        <div className="text-sm text-gray-500">
          Total: {restaurantContacts.length} restaurants
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-center">
            <div className="p-2 sm:p-3 rounded-full bg-green-50 text-green-600 mr-3 sm:mr-4">
              <span className="text-xl sm:text-2xl">✅</span>
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600">Active</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                {restaurantContacts.filter(r => r.is_active).length}
              </p>
              <p className="text-xs text-gray-500">Restaurants</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-center">
            <div className="p-2 sm:p-3 rounded-full bg-blue-50 text-blue-600 mr-3 sm:mr-4">
              <span className="text-xl sm:text-2xl">📧</span>
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600">With Owner Email</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                {restaurantContacts.filter(r => r.owner_email).length}
              </p>
              <p className="text-xs text-gray-500">Restaurants</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-center">
            <div className="p-2 sm:p-3 rounded-full bg-purple-50 text-purple-600 mr-3 sm:mr-4">
              <span className="text-xl sm:text-2xl">📱</span>
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600">With Phone</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                {restaurantContacts.filter(r => r.phone).length}
              </p>
              <p className="text-xs text-gray-500">Restaurants</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <h3 className="text-lg font-semibold text-gray-800">📞 Restaurant Contact Information</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Restaurant
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Owner
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Phone
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Address
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {restaurantContacts.map((restaurant) => (
                <tr key={restaurant.id} className="hover:bg-gray-50">
                  <td className="px-3 sm:px-6 py-4">
                    <div className="flex items-center">
                      {restaurant.image_url && (
                        <img 
                          className="h-10 w-10 rounded-lg object-cover mr-3" 
                          src={restaurant.image_url} 
                          alt={restaurant.name}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">{restaurant.name}</div>
                        <div className="text-sm text-gray-500">ID: {restaurant.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{restaurant.owner_name || 'N/A'}</div>
                  </td>
                  <td className="px-3 sm:px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {restaurant.owner_email ? (
                        <a 
                          href={`mailto:${restaurant.owner_email}`}
                          className="text-blue-600 hover:text-blue-900 underline"
                        >
                          {restaurant.owner_email}
                        </a>
                      ) : (
                        <span className="text-gray-400">No email</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {restaurant.phone ? (
                        <a 
                          href={`tel:${restaurant.phone}`}
                          className="text-blue-600 hover:text-blue-900 underline"
                        >
                          {restaurant.phone}
                        </a>
                      ) : (
                        <span className="text-gray-400">No phone</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-xs">
                      {restaurant.address || 'No address'}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        restaurant.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {restaurant.is_active ? 'Has Owner' : 'No Owner'}
                      </span>
                      {restaurant.has_active_subscription && (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          Subscribed
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {restaurantContacts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <span className="text-4xl mb-2 block">🏪</span>
            No restaurant contacts found
          </div>
        )}
      </div>
    </div>
  );
};

// Support Tab Component
const SupportTab = ({ supportMessages, supportStats, onUpdateMessage, onDeleteMessage }) => {
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [updating, setUpdating] = useState(false);

  const handleUpdateMessage = async (messageId) => {
    if (!status && !priority && !response.trim()) {
      showToast.warning('Please provide a status, priority, or response');
      return;
    }

    setUpdating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/support-messages/${messageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          status: status || undefined,
          priority: priority || undefined,
          admin_response: response || undefined
        }),
      });

      const data = await res.json();

      if (res.ok) {
        showToast.dataUpdate('Support message updated successfully');
        setSelectedMessage(null);
        setResponse('');
        setStatus('');
        setPriority('');
        onUpdateMessage(); // Refresh the messages list
      } else {
        showToast.error(data.error || 'Failed to update support message');
      }
    } catch (error) {
      showToast.error('An error occurred while updating the message');
    } finally {
      setUpdating(false);
    }
  };


  const handleViewMessage = async (message) => {
    setSelectedMessage(message);
    
    // Auto-mark as viewed if it's currently pending
    if (message.status === 'pending') {
      try {
        await fetch(`${API_BASE_URL}/api/admin/support-messages/${message.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            status: 'viewed'
          }),
        });
        // Silently refresh the messages list
        onUpdateMessage();
      } catch (error) {
        // Silently handle error, don't show toast for this background operation
      }
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'viewed': return 'bg-indigo-100 text-indigo-800';
      case 'responded': return 'bg-purple-100 text-purple-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Support Statistics */}
      {supportStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-50 text-blue-600 mr-4">
                <span className="text-2xl">📧</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Messages</p>
                <p className="text-2xl font-bold text-gray-900">{supportStats.total_messages || 0}</p>
                <p className="text-xs text-gray-500">{supportStats.today_count || 0} today</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-50 text-yellow-600 mr-4">
                <span className="text-2xl">⏳</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{supportStats.pending_count || 0}</p>
                <p className="text-xs text-gray-500">Awaiting response</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-red-50 text-red-600 mr-4">
                <span className="text-2xl">🚨</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Urgent</p>
                <p className="text-2xl font-bold text-gray-900">{supportStats.urgent_count || 0}</p>
                <p className="text-xs text-gray-500">High priority</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-50 text-green-600 mr-4">
                <span className="text-2xl">⏱️</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Response</p>
                <p className="text-2xl font-bold text-gray-900">
                  {supportStats.avg_response_time_hours ? 
                    `${Math.round(supportStats.avg_response_time_hours)}h` : 'N/A'}
                </p>
                <p className="text-xs text-gray-500">Response time</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Support Messages List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <h3 className="text-lg font-semibold text-gray-800">🎧 Support Messages</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Customer
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Subject
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Priority
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {supportMessages.map((message) => (
                <tr key={message.id} className="hover:bg-gray-50">
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {message.user_name || 'Guest'}
                      </div>
                      <div className="text-sm text-gray-500 hidden sm:block">{message.user_email}</div>
                      {message.user_phone && (
                        <div className="text-xs text-gray-400 hidden sm:block">{message.user_phone}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate">
                      {message.subject}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(message.status)}`}>
                      {message.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(message.priority)}`}>
                      {message.priority}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="sm:hidden">{new Date(message.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    <div className="hidden sm:block">{new Date(message.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-2">
                      <button
                        onClick={() => handleViewMessage(message)}
                        className="text-blue-600 hover:text-blue-900 hover:bg-blue-50 px-2 py-1 rounded transition-all duration-200 font-medium text-xs sm:text-sm"
                      >
                        View
                      </button>
                      <button
                        onClick={() => onDeleteMessage(message.id)}
                        className="text-red-600 hover:text-red-900 hover:bg-red-50 px-2 py-1 rounded transition-all duration-200 font-medium text-xs sm:text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {supportMessages.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No support messages found
          </div>
        )}
      </div>

      {/* Message Detail Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto shadow-2xl border border-gray-200">
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Support Message Details</h2>
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-all duration-200"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="block text-sm font-medium text-gray-700">Customer</div>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedMessage.user_name || 'Guest'} ({selectedMessage.user_email})
                    </p>
                  </div>
                  <div>
                    <div className="block text-sm font-medium text-gray-700">Date</div>
                    <p className="mt-1 text-sm text-gray-900">
                      {new Date(selectedMessage.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                <div>
                  <div className="block text-sm font-medium text-gray-700">Subject</div>
                  <p className="mt-1 text-sm text-gray-900">{selectedMessage.subject}</p>
                </div>
                
                <div>
                  <div className="block text-sm font-medium text-gray-700">Message</div>
                  <div className="mt-1 p-3 bg-gray-50 border rounded-md">
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedMessage.message}</p>
                  </div>
                </div>
                
                {selectedMessage.admin_response && (
                  <div>
                    <div className="block text-sm font-medium text-gray-700">Previous Response</div>
                    <div className="mt-1 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedMessage.admin_response}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Responded by {selectedMessage.admin_username} on {new Date(selectedMessage.responded_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="status-select" className="block text-sm font-medium text-gray-700">Status</label>
                    <select
                      id="status-select"
                      value={status || selectedMessage.status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-400"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="viewed">Viewed</option>
                      <option value="responded">Responded</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="priority-select" className="block text-sm font-medium text-gray-700">Priority</label>
                    <select
                      id="priority-select"
                      value={priority || selectedMessage.priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-400"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="admin-response" className="block text-sm font-medium text-gray-700">Admin Response</label>
                  <textarea
                    id="admin-response"
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    rows="4"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-400"
                    placeholder="Type your response here..."
                  />
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setSelectedMessage(null)}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md font-medium hover:bg-gray-400 hover:shadow-md transition-all duration-200 transform hover:scale-105"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUpdateMessage(selectedMessage.id)}
                    disabled={updating}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 disabled:transform-none"
                  >
                    {updating ? 'Updating...' : 'Update Message'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// System Tab Component with real-time health monitoring
const SystemTab = ({ systemHealth, onRefresh, isRefreshing, onSystemAction }) => {
  if (!systemHealth) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading system health data...</p>
          </div>
        </div>
      </div>
    );
  }

  const { database, redis, queues, system, status, recent_errors } = systemHealth;

  // Prepare memory usage data for chart
  const memoryData = {
    labels: ['RSS', 'Heap Used', 'Heap Total', 'External'],
    datasets: [
      {
        data: [
          (system.memory.rss / 1024 / 1024).toFixed(1),
          (system.memory.heapUsed / 1024 / 1024).toFixed(1),
          (system.memory.heapTotal / 1024 / 1024).toFixed(1),
          (system.memory.external / 1024 / 1024).toFixed(1)
        ],
        backgroundColor: [
          'rgba(239, 68, 68, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(251, 146, 60, 0.8)'
        ],
        borderColor: [
          'rgb(239, 68, 68)',
          'rgb(59, 130, 246)',
          'rgb(34, 197, 94)',
          'rgb(251, 146, 60)'
        ],
        borderWidth: 2,
      },
    ],
  };

  const memoryOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `${context.label}: ${context.parsed} MB`;
          }
        }
      }
    },
  };

  // Helper functions
  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
      case 'connected':
        return 'text-green-600 bg-green-100';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100';
      case 'error':
      case 'disconnected':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };


  return (
    <div className="space-y-6">
      {/* Header with Refresh Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">⚙️ System Health Monitor</h2>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <div className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}>
            🔄
          </div>
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Overall System Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">🖥️ System Status</h3>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status)}`}>
              {status}
            </span>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Platform:</span>
              <span className="font-medium">{system.platform}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Node.js:</span>
              <span className="font-medium">{system.version}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Uptime:</span>
              <span className="font-medium">{formatUptime(system.uptime)}</span>
            </div>
          </div>
        </div>

        {/* Database Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">🗄️ Database</h3>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(database.status)}`}>
              {database.status}
            </span>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Connection:</span>
              <span className="font-medium">PostgreSQL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Latency:</span>
              <span className="font-medium">{database.latency}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`font-medium ${database.status === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                {database.status === 'connected' ? '✅ Connected' : '❌ Disconnected'}
              </span>
            </div>
          </div>
        </div>

        {/* Redis Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">📦 Redis Cache</h3>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(redis.status)}`}>
              {redis.status}
            </span>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Connection:</span>
              <span className="font-medium">Redis</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Latency:</span>
              <span className="font-medium">{redis.latency}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`font-medium ${redis.status === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                {redis.status === 'connected' ? '✅ Connected' : '❌ Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Memory Usage and Queue Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Memory Usage Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">💾 Memory Usage</h3>
          <div className="h-80">
            <Doughnut data={memoryData} options={memoryOptions} />
          </div>
          <div className="mt-4 text-sm text-gray-600 text-center">
            Total Memory: {((system.memory.rss + system.memory.external) / 1024 / 1024).toFixed(1)} MB
          </div>
        </div>

        {/* Queue Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">📋 Queue Status</h3>
          <div className="space-y-4">
            {Object.entries(queues || {}).length > 0 ? (
              Object.entries(queues).map(([queueName, queueStats]) => (
                <div key={queueName} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-gray-800 capitalize">{queueName}</h4>
                    <span className="text-sm text-gray-500">
                      {queueStats.waiting + queueStats.active} total
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{queueStats.waiting}</div>
                      <div className="text-sm text-gray-600">Waiting</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{queueStats.active}</div>
                      <div className="text-sm text-gray-600">Active</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${((queueStats.active / (queueStats.waiting + queueStats.active)) * 100) || 0}%`
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <span className="text-4xl mb-2 block">📋</span>
                No active queues found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Errors and System Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Errors */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">🚨 Recent Errors</h3>
          <div className="space-y-3">
            {recent_errors && recent_errors.length > 0 ? (
              recent_errors.map((error, index) => (
                <div key={index} className="border-l-4 border-red-500 bg-red-50 p-3 rounded">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-red-800">{error.message}</p>
                      <p className="text-xs text-red-600 mt-1">{error.timestamp}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-green-600">
                <span className="text-4xl mb-2 block">✅</span>
                No recent errors
              </div>
            )}
          </div>
        </div>

        {/* System Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">🔧 Quick Actions</h3>
          <div className="space-y-3">
            <button 
              onClick={() => onSystemAction('clear-cache')}
              className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 hover:shadow-md transition-all duration-200 transform hover:scale-105"
            >
              🧹 Clear Redis Cache
            </button>
            <button 
              onClick={() => onSystemAction('generate-report')}
              className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 hover:shadow-md transition-all duration-200 transform hover:scale-105"
            >
              📊 Generate System Report
            </button>
            <button 
              onClick={() => onSystemAction('restart')}
              className="w-full bg-yellow-600 text-white px-4 py-3 rounded-lg hover:bg-yellow-700 hover:shadow-md transition-all duration-200 transform hover:scale-105"
            >
              🔄 Restart Services
            </button>
            <button 
              onClick={() => onSystemAction('view-logs')}
              className="w-full bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 hover:shadow-md transition-all duration-200 transform hover:scale-105"
            >
              📁 View System Logs
            </button>
          </div>
        </div>
      </div>

      {/* System Information Footer */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-2xl mr-3">⏰</span>
            <div>
              <h3 className="text-sm font-medium text-gray-800">Last Updated</h3>
              <div className="text-sm text-gray-600">
                {new Date(systemHealth.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-800">Auto-refresh</div>
            <div className="text-sm text-gray-600">Every 30 seconds</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// PropTypes validation
OverviewTab.propTypes = {
  dashboardData: PropTypes.shape({
    overview: PropTypes.shape({
      total_users: PropTypes.number,
      users_today: PropTypes.number,
      total_restaurants: PropTypes.number,
      restaurants_today: PropTypes.number,
      total_orders: PropTypes.number,
      orders_today: PropTypes.number,
      total_revenue: PropTypes.number,
      platform_fees_today: PropTypes.number,
    }),
    realtime: PropTypes.shape({
      current_online: PropTypes.number,
      visitor_growth: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      visitors_today: PropTypes.number,
      orders_today: PropTypes.number,
      revenue_today: PropTypes.number,
    }),
    top_restaurants: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.number,
      name: PropTypes.string,
      total_orders: PropTypes.number,
      total_revenue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      unique_customers: PropTypes.number,
    })),
    system: PropTypes.shape({
      queues: PropTypes.object,
    }),
  }),
  onSystemAction: PropTypes.func.isRequired,
};

MetricCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  change: PropTypes.string.isRequired,
  color: PropTypes.oneOf(['blue', 'green', 'purple', 'yellow']).isRequired,
  icon: PropTypes.string.isRequired,
};

AnalyticsTab.propTypes = {
  analytics: PropTypes.object,
  onRefresh: PropTypes.func,
  isRefreshing: PropTypes.bool,
};

UsersTab.propTypes = {
  users: PropTypes.arrayOf(PropTypes.object),
};

RestaurantsTab.propTypes = {
  restaurants: PropTypes.arrayOf(PropTypes.object),
};

OrdersTab.propTypes = {
  orders: PropTypes.arrayOf(PropTypes.object),
};

SupportTab.propTypes = {
  supportMessages: PropTypes.arrayOf(PropTypes.object),
  supportStats: PropTypes.object,
  onUpdateMessage: PropTypes.func.isRequired,
  onDeleteMessage: PropTypes.func.isRequired,
};

RestaurantContactsTab.propTypes = {
  restaurantContacts: PropTypes.arrayOf(PropTypes.object),
};

SystemTab.propTypes = {
  systemHealth: PropTypes.object,
  onRefresh: PropTypes.func,
  isRefreshing: PropTypes.bool,
  onSystemAction: PropTypes.func.isRequired,
};

// Default props
OverviewTab.defaultProps = {
  dashboardData: null,
};

AnalyticsTab.defaultProps = {
  analytics: null,
};

UsersTab.defaultProps = {
  users: [],
};

RestaurantsTab.defaultProps = {
  restaurants: [],
};

OrdersTab.defaultProps = {
  orders: [],
};

RestaurantContactsTab.defaultProps = {
  restaurantContacts: [],
};

SupportTab.defaultProps = {
  supportMessages: [],
  supportStats: null,
};

SystemTab.defaultProps = {
  systemHealth: null,
};

LogEntry.propTypes = {
  log: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
};

export default AdminDashboard;