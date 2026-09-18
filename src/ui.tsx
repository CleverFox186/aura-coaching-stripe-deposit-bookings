import React from "react";

/** Shown while a request is in flight. Announced to screen readers. */
export function Loading({ label = "Loading..." }: { label?: string }) {
	return (
		<div className="loading" role="status" aria-live="polite">
			<span className="spinner" aria-hidden="true" />
			<span>{label}</span>
		</div>
	);
}

/** Shown when a list, table or search legitimately has nothing in it. */
export function Empty({
	title,
	hint,
	action,
}: {
	title: string;
	hint?: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="empty">
			<p className="empty-title">{title}</p>
			{hint ? <p className="hint">{hint}</p> : null}
			{action}
		</div>
	);
}

/** Shown when something failed. A failure the user cannot see is a bug. */
export function ErrorStrip({
	message,
	onRetry,
}: {
	message: string;
	onRetry?: () => void;
}) {
	return (
		<div className="alert alert-error" role="alert">
			<span>{message}</span>
			{onRetry ? (
				<button type="button" className="btn btn-secondary" onClick={onRetry}>
					Try again
				</button>
			) : null}
		</div>
	);
}
