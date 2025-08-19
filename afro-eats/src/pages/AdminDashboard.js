// React import removed as it's not needed in React 17+
import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import PropTypes from 'prop-types';
import { API_BASE_URL } from '../config/api';

const AdminDashboard = () => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [orders, setOrders] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [supportMessages, setSupportMessages] = useState([]);
  const [supportStats, setSupportStats] = useState(null);

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
      
      // Auto-refresh every 30 seconds
      const interval = setInterval(() => {
        loadDashboardData();
      }, 30000);
      
      // Check authentication every 5 minutes
      const authCheckInterval = setInterval(() => {
        checkAdminAuth();
      }, 300000); // 5 minutes
      
      return () => {
        clearInterval(interval);
        clearInterval(authCheckInterval);
      };
    }
    return undefined;
  }, [admin]);

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
          toast.warn('Session expired. Please log in again.');
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

  const loadDashboardData = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/dashboard`, {
        credentials: 'include'
      });
      
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      } else if (res.status === 401) {
        // Session expired during data loading
        setAdmin(null);
        toast.warn('Session expired. Please log in again.');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load dashboard data:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/analytics?period=30`, {
        credentials: 'include'
      });
      
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (error) {
      // console.error('Failed to load analytics:', error);
    }
  };

  const loadSystemHealth = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/system`, {
        credentials: 'include'
      });
      
      if (res.ok) {
        const data = await res.json();
        setSystemHealth(data);
      }
    } catch (error) {
      // console.error('Failed to load system health:', error);
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
        toast.success('Logged out successfully');
        
        // Force page reload to clear any cached data
        setTimeout(() => {
          window.location.href = '/admin/login';
        }, 1000);
      } else {
        toast.error('Logout failed. Please try again.');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Logout failed:', error);
      toast.error('Logout failed. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/admin/login" />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">🍽️ A Food Zone Admin</h1>
              <span className="ml-4 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                {admin.role}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {admin.username}</span>
              <button
                onClick={logout}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
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
          <div className="flex space-x-8">
            {[
              { id: 'overview', label: '📊 Overview' },
              { id: 'analytics', label: '📈 Analytics' },
              { id: 'users', label: '👥 Users' },
              { id: 'restaurants', label: '🏪 Restaurants' },
              { id: 'orders', label: '📋 Orders' },
              { id: 'support', label: '🎧 Support' },
              { id: 'system', label: '⚙️ System' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
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
          <OverviewTab dashboardData={dashboardData} />
        )}
        
        {activeTab === 'analytics' && (
          <AnalyticsTab analytics={analytics} />
        )}
        
        {activeTab === 'users' && (
          <UsersTab users={users} />
        )}
        
        {activeTab === 'restaurants' && (
          <RestaurantsTab restaurants={restaurants} />
        )}
        
        {activeTab === 'orders' && (
          <OrdersTab orders={orders} />
        )}
        
        {activeTab === 'support' && (
          <SupportTab 
            supportMessages={supportMessages} 
            supportStats={supportStats}
            onUpdateMessage={loadSupportMessages}
          />
        )}
        
        {activeTab === 'system' && (
          <SystemTab systemHealth={systemHealth} />
        )}
      </main>
    </div>
  );
};

// Overview Tab Component
const OverviewTab = ({ dashboardData }) => {
  if (!dashboardData) {
    return <div className="text-center py-8">Loading overview...</div>;
  }

  const { overview, realtime, top_restaurants, system } = dashboardData;

  return (
    <div className="space-y-6">
      {/* Real-time Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
      <div className="bg-white rounded-lg shadow p-6">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            <button className="w-full bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
              Clear Cache
            </button>
            <button className="w-full bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">
              Export Data
            </button>
            <button className="w-full bg-yellow-600 text-white px-4 py-2 rounded text-sm hover:bg-yellow-700">
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
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-full ${colorClasses[color]} mr-4`}>
          <span className="text-2xl">{icon}</span>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{change}</p>
        </div>
      </div>
    </div>
  );
};

// Analytics Tab Component (simplified for now)
const AnalyticsTab = ({ analytics }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <h3 className="text-lg font-semibold mb-4">📈 Analytics Dashboard</h3>
    <p className="text-gray-600">Detailed analytics charts would go here.</p>
    <pre className="mt-4 text-xs bg-gray-100 p-4 rounded overflow-auto">
      {JSON.stringify(analytics, null, 2)}
    </pre>
  </div>
);

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

// Support Tab Component
const SupportTab = ({ supportMessages, supportStats, onUpdateMessage }) => {
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [updating, setUpdating] = useState(false);

  const handleUpdateMessage = async (messageId) => {
    if (!status && !priority && !response.trim()) {
      toast.error('Please provide a status, priority, or response');
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
        toast.success('Support message updated successfully');
        setSelectedMessage(null);
        setResponse('');
        setStatus('');
        setPriority('');
        onUpdateMessage(); // Refresh the messages list
      } else {
        toast.error(data.error || 'Failed to update support message');
      }
    } catch (error) {
      toast.error('An error occurred while updating the message');
    } finally {
      setUpdating(false);
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
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Support Statistics */}
      {supportStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">🎧 Support Messages</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Subject
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {supportMessages.map((message) => (
                <tr key={message.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {message.user_name || 'Guest'}
                      </div>
                      <div className="text-sm text-gray-500">{message.user_email}</div>
                      {message.user_phone && (
                        <div className="text-xs text-gray-400">{message.user_phone}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate">
                      {message.subject}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(message.status)}`}>
                      {message.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(message.priority)}`}>
                      {message.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(message.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button
                      onClick={() => setSelectedMessage(message)}
                      className="text-blue-600 hover:text-blue-900 font-medium"
                    >
                      View/Respond
                    </button>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Support Message Details</h2>
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="text-gray-400 hover:text-gray-600"
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
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
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
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
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
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Type your response here..."
                  />
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setSelectedMessage(null)}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md font-medium hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUpdateMessage(selectedMessage.id)}
                    disabled={updating}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

// System Tab Component
const SystemTab = ({ systemHealth }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <h3 className="text-lg font-semibold mb-4">⚙️ System Health</h3>
    {systemHealth ? (
      <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto">
        {JSON.stringify(systemHealth, null, 2)}
      </pre>
    ) : (
      <p className="text-gray-600">Loading system health...</p>
    )}
  </div>
);

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
};

SystemTab.propTypes = {
  systemHealth: PropTypes.object,
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

SupportTab.defaultProps = {
  supportMessages: [],
  supportStats: null,
};

SystemTab.defaultProps = {
  systemHealth: null,
};

export default AdminDashboard;