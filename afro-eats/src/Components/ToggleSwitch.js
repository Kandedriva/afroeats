// React import removed as it's not needed in React 17+
import PropTypes from 'prop-types';

const ToggleSwitch = ({ checked, onChange }) => {
  return (
    <label className="inline-flex items-center cursor-pointer relative" aria-label="Toggle switch">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={onChange}
      />
      <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-green-500 transition-colors duration-300"></div>
      <div className="w-4 h-4 bg-white rounded-full absolute left-1 top-1 transition-transform duration-300 transform peer-checked:translate-x-5"></div>
    </label>
  );
};

ToggleSwitch.propTypes = {
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default ToggleSwitch;
