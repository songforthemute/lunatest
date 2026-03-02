import React from "react";
import ReactDOM from "react-dom/client";
import { bootstrapLunaRuntime } from "@lunatest/react";

import { App } from "./app";
import "./styles.css";

const nodeEnv =
  typeof import.meta !== "undefined"
    ? import.meta.env?.MODE
    : typeof process !== "undefined"
      ? process.env.NODE_ENV
      : undefined;

void bootstrapLunaRuntime({
  source: "./lunatest.lua",
  nodeEnv,
  mountDevtools: true,
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
