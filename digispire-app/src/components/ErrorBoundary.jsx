import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

/** Shows a recoverable message when a page crashes, instead of a white screen. */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-sm w-full text-center space-y-4">
          <AlertTriangle size={36} className="mx-auto text-amber-500" />
          <div>
            <h1 className="text-base font-bold text-slate-800">This page could not be opened</h1>
            <p className="text-xs text-slate-500 mt-1">Something went wrong. Check your internet and try again.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 py-2.5 bg-[#255A84] hover:bg-[#1a4261] text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Dashboard
            </button>
          </div>
          <p className="text-[10px] text-slate-400 break-words">{error?.message || String(error)}</p>
        </div>
      </div>
    );
  }
}
