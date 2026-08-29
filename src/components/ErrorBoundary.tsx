import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#03070B] text-[#EAF2F7] flex flex-col items-center justify-center p-6 select-none">
          <div className="max-w-lg w-full bg-[#0B1520] border border-[#D62828]/50 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-[#D62828]">
              <AlertTriangle className="w-8 h-8 shrink-0" />
              <div>
                <h2 className="text-lg font-bold font-mono tracking-wide">
                  {this.props.fallbackTitle || "OCC SYSTEM DIAGNOSTIC ERROR"}
                </h2>
                <p className="text-xs text-[#8C9A8E] font-sans">
                  A component error was safely intercepted by the system boundary.
                </p>
              </div>
            </div>

            <div className="bg-[#050B11] p-3 rounded-lg border border-[#1E2B23] text-xs font-mono text-[#E2E8E4] overflow-x-auto max-h-40">
              {this.state.error?.message || "Unknown error occurred"}
            </div>

            <button
              onClick={this.handleReset}
              className="w-full py-2.5 px-4 bg-[#00D4FF] hover:bg-[#00B4D8] text-[#03070B] font-mono font-bold text-sm rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#00D4FF]/20"
            >
              <RefreshCw className="w-4 h-4" />
              <span>RELOAD OCC DIGITAL TWIN</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
