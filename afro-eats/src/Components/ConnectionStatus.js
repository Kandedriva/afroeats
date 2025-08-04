import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';

const ConnectionStatus = () => {
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/health`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (response.ok) {
          const data = await response.json();
          setStatus('connected');
          console.log('Backend connection successful:', data);
        } else {
          setStatus('error');
          setError(`Server responded with ${response.status}`);
        }
      } catch (err) {
        setStatus('error');
        setError(err.message);
        console.error('Backend connection failed:', err);
      }
    };

    checkConnection();
  }, []);

  if (status === 'checking') {
    return (
      <div className="fixed top-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-2 rounded z-50">
        🔄 Checking server connection...
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded z-50">
        ❌ Server connection failed: {error}
      </div>
    );
  }

  if (status === 'connected') {
    return (
      <div className="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded z-50">
        ✅ Server connected
      </div>
    );
  }

  return null;
};

export default ConnectionStatus;