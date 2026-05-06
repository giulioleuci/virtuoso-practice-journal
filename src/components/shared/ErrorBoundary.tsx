import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface State { error: Error | null }

/** Catches render errors and offers a recovery action. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="paper-card p-6 max-w-md w-full text-center space-y-3">
          <h2 className="font-serif text-2xl">Something went wrong</h2>
          <p className="text-sm text-muted-foreground italic break-words">
            {this.state.error.message || "Unexpected error"}
          </p>
          <div className="flex gap-2 justify-center pt-2">
            <Button variant="outline" onClick={this.reset}>Try again</Button>
            <Button onClick={() => location.reload()}>Reload</Button>
          </div>
        </div>
      </div>
    );
  }
}
