import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { configurePlatform } from "./lib/platform";
import { configurePresentationQueries } from "./application/queries/presentationQueryService";
import { dexiePresentationReads } from "./infrastructure/dexie/presentationReadPort";
import "./index.css";

configurePlatform();
configurePresentationQueries(dexiePresentationReads);

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element #root not found");
createRoot(rootElement).render(<App />);
