import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { API_BASE_URL } from '../config/api';
import { toast } from 'react-toastify';
import ConfirmDialog from '../Components/ConfirmDialog';

function GroceryOwnerProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
  });

  useEffect(() => {
    fetchStoreAndProducts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStoreAndProducts = async () => {
    try {
      setLoading(true);

      // Fetch store information first
      const storeResponse = await fetch(`${API_BASE_URL}/api/grocery-owners/store`, {
        credentials: 'include',
      });

      if (storeResponse.ok) {
        const storeData = await storeResponse.json();

        // Fetch products for this store
        const productsResponse = await fetch(
          `${API_BASE_URL}/api/products?store_id=${storeData.id}`,
          {
            credentials: 'include',
          }
        );

        if (productsResponse.ok) {
          const productsData = await productsResponse.json();
          setProducts(productsData);
        } else {
          toast.error('Failed to load products');
        }
      } else {
        toast.error('Failed to load store information');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Products fetch error:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAvailability = async (productId, currentStatus) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/grocery-owners/products/${productId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          is_available: !currentStatus,
        }),
      });

      if (response.ok) {
        toast.success(`Product ${!currentStatus ? 'enabled' : 'disabled'} successfully`);
        // Refresh products
        fetchStoreAndProducts();
      } else {
        toast.error('Failed to update product');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Toggle availability error:', error);
      toast.error('Failed to update product');
    }
  };

  const handleDeleteProduct = (productId) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Product?',
      message: 'Are you sure you want to delete this product? This action cannot be undone.',
      confirmColor: 'red',
      icon: '🗑️',
      onConfirm: () => executeDeleteProduct(productId),
    });
  };

  const executeDeleteProduct = async (productId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/grocery-owners/products/${productId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('Product deleted successfully');
        fetchStoreAndProducts();
      } else {
        toast.error('Failed to delete product');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Delete product error:', error);
      toast.error('Failed to delete product');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Manage Products</h1>
              <p className="text-gray-600 mt-2">
                View and manage your store&apos;s product inventory
              </p>
            </div>
            <Link
              to="/grocery-owner/products/add"
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
            >
              <span className="text-xl">+</span>
              Add New Product
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">Total Products</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{products.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">Available</p>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {products.filter((p) => p.is_available).length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">Out of Stock</p>
            <p className="text-3xl font-bold text-red-600 mt-2">
              {products.filter((p) => !p.is_available).length}
            </p>
          </div>
        </div>

        {/* Products Grid */}
        {products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {products.map((product) => (
              <ProductManagementCard
                key={product.id}
                product={product}
                onToggleAvailability={handleToggleAvailability}
                onDelete={handleDeleteProduct}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-2xl font-semibold text-gray-800 mb-2">No products yet</h3>
            <p className="text-gray-600 mb-6">
              Start by adding your first product to your store
            </p>
            <Link
              to="/grocery-owner/products/add"
              className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Add Your First Product
            </Link>
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmColor={confirmDialog.confirmColor}
        icon={confirmDialog.icon}
      />
    </div>
  );
}

// Simplified Product Card for Management (smaller, no cart buttons)
const ProductManagementCard = ({ product, onToggleAvailability, onDelete }) => {
  const formatPrice = (price) => parseFloat(price).toFixed(2);

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden">
      {/* Product Image */}
      <div className="relative aspect-square bg-gray-100">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">
            🛍️
          </div>
        )}

        {/* Availability Badge */}
        <div className="absolute top-2 right-2">
          <span
            className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
              product.is_available
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {product.is_available ? '✓ Active' : '✕ Hidden'}
          </span>
        </div>

        {/* Low Stock Warning */}
        {product.stock_quantity !== null && product.stock_quantity < 10 && (
          <div className="absolute top-2 left-2">
            <span className="inline-block px-2 py-1 text-xs font-semibold rounded bg-yellow-100 text-yellow-800">
              Low Stock
            </span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-3">
        <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 mb-1">
          {product.name}
        </h3>

        <p className="text-xs text-gray-500 mb-2">
          {product.category || 'Uncategorized'}
        </p>

        <div className="flex items-center justify-between mb-2">
          <span className="text-lg font-bold text-green-600">
            ${formatPrice(product.price)}
          </span>
          {product.stock_quantity !== null && (
            <span className="text-xs text-gray-600">
              Stock: {product.stock_quantity}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Link
            to={`/grocery-owner/products/edit/${product.id}`}
            className="px-2 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors text-center"
          >
            Edit
          </Link>
          <button
            onClick={() => onToggleAvailability(product.id, product.is_available)}
            className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
              product.is_available
                ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {product.is_available ? 'Hide' : 'Show'}
          </button>
        </div>

        <button
          onClick={() => onDelete(product.id)}
          className="w-full mt-2 px-2 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

ProductManagementCard.propTypes = {
  product: PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    category: PropTypes.string,
    image_url: PropTypes.string,
    is_available: PropTypes.bool,
    stock_quantity: PropTypes.number,
  }).isRequired,
  onToggleAvailability: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

// Add ConfirmDialog before closing the component
// This needs to be added inside the return statement of GroceryOwnerProducts
// Search for the closing tag of the main container and add before it

export default GroceryOwnerProducts;
