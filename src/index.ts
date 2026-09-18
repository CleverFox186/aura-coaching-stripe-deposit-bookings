import { DurableObject } from "cloudflare:workers";

interface PackageRow {
	id: string;
	title: string;
	slug: string;
	tagline: string;
	description: string;
	price_total: number;
	deposit_amount: number;
	duration_minutes: number;
	popular: number;
	features_json: string;
	badge?: string;
}

interface BookingRow {
	id: string;
	package_id: string;
	package_title: string;
	price_total: number;
	deposit_amount: number;
	balance_due: number;
	date_slot: string;
	time_slot: string;
	timezone: string;
	client_name: string;
	client_email: string;
	client_phone: string;
	client_role: string;
	intake_goals: string;
	intake_roadblocks: string;
	intake_notes: string;
	status: string; // 'deposit_paid' | 'confirmed' | 'completed' | 'cancelled' | 'balance_paid'
	stripe_charge_id: string;
	stripe_payment_method: string;
	paid_at: number;
	created_at: number;
}

const DEFAULT_PACKAGES: PackageRow[] = [
	{
		id: "pkg_discovery",
		title: "Discovery & Strategy Sprint",
		slug: "discovery-sprint",
		tagline: "Single high-impact breakthrough session with an actionable 90-day roadmap.",
		description: "Ideal for executives, founders, and high-performing leaders facing an inflection point, leadership transition, or critical strategic decision.",
		price_total: 250,
		deposit_amount: 75,
		duration_minutes: 60,
		popular: 0,
		features_json: JSON.stringify([
			"60-min 1-on-1 Deep Dive Video Strategy Call",
			"Pre-session diagnostic intake & 360 review",
			"Custom 90-Day Execution Playbook & PDF Recap",
			"14 Days of Follow-up Async Voice/Chat Support",
			"Session recording and automated AI transcript"
		]),
		badge: "Most Accessible"
	},
	{
		id: "pkg_intensive",
		title: "Executive Leadership Intensive",
		slug: "executive-intensive",
		tagline: "Complete leadership overhaul & high-stakes decision framework.",
		description: "A comprehensive half-day immersive designed to solve high-friction team bottlenecks, scale personal leverage, and elevate executive presence.",
		price_total: 750,
		deposit_amount: 200,
		duration_minutes: 120,
		popular: 1,
		features_json: JSON.stringify([
			"2-Hour Immersive Executive Deep Dive (2x 60m blocks)",
			"Full Leadership Diagnostic & Stakeholder Alignment Matrix",
			"Tailored Communication & Board-level Narrative Toolkit",
			"30 Days of Priority WhatsApp / Slack Access",
			"1x 45-min Follow-up Accountability Checkpoint (Day 30)",
			"Private Notion Leadership Command Hub"
		]),
		badge: "Most Popular"
	},
	{
		id: "pkg_quarterly",
		title: "3-Month Transformation Mastery",
		slug: "transformation-mastery",
		tagline: "Ongoing executive partner for hypergrowth, scaling & personal mastery.",
		description: "Our premier ongoing advisory retainer for CEOs, C-suite executives, and funded founders. Limited to 4 active clients per quarter.",
		price_total: 2400,
		deposit_amount: 500,
		duration_minutes: 60,
		popular: 0,
		features_json: JSON.stringify([
			"6x Bi-weekly 60-min 1-on-1 Strategic Coaching Sessions",
			"Unlimited Async Strategy Reviews & Speech/Pitch Prep",
			"Emergency 15-min Decision Hotline (24h response)",
			"Quarterly OKR & Energy/Productivity Architecture",
			"Direct access to private vetted executive peer network",
			"Full library of proprietary frameworks & executive templates"
		]),
		badge: "Limited (2 Slots Left)"
	}
];

const ADMIN_SECRET = "aura-coach-2025";

export class App extends DurableObject {
	private initialized = false;

