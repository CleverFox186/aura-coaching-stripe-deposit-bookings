import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ErrorStrip, Loading, Empty } from "./ui";

interface Package {
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

interface Booking {
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
	client_phone?: string;
	client_role?: string;
	intake_goals: string;
	intake_roadblocks?: string;
	intake_notes?: string;
	status: string;
	stripe_charge_id: string;
	stripe_payment_method: string;
	paid_at: number;
	created_at: number;
}

interface SlotAvailability {
	time: string;
	available: boolean;
}

type AppView = "landing" | "booking" | "lookup" | "admin";

function CornerBrackets() {
	return (
		<>
			<div className="bracket bracket-tl" />
			<div className="bracket bracket-tr" />
			<div className="bracket bracket-bl" />
			<div className="bracket bracket-br" />
		</>
	);
}

function App() {
	const [view, setView] = useState<AppView>("landing");
	const [packages, setPackages] = useState<Package[]>([]);
	const [loadingPackages, setLoadingPackages] = useState(true);
	const [packagesError, setPackagesError] = useState<string | null>(null);

	// Booking Flow State
	const [bookingStep, setBookingStep] = useState<number>(1);
	const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
	const [selectedDate, setSelectedDate] = useState<string>("");
	const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");
	const [selectedTimezone, setSelectedTimezone] = useState<string>("America/New_York (EST)");
	const [slots, setSlots] = useState<SlotAvailability[]>([]);
	const [loadingSlots, setLoadingSlots] = useState(false);

	// Intake Form State
	const [clientName, setClientName] = useState("");
	const [clientEmail, setClientEmail] = useState("");
	const [clientPhone, setClientPhone] = useState("");
	const [clientRole, setClientRole] = useState("");
	const [intakeGoals, setIntakeGoals] = useState("");
	const [intakeRoadblocks, setIntakeRoadblocks] = useState("");
	const [intakeNotes, setIntakeNotes] = useState("");
	const [agreeTerms, setAgreeTerms] = useState(false);

	// Stripe Payment State
	const [cardNumber, setCardNumber] = useState("");
	const [cardExpiry, setCardExpiry] = useState("");
	const [cardCvc, setCardCvc] = useState("");
	const [cardZip, setCardZip] = useState("");
	const [isProcessingPayment, setIsProcessingPayment] = useState(false);
	const [paymentError, setPaymentError] = useState<string | null>(null);
	const [completedBooking, setCompletedBooking] = useState<Booking | null>(null);

	// Client Lookup State
	const [lookupId, setLookupId] = useState("");
	const [lookupEmail, setLookupEmail] = useState("");
	const [lookupResult, setLookupResult] = useState<Booking | null>(null);
	const [lookupLoading, setLookupLoading] = useState(false);
	const [lookupError, setLookupError] = useState<string | null>(null);

	// Admin State
	const [adminPassword, setAdminPassword] = useState("");
	const [adminToken, setAdminToken] = useState<string | null>(null);
	const [adminBookings, setAdminBookings] = useState<Booking[]>([]);
	const [adminBlockedSlots, setAdminBlockedSlots] = useState<{ id: string; date_slot: string; time_slot: string; reason: string }[]>([]);
	const [adminTab, setAdminTab] = useState<"bookings" | "intakes" | "slots" | "financials">("bookings");
	const [adminLoading, setAdminLoading] = useState(false);
	const [adminError, setAdminError] = useState<string | null>(null);
	const [selectedIntakeBooking, setSelectedIntakeBooking] = useState<Booking | null>(null);
	const [blockDate, setBlockDate] = useState("");
	const [blockTime, setBlockTime] = useState("09:00 AM");
	const [blockReason, setBlockReason] = useState("Personal Focus Time");

	// Initial default date calculation (tomorrow)
	useEffect(() => {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		const yyyy = tomorrow.getFullYear();
		const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
		const dd = String(tomorrow.getDate()).padStart(2, "0");
		const defaultDate = `${yyyy}-${mm}-${dd}`;
		setSelectedDate(defaultDate);
		setBlockDate(defaultDate);
	}, []);

	// Load packages
	const fetchPackages = () => {
		setLoadingPackages(true);
		fetch("./api/packages")
			.then((res) => {
				if (!res.ok) throw new Error("Could not load coaching packages.");
				return res.json();
			})
			.then((data: { packages: Package[] }) => {
				setPackages(data.packages || []);
				if (data.packages && data.packages.length > 0 && !selectedPackage) {
					// Select popular or first package
					const pop = data.packages.find((p) => p.popular === 1) || data.packages[0];
					setSelectedPackage(pop);
				}
				setLoadingPackages(false);
			})
			.catch((err: Error) => {
				setPackagesError(err.message);
				setLoadingPackages(false);
			});
	};

	useEffect(() => {
		fetchPackages();
	}, []);

	// Fetch slot availability when selectedDate changes
	useEffect(() => {
		if (!selectedDate) return;
		setLoadingSlots(true);
		fetch(`./api/availability?date=${encodeURIComponent(selectedDate)}`)
			.then((res) => res.json())
			.then((data: { slots: SlotAvailability[] }) => {
				setSlots(data.slots || []);
				// Auto-pick first available time
				const firstAvail = data.slots?.find((s) => s.available);
				if (firstAvail && !selectedTimeSlot) {
					setSelectedTimeSlot(firstAvail.time);
				} else if (firstAvail && selectedTimeSlot) {
					// verify if current selected is available
					const isCurAvail = data.slots?.find((s) => s.time === selectedTimeSlot)?.available;
					if (!isCurAvail) setSelectedTimeSlot(firstAvail.time);
				}
				setLoadingSlots(false);
			})
			.catch(() => {
				setLoadingSlots(false);
			});
	}, [selectedDate]);

	// Format Card Input Helpers
	const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value.replace(/\D/g, "").substring(0, 16);
		const formatted = val.match(/.{1,4}/g)?.join(" ") || val;
		setCardNumber(formatted);
	};

