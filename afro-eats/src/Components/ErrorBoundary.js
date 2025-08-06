import { Component } from 'react';
import PropTypes from 'prop-types';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(_error) {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    this.setState({
      error,
      errorInfo
    });

    // Log to error monitoring service (if available)
    this.logErrorToService(error, errorInfo);
  }

  logErrorToService = (error, errorInfo) => {
    // In production, you might want to send this to an error monitoring service
    if (process.env.NODE_ENV === 'development') {
      // Use structured logging instead of console statements
      const errorDetails = {
        error: error.toString(),
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString()
      };
      
      // Only log in development, avoiding ESLint console warnings
      // eslint-disable-next-line no-console
      console.group('🚨 Error Boundary Caught an Error');
      // eslint-disable-next-line no-console
      console.error('Error Details:', errorDetails);
      // eslint-disable-next-line no-console
      console.groupEnd();
    }
  };

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleReloadPage = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { fallback: Fallback, level = 'component' } = this.props;

      // If a custom fallback component is provided, use it
      if (Fallback) {
        return (
          <Fallback
            error={this.state.error}
            errorInfo={this.state.errorInfo}
            onRetry={this.handleRetry}
            onReload={this.handleReloadPage}
          />
        );
      }

      // Default error UI based on error level
      if (level === 'app') {
        return (
          <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
              <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                <div className="text-center">
                  <div className="text-6xl mb-4">💥</div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-4">
                    Something went wrong
                  </h1>
                  <p className="text-gray-600 mb-6">
                    We&apos;re sorry, but the application encountered an unexpected error.
                  </p>
                  
                  <div className="space-y-3">
                    <button
                      onClick={this.handleRetry}
                      className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
                    >
                      Try Again
                    </button>
                    
                    <button
                      onClick={this.handleReloadPage}
                      className="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                    >
                      Reload Page
                    </button>
                  </div>

                  {process.env.NODE_ENV === 'development' && this.state.error && (
                    <details className="mt-6 text-left">
                      <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                        Show error details
                      </summary>
                      <div className="mt-2 p-3 bg-gray-100 rounded text-xs text-gray-700 font-mono overflow-auto max-h-40">
                        <div className="mb-2">
                          <strong>Error:</strong> {this.state.error.toString()}
                        </div>
                        <div>
                          <strong>Stack:</strong>
                          <pre className="whitespace-pre-wrap">{this.state.error.stack}</pre>
                        </div>
                      </div>
                    </details>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      }

      // Default component-level error UI
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-red-600 text-xl">⚠️</span>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800">
                Component Error
              </h3>
              <p className="mt-1 text-sm text-red-700">
                This component encountered an error and couldn&apos;t render properly.
              </p>
              <div className="mt-3">
                <button
                  onClick={this.handleRetry}
                  className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  fallback: PropTypes.elementType,
  level: PropTypes.oneOf(['app', 'component']),
};

ErrorBoundary.defaultProps = {
  fallback: null,
  level: 'component',
};

export default ErrorBoundary;