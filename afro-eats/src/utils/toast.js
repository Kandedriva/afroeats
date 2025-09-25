import { toast } from 'react-toastify';

// Enhanced toast notifications with icons and better styling
export const showToast = {
  success: (message, options = {}) => {
    toast.success(`✅ ${message}`, {
      ...options,
      autoClose: 3000,
    });
  },
  
  error: (message, options = {}) => {
    toast.error(`❌ ${message}`, {
      ...options,
      autoClose: 5000,
    });
  },
  
  warning: (message, options = {}) => {
    toast.warn(`⚠️ ${message}`, {
      ...options,
      autoClose: 4000,
    });
  },
  
  info: (message, options = {}) => {
    toast.info(`ℹ️ ${message}`, {
      ...options,
      autoClose: 4000,
    });
  },

  // Special admin action toasts
  adminAction: (message, options = {}) => {
    toast.success(`🔧 ${message}`, {
      ...options,
      autoClose: 3000,
    });
  },

  systemHealth: (message, options = {}) => {
    toast.info(`🖥️ ${message}`, {
      ...options,
      autoClose: 4000,
    });
  },

  userAction: (message, options = {}) => {
    toast.success(`👤 ${message}`, {
      ...options,
      autoClose: 3000,
    });
  },

  dataUpdate: (message, options = {}) => {
    toast.success(`💾 ${message}`, {
      ...options,
      autoClose: 3000,
    });
  },

  authentication: (message, options = {}) => {
    toast.warn(`🔐 ${message}`, {
      ...options,
      autoClose: 5000,
    });
  }
};

// Legacy compatibility - these will gradually replace toast.* calls
export const enhancedToast = {
  success: showToast.success,
  error: showToast.error,
  warn: showToast.warning,
  warning: showToast.warning,
  info: showToast.info,
};

export default showToast;