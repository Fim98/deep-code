import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { initI18n } from "./lib/i18n";
import { initAccent } from "./stores/accent";
import { installThemeWatcher } from "./stores/theme";
import "./styles/globals.css";

installThemeWatcher();
initAccent();
initI18n();

const root = document.getElementById("root");
if (!root) throw new Error("root element not found");

ReactDOM.createRoot(root).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
