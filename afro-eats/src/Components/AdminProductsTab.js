/* eslint-disable jsx-a11y/label-has-associated-control */
import { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "../config/api";
import { toast } from "react-toastify";

const AdminProductsTab = () => {
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterAvailability, setFilterAvailability] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState([]);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    category: "vegetables",
    subcategory: "",
    unit: "lb",
    stock_quantity: "",
    low_stock_threshold: "10",
    is_available: true,
    image_url: "",
    origin: "",
    organic: false,
    gluten_free: false,
    vegan: false,
    tags: "",
  });

  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (filterCategory !== "all") {
        params.append("category", filterCategory);
      }
      if (filterAvailability !== "all") {
        params.append("is_available", filterAvailability);
      }
      if (searchQuery) {
        params.append("search", searchQuery);
      }

      const res = await fetch(`${API_BASE_URL}/api/products?${params}`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to load products");
      }

      const data = await res.json();
      setProducts(data);
    } catch (err) {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterAvailability, searchQuery]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/products/admin/stats`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to load stats");
      }

      const data = await res.json();
      setStats(data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Stats error:", err);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/products/categories`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to load categories");
      }

      const data = await res.json();
      setCategories(data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Categories error:", err);
    }
  }, []);

  useEffect(() => {
    loadProducts();
    loadStats();
    loadCategories();
  }, [loadProducts, loadStats, loadCategories]);

  const openCreateModal = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      category: "vegetables",
      subcategory: "",
      unit: "lb",
      stock_quantity: "0",
      low_stock_threshold: "10",
      is_available: true,
      image_url: "",
      origin: "",
      organic: false,
      gluten_free: false,
      vegan: false,
      tags: "",
    });
    setSelectedImageFile(null);
    setImagePreview("");
    setShowCreateModal(true);
  };

  const openEditModal = (product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name || "",
      description: product.description || "",
      price: product.price || "",
      category: product.category || "vegetables",
      subcategory: product.subcategory || "",
      unit: product.unit || "lb",
      stock_quantity: product.stock_quantity || "0",
      low_stock_threshold: product.low_stock_threshold || "10",
      is_available: product.is_available !== false,
      image_url: product.image_url || "",
      origin: product.origin || "",
      organic: product.organic || false,
      gluten_free: product.gluten_free || false,
      vegan: product.vegan || false,
      tags: Array.isArray(product.tags) ? product.tags.join(", ") : "",
    });
    setSelectedImageFile(null);
    setImagePreview(product.image_url || "");
    setShowEditModal(true);
  };

  const openDeleteModal = (product) => {
    setSelectedProduct(product);
    setShowDeleteModal(true);
  };

  const openStockModal = (product) => {
    setSelectedProduct(product);
    setStockQuantity(product.stock_quantity.toString());
    setShowStockModal(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size must be less than 5MB");
        return;
      }
      if (!file.type.startsWith("image/")) {
        toast.error("Please select a valid image file");
        return;
      }
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateProduct = async () => {
    try {
      if (!formData.name || !formData.price || !formData.category || !formData.unit) {
        toast.error("Please fill in all required fields");
        return;
      }

      setSubmitting(true);

      // Use FormData for file upload
      const formDataToSend = new FormData();
      formDataToSend.append("name", formData.name);
      formDataToSend.append("description", formData.description);
      formDataToSend.append("price", parseFloat(formData.price));
      formDataToSend.append("category", formData.category);
      formDataToSend.append("subcategory", formData.subcategory || "");
      formDataToSend.append("unit", formData.unit);
      formDataToSend.append("stock_quantity", parseInt(formData.stock_quantity) || 0);
      formDataToSend.append("low_stock_threshold", parseInt(formData.low_stock_threshold) || 10);
      formDataToSend.append("is_available", formData.is_available);
      formDataToSend.append("origin", formData.origin || "");
      formDataToSend.append("organic", formData.organic);
      formDataToSend.append("gluten_free", formData.gluten_free);
      formDataToSend.append("vegan", formData.vegan);
      formDataToSend.append("tags", formData.tags ? formData.tags.split(",").map((t) => t.trim()).join(",") : "");

      // Add image file if selected
      if (selectedImageFile) {
        formDataToSend.append("image", selectedImageFile);
      }

      const res = await fetch(`${API_BASE_URL}/api/products/admin`, {
        method: "POST",
        credentials: "include",
        body: formDataToSend,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create product");
      }

      toast.success("Product created successfully!");
      setShowCreateModal(false);
      setSelectedImageFile(null);
      setImagePreview("");
      loadProducts();
      loadStats();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateProduct = async () => {
    try {
      if (!formData.name || !formData.price || !formData.category || !formData.unit) {
        toast.error("Please fill in all required fields");
        return;
      }

      setSubmitting(true);

      // Use FormData for file upload
      const formDataToSend = new FormData();
      formDataToSend.append("name", formData.name);
      formDataToSend.append("description", formData.description);
      formDataToSend.append("price", parseFloat(formData.price));
      formDataToSend.append("category", formData.category);
      formDataToSend.append("subcategory", formData.subcategory || "");
      formDataToSend.append("unit", formData.unit);
      formDataToSend.append("stock_quantity", parseInt(formData.stock_quantity) || 0);
      formDataToSend.append("low_stock_threshold", parseInt(formData.low_stock_threshold) || 10);
      formDataToSend.append("is_available", formData.is_available);
      formDataToSend.append("origin", formData.origin || "");
      formDataToSend.append("organic", formData.organic);
      formDataToSend.append("gluten_free", formData.gluten_free);
      formDataToSend.append("vegan", formData.vegan);
      formDataToSend.append("tags", formData.tags ? formData.tags.split(",").map((t) => t.trim()).join(",") : "");

      // Add image file if selected (new image)
      if (selectedImageFile) {
        formDataToSend.append("image", selectedImageFile);
      }

      const res = await fetch(`${API_BASE_URL}/api/products/admin/${selectedProduct.id}`, {
        method: "PUT",
        credentials: "include",
        body: formDataToSend,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update product");
      }

      toast.success("Product updated successfully!");
      setShowEditModal(false);
      setSelectedImageFile(null);
      setImagePreview("");
      loadProducts();
      loadStats();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async () => {
    try {
      setSubmitting(true);

      const res = await fetch(`${API_BASE_URL}/api/products/admin/${selectedProduct.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete product");
      }

      toast.success("Product deleted successfully!");
      setShowDeleteModal(false);
      loadProducts();
      loadStats();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStock = async () => {
    try {
      const quantity = parseInt(stockQuantity);

      if (isNaN(quantity) || quantity < 0) {
        toast.error("Please enter a valid quantity");
        return;
      }

      setSubmitting(true);

      const res = await fetch(`${API_BASE_URL}/api/products/admin/${selectedProduct.id}/stock`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update stock");
      }

      toast.success("Stock updated successfully!");
      setShowStockModal(false);
      loadProducts();
      loadStats();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getStockBadge = (product) => {
    if (product.stock_quantity === 0) {
      return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Out of Stock</span>;
    }
    if (product.stock_quantity <= product.low_stock_threshold) {
      return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Low Stock</span>;
    }
    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">In Stock</span>;
  };

  if (loading && products.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">📦 Marketplace Products</h2>
        <button
          onClick={openCreateModal}
          className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center gap-2"
        >
          <span className="text-xl">+</span>
          Add Product
        </button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Total Products</div>
            <div className="text-3xl font-bold text-purple-600">{stats.total_products}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Available</div>
            <div className="text-3xl font-bold text-green-600">{stats.available_products}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Low Stock</div>
            <div className="text-3xl font-bold text-yellow-600">{stats.low_stock_products}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Out of Stock</div>
            <div className="text-3xl font-bold text-red-600">{stats.out_of_stock_products}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.icon} {cat.display_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
            <select
              value={filterAvailability}
              onChange={(e) => setFilterAvailability(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Products</option>
              <option value="true">Available Only</option>
              <option value="false">Unavailable Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    <div className="text-5xl mb-4">📦</div>
                    <p className="text-lg font-medium">No products found</p>
                    <p className="text-sm mt-1">Get started by adding your first product</p>
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {product.image_url && (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-12 w-12 rounded object-cover mr-3"
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">{product.name}</div>
                          <div className="text-sm text-gray-500">
                            {product.unit} {product.origin && `• ${product.origin}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 capitalize">{product.category.replace("_", " ")}</span>
                      {product.subcategory && <div className="text-xs text-gray-500">{product.subcategory}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-purple-600">${parseFloat(product.price).toFixed(2)}</span>
                      <div className="text-xs text-gray-500">per {product.unit}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{product.stock_quantity}</div>
                      {getStockBadge(product)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {product.is_available ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Available</span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Unavailable</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openStockModal(product)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                          title="Update Stock"
                        >
                          Stock
                        </button>
                        <button
                          onClick={() => openEditModal(product)}
                          className="text-purple-600 hover:text-purple-800 font-medium"
                          title="Edit Product"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openDeleteModal(product)}
                          className="text-red-600 hover:text-red-800 font-medium"
                          title="Delete Product"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Product Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">
              {showCreateModal ? "Add New Product" : "Edit Product"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Fresh Spinach"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  {categories.map((cat) => (
                    <option key={cat.name} value={cat.name}>
                      {cat.icon} {cat.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unit <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="lb">lb (pound)</option>
                  <option value="kg">kg (kilogram)</option>
                  <option value="each">each</option>
                  <option value="bunch">bunch</option>
                  <option value="dozen">dozen</option>
                  <option value="bottle">bottle</option>
                  <option value="bag">bag</option>
                  <option value="box">box</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stock Quantity</label>
                <input
                  type="number"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Low Stock Alert</label>
                <input
                  type="number"
                  value={formData.low_stock_threshold}
                  onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="10"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Product description..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Origin</label>
                <input
                  type="text"
                  value={formData.origin}
                  onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Local, Nigeria"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
                {imagePreview && (
                  <div className="mt-2">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="h-24 w-24 object-cover rounded-lg"
                    />
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., fresh, organic, seasonal"
                />
              </div>

              <div className="md:col-span-2">
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_available}
                      onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Available for purchase</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.organic}
                      onChange={(e) => setFormData({ ...formData, organic: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Organic</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.gluten_free}
                      onChange={(e) => setFormData({ ...formData, gluten_free: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Gluten-Free</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.vegan}
                      onChange={(e) => setFormData({ ...formData, vegan: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Vegan</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                }}
                disabled={submitting}
                className="px-5 py-2.5 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={showCreateModal ? handleCreateProduct : handleUpdateProduct}
                disabled={submitting}
                className="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    {showCreateModal ? "Creating..." : "Updating..."}
                  </>
                ) : showCreateModal ? (
                  "Create Product"
                ) : (
                  "Update Product"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Update Modal */}
      {showStockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Update Stock</h3>
            <p className="text-gray-600 mb-4">
              Product: <span className="font-medium">{selectedProduct?.name}</span>
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Current stock: <span className="font-medium">{selectedProduct?.stock_quantity}</span>
            </p>

            <label className="block text-sm font-medium text-gray-700 mb-2">New Stock Quantity</label>
            <input
              type="number"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-6"
              placeholder="0"
              min="0"
            />

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowStockModal(false)}
                disabled={submitting}
                className="px-5 py-2.5 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateStock}
                disabled={submitting}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Updating...
                  </>
                ) : (
                  "Update Stock"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-red-100 mb-4">
                <span className="text-3xl">⚠️</span>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Delete Product?</h3>
              <p className="text-gray-600">
                Are you sure you want to delete <span className="font-medium">{selectedProduct?.name}</span>? This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={submitting}
                className="px-5 py-2.5 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProduct}
                disabled={submitting}
                className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Deleting...
                  </>
                ) : (
                  "Delete Product"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProductsTab;
