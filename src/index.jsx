import React from "react";
import { createRoot } from "react-dom/client";
import isPropValid from "@emotion/is-prop-valid";
import { StyleSheetManager } from "styled-components";
import "./index.css";
import App from "./App";

// styled-components 6 forwards every prop to the DOM unless told otherwise.
const shouldForwardProp = (prop, target) => typeof target !== "string" || isPropValid(prop);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <StyleSheetManager shouldForwardProp={shouldForwardProp}>
      <App />
    </StyleSheetManager>
  </React.StrictMode>
);
