import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./index.css";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("MemoryLab needs a #root element to render into");
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
