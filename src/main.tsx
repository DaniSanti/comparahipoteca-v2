import { createRoot } from 'react-dom/client'
import { initialisePrivacy } from "./analytics/runtime";
import App from './App.tsx'
import './index.css'

initialisePrivacy();
createRoot(document.getElementById("root")!).render(<App />);
