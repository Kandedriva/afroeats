import { Component } from 'react';
import PropTypes from 'prop-types';
import ErrorBoundary from './ErrorBoundary';

/**
 * Enhanced Error Boundary that can catch async errors and Promise rejections
 */
class AsyncErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasAsyncError: false,
      asyncError: null
    };
  }

  componentDidMount() {
    // Listen for unhandled promise rejections
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  handleUnhandledRejection = (event) => {
    // Only catch errors from our app, not from other scripts
    if (this.isFromOurApp(event)) {
      event.preventDefault(); // Prevent the default browser behavior
      
      this.setState({
        hasAsyncError: true,
        asyncError: {
          message: event.reason?.message || 'Unhandled async error',
          stack: event.reason?.stack || '',
          type: 'unhandled_rejection'
        }
      });
    }
  };

  isFromOurApp = (event) => {
    // Check if the error comes from our application
    // This is a simple heuristic - you might want to make it more sophisticated
    const stack = event.reason?.stack || '';
    return stack.includes('/src/') || stack.includes('localhost') || 
           event.reason?.name === 'ChunkLoadError';
  };

  handleAsyncErrorRetry = () => {
    this.setState({
      hasAsyncError: false,
      asyncError: null
    });
  };

  render() {
    if (this.state.hasAsyncError) {
      return (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 my-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-orange-600 text-xl">⚡</span>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-orange-800">
                Async Operation Failed
              </h3>
              <p className="mt-1 text-sm text-orange-700">
                An asynchronous operation failed: {this.state.asyncError.message}
              </p>
              <div className="mt-3">
                <button
                  onClick={this.handleAsyncErrorRetry}
                  className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
                >
                  Retry
                </button>
              </div>
              
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-orange-600 hover:text-orange-800">
                    Show technical details
                  </summary>
                  <pre className="mt-2 text-xs text-orange-700 font-mono bg-orange-100 p-2 rounded overflow-auto max-h-32">
                    {this.state.asyncError.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <ErrorBoundary {...this.props}>
        {this.props.children}
      </ErrorBoundary>
    );
  }
}

AsyncErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};

export default AsyncErrorBoundary;