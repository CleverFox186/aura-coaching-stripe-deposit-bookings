import { DurableObject } from "cloudflare:workers";

export class App extends DurableObject {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/api/hello") {
			return Response.json({ message: "Your app is running." });
		}

		return new Response("Not found", { status: 404 });
	}
}
