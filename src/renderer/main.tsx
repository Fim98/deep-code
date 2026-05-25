import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { installThemeWatcher } from "./stores/theme";
import "./styles/globals.css";

installThemeWatcher();

const root = document.getElementById("root");
if (!root) throw new Error("root element not found");

ReactDOM.createRoot(root).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
