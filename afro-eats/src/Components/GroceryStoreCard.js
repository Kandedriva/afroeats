import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { getImageUrl, handleImageError } from '../utils/imageUtils';

function GroceryStoreCard({ store }) {
  const imageUrl = getImageUrl(store.image_url, 'No Store Image');

  return (
    <Link to={`/store/${store.slug || store.id}`}>
      <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 cursor-pointer h-full flex flex-col">
        <img
          className="w-full h-40 object-cover"
          src={imageUrl}
          alt={store.name}
          onError={(e) => handleImageError(e, 'No Store Image')}
        />
        <div className="p-4 flex flex-col flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🛒</span>
            <h3 className="text-xl font-semibold text-gray-800">{store.name}</h3>
          </div>
          <p className="text-gray-500 text-sm mb-3">{store.address}</p>

          {store.products && store.products.length > 0 ? (
            <div className="mt-auto">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Products available</p>
              <div className="flex gap-2 flex-wrap">
                {store.products.map((p) => (
                  <span
                    key={p.id}
                    className="inline-block px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full border border-green-100"
                  >
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 mt-auto">No products listed yet</p>
          )}
        </div>
      </div>
    </Link>
  );
}

GroceryStoreCard.propTypes = {
  store: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string.isRequired,
    address: PropTypes.string.isRequired,
    slug: PropTypes.string,
    image_url: PropTypes.string,
    products: PropTypes.array,
  }).isRequired,
};

export default GroceryStoreCard;
