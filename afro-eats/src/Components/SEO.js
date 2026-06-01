import { Helmet } from 'react-helmet-async';
import PropTypes from 'prop-types';

const BASE_URL = 'https://www.orderdabaly.com';
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;

export default function SEO({ title, description, path = '', image = DEFAULT_IMAGE }) {
  const fullTitle = title
    ? `${title} | OrderDabaly`
    : 'OrderDabaly — African Food & Grocery Delivery';
  const url = `${BASE_URL}${path}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />

      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}

SEO.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string.isRequired,
  path: PropTypes.string,
  image: PropTypes.string,
};
