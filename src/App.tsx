import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

const App = () => (
  <ErrorBoundary>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/*" element={<Index />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </ErrorBoundary>
);

export default App;
