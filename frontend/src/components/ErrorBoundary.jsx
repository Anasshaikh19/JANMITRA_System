import React, { Component } from 'react';

/**
 * ErrorBoundary Component
 * 
 * Catches uncaught JavaScript errors anywhere in the child component tree,
 * logs the error information, and displays a friendly, accessible civic fallback UI.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to monitoring service / console
    console.error('JANMITRA Uncaught UI Error:', error, errorInfo);
    this.setState({ errorInfo });
    
    // Optional external error logger hook
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (logErr) {
        console.warn('Error reporting failed:', logErr);
      }
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleCopyDiagnostics = () => {
    const diagnostics = `JANMITRA Error Report
Timestamp: ${new Date().toISOString()}
URL: ${window.location.href}
Error: ${this.state.error?.toString()}
Component Stack:
${this.state.errorInfo?.componentStack || 'N/A'}`;

    navigator.clipboard?.writeText(diagnostics).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 3000);
    }).catch(() => {
      // Fallback
    });
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback support
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback({
              error: this.state.error,
              reset: this.handleReset,
              reload: this.handleReload,
            })
          : this.props.fallback;
      }

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 antialiased text-slate-800"
        >
          <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl border border-slate-200/90 overflow-hidden transition-all animate-fade-in">
            {/* Top Municipal Branding Header */}
            <div className="bg-gradient-to-r from-blue-700 via-primary to-blue-600 px-6 py-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center font-black text-xl shadow-xs">
                  🏛️
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-blue-200">
                    JANMITRA • Municipal System Guard
                  </div>
                  <h1 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                    Civic Portal Notice
                  </h1>
                </div>
              </div>
              <span className="text-xs bg-white/15 px-2.5 py-1 rounded-full font-bold">
                Ward Support 1916
              </span>
            </div>

            {/* Error Content Body */}
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl shrink-0">
                  ⚠️
                </div>
                <div className="space-y-1">
                  <h2 className="text-base sm:text-lg font-black text-slate-900">
                    Something went wrong on this screen
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    The portal encountered an unexpected display error. Your municipal records, draft complaints, and saved data remain completely safe and uncorrupted.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  id="btn-error-reload"
                  onClick={this.handleReload}
                  className="w-full py-3 px-4 bg-primary hover:bg-blue-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md shadow-blue-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <span>🔄</span>
                  <span>Reload Page</span>
                </button>

                <button
                  type="button"
                  id="btn-error-home"
                  onClick={this.handleGoHome}
                  className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <span>🏠</span>
                  <span>Return to Portal Home</span>
                </button>
              </div>

              {/* Helpline & IT Assistance */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <span className="font-extrabold text-slate-800">Need Immediate Assistance?</span>
                  <p className="text-slate-500 text-[11px]">
                    NMC Civic Helpline: <strong>1916</strong> (Toll-Free, 24x7)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={this.handleCopyDiagnostics}
                  className="text-xs font-bold text-primary hover:text-blue-800 underline self-start sm:self-auto"
                >
                  {this.state.copied ? '✓ Copied Details!' : '📋 Copy Error Diagnostics'}
                </button>
              </div>

              {/* Collapsible Technical Details for Administrators */}
              <div className="border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                  className="text-[11px] font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1.5 focus:outline-none"
                  aria-expanded={this.state.showDetails}
                >
                  <span>{this.state.showDetails ? '▼' : '▶'}</span>
                  <span>Technical Diagnostic Details (IT Desk)</span>
                </button>

                {this.state.showDetails && (
                  <div className="mt-3 p-3 bg-slate-900 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto max-h-44 space-y-2 select-text">
                    <p className="text-red-400 font-bold">
                      {this.state.error?.toString()}
                    </p>
                    {this.state.errorInfo?.componentStack && (
                      <pre className="text-[10px] text-slate-400 whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
