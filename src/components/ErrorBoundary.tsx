import { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../lib/logger';
import { SUPPORT_EMAIL } from '../lib/contactPlaceholders';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Error caught by boundary:', error.message);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.href = '/';
  };

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-sky-50 px-4">
          <div className="max-w-md w-full text-center animate-fade-in">
            <div className="w-24 h-24 bg-gradient-to-br from-red-100 to-red-50 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-red-100">
              <i className="ri-error-warning-line text-5xl text-red-500"></i>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
              Oops! Something went wrong
            </h1>
            
            <p className="text-slate-600 mb-8 leading-relaxed">
              We encountered an unexpected error. Don't worry, your data is safe.
              Please try again or return to the home page.
            </p>

            {this.state.error && import.meta.env.DEV && (
              <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl text-left">
                <p className="text-sm font-semibold text-red-900 mb-2 flex items-center gap-2">
                  <i className="ri-code-line"></i>
                  Error Details (Dev Only)
                </p>
                <p className="text-xs text-red-700 font-mono break-all leading-relaxed">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-8 py-4 bg-sky-600 text-white rounded-xl font-semibold hover:bg-sky-700 transition-all cursor-pointer whitespace-nowrap shadow-lg shadow-sky-600/20 hover:shadow-xl hover:shadow-sky-600/30 touch-target"
              >
                <span className="flex items-center justify-center gap-2">
                  <i className="ri-refresh-line"></i>
                  Try Again
                </span>
              </button>
              
              <button
                onClick={this.handleReset}
                className="px-8 py-4 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-all cursor-pointer whitespace-nowrap touch-target"
              >
                <span className="flex items-center justify-center gap-2">
                  <i className="ri-home-line"></i>
                  Go to Home
                </span>
              </button>
            </div>

            <p className="text-sm text-slate-500 mt-8">
              If this problem persists, please{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sky-600 hover:underline">
                contact support
              </a>
              .
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
