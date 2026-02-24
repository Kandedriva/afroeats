import { useState, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';
import { useSocket } from '../hooks/useSocket';
import { AuthContext } from '../context/AuthContext';
import { API_BASE_URL } from '../config/api';
import ChatWindow from './ChatWindow';
import '../styles/FloatingChatWindow.css';

/**
 * Floating chat window with restaurant list and chat interface
 */
function FloatingChatWindow({ isMinimized, onMinimize }) {
  const { user } = useContext(AuthContext);
  const {
    conversations,
    activeConversation,
    openConversation,
    closeConversation,
    createConversation,
    setIsChatOpen
  } = useSocket();

  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRestaurantList, setShowRestaurantList] = useState(true);

  // Fetch restaurants where user has placed orders
  useEffect(() => {
    const fetchRestaurants = async () => {
      if (!user) {
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/orders/my-restaurants`, {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setRestaurants(data.restaurants || []);
        }
      } catch (error) {
        // Error fetching restaurants
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurants();
  }, [user]);

  const handleClose = () => {
    setIsChatOpen(false);
    closeConversation();
    setShowRestaurantList(true);
  };

  const handleSelectRestaurant = async (restaurant) => {
    // Check if conversation already exists
    const existingConversation = conversations.find(
      conv => conv.restaurant_id === restaurant.id
    );

    if (existingConversation) {
      await openConversation(existingConversation);
    } else {
      // Create new conversation
      const newConversation = await createConversation(restaurant.id);
      if (newConversation) {
        await openConversation(newConversation);
      }
    }
    setShowRestaurantList(false);
  };

  const handleBack = () => {
    closeConversation();
    setShowRestaurantList(true);
  };

  if (isMinimized) {
    return null;
  }

  return (
    <div className="floating-chat-window">
      {/* Header */}
      <div className="floating-chat-header">
        <div className="floating-chat-header-info">
          {activeConversation && !showRestaurantList ? (
            <>
              <button onClick={handleBack} className="back-button">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M12 4l-8 8 8 8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <h3>{activeConversation.restaurant_name || 'Chat'}</h3>
            </>
          ) : (
            <h3>My Chats</h3>
          )}
        </div>

        <div className="floating-chat-header-actions">
          <button onClick={onMinimize} className="chat-action-btn" aria-label="Minimize">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button onClick={handleClose} className="chat-action-btn" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="floating-chat-content">
        {showRestaurantList ? (
          /* Restaurant List */
          <div className="restaurant-list">
            {loading ? (
              <div className="loading-state">
                <p>Loading restaurants...</p>
              </div>
            ) : restaurants.length === 0 ? (
              <div className="empty-state">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M54 18a4 4 0 0 1-4 4H18l-8 8V14a4 4 0 0 1 4-4h36a4 4 0 0 1 4 4z" />
                </svg>
                <p>No restaurants yet</p>
                <span>Place an order first to start chatting with restaurants</span>
              </div>
            ) : (
              <>
                <div className="restaurant-list-header">
                  <p>Select a restaurant to chat with:</p>
                </div>
                {restaurants.map((restaurant) => {
                  const hasUnread = conversations.some(
                    conv => conv.restaurant_id === restaurant.id && conv.customer_unread_count > 0
                  );

                  return (
                    <div
                      key={restaurant.id}
                      role="button"
                      tabIndex={0}
                      className="restaurant-item"
                      onClick={() => handleSelectRestaurant(restaurant)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectRestaurant(restaurant);
                        }
                      }}
                    >
                      <div className="restaurant-avatar">
                        {restaurant.image_url ? (
                          <img src={restaurant.image_url} alt={restaurant.name} />
                        ) : (
                          <div className="avatar-placeholder">
                            {restaurant.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {hasUnread && <span className="unread-indicator" />}
                      </div>
                      <div className="restaurant-info">
                        <h4>{restaurant.name}</h4>
                        {restaurant.last_order_date && (
                          <span className="last-order">Last order: {new Date(restaurant.last_order_date).toLocaleDateString()}</span>
                        )}
                      </div>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8 4l6 8-6 8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        ) : (
          /* Chat Window */
          <ChatWindow isMinimized={false} onMinimize={() => {}} isFloating={true} />
        )}
      </div>
    </div>
  );
}

FloatingChatWindow.propTypes = {
  isMinimized: PropTypes.bool,
  onMinimize: PropTypes.func
};

export default FloatingChatWindow;
