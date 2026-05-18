import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { configurePlatform } from "./lib/platform";
import "./index.css";

configurePlatform();

createRoot(document.getElementById("root")!).render(<App />);
