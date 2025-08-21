// React import removed as it's not needed in React 17+
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
// Import fetch interceptor to ensure all API calls include credentials
import "./utils/fetchInterceptor";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
