import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./index.css";
import { createJourneyConfig } from "./wagmi";

const config = await createJourneyConfig();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App config={config} />
  </StrictMode>,
);
