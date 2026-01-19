import PropTypes from 'prop-types';
import { useOrderNotifications } from '../hooks/useOrderNotifications';

/**
 * Notification Bell Component
 * Shows a bell icon with a badge for new order notifications
 * Includes sound alerts and browser notifications
 */
const NotificationBell = ({ userRole, restaurantId }) => {
  const {
    newOrderCount,
    clearNotificationCount,
    isEnabled,
    toggleNotifications,
    requestNotificationPermission,
  } = useOrderNotifications(userRole, restaurantId);

  const handleBellClick = () => {
    if (newOrderCount > 0) {
      clearNotificationCount();
    }
    // Could navigate to orders page or show a dropdown here
  };

  const handleToggleNotifications = async () => {
    if (!isEnabled) {
      // Request permission when enabling
      await requestNotificationPermission();
    }
    toggleNotifications();
  };

  // Don't show for regular customers
  if (userRole !== 'owner' && userRole !== 'admin') {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Notification Bell */}
      <button
        onClick={handleBellClick}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <svg
          className={`w-6 h-6 ${newOrderCount > 0 ? 'text-orange-600 animate-bounce' : 'text-gray-600'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Notification Badge */}
        {newOrderCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full min-w-[20px]">
            {newOrderCount > 99 ? '99+' : newOrderCount}
          </span>
        )}
      </button>

      {/* Toggle Notifications Button */}
      <button
        onClick={handleToggleNotifications}
        className={`p-2 rounded-full transition-colors ${
          isEnabled
            ? 'text-green-600 hover:bg-green-50'
            : 'text-gray-400 hover:bg-gray-100'
        }`}
        title={isEnabled ? 'Disable notifications' : 'Enable notifications'}
        aria-label={isEnabled ? 'Disable notifications' : 'Enable notifications'}
      >
        {isEnabled ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
              clipRule="evenodd"
            />
            <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
          </svg>
        )}
      </button>

      {/* Notification Status Indicator */}
      {newOrderCount > 0 && (
        <div className="hidden sm:block">
          <span className="text-xs font-medium text-orange-600">
            {newOrderCount} new {newOrderCount === 1 ? 'order' : 'orders'}
          </span>
        </div>
      )}
    </div>
  );
};

NotificationBell.propTypes = {
  userRole: PropTypes.string,
  restaurantId: PropTypes.number,
};

export default NotificationBell;