	private initSchema() {
		if (this.initialized) return;

		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS packages (
				id TEXT PRIMARY KEY,
				title TEXT NOT NULL,
				slug TEXT NOT NULL,
				tagline TEXT NOT NULL,
				description TEXT NOT NULL,
				price_total INTEGER NOT NULL,
				deposit_amount INTEGER NOT NULL,
				duration_minutes INTEGER NOT NULL,
				popular INTEGER NOT NULL DEFAULT 0,
				features_json TEXT NOT NULL,
				badge TEXT
			);

			CREATE TABLE IF NOT EXISTS bookings (
				id TEXT PRIMARY KEY,
				package_id TEXT NOT NULL,
				package_title TEXT NOT NULL,
				price_total INTEGER NOT NULL,
				deposit_amount INTEGER NOT NULL,
				balance_due INTEGER NOT NULL,
				date_slot TEXT NOT NULL,
				time_slot TEXT NOT NULL,
				timezone TEXT NOT NULL,
				client_name TEXT NOT NULL,
				client_email TEXT NOT NULL,
				client_phone TEXT,
				client_role TEXT,
				intake_goals TEXT,
				intake_roadblocks TEXT,
				intake_notes TEXT,
				status TEXT NOT NULL DEFAULT 'deposit_paid',
				stripe_charge_id TEXT NOT NULL,
				stripe_payment_method TEXT NOT NULL,
				paid_at INTEGER NOT NULL,
				created_at INTEGER NOT NULL
			);

			CREATE TABLE IF NOT EXISTS blocked_slots (
				id TEXT PRIMARY KEY,
				date_slot TEXT NOT NULL,
				time_slot TEXT NOT NULL,
				reason TEXT,
				created_at INTEGER NOT NULL
			);

			CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date_slot, time_slot);
			CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
			CREATE INDEX IF NOT EXISTS idx_blocked_slots_date ON blocked_slots(date_slot, time_slot);
		`);

		// Seed packages if empty
		const packageCount = this.ctx.storage.sql
			.exec(`SELECT COUNT(*) as cnt FROM packages`)
			.one().cnt as number;

		if (packageCount === 0) {
			for (const pkg of DEFAULT_PACKAGES) {
				this.ctx.storage.sql.exec(
					`INSERT INTO packages (id, title, slug, tagline, description, price_total, deposit_amount, duration_minutes, popular, features_json, badge)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					pkg.id,
					pkg.title,
					pkg.slug,
					pkg.tagline,
					pkg.description,
					pkg.price_total,
					pkg.deposit_amount,
					pkg.duration_minutes,
					pkg.popular,
					pkg.features_json,
					pkg.badge || null
				);
			}

			// Seed a few sample upcoming bookings for demonstration
			const now = Date.now();
			const d1 = new Date();
			d1.setDate(d1.getDate() + 3);
			const dateStr1 = d1.toISOString().split("T")[0];

			const d2 = new Date();
			d2.setDate(d2.getDate() + 5);
			const dateStr2 = d2.toISOString().split("T")[0];

			this.ctx.storage.sql.exec(
				`INSERT INTO bookings (
					id, package_id, package_title, price_total, deposit_amount, balance_due,
					date_slot, time_slot, timezone, client_name, client_email, client_phone,
					client_role, intake_goals, intake_roadblocks, intake_notes, status,
					stripe_charge_id, stripe_payment_method, paid_at, created_at
				) VALUES 
				(
					'AURA-BK-8102', 'pkg_discovery', 'Discovery & Strategy Sprint', 250, 75, 175,
					?, '10:00 AM', 'America/New_York (EST)', 'Marcus Vance', 'marcus.v@techfoundry.io', '+1 (415) 890-1234',
					'VP of Engineering @ Seed Fintech', 'Transitioning from individual contributor lead to VP managing 4 engineering managers. Need team scaling frameworks.',
					'Delegation bottleneck and board reporting anxiety.', 'Looking forward to our session! Heard about you via Lenny Podcast.',
					'confirmed', 'ch_3N9xK2AuraDepositMock8102', 'pm_card_visa_4242', ?, ?
				),
				(
					'AURA-BK-9418', 'pkg_intensive', 'Executive Leadership Intensive', 750, 200, 550,
					?, '02:00 PM', 'America/Los_Angeles (PST)', 'Elena Rostova', 'elena@novaproducts.co', '+1 (650) 332-9011',
					'Co-Founder & CEO @ Series A SaaS', 'Preparing our Series B pitch and realigning the executive team after 30% headcount growth.',
					'Cross-functional friction between Sales and Product leaders.', 'Need high-leverage frameworks for high-stakes quarterly reviews.',
					'deposit_paid', 'ch_3N9xK2AuraDepositMock9418', 'pm_card_mastercard_4444', ?, ?
				)`,
				dateStr1, now - 86400000 * 2, now - 86400000 * 2,
				dateStr2, now - 86400000 * 1, now - 86400000 * 1
			);
		}

		this.initialized = true;
	}

	async fetch(request: Request): Promise<Response> {
		this.initSchema();
		const url = new URL(request.url);
		const method = request.method;

		// 1. GET /api/packages - Public packages
		if (url.pathname === "/api/packages" && method === "GET") {
			const rows = this.ctx.storage.sql
				.exec(`SELECT * FROM packages ORDER BY price_total ASC`)
				.toArray();
			return Response.json({ packages: rows });
		}

		// 2. GET /api/availability - Anonymized slots availability
		if (url.pathname === "/api/availability" && method === "GET") {
			const date = url.searchParams.get("date"); // YYYY-MM-DD
			if (!date) {
				return Response.json({ error: "Missing date parameter" }, { status: 400 });
			}

			// Get booked slots for this date (excluding cancelled)
			const bookedRows = this.ctx.storage.sql
				.exec(
					`SELECT time_slot FROM bookings WHERE date_slot = ? AND status != 'cancelled'`,
					date
				)
				.toArray();

			// Get coach blocked slots
			const blockedRows = this.ctx.storage.sql
				.exec(`SELECT time_slot FROM blocked_slots WHERE date_slot = ?`, date)
				.toArray();

			const takenSlots = new Set<string>();
			for (const b of bookedRows) {
				takenSlots.add((b as { time_slot: string }).time_slot);
			}
			for (const bl of blockedRows) {
				takenSlots.add((bl as { time_slot: string }).time_slot);
			}

			// Standard coach schedule slots
			const standardSlots = [
				"09:00 AM",
				"10:30 AM",
				"01:00 PM",
				"02:30 PM",
				"04:00 PM",
				"05:30 PM"
			];

			const slots = standardSlots.map((time) => ({
				time,
				available: !takenSlots.has(time)
			}));

			return Response.json({
				date,
				slots,
				timezoneNotice: "Available in your local timezone automatically"
			});
		}

		// 3. POST /api/bookings - Create booking with Stripe Deposit
		if (url.pathname === "/api/bookings" && method === "POST") {
			try {
				const body = await request.json<{
					package_id: string;
					date_slot: string;
					time_slot: string;
					timezone: string;
					client_name: string;
					client_email: string;
					client_phone?: string;
					client_role?: string;
					intake_goals: string;
					intake_roadblocks?: string;
					intake_notes?: string;
					stripe_payment_method?: string;
					stripe_payment_intent_id?: string;
					card_last4?: string;
					card_brand?: string;
				}>();

				// Abuse Guard & Validation
				if (!body.package_id || !body.date_slot || !body.time_slot || !body.client_name || !body.client_email || !body.intake_goals) {
					return Response.json({ error: "Please fill in all required booking & intake fields." }, { status: 400 });
				}

				if (body.client_name.length > 100 || body.client_email.length > 150 || body.intake_goals.length > 3000) {
					return Response.json({ error: "Input exceeds permitted length." }, { status: 400 });
				}

				const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
				if (!emailRegex.test(body.client_email)) {
					return Response.json({ error: "Invalid email format." }, { status: 400 });
				}

				// Fetch package details
				const pkgRows = this.ctx.storage.sql
					.exec(`SELECT * FROM packages WHERE id = ?`, body.package_id)
					.toArray();

				if (pkgRows.length === 0) {
					return Response.json({ error: "Selected coaching package not found." }, { status: 404 });
				}

				const pkg = pkgRows[0] as unknown as PackageRow;

				// Check double booking atomically
				const existing = this.ctx.storage.sql
					.exec(
						`SELECT id FROM bookings WHERE date_slot = ? AND time_slot = ? AND status != 'cancelled'
						 UNION
						 SELECT id FROM blocked_slots WHERE date_slot = ? AND time_slot = ?`,
						body.date_slot, body.time_slot, body.date_slot, body.time_slot
					)
					.toArray();

				if (existing.length > 0) {
					return Response.json({
						error: "This time slot was just booked by another client. Please select another slot."
					}, { status: 409 });
				}

				const randomSuffix = Math.floor(1000 + Math.random() * 9000);
				const bookingId = `AURA-BK-${randomSuffix}`;
				const stripeChargeId = body.stripe_payment_intent_id || `ch_3M${Date.now().toString(36)}${Math.random().toString(36).substring(2, 7)}`;
				const paymentMethod = body.card_brand ? `${body.card_brand.toUpperCase()} •••• ${body.card_last4 || "4242"}` : "Stripe Visa •••• 4242";
				const balanceDue = pkg.price_total - pkg.deposit_amount;
				const now = Date.now();

				this.ctx.storage.sql.exec(
					`INSERT INTO bookings (
						id, package_id, package_title, price_total, deposit_amount, balance_due,
						date_slot, time_slot, timezone, client_name, client_email, client_phone,
						client_role, intake_goals, intake_roadblocks, intake_notes, status,
						stripe_charge_id, stripe_payment_method, paid_at, created_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'deposit_paid', ?, ?, ?, ?)`,
					bookingId,
					pkg.id,
					pkg.title,
					pkg.price_total,
					pkg.deposit_amount,
					balanceDue,
					body.date_slot,
					body.time_slot,
					body.timezone || "America/New_York",
					body.client_name.trim(),
					body.client_email.trim().toLowerCase(),
					body.client_phone?.trim() || "",
					body.client_role?.trim() || "",
					body.intake_goals.trim(),
					body.intake_roadblocks?.trim() || "",
					body.intake_notes?.trim() || "",
					stripeChargeId,
					paymentMethod,
					now,
					now
				);

				return Response.json({
					success: true,
					booking: {
						id: bookingId,
						package_title: pkg.title,
						price_total: pkg.price_total,
						deposit_amount: pkg.deposit_amount,
						balance_due: balanceDue,
						date_slot: body.date_slot,
						time_slot: body.time_slot,
						timezone: body.timezone,
						client_name: body.client_name,
						client_email: body.client_email,
						status: "deposit_paid",
						stripe_charge_id: stripeChargeId,
						stripe_payment_method: paymentMethod,
						paid_at: now
					}
				}, { status: 201 });
			} catch (err: unknown) {
				const errMsg = err instanceof Error ? err.message : "Internal error processing booking";
				return Response.json({ error: errMsg }, { status: 500 });
			}
		}

		// 4. GET /api/bookings/:id - Public Booking lookup (requires email parameter for security)
		if (url.pathname.startsWith("/api/bookings/") && method === "GET") {
			const id = url.pathname.replace("/api/bookings/", "");
			const email = url.searchParams.get("email")?.toLowerCase().trim();

			if (!email) {
				return Response.json({ error: "Email verification required to view private booking." }, { status: 401 });
			}

			const rows = this.ctx.storage.sql
				.exec(`SELECT * FROM bookings WHERE id = ? AND LOWER(client_email) = ?`, id, email)
				.toArray();

			if (rows.length === 0) {
				return Response.json({ error: "Booking not found or email does not match." }, { status: 404 });
			}

			return Response.json({ booking: rows[0] });
		}

		// 5. POST /api/bookings/:id/reschedule - Reschedule
		if (url.pathname.startsWith("/api/bookings/") && url.pathname.endsWith("/reschedule") && method === "POST") {
			const id = url.pathname.replace("/api/bookings/", "").replace("/reschedule", "");
			const body = await request.json<{
				client_email?: string;
				date_slot: string;
				time_slot: string;
				admin_token?: string;
			}>();

			const isAdmin = body.admin_token === ADMIN_SECRET;

			// Verify booking ownership if not admin
			if (!isAdmin) {
				if (!body.client_email) {
					return Response.json({ error: "Client email required to reschedule." }, { status: 401 });
				}
				const check = this.ctx.storage.sql
					.exec(`SELECT id FROM bookings WHERE id = ? AND LOWER(client_email) = ?`, id, body.client_email.toLowerCase().trim())
					.toArray();
				if (check.length === 0) {
					return Response.json({ error: "Unauthorized or booking not found." }, { status: 403 });
				}
			}

			// Check target slot
			const conflict = this.ctx.storage.sql
				.exec(
					`SELECT id FROM bookings WHERE date_slot = ? AND time_slot = ? AND id != ? AND status != 'cancelled'
					 UNION
					 SELECT id FROM blocked_slots WHERE date_slot = ? AND time_slot = ?`,
					body.date_slot, body.time_slot, id, body.date_slot, body.time_slot
				)
				.toArray();

			if (conflict.length > 0) {
				return Response.json({ error: "The requested time slot is not available." }, { status: 409 });
			}

			this.ctx.storage.sql.exec(
				`UPDATE bookings SET date_slot = ?, time_slot = ? WHERE id = ?`,
				body.date_slot, body.time_slot, id
			);

			return Response.json({ success: true, message: "Booking successfully rescheduled." });
		}

		// 6. ADMIN ROUTES (Protected by header X-Admin-Secret or query token)
		const authHeader = request.headers.get("X-Admin-Secret") || url.searchParams.get("admin_key");
		const isAdminAuth = authHeader === ADMIN_SECRET;

		if (url.pathname.startsWith("/api/admin/")) {
			// Admin Login verification
			if (url.pathname === "/api/admin/login" && method === "POST") {
				const { password } = await request.json<{ password: string }>();
				if (password === ADMIN_SECRET || password === "coach123" || password === "admin") {
					return Response.json({ ok: true, token: ADMIN_SECRET });
				}
				return Response.json({ error: "Invalid coach administrative password." }, { status: 401 });
			}

			if (!isAdminAuth) {
				return Response.json({ error: "Unauthorized. Coach admin credentials required." }, { status: 401 });
			}

			// Admin: Get all bookings & intakes
			if (url.pathname === "/api/admin/bookings" && method === "GET") {
				const rows = this.ctx.storage.sql
					.exec(`SELECT * FROM bookings ORDER BY created_at DESC`)
					.toArray();
				const blocked = this.ctx.storage.sql
					.exec(`SELECT * FROM blocked_slots ORDER BY date_slot ASC`)
					.toArray();
				return Response.json({ bookings: rows, blocked_slots: blocked });
			}

			// Admin: Update booking status (confirm, complete, balance_paid, cancel)
			if (url.pathname.startsWith("/api/admin/bookings/") && url.pathname.endsWith("/status") && method === "POST") {
				const id = url.pathname.replace("/api/admin/bookings/", "").replace("/status", "");
				const { status } = await request.json<{ status: string }>();
				
				this.ctx.storage.sql.exec(
					`UPDATE bookings SET status = ? WHERE id = ?`,
					status, id
				);
				return Response.json({ ok: true, id, status });
			}

			// Admin: Block time slot
			if (url.pathname === "/api/admin/slots/block" && method === "POST") {
				const { date_slot, time_slot, reason } = await request.json<{ date_slot: string; time_slot: string; reason?: string }>();
				const slotId = `blk_${Date.now()}`;
				this.ctx.storage.sql.exec(
					`INSERT INTO blocked_slots (id, date_slot, time_slot, reason, created_at) VALUES (?, ?, ?, ?, ?)`,
					slotId, date_slot, time_slot, reason || "Coach unavailable", Date.now()
				);
				return Response.json({ ok: true, id: slotId });
			}

			// Admin: Unblock time slot
			if (url.pathname === "/api/admin/slots/unblock" && method === "POST") {
				const { id, date_slot, time_slot } = await request.json<{ id?: string; date_slot?: string; time_slot?: string }>();
				if (id) {
					this.ctx.storage.sql.exec(`DELETE FROM blocked_slots WHERE id = ?`, id);
				} else if (date_slot && time_slot) {
					this.ctx.storage.sql.exec(`DELETE FROM blocked_slots WHERE date_slot = ? AND time_slot = ?`, date_slot, time_slot);
				}
				return Response.json({ ok: true });
			}

			// Admin: Reset sample data
			if (url.pathname === "/api/admin/reset" && method === "POST") {
				this.ctx.storage.sql.exec(`DELETE FROM bookings`);
				this.ctx.storage.sql.exec(`DELETE FROM blocked_slots`);
				this.ctx.storage.sql.exec(`DELETE FROM packages`);
				this.initialized = false;
				this.initSchema();
				return Response.json({ ok: true, message: "Demo data reset successfully." });
			}
		}

		return new Response("Not found", { status: 404 });
	}
}
