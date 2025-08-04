let isLoggedIn = false;
let refreshInterval;

// Check if already logged in
document.addEventListener('DOMContentLoaded', function() {
    if (sessionStorage.getItem('adminLoggedIn')) {
        showDashboard();
        loadDashboardData();
    }
});

// Login form handler
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('loginBtn');
    const loginText = document.getElementById('loginText');
    const loginLoading = document.getElementById('loginLoading');
    const errorMessage = document.getElementById('errorMessage');

    // Show loading state
    loginBtn.disabled = true;
    loginText.style.display = 'none';
    loginLoading.style.display = 'inline-block';
    errorMessage.style.display = 'none';

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok && data.success) {
            sessionStorage.setItem('adminLoggedIn', 'true');
            showDashboard();
            loadDashboardData();
        } else {
            throw new Error(data.error || 'Login failed');
        }
    } catch (error) {
        errorMessage.textContent = error.message;
        errorMessage.style.display = 'block';
    } finally {
        // Reset loading state
        loginBtn.disabled = false;
        loginText.style.display = 'inline';
        loginLoading.style.display = 'none';
    }
});

function showDashboard() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    isLoggedIn = true;
    
    // Auto-refresh every 30 seconds
    refreshInterval = setInterval(loadDashboardData, 30000);
}

async function loadDashboardData() {
    try {
        // Load main dashboard data
        const dashboardResponse = await fetch('/api/admin/dashboard', {
            credentials: 'include'
        });

        if (!dashboardResponse.ok) {
            throw new Error('Failed to load dashboard data');
        }

        const dashboardData = await dashboardResponse.json();
        updateDashboard(dashboardData);

        // Load restaurants data
        const restaurantsResponse = await fetch('/api/admin/restaurants?limit=10', {
            credentials: 'include'
        });

        if (restaurantsResponse.ok) {
            const restaurantsData = await restaurantsResponse.json();
            updateRestaurantsList(restaurantsData.restaurants);
        }

    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        if (error.message.includes('401') || error.message.includes('authentication')) {
            logout();
        }
    }
}

function updateDashboard(data) {
    const overview = data.overview;
    const realtime = data.realtime;

    // Update main stats
    document.getElementById('totalRestaurants').textContent = overview.total_restaurants;
    document.getElementById('newUsers').textContent = overview.users_this_week;
    document.getElementById('totalOrders').textContent = overview.total_orders;
    document.getElementById('platformRevenue').textContent = '$' + overview.total_platform_fees.toFixed(2);
    document.getElementById('dailyVisitors').textContent = realtime.visitors_today || 0;
    document.getElementById('activeOrders').textContent = realtime.orders_today || 0;

    // Update growth indicators
    document.getElementById('restaurantGrowth').textContent = '+' + overview.restaurants_this_week + ' this week';
    document.getElementById('userGrowth').textContent = '+' + overview.users_today + ' today';
    document.getElementById('orderGrowth').textContent = '+' + overview.orders_today + ' today';
    document.getElementById('revenueGrowth').textContent = '+$' + overview.platform_fees_today.toFixed(2) + ' today';
    
    const visitorGrowth = realtime.visitor_growth || 0;
    const visitorGrowthElement = document.getElementById('visitorGrowth');
    visitorGrowthElement.textContent = visitorGrowth > 0 ? '+' + visitorGrowth + '% vs yesterday' : visitorGrowth + '% vs yesterday';
    visitorGrowthElement.className = visitorGrowth >= 0 ? 'growth' : 'growth negative';

    document.getElementById('activeOrderGrowth').textContent = 'Processing now';
}

function updateRestaurantsList(restaurants) {
    const list = document.getElementById('restaurantsList');
    
    if (!restaurants || restaurants.length === 0) {
        list.innerHTML = '<li class="restaurant-item"><span class="restaurant-name">No restaurants found</span><span class="restaurant-orders">0</span></li>';
        return;
    }

    list.innerHTML = restaurants.map(restaurant => `
        <li class="restaurant-item">
            <span class="restaurant-name">${restaurant.name}</span>
            <span class="restaurant-orders">${restaurant.total_orders} orders</span>
        </li>
    `).join('');
}

function refreshData() {
    if (isLoggedIn) {
        loadDashboardData();
    }
}

function logout() {
    fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include'
    }).finally(() => {
        sessionStorage.removeItem('adminLoggedIn');
        document.getElementById('loginSection').style.display = 'block';
        document.getElementById('dashboard').style.display = 'none';
        document.getElementById('email').value = '';
        document.getElementById('password').value = '';
        isLoggedIn = false;
        
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
    });
}

// Handle browser back/forward
window.addEventListener('beforeunload', function() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});

// Make functions globally available
window.refreshData = refreshData;
window.logout = logout;