import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' })
    .then((registration) => {
      console.log('[SW] Registered:', registration.scope);
    })
    .catch((err) => {
      console.warn('[SW] Registration failed:', err);
    });
}

createRoot(document.getElementById("root")!).render(<App />);
