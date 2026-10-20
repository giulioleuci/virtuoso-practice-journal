import { Component, type ReactNode } from "react";
import { I18nContext, browserLang, translate, type I18nContextValue } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

interface Props { children: ReactNode; /** Render inside the page instead of full screen. */ inline?: boolean; /** Clears the error when it changes (e.g. the route). */ resetKey?: string }
interface State { error: Error | null }

/** Catches render and read errors and offers a recovery action. Stored data is untouched. */
export class ErrorBoundary extends Component<Props, State> {
  static contextType = I18nContext;
  declare context: I18nContextValue | null;
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    // The root boundary sits outside the i18n provider, so it falls back to the browser language.
    const t = this.context?.t ?? ((key: string) => translate(browserLang(), key));
    return (
      <div role="alert" className={this.props.inline ? "py-16" : "flex min-h-screen items-center justify-center px-6"}>
        <div className="mx-auto w-full max-w-md space-y-3 text-center">
          <h2 className="font-serif text-3xl font-semibold">{t("states.errorTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("states.errorBody")}</p>
          <details className="text-left text-xs text-muted-foreground">
            <summary className="cursor-pointer text-center">{t("states.details")}</summary>
            <p className="mt-2 break-words font-mono">{error.message || String(error)}</p>
          </details>
          <div className="flex justify-center gap-2 pt-2">
            <Button variant="outline" onClick={this.reset}>{t("states.retry")}</Button>
            <Button onClick={() => location.reload()}>{t("states.reload")}</Button>
          </div>
        </div>
      </div>
    );
  }
}
