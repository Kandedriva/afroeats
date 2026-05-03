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
    if (weight < 0.1 || weight > product.stock_quantity) {
      toast.error(`Please enter a valid weight between 0.1 and ${product.stock_quantity} ${product.unit}`);
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
  const pricePerUnit = product.price + (product.platform_fee || 0);
  const calculatedTotal = (pricePerUnit * weight).toFixed(2);

  const categoryEmoji =
    product.category === 'vegetables' ? '🥬' :
    product.category === 'fruits'     ? '🍎' :
    product.category === 'grains'     ? '🌾' :
    product.category === 'spices'     ? '🌶️' : '📦';

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group relative">
      <Link to={`/marketplace/product/${slugify(product.name)}`} className="block">
        <div className="relative h-56 bg-gray-100 overflow-hidden">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = `<div class="flex items-center justify-center h-full text-6xl">${categoryEmoji}</div>`;
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-6xl">{categoryEmoji}</div>
          )}
          {isLowStock && (
            <div className="absolute top-3 right-3">
              <span className="px-3 py-1 bg-orange-500 text-white text-xs font-semibold rounded-full shadow-lg">
                {isOutOfStock ? 'Out of Stock' : 'Low Stock'}
              </span>
            </div>
          )}
        </div>

        <div className="p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2 group-hover:text-green-600 transition-colors">
            {product.name}
          </h3>
          {product.store_name && (
            <p className="text-xs text-green-700 font-medium bg-green-50 px-2 py-1 rounded-full inline-block mb-2">
              🏪 {product.store_name}
            </p>
          )}
          {product.origin && (
            <p className="text-sm text-gray-500 mb-2">📍 {product.origin}</p>
          )}
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {badges.map((badge, idx) => (
                <span key={idx} className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                  {badge.text}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <span className="text-2xl font-bold text-green-600">
                ${formatPrice(product.price + (product.platform_fee || 0))}
              </span>
              <span className="text-sm text-gray-500 ml-1">/ {product.unit}</span>
            </div>
          </div>
          {product.description && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
          )}
        </div>
      </Link>

      <div className="px-4 pb-4 flex gap-2">
        {isOutOfStock || !product.is_available ? (
          <button disabled className="flex-1 py-2 bg-gray-300 text-gray-500 rounded-lg font-medium text-sm cursor-not-allowed">
            Out of Stock
          </button>
        ) : (
          <button
            onClick={handleAddToCart}
            className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm flex items-center justify-center gap-1"
          >
            <span>🛒</span> Add to Cart
          </button>
        )}
        <Link
          to={`/marketplace/product/${slugify(product.name)}`}
          className="px-4 py-2 border-2 border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-colors font-medium text-sm"
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
                  step="0.1" min="0" max={product.stock_quantity} placeholder="0.0"
                  className="flex-1 text-center text-xl font-semibold border-2 border-gray-300 rounded-lg py-3 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <button
                  onClick={() => setWeight(Math.min(product.stock_quantity, parseFloat((weight + 0.1).toFixed(1))))}
                  className="px-4 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-semibold text-lg"
                >+</button>
                <span className="text-gray-600 font-medium">{product.unit}</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">Available: {product.stock_quantity} {product.unit}</p>
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
