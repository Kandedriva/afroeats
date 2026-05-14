import { useState } from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { toast } from 'react-toastify';
import { useGroceryCart } from '../context/GroceryCartContext';
import { slugify } from '../utils/slugify';

const ProductCard = ({ product }) => {
  const { addToGroceryCart } = useGroceryCart();
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [weight, setWeight] = useState(0);
  const formatPrice = (price) => parseFloat(price).toFixed(2);

  const isWeightBased = ['lb', 'kg', 'oz', 'g'].includes(product.unit);

  const getBadges = (p) => {
    const badges = [];
    if (p.organic) { badges.push({ text: 'Organic', color: 'bg-green-100 text-green-800' }); }
    if (p.gluten_free) { badges.push({ text: 'Gluten-Free', color: 'bg-blue-100 text-blue-800' }); }
    if (p.vegan) { badges.push({ text: 'Vegan', color: 'bg-purple-100 text-purple-800' }); }
    return badges;
  };

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (product.stock_quantity === 0 || !product.is_available) {
      toast.error('This product is currently unavailable');
      return;
    }

    if (isWeightBased) {
      setShowWeightModal(true);
      return;
    }

    try {
      await addToGroceryCart(product, 1);
      toast.success(`Added ${product.name} to grocery cart!`);
    } catch (err) {
      toast.error(err.message || 'Failed to add to cart');
    }
  };

  const handleConfirmWeight = async () => {
    if (!weight || weight < 0.1) {
      toast.error(`Please enter a valid amount (minimum 0.1 ${product.unit})`);
      return;
    }
    try {
      await addToGroceryCart(product, parseFloat(weight));
      toast.success(`Added ${weight} ${product.unit} of ${product.name} to grocery cart!`);
      setShowWeightModal(false);
      setWeight(0);
    } catch (err) {
      toast.error(err.message || 'Failed to add to cart');
    }
  };

  const badges = getBadges(product);
  const isLowStock = product.stock_quantity <= product.low_stock_threshold;
  const isOutOfStock = product.stock_quantity === 0;
  const pricePerUnit = parseFloat(product.price) + parseFloat(product.platform_fee || 0);
  const calculatedTotal = weight > 0 ? (pricePerUnit * weight).toFixed(2) : '0.00';

  const categoryEmoji =
    product.category === 'vegetables' ? '🥬' :
    product.category === 'fruits'     ? '🍎' :
    product.category === 'grains'     ? '🌾' :
    product.category === 'spices'     ? '🌶️' : '📦';

  return (
    <div className="bg-white rounded-md sm:rounded-lg shadow-sm sm:shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group relative flex flex-col h-full">
      <Link to={`/marketplace/product/${slugify(product.name)}`} className="flex flex-col flex-1">
        {/* Image — compact on mobile, full on sm+ */}
        <div className="relative h-28 sm:h-44 lg:h-56 bg-gray-100 overflow-hidden flex-shrink-0">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = `<div class="flex items-center justify-center h-full text-3xl sm:text-6xl">${categoryEmoji}</div>`;
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-3xl sm:text-6xl">{categoryEmoji}</div>
          )}
          {isLowStock && (
            <div className="absolute top-1 right-1 sm:top-3 sm:right-3">
              <span className="px-1.5 py-0.5 sm:px-3 sm:py-1 bg-orange-500 text-white text-[10px] sm:text-xs font-semibold rounded-full shadow-lg">
                {isOutOfStock ? 'Out' : 'Low'}
              </span>
            </div>
          )}
        </div>

        <div className="p-1.5 sm:p-4 flex flex-col flex-1">
          <h3 className="text-[11px] sm:text-base lg:text-lg font-semibold text-gray-800 mb-0.5 sm:mb-2 line-clamp-1 sm:line-clamp-2 group-hover:text-green-600 transition-colors">
            {product.name}
          </h3>
          {product.store_name && (
            <p className="hidden sm:inline-block text-xs text-green-700 font-medium bg-green-50 px-2 py-1 rounded-full mb-2">
              🏪 {product.store_name}
            </p>
          )}
          {product.origin && (
            <p className="hidden sm:block text-sm text-gray-500 mb-2">📍 {product.origin}</p>
          )}
          {badges.length > 0 && (
            <div className="hidden sm:flex flex-wrap gap-1 mb-3">
              {badges.map((badge, idx) => (
                <span key={idx} className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                  {badge.text}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-baseline justify-between mb-0.5 sm:mb-3">
            <div>
              <span className="text-xs sm:text-xl lg:text-2xl font-bold text-green-600">
                ${formatPrice(product.price + (product.platform_fee || 0))}
              </span>
              <span className="hidden sm:inline text-sm text-gray-500 ml-1">/ {product.unit}</span>
            </div>
          </div>
        </div>
      </Link>

      <div className="px-1.5 pb-1.5 sm:px-4 sm:pb-4 flex gap-1 sm:gap-2">
        {isOutOfStock || !product.is_available ? (
          <button disabled className="flex-1 py-1 sm:py-2 bg-gray-300 text-gray-500 rounded sm:rounded-lg font-medium text-[10px] sm:text-sm cursor-not-allowed">
            <span className="sm:hidden">✕</span>
            <span className="hidden sm:inline">Out of Stock</span>
          </button>
        ) : (
          <button
            onClick={handleAddToCart}
            className="flex-1 py-1 sm:py-2 bg-green-600 text-white rounded sm:rounded-lg hover:bg-green-700 transition-colors font-medium text-[10px] sm:text-sm flex items-center justify-center gap-0.5 sm:gap-1"
          >
            <span className="sm:hidden">+ Add</span>
            <span className="hidden sm:inline">🛒 Add to Cart</span>
          </button>
        )}
        <Link
          to={`/marketplace/product/${slugify(product.name)}`}
          className="hidden sm:block px-4 py-2 border-2 border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-colors font-medium text-sm"
        >
          View
        </Link>
      </div>

      {showWeightModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Enter Weight for {product.name}</h3>
            <div className="mb-6">
              <label htmlFor="weight-input" className="block text-sm font-medium text-gray-700 mb-2">
                How much do you want? ({product.unit})
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setWeight(Math.max(0.1, parseFloat((weight - 0.1).toFixed(1))))}
                  className="px-4 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-semibold text-lg"
                >-</button>
                <input
                  id="weight-input"
                  type="number"
                  value={weight || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') { setWeight(0); }
                    else {
                      const n = parseFloat(val);
                      if (!isNaN(n) && n >= 0) { setWeight(n); }
                    }
                  }}
                  step="0.1" min="0.1" placeholder="0.0"
                  className="flex-1 text-center text-xl font-semibold border-2 border-gray-300 rounded-lg py-3 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <button
                  onClick={() => setWeight(parseFloat((weight + 0.1).toFixed(1)))}
                  className="px-4 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-semibold text-lg"
                >+</button>
                <span className="text-gray-600 font-medium">{product.unit}</span>
              </div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Price per {product.unit}:</span>
                <span className="font-semibold text-gray-900">${formatPrice(pricePerUnit)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">Total:</span>
                <span className="text-2xl font-bold text-green-600">${calculatedTotal}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowWeightModal(false); setWeight(0); }}
                className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >Cancel</button>
              <button
                onClick={handleConfirmWeight}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <span>🛒</span> Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

ProductCard.propTypes = {
  product: PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    unit: PropTypes.string.isRequired,
    image_url: PropTypes.string,
    origin: PropTypes.string,
    description: PropTypes.string,
    is_available: PropTypes.bool,
    stock_quantity: PropTypes.number,
    category: PropTypes.string,
    organic: PropTypes.bool,
    gluten_free: PropTypes.bool,
    vegan: PropTypes.bool,
    low_stock_threshold: PropTypes.number,
    platform_fee: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    store_name: PropTypes.string,
  }).isRequired,
};

export default ProductCard;
