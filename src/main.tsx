import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { configurePlatform } from "./lib/platform";
import "./index.css";

configurePlatform();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element #root not found");
createRoot(rootElement).render(<App />);