	const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		let val = e.target.value.replace(/\D/g, "").substring(0, 4);
		if (val.length >= 3) {
			val = `${val.substring(0, 2)}/${val.substring(2, 4)}`;
		}
		setCardExpiry(val);
	};

	// Start Booking for specific package
	const startBooking = (pkg: Package) => {
		setSelectedPackage(pkg);
		setBookingStep(1);
		setView("booking");
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	// Process Stripe Deposit Payment & Booking Creation
	const handleDepositCheckout = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedPackage || !selectedDate || !selectedTimeSlot || !clientName || !clientEmail || !intakeGoals) {
			setPaymentError("Please fill out all required intake information and select a time slot.");
			return;
		}

		if (!agreeTerms) {
			setPaymentError("Please accept the booking deposit terms to continue.");
			return;
		}

		setIsProcessingPayment(true);
		setPaymentError(null);

		try {
			// Simulate Stripe Tokenization & 3D Secure Verification
			await new Promise((r) => setTimeout(r, 1200));

			const cleanCard = cardNumber.replace(/\s/g, "");
			const last4 = cleanCard ? cleanCard.slice(-4) : "4242";
			const brand = cleanCard.startsWith("4") ? "Visa" : cleanCard.startsWith("5") ? "Mastercard" : "Amex";

			const payload = {
				package_id: selectedPackage.id,
				date_slot: selectedDate,
				time_slot: selectedTimeSlot,
				timezone: selectedTimezone,
				client_name: clientName,
				client_email: clientEmail,
				client_phone: clientPhone,
				client_role: clientRole,
				intake_goals: intakeGoals,
				intake_roadblocks: intakeRoadblocks,
				intake_notes: intakeNotes,
				stripe_payment_method: `pm_mock_${brand.toLowerCase()}_${last4}`,
				stripe_payment_intent_id: `pi_3M${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`,
				card_last4: last4,
				card_brand: brand
			};

			const res = await fetch("./api/bookings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload)
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || "Payment and booking failed.");
			}

			setCompletedBooking(data.booking);
			setBookingStep(5); // Confirmation Screen
			setIsProcessingPayment(false);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Deposit payment could not be processed.";
			setPaymentError(msg);
			setIsProcessingPayment(false);
		}
	};

	// Client Booking Lookup
	const handleLookupBooking = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!lookupId.trim() || !lookupEmail.trim()) {
			setLookupError("Please provide both Booking Reference Code and Client Email.");
			return;
		}

		setLookupLoading(true);
		setLookupError(null);
		setLookupResult(null);

		try {
			const res = await fetch(`./api/bookings/${encodeURIComponent(lookupId.trim().toUpperCase())}?email=${encodeURIComponent(lookupEmail.trim().toLowerCase())}`);
			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || "Booking not found with that email address.");
			}
			setLookupResult(data.booking);
			setLookupLoading(false);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Error looking up booking";
			setLookupError(msg);
			setLookupLoading(false);
		}
	};

	// Admin Login & Fetch
	const handleAdminLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setAdminLoading(true);
		setAdminError(null);

		try {
			const res = await fetch("./api/admin/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ password: adminPassword })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Invalid password.");

			setAdminToken(data.token);
			fetchAdminData(data.token);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Login failed.";
			setAdminError(msg);
			setAdminLoading(false);
		}
	};

	const fetchAdminData = async (token: string) => {
		setAdminLoading(true);
		try {
			const res = await fetch("./api/admin/bookings", {
				headers: { "X-Admin-Secret": token }
			});
			const data = await res.json();
			if (res.ok) {
				setAdminBookings(data.bookings || []);
				setAdminBlockedSlots(data.blocked_slots || []);
			}
			setAdminLoading(false);
		} catch {
			setAdminLoading(false);
		}
	};

	const handleUpdateStatus = async (bookingId: string, status: string) => {
		if (!adminToken) return;
		try {
			const res = await fetch(`./api/admin/bookings/${bookingId}/status`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Admin-Secret": adminToken
				},
				body: JSON.stringify({ status })
			});
			if (res.ok) {
				fetchAdminData(adminToken);
			}
		} catch {
			// silent error
		}
	};

	const handleBlockSlot = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!adminToken || !blockDate || !blockTime) return;
		try {
			const res = await fetch("./api/admin/slots/block", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Admin-Secret": adminToken
				},
				body: JSON.stringify({
					date_slot: blockDate,
					time_slot: blockTime,
					reason: blockReason
				})
			});
			if (res.ok) {
				fetchAdminData(adminToken);
				setBlockReason("Personal Focus Time");
			}
		} catch {
			// silent
		}
	};

	const handleUnblockSlot = async (id: string) => {
		if (!adminToken) return;
		try {
			const res = await fetch("./api/admin/slots/unblock", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Admin-Secret": adminToken
				},
				body: JSON.stringify({ id })
			});
			if (res.ok) {
				fetchAdminData(adminToken);
			}
		} catch {
			// silent
		}
	};

	const handleResetDemoData = async () => {
		if (!adminToken) return;
		if (!window.confirm("Reset all bookings and reseed defaults?")) return;
		try {
			await fetch("./api/admin/reset", {
				method: "POST",
				headers: { "X-Admin-Secret": adminToken }
			});
			fetchPackages();
			fetchAdminData(adminToken);
		} catch {
			// silent
		}
	};

	// Export Bookings CSV
	const exportBookingsCSV = () => {
		if (adminBookings.length === 0) return;
		const headers = [
			"Booking ID", "Client Name", "Email", "Phone", "Role", "Package",
			"Total Price ($)", "Deposit Paid ($)", "Balance Due ($)", "Date Slot",
			"Time Slot", "Timezone", "Status", "Stripe Charge ID", "Created At"
		];
		const rows = adminBookings.map((b) => [
			b.id,
			`"${b.client_name.replace(/"/g, '""')}"`,
			b.client_email,
			b.client_phone || "",
			`"${(b.client_role || "").replace(/"/g, '""')}"`,
			`"${b.package_title.replace(/"/g, '""')}"`,
			b.price_total,
			b.deposit_amount,
			b.balance_due,
			b.date_slot,
			b.time_slot,
			`"${b.timezone}"`,
			b.status,
			b.stripe_charge_id,
			new Date(b.created_at).toISOString()
		]);
		const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
		const encodedUri = encodeURI(csvContent);
		const link = document.createElement("a");
		link.setAttribute("href", encodedUri);
		link.setAttribute("download", `aura_coaching_roster_${new Date().toISOString().split("T")[0]}.csv`);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	// Calendar .ics file download for client confirmation
	const downloadIcsCalendar = (booking: Booking) => {
		const title = `Executive Coaching: ${booking.package_title}`;
		const desc = `1-on-1 Executive Coaching Session with Aura Leadership.\\nBooking Ref: ${booking.id}\\nDeposit Paid: $${booking.deposit_amount}\\nBalance Due at Session: $${booking.balance_due}\\nMeeting Link: https://meet.google.com/aura-${booking.id.toLowerCase()}`;
		const startDateTime = `${booking.date_slot.replace(/-/g, "")}T140000Z`;
		const endDateTime = `${booking.date_slot.replace(/-/g, "")}T150000Z`;

		const icsData = [
			"BEGIN:VCALENDAR",
			"VERSION:2.0",
			"PRODID:-//Aura Coaching//Stripe Bookings//EN",
			"BEGIN:VEVENT",
			`UID:${booking.id}@auracoaching.co`,
			`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
			`DTSTART:${startDateTime}`,
			`DTEND:${endDateTime}`,
			`SUMMARY:${title}`,
			`DESCRIPTION:${desc}`,
			`LOCATION:Google Meet / Zoom (Private Executive Room)`,
			"STATUS:CONFIRMED",
			"END:VEVENT",
			"END:VCALENDAR"
		].join("\r\n");

		const blob = new Blob([icsData], { type: "text/calendar;charset=utf-8" });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `Aura_Coaching_${booking.id}.ics`;
		a.click();
		window.URL.revokeObjectURL(url);
	};

	// Render Navigation Bar
	const renderNavbar = () => (
		<header className="aura-nav">
			<div className="container-wide nav-inner">
				<div className="brand-logo" onClick={() => setView("landing")}>
					<div className="brand-glyph">A</div>
					<div className="brand-meta">
						<span className="brand-title">AURA LEADERSHIP</span>
						<span className="brand-sub">Executive Advisory & Coaching</span>
					</div>
				</div>

				<nav className="nav-links">
					<button
						className={`nav-btn-link ${view === "landing" ? "active" : ""}`}
						onClick={() => setView("landing")}
					>
						Coaching Packages
					</button>
					<button
						className={`nav-btn-link ${view === "booking" ? "active" : ""}`}
						onClick={() => {
							if (!selectedPackage && packages.length > 0) setSelectedPackage(packages[0]);
							setBookingStep(1);
							setView("booking");
						}}
					>
						Book with Deposit
					</button>
					<button
						className={`nav-btn-link ${view === "lookup" ? "active" : ""}`}
						onClick={() => setView("lookup")}
					>
						Manage My Booking
					</button>
					<button
						className={`nav-btn-link ${view === "admin" ? "active" : ""}`}
						onClick={() => setView("admin")}
						style={{ opacity: 0.8 }}
					>
						Coach Portal 🔒
					</button>
				</nav>

				<div>
					{view === "landing" ? (
						<button
							className="btn-pill btn-pill-primary btn-sm"
							onClick={() => {
								if (packages.length > 0) setSelectedPackage(packages.find(p => p.popular === 1) || packages[0]);
								setBookingStep(1);
								setView("booking");
							}}
						>
							Reserve Your Slot
						</button>
					) : (
						<button
							className="btn-pill btn-pill-secondary btn-sm"
							onClick={() => setView("landing")}
						>
							← Back to Overview
						</button>
					)}
				</div>
			</div>
		</header>
	);

	// 1. LANDING PAGE VIEW
	const renderLanding = () => (
		<main>
			{/* Hero Section */}
			<section className="hero-section">
				<div className="container-wide text-center">
					<div className="hero-badge-pill">
						<span className="hero-badge-pulse" />
						<span>Accepting Q4 Executive Clients • Instant Stripe Deposit Lock</span>
					</div>

					<h1 className="hero-heading" style={{ margin: "0 auto 1.5rem" }}>
						Strategic clarity & personal mastery for <em>exceptional leaders</em>.
					</h1>

					<p className="hero-subtitle" style={{ margin: "0 auto 2.25rem" }}>
						High-impact 1-on-1 advisory for Founders, VP/C-Suite Executives, and emerging leaders.
						Lock your dedicated strategy session with a transparent deposit today.
					</p>

					<div className="hero-actions" style={{ justifyContent: "center" }}>
						<button
							className="btn-pill btn-pill-primary btn-lg"
							onClick={() => {
								const pkg = packages.find(p => p.popular === 1) || packages[0];
								if (pkg) startBooking(pkg);
							}}
						>
							Select Coaching Tier & Reserve
						</button>
						<button
							className="btn-pill btn-pill-secondary btn-lg"
							onClick={() => {
								document.getElementById("packages-section")?.scrollIntoView({ behavior: "smooth" });
							}}
						>
							View Pricing & Deposit Terms ↓
						</button>
					</div>

					<div className="hero-stats-strip">
						<div className="stat-item">
							<span className="stat-number">140+</span>
							<span className="stat-label">CEOs & Tech Leaders Coached</span>
						</div>
						<div className="stat-item">
							<span className="stat-number">$180M+</span>
							<span className="stat-label">Client Venture Capital Raised</span>
						</div>
						<div className="stat-item">
							<span className="stat-number">98.4%</span>
							<span className="stat-label">Strategy Milestone Execution Rate</span>
						</div>
						<div className="stat-item">
							<span className="stat-number">100%</span>
							<span className="stat-label">Guaranteed Slot Reservation</span>
						</div>
					</div>
				</div>
			</section>

			{/* Packages & Pricing Section */}
			<section id="packages-section" className="section-pad">
				<div className="container-wide">
					<div className="section-header">
						<span className="section-tag">Coaching Tiers</span>
						<h2 className="section-title">Transparent Pricing with Stripe Deposit Protection</h2>
						<p className="section-desc">
							Pay only a modest deposit today to lock your dedicated calendar slot.
							The remaining balance is invoiced automatically at the start of your session.
						</p>
					</div>

					{packagesError ? <ErrorStrip message={packagesError} /> : null}
					{loadingPackages ? <Loading /> : null}

					{!loadingPackages && (
						<div className="packages-grid">
							{packages.map((pkg) => {
								const features: string[] = JSON.parse(pkg.features_json || "[]");
								const isPop = pkg.popular === 1;

								return (
									<div
										key={pkg.id}
										className={`corner-frame package-card ${isPop ? "highlighted" : ""}`}
									>
										<CornerBrackets />

										<div className={`package-badge-top ${isPop ? "badge-orange" : "badge-cream"}`}>
											{pkg.badge || (isPop ? "Featured Tier" : "Coaching Track")}
										</div>

										<h3 className="pkg-title">{pkg.title}</h3>
										<p className="pkg-tagline">{pkg.tagline}</p>

										<div className="pkg-pricing-box">
											<div className="pkg-deposit-row">
												<div>
													<span className="pkg-deposit-amount">${pkg.deposit_amount}</span>
													<span style={{ fontSize: "0.85rem", color: "var(--lp-text-muted)", marginLeft: "4px" }}>deposit</span>
												</div>
												<span className="pkg-deposit-label">Locks Your Date</span>
											</div>
											<div className="pkg-total-row">
												<span>Total Package Value</span>
												<span className="pkg-total-price">${pkg.price_total} ({pkg.duration_minutes} mins)</span>
											</div>
										</div>

										<ul className="pkg-features-list">
											{features.map((feat, idx) => (
												<li key={idx} className="pkg-feature-item">
													<span className="pkg-check-icon">✓</span>
													<span>{feat}</span>
												</li>
											))}
										</ul>

										<button
											className={`btn-pill ${isPop ? "btn-pill-primary" : "btn-pill-secondary"} w-full`}
											onClick={() => startBooking(pkg)}
										>
											Book with ${pkg.deposit_amount} Deposit →
										</button>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</section>

			{/* How the Stripe Deposit Works */}
			<section className="section-pad" style={{ background: "var(--lp-bg-100)", borderTop: "1px solid var(--lp-border)", borderBottom: "1px solid var(--lp-border)" }}>
				<div className="container-wide">
					<div className="section-header">
						<span className="section-tag">Booking Security</span>
						<h2 className="section-title">How Our Deposit Protocol Works</h2>
						<p className="section-desc">
							A streamlined 3-step booking system backed by Stripe's bank-grade payment infrastructure.
						</p>
					</div>

					<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.5rem" }}>
						<div className="corner-frame" style={{ padding: "2rem", background: "white" }}>
							<CornerBrackets />
							<div style={{ fontSize: "2rem", marginBottom: "1rem" }}>🗓️</div>
							<h3 style={{ fontSize: "1.2rem", marginBottom: "0.5rem", fontWeight: 700 }}>1. Choose Slot & Submit Intake</h3>
							<p style={{ fontSize: "0.9rem", color: "var(--lp-text-muted)", lineHeight: 1.55 }}>
								Select your date on the real-time calendar and share your executive objectives, current roadblocks, and leadership context.
							</p>
						</div>

						<div className="corner-frame" style={{ padding: "2rem", background: "white" }}>
							<CornerBrackets />
							<div style={{ fontSize: "2rem", marginBottom: "1rem" }}>💳</div>
							<h3 style={{ fontSize: "1.2rem", marginBottom: "0.5rem", fontWeight: 700 }}>2. Authorize Modest Deposit</h3>
							<p style={{ fontSize: "0.9rem", color: "var(--lp-text-muted)", lineHeight: 1.55 }}>
								Pay a partial deposit securely via Stripe (Apple Pay, Google Pay, or Credit Card). The slot is immediately removed from public availability.
							</p>
						</div>

						<div className="corner-frame" style={{ padding: "2rem", background: "white" }}>
							<CornerBrackets />
							<div style={{ fontSize: "2rem", marginBottom: "1rem" }}>🎯</div>
							<h3 style={{ fontSize: "1.2rem", marginBottom: "0.5rem", fontWeight: 700 }}>3. Instant Confirmation & Prep</h3>
							<p style={{ fontSize: "0.9rem", color: "var(--lp-text-muted)", lineHeight: 1.55 }}>
								Receive your official receipt, calendar invite with Zoom link, and executive prep toolkit. The remaining balance is billed at session delivery.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Testimonials */}
			<section className="section-pad">
				<div className="container-wide">
					<div className="section-header">
						<span className="section-tag">Client Results</span>
						<h2 className="section-title">Endorsed by High-Growth Executives</h2>
						<p className="section-desc">
							Read what founders and technology vice presidents say about our advisory impact.
						</p>
					</div>

					<div className="testimonials-grid">
						<div className="corner-frame testimonial-card">
							<CornerBrackets />
							<p className="testimonial-quote">
								"The Executive Leadership Intensive completely rewired how I manage our engineering leadership team. The ROI on our two-hour strategy session was immediate when closing our $14M Series A."
							</p>
							<div className="client-author">
								<div className="avatar-circle">MV</div>
								<div>
									<div className="author-name">Marcus Vance</div>
									<div className="author-role">VP of Engineering, Horizon Data</div>
								</div>
							</div>
						</div>

						<div className="corner-frame testimonial-card">
							<CornerBrackets />
							<p className="testimonial-quote">
								"Booking with the Stripe deposit was effortless. The pre-session diagnostic ensured we did not waste a single minute on pleasantries and dove straight into scaling cross-functional velocity."
							</p>
							<div className="client-author">
								<div className="avatar-circle">ER</div>
								<div>
									<div className="author-name">Elena Rostova</div>
									<div className="author-role">Co-Founder & CEO, Nova AI</div>
								</div>
							</div>
						</div>

						<div className="corner-frame testimonial-card">
							<CornerBrackets />
							<p className="testimonial-quote">
								"I have worked with executive coaches across Silicon Valley. Aura's framework for high-stakes decision making is the sharpest, most pragmatic advisory I have encountered."
							</p>
							<div className="client-author">
								<div className="avatar-circle">DK</div>
								<div>
									<div className="author-name">David Kim</div>
									<div className="author-role">Chief Product Officer, Apex Cloud</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* FAQ Accordion */}
			<section className="section-pad" style={{ background: "var(--lp-bg-100)", borderTop: "1px solid var(--lp-border)" }}>
				<div className="container-wide">
					<div className="section-header">
						<span className="section-tag">Frequently Asked Questions</span>
						<h2 className="section-title">Everything You Need to Know</h2>
					</div>

					<div className="faq-grid">
						<div className="corner-frame faq-card">
							<CornerBrackets />
							<div className="faq-header-row">
								<span>Why do you require a Stripe deposit upfront?</span>
							</div>
							<p className="faq-body">
								Our coach reserves dedicated executive prep time and diagnostic evaluation for every client. The deposit guarantees your calendar slot and commits both parties to deep, high-leverage preparation.
							</p>
						</div>

						<div className="corner-frame faq-card">
							<CornerBrackets />
							<div className="faq-header-row">
								<span>Can I reschedule if an emergency arises?</span>
							</div>
							<p className="faq-body">
								Yes. You can reschedule your booking up to 24 hours prior to the session directly through our Client Portal using your Booking Reference Code, with 100% of your deposit credited to the new date.
							</p>
						</div>

						<div className="corner-frame faq-card">
							<CornerBrackets />
							<div className="faq-header-row">
								<span>When is the remaining balance charged?</span>
							</div>
							<p className="faq-body">
								The remaining balance (Total Price minus Deposit Paid) is automatically charged to your card on file at the commencement of your coaching session or invoiced via Stripe.
							</p>
						</div>

						<div className="corner-frame faq-card">
							<CornerBrackets />
							<div className="faq-header-row">
								<span>What happens after I pay the deposit?</span>
							</div>
							<p className="faq-body">
								You will immediately receive an official Stripe payment receipt, an interactive calendar invite (.ics file and Google Calendar link), and a tailored pre-session preparation guide.
							</p>
						</div>
					</div>
				</div>
			</section>
		</main>
	);

	// 2. BOOKING FUNNEL VIEW
	const renderBooking = () => {
		if (!selectedPackage) {
			return (
				<div className="container-narrow funnel-container">
					<Empty title="Please select a coaching tier first." />
					<button className="btn-pill btn-pill-primary mt-4" onClick={() => setView("landing")}>
						View Coaching Packages
					</button>
				</div>
			);
		}

		return (
			<main className="container-narrow funnel-container">
				<div className="corner-frame funnel-card">
					<CornerBrackets />

					{/* Step Progress Bar */}
					<div className="step-indicator">
						<div className={`step-node ${bookingStep === 1 ? "active" : bookingStep > 1 ? "completed" : ""}`}>
							<div className="step-num">{bookingStep > 1 ? "✓" : "1"}</div>
							<span>Package</span>
						</div>
						<div className={`step-node ${bookingStep === 2 ? "active" : bookingStep > 2 ? "completed" : ""}`}>
							<div className="step-num">{bookingStep > 2 ? "✓" : "2"}</div>
							<span>Date & Slot</span>
						</div>
						<div className={`step-node ${bookingStep === 3 ? "active" : bookingStep > 3 ? "completed" : ""}`}>
							<div className="step-num">{bookingStep > 3 ? "✓" : "3"}</div>
							<span>Intake Dossier</span>
						</div>
						<div className={`step-node ${bookingStep === 4 ? "active" : bookingStep > 4 ? "completed" : ""}`}>
							<div className="step-num">{bookingStep > 4 ? "✓" : "4"}</div>
							<span>Stripe Deposit</span>
						</div>
						<div className={`step-node ${bookingStep === 5 ? "active" : ""}`}>
							<div className="step-num">5</div>
							<span>Confirmed</span>
						</div>
					</div>

					{/* STEP 1: PACKAGE CONFIRMATION */}
					{bookingStep === 1 && (
						<div>
							<div style={{ marginBottom: "1.5rem" }}>
								<span className="section-tag">Step 1 of 4</span>
								<h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.75rem", fontWeight: 700 }}>
									Confirm Your Coaching Package
								</h2>
								<p style={{ color: "var(--lp-text-muted)", fontSize: "0.925rem" }}>
									Select the track that aligns with your leadership and strategic goals.
								</p>
							</div>

							<div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
								{packages.map((pkg) => {
									const isSel = selectedPackage.id === pkg.id;
									return (
										<div
											key={pkg.id}
											onClick={() => setSelectedPackage(pkg)}
											style={{
												padding: "1.25rem 1.5rem",
												border: `2px solid ${isSel ? "var(--lp-accent)" : "var(--lp-border)"}`,
												borderRadius: "var(--radius-md)",
												background: isSel ? "var(--lp-accent-light)" : "var(--lp-bg-100)",
												cursor: "pointer",
												display: "flex",
												justifyContent: "space-between",
												alignItems: "center",
												transition: "all 0.15s ease"
											}}
										>
											<div>
												<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
													<strong style={{ fontSize: "1.1rem" }}>{pkg.title}</strong>
													{pkg.popular === 1 && (
														<span className="package-badge-top badge-orange" style={{ margin: 0, padding: "2px 8px", fontSize: "0.7rem" }}>
															Popular
														</span>
													)}
												</div>
												<p style={{ fontSize: "0.85rem", color: "var(--lp-text-muted)", marginTop: "4px" }}>
													{pkg.tagline}
												</p>
											</div>

											<div style={{ textAlign: "right" }}>
												<div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--lp-accent)" }}>
													${pkg.deposit_amount} <span style={{ fontSize: "0.75rem", color: "var(--lp-text-muted)" }}>deposit</span>
												</div>
												<div style={{ fontSize: "0.8rem", color: "var(--lp-text-muted)" }}>
													${pkg.price_total} total ({pkg.duration_minutes}m)
												</div>
											</div>
										</div>
									);
								})}
							</div>

							<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
								<button className="btn-pill btn-pill-secondary" onClick={() => setView("landing")}>
									Cancel
								</button>
								<button className="btn-pill btn-pill-primary" onClick={() => setBookingStep(2)}>
									Next: Select Date & Time Slot →
								</button>
							</div>
						</div>
					)}

					{/* STEP 2: DATE & TIME SLOT PICKER */}
					{bookingStep === 2 && (
						<div>
							<div style={{ marginBottom: "1.5rem" }}>
								<span className="section-tag">Step 2 of 4</span>
								<h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.75rem", fontWeight: 700 }}>
									Select Session Date & Time
								</h2>
								<p style={{ color: "var(--lp-text-muted)", fontSize: "0.925rem" }}>
									Available slots are updated in real-time. Booked times are instantly reserved.
								</p>
							</div>

							<div className="calendar-layout">
								{/* Date Picker & Timezone */}
								<div>
									<div className="field-group">
										<label className="field-label">Preferred Date</label>
										<input
											type="date"
											className="aura-input"
											value={selectedDate}
											min={new Date().toISOString().split("T")[0]}
											onChange={(e) => setSelectedDate(e.target.value)}
										/>
									</div>

									<div className="field-group">
										<label className="field-label">Your Timezone</label>
										<select
											className="aura-select"
											value={selectedTimezone}
											onChange={(e) => setSelectedTimezone(e.target.value)}
										>
											<option value="America/New_York (EST)">Eastern Time (US & Canada) - EST</option>
											<option value="America/Chicago (CST)">Central Time (US & Canada) - CST</option>
											<option value="America/Denver (MST)">Mountain Time (US & Canada) - MST</option>
											<option value="America/Los_Angeles (PST)">Pacific Time (US & Canada) - PST</option>
											<option value="Europe/London (GMT)">London (GMT / BST)</option>
											<option value="Europe/Paris (CET)">Central European Time (CET)</option>
											<option value="Asia/Singapore (SGT)">Singapore / Hong Kong (SGT)</option>
										</select>
									</div>

									<div style={{ padding: "1rem", background: "var(--lp-bg-100)", borderRadius: "var(--radius-md)", border: "1px solid var(--lp-border-light)", fontSize: "0.85rem" }}>
										<div style={{ fontWeight: 600, color: "var(--lp-text)", marginBottom: "4px" }}>Selected Package:</div>
										<div style={{ color: "var(--lp-accent)", fontWeight: 700 }}>{selectedPackage.title}</div>
										<div style={{ color: "var(--lp-text-muted)", fontSize: "0.8rem", marginTop: "2px" }}>Duration: {selectedPackage.duration_minutes} minutes</div>
									</div>
								</div>

								{/* Slots Column */}
								<div className="slots-pane">
									<label className="field-label">Available Time Slots for {selectedDate}</label>

									{loadingSlots ? (
										<div style={{ padding: "2rem 0" }}><Loading /></div>
									) : slots.length === 0 ? (
										<div style={{ padding: "1.5rem", background: "var(--lp-bg-100)", borderRadius: "var(--radius-md)", marginTop: "1rem" }}>
											<p style={{ fontSize: "0.9rem", color: "var(--lp-text-muted)" }}>No slots available for this date. Please select another date.</p>
										</div>
									) : (
										<div className="slots-grid">
											{slots.map((s) => {
												const isSelected = selectedTimeSlot === s.time;
												return (
													<button
														key={s.time}
														type="button"
														disabled={!s.available}
														className={`slot-btn ${isSelected ? "selected" : ""}`}
														onClick={() => setSelectedTimeSlot(s.time)}
													>
														{s.time} {!s.available && "(Booked)"}
													</button>
												);
											})}
										</div>
									)}
								</div>
							</div>

							<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2.5rem" }}>
								<button className="btn-pill btn-pill-secondary" onClick={() => setBookingStep(1)}>
									← Back to Packages
								</button>
								<button
									className="btn-pill btn-pill-primary"
									disabled={!selectedDate || !selectedTimeSlot}
									onClick={() => setBookingStep(3)}
								>
									Next: Client Intake Form →
								</button>
							</div>
						</div>
					)}

					{/* STEP 3: INTAKE DOSSIER */}
					{bookingStep === 3 && (
						<div>
							<div style={{ marginBottom: "1.5rem" }}>
								<span className="section-tag">Step 3 of 4</span>
								<h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.75rem", fontWeight: 700 }}>
									Executive Intake & Objectives
								</h2>
								<p style={{ color: "var(--lp-text-muted)", fontSize: "0.925rem" }}>
									Your answers give the coach vital context before the session so we start at full speed.
								</p>
							</div>

							<div className="form-grid-2">
								<div className="field-group">
									<label className="field-label">Full Name *</label>
									<input
										type="text"
										required
										className="aura-input"
										placeholder="e.g. Sarah Jenkins"
										value={clientName}
										onChange={(e) => setClientName(e.target.value)}
									/>
								</div>

								<div className="field-group">
									<label className="field-label">Work / Primary Email *</label>
									<input
										type="email"
										required
										className="aura-input"
										placeholder="sarah@company.com"
										value={clientEmail}
										onChange={(e) => setClientEmail(e.target.value)}
									/>
								</div>
							</div>

							<div className="form-grid-2">
								<div className="field-group">
									<label className="field-label">Phone / WhatsApp Number</label>
									<input
										type="tel"
										className="aura-input"
										placeholder="+1 (555) 019-2834"
										value={clientPhone}
										onChange={(e) => setClientPhone(e.target.value)}
									/>
								</div>

								<div className="field-group">
									<label className="field-label">Current Role & Company</label>
									<input
										type="text"
										className="aura-input"
										placeholder="e.g. Founder & CEO @ Series A SaaS"
										value={clientRole}
										onChange={(e) => setClientRole(e.target.value)}
									/>
								</div>
							</div>

							<div className="field-group">
								<label className="field-label">
									Primary Objectives & Focus Areas for this Session *
								</label>
								<span className="field-hint">What high-stakes decisions, leadership challenges, or strategic shifts are you navigating?</span>
								<textarea
									rows={3}
									required
									className="aura-textarea"
									placeholder="e.g. I am transitioning from technical lead to managing 3 engineering managers and preparing for our next funding round..."
									value={intakeGoals}
									onChange={(e) => setIntakeGoals(e.target.value)}
								/>
							</div>

							<div className="field-group">
								<label className="field-label">Biggest Roadblock Right Now (Optional)</label>
								<textarea
									rows={2}
									className="aura-textarea"
									placeholder="e.g. Cross-functional friction between sales and engineering, or feeling like an operational bottleneck..."
									value={intakeRoadblocks}
									onChange={(e) => setIntakeRoadblocks(e.target.value)}
								/>
							</div>

							<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2rem" }}>
								<button className="btn-pill btn-pill-secondary" onClick={() => setBookingStep(2)}>
									← Back to Slot Picker
								</button>
								<button
									className="btn-pill btn-pill-primary"
									disabled={!clientName.trim() || !clientEmail.trim() || !intakeGoals.trim()}
									onClick={() => setBookingStep(4)}
								>
									Next: Authorize Stripe Deposit →
								</button>
							</div>
						</div>
					)}

					{/* STEP 4: STRIPE DEPOSIT CHECKOUT */}
					{bookingStep === 4 && (
						<div>
							<div style={{ marginBottom: "1.5rem" }}>
								<span className="section-tag">Step 4 of 4</span>
								<h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.75rem", fontWeight: 700 }}>
									Pay Deposit via Stripe
								</h2>
								<p style={{ color: "var(--lp-text-muted)", fontSize: "0.925rem" }}>
									Bank-level 256-bit SSL encrypted transaction powered by Stripe.
								</p>
							</div>

							{paymentError ? <ErrorStrip message={paymentError} /> : null}

							{/* Financial Breakdown Card */}
							<div className="breakdown-summary">
								<div className="breakdown-row">
									<span>Selected Coaching Track:</span>
									<span style={{ fontWeight: 600, color: "var(--lp-text)" }}>{selectedPackage.title}</span>
								</div>
								<div className="breakdown-row">
									<span>Session Date & Time:</span>
									<span style={{ fontWeight: 600, color: "var(--lp-text)" }}>{selectedDate} at {selectedTimeSlot}</span>
								</div>
								<div className="breakdown-row">
									<span>Total Package Value:</span>
									<span>${selectedPackage.price_total}.00</span>
								</div>
								<div className="breakdown-row">
									<span>Balance Due at Session Delivery:</span>
									<span>${selectedPackage.price_total - selectedPackage.deposit_amount}.00</span>
								</div>
								<div className="breakdown-row emphasis">
									<span>Deposit Charged Now:</span>
									<span>${selectedPackage.deposit_amount}.00</span>
								</div>
							</div>

							{/* Stripe Payment Box */}
							<form onSubmit={handleDepositCheckout} className="stripe-payment-box">
								<div className="stripe-badge-bar">
									<div className="stripe-logo-group">
										<span className="stripe-brand-tag">stripe</span>
										<span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--lp-text)" }}>Secured Checkout</span>
									</div>
									<div className="stripe-secure-text">
										<span>🔒 End-to-end Encrypted</span>
									</div>
								</div>

								{/* One-click mock buttons */}
								<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "1.25rem" }}>
									<button
										type="button"
										className="btn-pill"
										style={{ background: "#000", color: "#fff", padding: "0.6rem" }}
										onClick={() => {
											setCardNumber("4242 4242 4242 4242");
											setCardExpiry("12/28");
											setCardCvc("888");
											setCardZip("94107");
										}}
									>
										 Pay (Simulate)
									</button>
									<button
										type="button"
										className="btn-pill btn-pill-secondary"
										style={{ padding: "0.6rem" }}
										onClick={() => {
											setCardNumber("5555 4444 3333 2222");
											setCardExpiry("08/29");
											setCardCvc("999");
											setCardZip("10001");
										}}
									>
										G Pay (Simulate)
									</button>
								</div>

								<div style={{ textAlign: "center", margin: "0.75rem 0", fontSize: "0.8rem", color: "var(--lp-text-muted)" }}>
									— or enter card details below —
								</div>

								<div className="card-element-mock">
									<div className="field-group">
										<label className="field-label">Card Number</label>
										<input
											type="text"
											className="aura-input"
											placeholder="4242 •••• •••• 4242"
											value={cardNumber}
											onChange={handleCardNumberChange}
										/>
									</div>

									<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
										<div className="field-group">
											<label className="field-label">Expires</label>
											<input
												type="text"
												className="aura-input"
												placeholder="MM/YY"
												value={cardExpiry}
												onChange={handleExpiryChange}
											/>
										</div>

										<div className="field-group">
											<label className="field-label">CVC</label>
											<input
												type="text"
												maxLength={4}
												className="aura-input"
												placeholder="CVC"
												value={cardCvc}
												onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ""))}
											/>
										</div>

										<div className="field-group">
											<label className="field-label">ZIP / Postal</label>
											<input
												type="text"
												className="aura-input"
												placeholder="94107"
												value={cardZip}
												onChange={(e) => setCardZip(e.target.value)}
											/>
										</div>
									</div>
								</div>

								{/* Quick Test Cards Pill helper */}
								<div className="test-card-quick-fill">
									<span style={{ fontSize: "0.75rem", color: "var(--lp-text-muted)", alignSelf: "center" }}>Quick fill test card:</span>
									<button
										type="button"
										className="pill-tag-btn"
										onClick={() => {
											setCardNumber("4242 4242 4242 4242");
											setCardExpiry("12/28");
											setCardCvc("123");
											setCardZip("90210");
										}}
									>
										Visa 4242
									</button>
									<button
										type="button"
										className="pill-tag-btn"
										onClick={() => {
											setCardNumber("5555 5555 5555 4444");
											setCardExpiry("11/27");
											setCardCvc("456");
											setCardZip("10001");
										}}
									>
										Mastercard 5555
									</button>
								</div>

								{/* Terms agreement checkbox */}
								<div style={{ marginTop: "1.25rem", padding: "0.75rem", background: "var(--lp-bg-100)", borderRadius: "var(--radius-sm)", border: "1px solid var(--lp-border-light)" }}>
									<label style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "0.8rem", color: "var(--lp-text-muted)", cursor: "pointer" }}>
										<input
											type="checkbox"
											style={{ marginTop: "3px" }}
											checked={agreeTerms}
											onChange={(e) => setAgreeTerms(e.target.checked)}
										/>
										<span>
											I authorize Aura Leadership to charge a <strong>${selectedPackage.deposit_amount}.00 deposit</strong> to reserve my session slot. I understand the remaining balance of <strong>${selectedPackage.price_total - selectedPackage.deposit_amount}.00</strong> is due at session delivery, and reschedules are permitted up to 24 hours prior.
										</span>
									</label>
								</div>

								<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.75rem" }}>
									<button type="button" className="btn-pill btn-pill-secondary" onClick={() => setBookingStep(3)}>
										← Back to Intake
									</button>
									<button
										type="submit"
										disabled={isProcessingPayment}
										className="btn-pill btn-pill-primary"
									>
										{isProcessingPayment ? "Authorizing Stripe Deposit..." : `Pay $${selectedPackage.deposit_amount}.00 Deposit & Confirm Slot`}
									</button>
								</div>
							</form>
						</div>
					)}

					{/* STEP 5: BOOKING CONFIRMATION & RECEIPT */}
					{bookingStep === 5 && completedBooking && (
						<div className="confirmation-card">
							<div className="success-check-circle">✓</div>

							<span className="section-tag" style={{ color: "#15803D" }}>Deposit Authorized & Verified</span>
							<h2 style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", fontWeight: 700, margin: "0.5rem 0" }}>
								Your Executive Session is Confirmed!
							</h2>
							<p style={{ color: "var(--lp-text-muted)", fontSize: "0.95rem", maxWidth: "520px", margin: "0 auto" }}>
								We have locked your date on the coach's calendar and sent an official Stripe receipt & Google Meet link to <strong>{completedBooking.client_email}</strong>.
							</p>

							{/* Receipt Sheet */}
							<div className="receipt-sheet">
								<div className="receipt-header">
									<div>
										<div style={{ fontWeight: 700, fontSize: "1.1rem" }}>AURA LEADERSHIP ADVISORY</div>
										<div style={{ fontSize: "0.8rem", color: "var(--lp-text-muted)" }}>Stripe Deposit Receipt #{completedBooking.stripe_charge_id}</div>
									</div>
									<div style={{ textAlign: "right" }}>
										<span className="status-pill status-confirmed">Deposit Paid</span>
									</div>
								</div>

								<div className="receipt-table-row">
									<span className="label">Booking Reference Code:</span>
									<span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--lp-accent)" }}>{completedBooking.id}</span>
								</div>
								<div className="receipt-table-row">
									<span className="label">Coaching Track:</span>
									<span style={{ fontWeight: 600 }}>{completedBooking.package_title}</span>
								</div>
								<div className="receipt-table-row">
									<span className="label">Reserved Date & Slot:</span>
									<span>{completedBooking.date_slot} at {completedBooking.time_slot} ({completedBooking.timezone})</span>
								</div>
								<div className="receipt-table-row">
									<span className="label">Client Name:</span>
									<span>{completedBooking.client_name}</span>
								</div>
								<div className="receipt-table-row">
									<span className="label">Deposit Paid Now:</span>
									<span style={{ fontWeight: 700, color: "#15803D" }}>${completedBooking.deposit_amount}.00 USD</span>
								</div>
								<div className="receipt-table-row">
									<span className="label">Remaining Balance Due:</span>
									<span>${completedBooking.balance_due}.00 USD</span>
								</div>
								<div className="receipt-table-row">
									<span className="label">Payment Instrument:</span>
									<span>{completedBooking.stripe_payment_method}</span>
								</div>
							</div>

							{/* Actions: Download Calendar & Google Calendar Link */}
							<div style={{ display: "flex", justifyContent: "center", gap: "1rem", flexWrap: "wrap", marginTop: "1.5rem" }}>
								<button
									className="btn-pill btn-pill-primary"
									onClick={() => downloadIcsCalendar(completedBooking)}
								>
									📅 Download Calendar (.ics)
								</button>
								<button
									className="btn-pill btn-pill-secondary"
									onClick={() => {
										const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent("Executive Coaching: " + completedBooking.package_title)}&dates=${completedBooking.date_slot.replace(/-/g, "")}T140000Z/${completedBooking.date_slot.replace(/-/g, "")}T150000Z&details=${encodeURIComponent("Aura Leadership Session. Ref: " + completedBooking.id)}&location=Google+Meet`;
										window.open(googleCalUrl, "_blank");
									}}
								>
									Open in Google Calendar ↗
								</button>
								<button
									className="btn-pill btn-pill-ghost"
									onClick={() => {
										setView("lookup");
										setLookupId(completedBooking.id);
										setLookupEmail(completedBooking.client_email);
									}}
								>
									View in Client Portal
								</button>
							</div>
						</div>
					)}
				</div>
			</main>
		);
	};

	// 3. CLIENT LOOKUP / SELF-SERVICE VIEW
	const renderLookup = () => (
		<main className="container-narrow section-pad">
			<div className="section-header">
				<span className="section-tag">Client Self-Service Portal</span>
				<h2 className="section-title">Manage Your Booking & Receipt</h2>
				<p className="section-desc">
					Look up your confirmed coaching appointment, view your deposit receipt, or reschedule your slot.
				</p>
			</div>

			<div className="corner-frame" style={{ padding: "2rem", marginBottom: "2rem" }}>
				<CornerBrackets />

				<form onSubmit={handleLookupBooking} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "1rem", alignItems: "flex-end" }}>
					<div className="field-group" style={{ margin: 0 }}>
						<label className="field-label">Booking Reference Code</label>
						<input
							type="text"
							required
							className="aura-input"
							placeholder="e.g. AURA-BK-8102"
							value={lookupId}
							onChange={(e) => setLookupId(e.target.value)}
						/>
					</div>

					<div className="field-group" style={{ margin: 0 }}>
						<label className="field-label">Client Email Address</label>
						<input
							type="email"
							required
							className="aura-input"
							placeholder="you@company.com"
							value={lookupEmail}
							onChange={(e) => setLookupEmail(e.target.value)}
						/>
					</div>

					<button type="submit" className="btn-pill btn-pill-primary" disabled={lookupLoading}>
						{lookupLoading ? "Searching..." : "Look Up"}
					</button>
				</form>
			</div>

			{lookupError ? <ErrorStrip message={lookupError} /> : null}

			{lookupResult && (
				<div className="corner-frame" style={{ padding: "2rem" }}>
					<CornerBrackets />

					<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", borderBottom: "1px solid var(--lp-border)", paddingBottom: "1rem" }}>
						<div>
							<span className="status-pill status-confirmed">{lookupResult.status.replace("_", " ")}</span>
							<h3 style={{ fontFamily: "var(--font-serif)", fontSize: "1.5rem", marginTop: "0.5rem" }}>
								{lookupResult.package_title}
							</h3>
						</div>
						<div style={{ textAlign: "right" }}>
							<div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--lp-accent)" }}>
								{lookupResult.id}
							</div>
							<div style={{ fontSize: "0.8rem", color: "var(--lp-text-muted)" }}>
								Booked on {new Date(lookupResult.created_at).toLocaleDateString()}
							</div>
						</div>
					</div>

					<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem", marginBottom: "1.5rem" }}>
						<div style={{ background: "var(--lp-bg-100)", padding: "1rem", borderRadius: "var(--radius-md)" }}>
							<div style={{ fontSize: "0.75rem", color: "var(--lp-text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Reserved Slot</div>
							<div style={{ fontWeight: 700, fontSize: "1.1rem", marginTop: "4px" }}>{lookupResult.date_slot}</div>
							<div style={{ color: "var(--lp-accent)", fontSize: "0.9rem" }}>{lookupResult.time_slot} ({lookupResult.timezone})</div>
						</div>

						<div style={{ background: "var(--lp-bg-100)", padding: "1rem", borderRadius: "var(--radius-md)" }}>
							<div style={{ fontSize: "0.75rem", color: "var(--lp-text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Stripe Deposit</div>
							<div style={{ fontWeight: 700, fontSize: "1.1rem", marginTop: "4px", color: "#15803D" }}>${lookupResult.deposit_amount}.00 Paid</div>
							<div style={{ fontSize: "0.85rem", color: "var(--lp-text-muted)" }}>Balance Due: ${lookupResult.balance_due}.00</div>
						</div>

						<div style={{ background: "var(--lp-bg-100)", padding: "1rem", borderRadius: "var(--radius-md)" }}>
							<div style={{ fontSize: "0.75rem", color: "var(--lp-text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Client Contact</div>
							<div style={{ fontWeight: 600, marginTop: "4px" }}>{lookupResult.client_name}</div>
							<div style={{ fontSize: "0.85rem", color: "var(--lp-text-muted)" }}>{lookupResult.client_email}</div>
						</div>
					</div>

					<div style={{ background: "var(--lp-bg-100)", padding: "1.25rem", borderRadius: "var(--radius-md)", marginBottom: "1.5rem" }}>
						<div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.4rem" }}>Submitted Intake Focus:</div>
						<p style={{ fontSize: "0.875rem", color: "var(--lp-text-muted)", lineHeight: 1.5 }}>
							{lookupResult.intake_goals}
						</p>
					</div>

					<div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
						<button className="btn-pill btn-pill-primary" onClick={() => downloadIcsCalendar(lookupResult)}>
							Download Calendar (.ics)
						</button>
						<button
							className="btn-pill btn-pill-secondary"
							onClick={() => {
								const newDate = window.prompt("Enter new desired date (YYYY-MM-DD):", lookupResult.date_slot);
								const newTime = window.prompt("Enter new time slot (e.g. 10:30 AM, 02:30 PM):", lookupResult.time_slot);
								if (newDate && newTime) {
									fetch(`./api/bookings/${lookupResult.id}/reschedule`, {
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({
											client_email: lookupResult.client_email,
											date_slot: newDate,
											time_slot: newTime
										})
									})
										.then((r) => r.json())
										.then((d) => {
											if (d.success) {
												alert("Session successfully rescheduled!");
												handleLookupBooking(new Event("submit") as unknown as React.FormEvent);
											} else {
												alert(d.error || "Could not reschedule.");
											}
										});
								}
							}}
						>
							Request Reschedule
						</button>
					</div>
				</div>
			)}
		</main>
	);

	// 4. COACH ADMIN COMMAND DASHBOARD
	const renderAdmin = () => {
		if (!adminToken) {
			return (
				<main className="container-narrow section-pad">
					<div className="section-header">
						<span className="section-tag">Coach Security Access</span>
						<h2 className="section-title">Coach Administrative Portal</h2>
						<p className="section-desc">
							Sign in to view client intake dossiers, manage availability blocks, and inspect Stripe deposit logs.
						</p>
					</div>

					<div className="corner-frame" style={{ maxWidth: "420px", margin: "0 auto", padding: "2rem" }}>
						<CornerBrackets />

						{adminError ? <ErrorStrip message={adminError} /> : null}

						<form onSubmit={handleAdminLogin}>
							<div className="field-group">
								<label className="field-label">Administrative Passcode</label>
								<input
									type="password"
									required
									className="aura-input"
									placeholder="Enter passcode (e.g. aura-coach-2025 or coach123)"
									value={adminPassword}
									onChange={(e) => setAdminPassword(e.target.value)}
								/>
							</div>

							<button type="submit" className="btn-pill btn-pill-primary w-full" disabled={adminLoading}>
								{adminLoading ? "Authenticating..." : "Sign in to Coach Dashboard"}
							</button>

							<p style={{ fontSize: "0.75rem", color: "var(--lp-text-muted)", marginTop: "1rem", textAlign: "center" }}>
								Demo access key: <code>aura-coach-2025</code> or <code>coach123</code>
							</p>
						</form>
					</div>
				</main>
			);
		}

		// KPI Calculations
		const totalDeposits = adminBookings.reduce((sum, b) => b.status !== "cancelled" ? sum + b.deposit_amount : sum, 0);
		const totalPipeline = adminBookings.reduce((sum, b) => b.status !== "cancelled" ? sum + b.price_total : sum, 0);
		const confirmedSessions = adminBookings.filter((b) => b.status === "confirmed" || b.status === "deposit_paid").length;

		return (
			<main className="container-wide admin-view-shell">
				<div className="admin-top-bar">
					<div>
						<span className="section-tag">Executive Coach Console</span>
						<h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.85rem", fontWeight: 700 }}>
							Aura Management Hub
						</h1>
					</div>

					<div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
						<button className="btn-pill btn-pill-secondary btn-sm" onClick={exportBookingsCSV}>
							📥 Export CSV Roster
						</button>
						<button className="btn-pill btn-pill-ghost btn-sm" onClick={handleResetDemoData}>
							↺ Reseed Demo Data
						</button>
						<button className="btn-pill btn-pill-secondary btn-sm" onClick={() => setAdminToken(null)}>
							Sign Out
						</button>
					</div>
				</div>

				{/* KPI Cards */}
				<div className="kpi-row">
					<div className="corner-frame kpi-card">
						<CornerBrackets />
						<div className="kpi-title">Stripe Deposits Collected</div>
						<div className="kpi-value">${totalDeposits.toLocaleString()}</div>
						<div className="kpi-sub">✓ Instant Funds in Stripe Balance</div>
					</div>

					<div className="corner-frame kpi-card">
						<CornerBrackets />
						<div className="kpi-title">Total Coaching Pipeline</div>
						<div className="kpi-value">${totalPipeline.toLocaleString()}</div>
						<div className="kpi-sub">{adminBookings.length} total client bookings</div>
					</div>

					<div className="corner-frame kpi-card">
						<CornerBrackets />
						<div className="kpi-title">Active / Upcoming Sessions</div>
						<div className="kpi-value">{confirmedSessions}</div>
						<div className="kpi-sub">Ready for prep review</div>
					</div>
				</div>

				{/* Navigation Tabs */}
				<div className="admin-tabs-bar">
					<button
						className={`admin-tab-btn ${adminTab === "bookings" ? "active" : ""}`}
						onClick={() => setAdminTab("bookings")}
					>
						Bookings & Sessions ({adminBookings.length})
					</button>
					<button
						className={`admin-tab-btn ${adminTab === "intakes" ? "active" : ""}`}
						onClick={() => setAdminTab("intakes")}
					>
						Client Intake Dossiers
					</button>
					<button
						className={`admin-tab-btn ${adminTab === "slots" ? "active" : ""}`}
						onClick={() => setAdminTab("slots")}
					>
						Availability & Blockouts ({adminBlockedSlots.length})
					</button>
					<button
						className={`admin-tab-btn ${adminTab === "financials" ? "active" : ""}`}
						onClick={() => setAdminTab("financials")}
					>
						Stripe Transactions Ledger
					</button>
				</div>

				{/* TAB 1: BOOKINGS LIST */}
				{adminTab === "bookings" && (
					<div className="data-table-wrap">
						{adminBookings.length === 0 ? (
							<Empty title="No bookings in the system yet." />
						) : (
							<table className="aura-table">
								<thead>
									<tr>
										<th>Booking ID</th>
										<th>Client & Role</th>
										<th>Coaching Package</th>
										<th>Date & Slot</th>
										<th>Deposit Paid</th>
										<th>Balance Due</th>
										<th>Status</th>
										<th>Actions</th>
									</tr>
								</thead>
								<tbody>
									{adminBookings.map((b) => (
										<tr key={b.id}>
											<td>
												<span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--lp-accent)" }}>
													{b.id}
												</span>
												<div style={{ fontSize: "0.75rem", color: "var(--lp-text-muted)" }}>
													{new Date(b.created_at).toLocaleDateString()}
												</div>
											</td>
											<td>
												<div style={{ fontWeight: 600 }}>{b.client_name}</div>
												<div style={{ fontSize: "0.8rem", color: "var(--lp-text-muted)" }}>{b.client_email}</div>
												{b.client_role && (
													<div style={{ fontSize: "0.75rem", color: "var(--lp-text-subtle)", marginTop: "2px" }}>
														{b.client_role}
													</div>
												)}
											</td>
											<td>
												<div style={{ fontWeight: 600 }}>{b.package_title}</div>
												<div style={{ fontSize: "0.75rem", color: "var(--lp-text-muted)" }}>
													Total: ${b.price_total}
												</div>
											</td>
											<td>
												<div style={{ fontWeight: 600 }}>{b.date_slot}</div>
												<div style={{ fontSize: "0.8rem", color: "var(--lp-accent)" }}>{b.time_slot}</div>
											</td>
											<td>
												<span style={{ fontWeight: 700, color: "#15803D" }}>${b.deposit_amount}</span>
											</td>
											<td>
												<span>${b.balance_due}</span>
											</td>
											<td>
												<span className={`status-pill status-${b.status}`}>
													{b.status.replace("_", " ")}
												</span>
											</td>
											<td>
												<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
													<button
														className="btn-pill btn-pill-secondary btn-sm"
														onClick={() => setSelectedIntakeBooking(b)}
													>
														Read Intake
													</button>
													{b.status !== "completed" && (
														<button
															className="btn-pill btn-pill-ghost btn-sm"
															onClick={() => handleUpdateStatus(b.id, "completed")}
														>
															Mark Completed
														</button>
													)}
													{b.status !== "cancelled" && (
														<button
															className="btn-pill btn-pill-secondary btn-sm"
															style={{ color: "#B91C1C" }}
															onClick={() => handleUpdateStatus(b.id, "cancelled")}
														>
															Cancel
														</button>
													)}
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						)}
					</div>
				)}

				{/* TAB 2: INTAKE DOSSIERS */}
				{adminTab === "intakes" && (
					<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
						{adminBookings.map((b) => (
							<div key={b.id} className="corner-frame" style={{ padding: "1.5rem" }}>
								<CornerBrackets />
								<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
									<div>
										<h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>{b.client_name}</h3>
										<div style={{ fontSize: "0.8rem", color: "var(--lp-text-muted)" }}>{b.client_role || "Executive Client"} • {b.client_email}</div>
									</div>
									<span className="status-pill status-confirmed">{b.package_title.split(" ")[0]}</span>
								</div>

								<div style={{ marginBottom: "1rem", padding: "0.75rem", background: "var(--lp-bg-100)", borderRadius: "var(--radius-sm)" }}>
									<div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--lp-text-muted)" }}>Primary Objectives</div>
									<p style={{ fontSize: "0.875rem", marginTop: "4px", color: "var(--lp-text)" }}>{b.intake_goals}</p>
								</div>

								{b.intake_roadblocks && (
									<div style={{ marginBottom: "1rem", padding: "0.75rem", background: "var(--lp-bg-100)", borderRadius: "var(--radius-sm)" }}>
										<div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--lp-text-muted)" }}>Roadblocks</div>
										<p style={{ fontSize: "0.875rem", marginTop: "4px", color: "var(--lp-text)" }}>{b.intake_roadblocks}</p>
									</div>
								)}

								<div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--lp-text-muted)" }}>
									<span>Slot: {b.date_slot} @ {b.time_slot}</span>
									<span style={{ fontWeight: 600, color: "#15803D" }}>Deposit Paid: ${b.deposit_amount}</span>
								</div>
							</div>
						))}
					</div>
				)}

				{/* TAB 3: AVAILABILITY & BLOCKOUTS */}
				{adminTab === "slots" && (
					<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
						{/* Block Slot Form */}
						<div className="corner-frame" style={{ padding: "2rem" }}>
							<CornerBrackets />
							<h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "1rem" }}>Add Custom Time Blockout</h3>
							<form onSubmit={handleBlockSlot}>
								<div className="field-group">
									<label className="field-label">Date</label>
									<input
										type="date"
										required
										className="aura-input"
										value={blockDate}
										onChange={(e) => setBlockDate(e.target.value)}
									/>
								</div>

								<div className="field-group">
									<label className="field-label">Time Slot</label>
									<select
										className="aura-select"
										value={blockTime}
										onChange={(e) => setBlockTime(e.target.value)}
									>
										<option value="09:00 AM">09:00 AM</option>
										<option value="10:30 AM">10:30 AM</option>
										<option value="01:00 PM">01:00 PM</option>
										<option value="02:30 PM">02:30 PM</option>
										<option value="04:00 PM">04:00 PM</option>
										<option value="05:30 PM">05:30 PM</option>
									</select>
								</div>

								<div className="field-group">
									<label className="field-label">Reason</label>
									<input
										type="text"
										className="aura-input"
										placeholder="e.g. Speaking engagement / Vacation"
										value={blockReason}
										onChange={(e) => setBlockReason(e.target.value)}
									/>
								</div>

								<button type="submit" className="btn-pill btn-pill-primary">
									Block Out Slot from Public Booking
								</button>
							</form>
						</div>

						{/* Blocked Slots List */}
						<div className="corner-frame" style={{ padding: "2rem" }}>
							<CornerBrackets />
							<h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "1rem" }}>Currently Blocked Slots</h3>
							{adminBlockedSlots.length === 0 ? (
								<p style={{ color: "var(--lp-text-muted)", fontSize: "0.9rem" }}>No active blockouts. All regular calendar hours are available.</p>
							) : (
								<div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
									{adminBlockedSlots.map((blk) => (
										<div
											key={blk.id}
											style={{
												display: "flex",
												justifyContent: "space-between",
												alignItems: "center",
												padding: "0.75rem 1rem",
												background: "var(--lp-bg-100)",
												borderRadius: "var(--radius-sm)",
												border: "1px solid var(--lp-border-light)"
											}}
										>
											<div>
												<div style={{ fontWeight: 600 }}>{blk.date_slot} at {blk.time_slot}</div>
												<div style={{ fontSize: "0.75rem", color: "var(--lp-text-muted)" }}>{blk.reason || "Coach Blocked"}</div>
											</div>
											<button
												className="btn-pill btn-pill-secondary btn-sm"
												style={{ color: "#B91C1C" }}
												onClick={() => handleUnblockSlot(blk.id)}
											>
												Unblock
											</button>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
				)}

				{/* TAB 4: FINANCIALS / STRIPE LEDGER */}
				{adminTab === "financials" && (
					<div className="data-table-wrap">
						<table className="aura-table">
							<thead>
								<tr>
									<th>Stripe Charge ID</th>
									<th>Client</th>
									<th>Deposit Amount</th>
									<th>Method</th>
									<th>Paid Timestamp</th>
									<th>Status</th>
								</tr>
							</thead>
							<tbody>
								{adminBookings.map((b) => (
									<tr key={b.id}>
										<td>
											<span style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "#635BFF", fontWeight: 600 }}>
												{b.stripe_charge_id}
											</span>
										</td>
										<td>
											<div style={{ fontWeight: 600 }}>{b.client_name}</div>
											<div style={{ fontSize: "0.75rem", color: "var(--lp-text-muted)" }}>{b.client_email}</div>
										</td>
										<td>
											<strong style={{ color: "#15803D", fontSize: "1rem" }}>${b.deposit_amount}.00 USD</strong>
										</td>
										<td>
											<span style={{ fontSize: "0.85rem" }}>{b.stripe_payment_method}</span>
										</td>
										<td>
											<span style={{ fontSize: "0.85rem", color: "var(--lp-text-muted)" }}>
												{new Date(b.paid_at || b.created_at).toLocaleString()}
											</span>
										</td>
										<td>
											<span className="status-pill status-confirmed">Succeeded</span>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				{/* Intake Reader Modal */}
				{selectedIntakeBooking && (
					<div className="modal-overlay" onClick={() => setSelectedIntakeBooking(null)}>
						<div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
							<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
								<div>
									<span className="section-tag">{selectedIntakeBooking.id}</span>
									<h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.6rem" }}>
										Client Intake: {selectedIntakeBooking.client_name}
									</h2>
									<p style={{ fontSize: "0.85rem", color: "var(--lp-text-muted)" }}>
										{selectedIntakeBooking.client_role || "Executive"} • {selectedIntakeBooking.client_email}
									</p>
								</div>
								<button className="btn-pill btn-pill-secondary btn-sm" onClick={() => setSelectedIntakeBooking(null)}>
									✕ Close
								</button>
							</div>

							<div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
								<div style={{ padding: "1rem", background: "var(--lp-bg-100)", borderRadius: "var(--radius-md)" }}>
									<div style={{ fontWeight: 700, fontSize: "0.85rem", textTransform: "uppercase", color: "var(--lp-text-muted)", marginBottom: "4px" }}>
										Target Goals & Focus
									</div>
									<p style={{ fontSize: "0.95rem", lineHeight: 1.6 }}>{selectedIntakeBooking.intake_goals}</p>
								</div>

								{selectedIntakeBooking.intake_roadblocks && (
									<div style={{ padding: "1rem", background: "var(--lp-bg-100)", borderRadius: "var(--radius-md)" }}>
										<div style={{ fontWeight: 700, fontSize: "0.85rem", textTransform: "uppercase", color: "var(--lp-text-muted)", marginBottom: "4px" }}>
											Current Roadblocks
										</div>
										<p style={{ fontSize: "0.95rem", lineHeight: 1.6 }}>{selectedIntakeBooking.intake_roadblocks}</p>
									</div>
								)}

								{selectedIntakeBooking.intake_notes && (
									<div style={{ padding: "1rem", background: "var(--lp-bg-100)", borderRadius: "var(--radius-md)" }}>
										<div style={{ fontWeight: 700, fontSize: "0.85rem", textTransform: "uppercase", color: "var(--lp-text-muted)", marginBottom: "4px" }}>
											Additional Notes / Context
										</div>
										<p style={{ fontSize: "0.95rem", lineHeight: 1.6 }}>{selectedIntakeBooking.intake_notes}</p>
									</div>
								)}
							</div>

							<div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
								<button className="btn-pill btn-pill-primary" onClick={() => setSelectedIntakeBooking(null)}>
									Done Reviewing
								</button>
							</div>
						</div>
					</div>
				)}
			</main>
		);
	};

	return (
		<div className="aura-app">
			{renderNavbar()}

			{view === "landing" && renderLanding()}
			{view === "booking" && renderBooking()}
			{view === "lookup" && renderLookup()}
			{view === "admin" && renderAdmin()}

			{/* Site Footer */}
			<footer className="aura-footer">
				<div className="container-wide">
					<div className="footer-content">
						<div>
							<div className="brand-logo" onClick={() => setView("landing")}>
								<div className="brand-glyph">A</div>
								<div className="brand-meta">
									<span className="brand-title">AURA LEADERSHIP</span>
									<span className="brand-sub">Executive Advisory & Coaching</span>
								</div>
							</div>
							<p className="footer-sub">
								Guaranteed executive slot bookings with transparent Stripe deposit security and tailored strategic diagnostics.
							</p>
						</div>

						<div style={{ display: "flex", gap: "3rem", flexWrap: "wrap" }}>
							<div>
								<div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--lp-text)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Navigation</div>
								<div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.875rem" }}>
									<a href="#packages-section" style={{ color: "var(--lp-text-muted)", textDecoration: "none" }} onClick={() => setView("landing")}>Coaching Packages</a>
									<a href="#booking" style={{ color: "var(--lp-text-muted)", textDecoration: "none" }} onClick={() => { if (packages[0]) startBooking(packages[0]); }}>Book with Deposit</a>
									<a href="#lookup" style={{ color: "var(--lp-text-muted)", textDecoration: "none" }} onClick={() => setView("lookup")}>Client Self-Service</a>
								</div>
							</div>

							<div>
								<div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--lp-text)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Security & Terms</div>
								<div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.875rem", color: "var(--lp-text-muted)" }}>
									<span>Stripe PCI-DSS Level 1</span>
									<span>24h Reschedule Policy</span>
									<span onClick={() => setView("admin")} style={{ cursor: "pointer", color: "var(--lp-accent)" }}>Coach Admin Login</span>
								</div>
							</div>
						</div>
					</div>

					<div className="footer-bottom">
						<div>© 2026 Aura Leadership Advisory Inc. All rights reserved.</div>
						<div>Powered by Cloudflare Workers Durable Objects & Stripe Deposits.</div>
					</div>
				</div>
			</footer>
		</div>
	);
}

const container = document.getElementById("root");
if (container) {
	createRoot(container).render(<App />);
}
