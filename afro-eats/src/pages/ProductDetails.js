/* eslint-disable jsx-a11y/label-has-associated-control */
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { toast } from "react-toastify";
import { useGroceryCart } from "../context/GroceryCartContext";
import PropTypes from 'prop-types';
import { slugify } from "../utils/slugify";

const ProductDetails = () => {
  const { productSlug } = useParams();
  const navigate = useNavigate();
  const { addToGroceryCart } = useGroceryCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [relatedProducts, setRelatedProducts] = useState([]);

  const loadProduct = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/products/${productSlug}`);

      if (!res.ok) {
        if (res.status === 404) {
          toast.error("Product not found");
          navigate("/marketplace");
          return;
        }
        throw new Error("Failed to load product");
      }

      const data = await res.json();
      setProduct(data);
    } catch (err) {
      toast.error("Failed to load product details");
      navigate("/marketplace");
    } finally {
      setLoading(false);
    }
  }, [productSlug, navigate]);

  const loadRelatedProducts = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/products?category=${product.category}&is_available=true&limit=4`
      );
      if (res.ok) {
        const data = await res.json();
        // Exclude current product
        const filtered = data.filter((p) => p.id !== product.id).slice(0, 3);
        setRelatedProducts(filtered);
      }
    } catch (err) {
      // Silent fail for related products
    }
  }, [product]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  useEffect(() => {
    if (product) {
      loadRelatedProducts();
    }
  }, [product, loadRelatedProducts]);

  const handleAddToCart = async () => {
    try {
      await addToGroceryCart(product, quantity);
      toast.success(`Added ${quantity} ${product.unit} of ${product.name} to grocery cart!`);
    } catch (err) {
      toast.error(err.message || 'Failed to add to cart');
    }
  };

  const handleQuantityChange = (delta) => {
    const isWeightBased = ['lb', 'kg', 'oz', 'g'].includes(product.unit);
    const minQuantity = isWeightBased ? 0.1 : 1;
    const newQuantity = parseFloat((quantity + delta).toFixed(1));

    if (newQuantity >= minQuantity && newQuantity <= product.stock_quantity) {
      setQuantity(newQuantity);
    }
  };

  const formatPrice = (price) => parseFloat(price).toFixed(2);

  const getBadges = (product) => {
    const badges = [];
    if (product.organic) {
      badges.push({ text: "Organic", color: "bg-green-100 text-green-800", icon: "🌱" });
    }
    if (product.gluten_free) {
      badges.push({ text: "Gluten-Free", color: "bg-blue-100 text-blue-800", icon: "🌾" });
    }
    if (product.vegan) {
      badges.push({ text: "Vegan", color: "bg-purple-100 text-purple-800", icon: "🥬" });
    }
    return badges;
  };

  const getStockStatus = () => {
    if (product.stock_quantity === 0) {
      return { text: "Out of Stock", color: "text-red-600", available: false };
    }
    if (product.stock_quantity <= product.low_stock_threshold) {
      return { text: `Only ${product.stock_quantity} left!`, color: "text-orange-600", available: true };
    }
    return { text: "In Stock", color: "text-green-600", available: true };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600"></div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  const badges = getBadges(product);
  const stockStatus = getStockStatus();
  const isWeightBased = ['lb', 'kg', 'oz', 'g'].includes(product.unit);
  const pricePerUnit = product.price + (product.platform_fee || 0);
  const totalPrice = (pricePerUnit * quantity).toFixed(2);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm">
          <ol className="flex items-center space-x-2 text-gray-600">
            <li>
              <Link to="/marketplace" className="hover:text-green-600">
                Marketplace
              </Link>
            </li>
            <li>→</li>
            <li>
              <Link
                to={`/marketplace?category=${product.category}`}
                className="hover:text-green-600 capitalize"
              >
                {product.category.replace("_", " ")}
              </Link>
            </li>
            <li>→</li>
            <li className="font-medium text-gray-800">{product.name}</li>
          </ol>
        </nav>

        {/* Product Details Section */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8">
            {/* Product Image */}
            <div className="relative">
              <div className="sticky top-8">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = "none";
                        e.target.parentElement.innerHTML = `<div class="flex items-center justify-center h-full text-9xl">${
                          product.category === "vegetables"
                            ? "🥬"
                            : product.category === "fruits"
                            ? "🍎"
                            : product.category === "grains"
                            ? "🌾"
                            : product.category === "spices"
                            ? "🌶️"
                            : "📦"
                        }</div>`;
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-9xl">
                      {product.category === "vegetables"
                        ? "🥬"
                        : product.category === "fruits"
                        ? "🍎"
                        : product.category === "grains"
                        ? "🌾"
                        : product.category === "spices"
                        ? "🌶️"
                        : "📦"}
                    </div>
                  )}
                </div>

                {/* Additional Images (if any) */}
                {product.additional_images && product.additional_images.length > 0 && (
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {product.additional_images.map((img, idx) => (
                      <div key={idx} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                        <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Product Info */}
            <div>
              {/* Category */}
              <div className="mb-2">
                <Link
                  to={`/marketplace?category=${product.category}`}
                  className="text-sm text-gray-500 hover:text-green-600 capitalize"
                >
                  {product.category.replace("_", " ")}
                </Link>
              </div>

              {/* Product Name */}
              <h1 className="text-4xl font-bold text-gray-900 mb-4">{product.name}</h1>

              {/* Badges */}
              {badges.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {badges.map((badge, idx) => (
                    <span
                      key={idx}
                      className={`px-3 py-1 rounded-full text-sm font-medium ${badge.color} flex items-center gap-1`}
                    >
                      <span>{badge.icon}</span>
                      {badge.text}
                    </span>
                  ))}
                </div>
              )}

              {/* Origin */}
              {product.origin && (
                <p className="text-lg text-gray-600 mb-4">
                  <span className="font-medium">Origin:</span> 📍 {product.origin}
                </p>
              )}

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-5xl font-bold text-green-600">${formatPrice(pricePerUnit)}</span>
                  <span className="text-xl text-gray-500">/ {product.unit}</span>
                </div>
                {isWeightBased && (
                  <p className="text-sm text-gray-600 mb-2">Price shown is per {product.unit}</p>
                )}
                {/* Stock Status */}
                <p className={`text-lg font-semibold ${stockStatus.color}`}>{stockStatus.text}</p>
              </div>

              {/* Description */}
              {product.description && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">About this product</h3>
                  <p className="text-gray-700 leading-relaxed">{product.description}</p>
                </div>
              )}

              {/* Tags */}
              {product.tags && product.tags.length > 0 && (
                <div className="mb-6">
                  <div className="flex flex-wrap gap-2">
                    {product.tags.map((tag, idx) => (
                      <span key={idx} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity Selector & Add to Cart */}
              {stockStatus.available && product.is_available && (
                <div className="bg-gray-50 rounded-lg p-6 mb-6">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {isWeightBased ? `Amount (${product.unit})` : 'Quantity'}
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center border-2 border-gray-300 rounded-lg overflow-hidden">
                        <button
                          onClick={() => handleQuantityChange(isWeightBased ? -0.1 : -1)}
                          disabled={quantity <= (isWeightBased ? 0.1 : 1)}
                          className="px-4 py-3 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={quantity}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val >= (isWeightBased ? 0.1 : 1) && val <= product.stock_quantity) {
                              setQuantity(val);
                            }
                          }}
                          className="w-24 text-center border-x-2 border-gray-300 py-3 font-semibold text-lg"
                          min={isWeightBased ? "0.1" : "1"}
                          step={isWeightBased ? "0.1" : "1"}
                          max={product.stock_quantity}
                        />
                        <button
                          onClick={() => handleQuantityChange(isWeightBased ? 0.1 : 1)}
                          disabled={quantity >= product.stock_quantity}
                          className="px-4 py-3 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-gray-600">{product.unit}</span>
                    </div>
                    {isWeightBased && (
                      <p className="text-xs text-gray-500 mt-2">
                        Enter the weight you want to purchase
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <span className="text-lg font-medium text-gray-700">Total:</span>
                    <span className="text-3xl font-bold text-green-600">${totalPrice}</span>
                  </div>

                  <button
                    onClick={handleAddToCart}
                    className="w-full py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-lg flex items-center justify-center gap-2"
                  >
                    <span>🛒</span>
                    Add to Cart
                  </button>
                </div>
              )}

              {/* Out of Stock Message */}
              {(!stockStatus.available || !product.is_available) && (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 mb-6">
                  <p className="text-red-800 font-semibold text-lg text-center">
                    This product is currently unavailable
                  </p>
                </div>
              )}

              {/* Product Details */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Product Details</h3>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Category:</dt>
                    <dd className="font-medium text-gray-900 capitalize">{product.category.replace("_", " ")}</dd>
                  </div>
                  {product.subcategory && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Subcategory:</dt>
                      <dd className="font-medium text-gray-900">{product.subcategory}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Unit:</dt>
                    <dd className="font-medium text-gray-900">{product.unit}</dd>
                  </div>
                  {product.origin && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Origin:</dt>
                      <dd className="font-medium text-gray-900">{product.origin}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-6">You May Also Like</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedProducts.map((relatedProduct) => (
                <RelatedProductCard key={relatedProduct.id} product={relatedProduct} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Related Product Card Component
const RelatedProductCard = ({ product }) => {
  const formatPrice = (price) => parseFloat(price).toFixed(2);

  return (
    <Link
      to={`/marketplace/product/${slugify(product.name)}`}
      className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group"
    >
      <div className="relative h-48 bg-gray-100 overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              e.target.style.display = "none";
              e.target.parentElement.innerHTML = `<div class="flex items-center justify-center h-full text-5xl">📦</div>`;
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-5xl">📦</div>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2 group-hover:text-green-600 transition-colors">
          {product.name}
        </h3>
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-xl font-bold text-green-600">${formatPrice(product.price)}</span>
            <span className="text-sm text-gray-500 ml-1">/ {product.unit}</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

RelatedProductCard.propTypes = {
  product: PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    unit: PropTypes.string.isRequired,
    image_url: PropTypes.string,
  }).isRequired,
};

export default ProductDetails;
