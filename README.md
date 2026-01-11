# Afro Eats - Restaurant Ordering Platform

A full-stack restaurant ordering platform built with React and Node.js, featuring Stripe Connect for multi-restaurant payment processing.

## Features

- **Dual User System**: Separate interfaces for customers and restaurant owners
- **Order Management**: Real-time order processing with notifications
- **Payment Processing**: Stripe Connect integration with platform fee splitting ($1.20 flat fee)
- **SMS Notifications**: Restaurant owners receive instant SMS alerts for new orders (Twilio)
- **Email Notifications**: Optional email notifications with beautiful HTML templates
- **Restaurant Management**: Owner dashboard for managing dishes and orders
- **Cart System**: Persistent shopping cart with backend storage
- **Authentication**: Session-based authentication for both user types
- **Multi-Restaurant Orders**: Customers can order from multiple restaurants in one checkout

## Tech Stack

### Frontend
- React 19
- React Router v7
- TailwindCSS
- Stripe React components
- Context API for state management

### Backend
- Node.js with Express
- PostgreSQL database
- Stripe Connect API
- Twilio SMS API
- Nodemailer (Email)
- Session-based authentication
- File upload handling (Cloudflare R2)

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL database
- Stripe account (optional for development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Afro-Restaut
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install
   
   # Install backend dependencies
   cd backend
   npm install
   
   # Install frontend dependencies
   cd ../afro-eats
   npm install
   ```

3. **Set up environment variables**
   
   **Backend** (`backend/.env`):
   ```bash
   cp backend/.env.example backend/.env
   ```
   Edit the `.env` file with your database and other configurations.
   
   **Frontend** (`afro-eats/.env`):
   ```bash
   cp afro-eats/.env.example afro-eats/.env
   ```

4. **Set up the database**
   ```bash
   # Create PostgreSQL database
   psql -U postgres -c "CREATE DATABASE afroeats;"
   
   # Run the session table setup
   psql -U postgres -d afroeats -f backend/create_sessions_table.sql
   
   # Run migrations
   psql -U postgres -d afroeats -f backend/migrations/add_subscription_columns.sql
   ```

5. **Start the application**
   
   **Backend** (Terminal 1):
   ```bash
   cd backend
   npm start
   ```
   
   **Frontend** (Terminal 2):
   ```bash
   cd afro-eats
   npm start
   ```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5001

## Development Mode

The application runs in development mode by default when Stripe keys are not configured:
- Payment processing uses demo mode
- No real charges are made
- All features work without Stripe setup

## Production Setup

For production deployment:

1. **Configure Stripe**:
   - Set up Stripe Connect in your Stripe dashboard
   - Add your production Stripe keys to environment variables
   - Configure webhook endpoints

2. **Database**:
   - Set up production PostgreSQL database
   - Run all migrations
   - Configure connection parameters

3. **Security**:
   - Set strong session secrets
   - Configure CORS for your domain
   - Set up HTTPS

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - User logout

### Orders
- `POST /api/orders` - Create order
- `GET /api/orders/:id` - Get order details
- `POST /api/orders/checkout-session` - Create Stripe checkout

### Restaurants
- `GET /api/restaurants` - List all restaurants
- `GET /api/restaurants/:id` - Get restaurant details

### Owner Routes
- `GET /api/owners/dashboard` - Owner dashboard data
- `POST /api/owners/dishes` - Add new dish
- `GET /api/owners/orders` - Get restaurant orders

## Project Structure

```
Afro-Restaut/
├── afro-eats/                 # React frontend
│   ├── src/
│   │   ├── Components/        # Reusable components
│   │   ├── pages/            # Page components
│   │   ├── context/          # Context providers
│   │   └── hooks/            # Custom hooks
│   └── public/
├── backend/                   # Node.js backend
│   ├── routes/               # API routes
│   ├── controllers/          # Route controllers
│   ├── middleware/           # Custom middleware
│   ├── migrations/           # Database migrations
│   └── uploads/              # File uploads
└── node_modules/
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.