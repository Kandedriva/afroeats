-- Create chat system tables for customer-restaurant messaging
-- This enables real-time communication between customers and restaurant owners

-- ============================================================================
-- CHAT CONVERSATIONS TABLE
-- ============================================================================
-- Stores chat conversation metadata between a customer and restaurant
CREATE TABLE IF NOT EXISTS chat_conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    customer_unread_count INTEGER DEFAULT 0,
    owner_unread_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensure one conversation per customer-restaurant-order combination
    UNIQUE(user_id, restaurant_id, order_id)
);

-- ============================================================================
-- CHAT MESSAGES TABLE
-- ============================================================================
-- Stores individual messages within conversations
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('customer', 'owner')),
    sender_id INTEGER NOT NULL,  -- user_id for customer, owner_id for owner
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT message_not_empty CHECK (LENGTH(TRIM(message)) > 0)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
-- Conversations indexes
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_restaurant_id ON chat_conversations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_order_id ON chat_conversations(order_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_message ON chat_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_status ON chat_conversations(status);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_is_read ON chat_messages(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_type, sender_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update conversation's last_message_at when new message is added
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_conversations
    SET last_message_at = NEW.created_at,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_last_message
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_last_message();

-- Increment unread count when message is sent
CREATE OR REPLACE FUNCTION increment_unread_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.sender_type = 'customer' THEN
        -- Customer sent message, increment owner's unread count
        UPDATE chat_conversations
        SET owner_unread_count = owner_unread_count + 1
        WHERE id = NEW.conversation_id;
    ELSE
        -- Owner sent message, increment customer's unread count
        UPDATE chat_conversations
        SET customer_unread_count = customer_unread_count + 1
        WHERE id = NEW.conversation_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_unread_count
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION increment_unread_count();

-- Update conversation updated_at timestamp
CREATE OR REPLACE FUNCTION update_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_updated_at
    BEFORE UPDATE ON chat_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_updated_at();

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- View to get conversation with latest message and participants info
CREATE OR REPLACE VIEW chat_conversations_with_details AS
SELECT
    c.id,
    c.user_id,
    c.restaurant_id,
    c.order_id,
    c.last_message_at,
    c.customer_unread_count,
    c.owner_unread_count,
    c.status,
    c.created_at,
    u.name as customer_name,
    u.email as customer_email,
    r.name as restaurant_name,
    ro.id as owner_id,
    ro.name as owner_name,
    ro.email as owner_email,
    o.total as order_total,
    o.status as order_status,
    (SELECT message FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
    (SELECT sender_type FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_sender
FROM chat_conversations c
LEFT JOIN users u ON c.user_id = u.id
LEFT JOIN restaurants r ON c.restaurant_id = r.id
LEFT JOIN restaurant_owners ro ON r.owner_id = ro.id
LEFT JOIN orders o ON c.order_id = o.id;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE chat_conversations IS 'Stores chat conversation metadata between customers and restaurants';
COMMENT ON TABLE chat_messages IS 'Stores individual messages within chat conversations';
COMMENT ON COLUMN chat_conversations.customer_unread_count IS 'Number of unread messages for the customer';
COMMENT ON COLUMN chat_conversations.owner_unread_count IS 'Number of unread messages for the restaurant owner';
COMMENT ON COLUMN chat_messages.sender_type IS 'Type of sender: customer or owner';
COMMENT ON COLUMN chat_messages.sender_id IS 'ID of sender (user_id for customer, owner_id for owner)';

-- ============================================================================
-- GRANT PERMISSIONS (if needed)
-- ============================================================================
-- GRANT SELECT, INSERT, UPDATE ON chat_conversations TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE ON chat_messages TO your_app_user;

COMMIT;
