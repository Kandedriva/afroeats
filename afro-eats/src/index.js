import * as Sentry from "@sentry/react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./utils/fetchInterceptor";

if (process.env.REACT_APP_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [Sentry.replayIntegration()],
  });
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <BrowserRouter>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </BrowserRouter>
);

function ErrorFallback() {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <h2>Something went wrong</h2>
      <p>We&apos;ve been notified and are working on a fix.</p>
      <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: "8px 20px", cursor: "pointer" }}>
        Reload page
      </button>
    </div>
  );
}
