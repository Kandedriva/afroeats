import { useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * Custom Confirmation Dialog Component
 * A beautiful alternative to window.confirm()
 */
const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmColor = 'red', // red, green, blue, yellow
  icon = '⚠️',
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const colorClasses = {
    red: {
      bg: 'bg-red-100',
      icon: 'text-red-600',
      button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    },
    green: {
      bg: 'bg-green-100',
      icon: 'text-green-600',
      button: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
    },
    blue: {
      bg: 'bg-blue-100',
      icon: 'text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    },
    yellow: {
      bg: 'bg-yellow-100',
      icon: 'text-yellow-600',
      button: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
    },
  };

  const colors = colorClasses[confirmColor] || colorClasses.red;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleBackdropClick}
        onKeyDown={(e) => e.key === 'Enter' && handleBackdropClick(e)}
        role="button"
        tabIndex={0}
        aria-label="Close dialog"
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all animate-scaleIn">
        {/* Icon */}
        <div className="flex flex-col items-center pt-8 pb-4">
          <div className={`${colors.bg} rounded-full p-4 mb-4`}>
            <span className={`text-5xl ${colors.icon}`}>{icon}</span>
          </div>

          {/* Title */}
          <h3 className="text-2xl font-bold text-gray-900 text-center px-6">
            {title}
          </h3>
        </div>

        {/* Message */}
        <div className="px-8 pb-6">
          <p className="text-gray-600 text-center leading-relaxed">
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 px-6 py-3 text-white rounded-xl font-semibold transition-colors focus:outline-none focus:ring-2 ${colors.button}`}
          >
            {confirmText}
          </button>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

ConfirmDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  title: PropTypes.string,
  message: PropTypes.string,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  confirmColor: PropTypes.oneOf(['red', 'green', 'blue', 'yellow']),
  icon: PropTypes.string,
};

export default ConfirmDialog;
