import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ErrorStrip, Loading } from "./ui";

function App() {
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetch("./api/hello")
			.then((response) => response.json())
			.then((data: { message: string }) => {
				if (!cancelled) setMessage(data.message);
			})
			.catch(() => {
				if (!cancelled) setError("Could not reach the API.");
			});
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<main className="shell stack">
			<div>
				<h1>Your app is ready</h1>
				{error ? <ErrorStrip message={error} /> : null}
				{!error && message === null ? <Loading /> : null}
				{message ? <p className="lede">{message}</p> : null}
			</div>
			<p className="hint">
				Describe what you want to build and this page will change.
			</p>
		</main>
	);
}

const container = document.getElementById("root");
if (container) {
	createRoot(container).render(<App />);
}
