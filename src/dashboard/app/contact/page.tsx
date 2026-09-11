"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Building2, Mail, Phone, Send, CheckCircle2 } from "lucide-react";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import "../home/homepage.css";

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    sessionTool: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to send message");
      }

      setStatus("sent");
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please email us directly.");
      setStatus("error");
    }
  };

  return (
    <main className="hp min-h-screen pb-20" style={{ background: 'var(--bg-raised)' }}>
      <MarketingNav />
      
      {/* Hero */}
      <section className="pt-32 pb-16 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(255,90,31,0.06)_0%,rgba(255,255,255,0)_60%)] z-0" />
        </div>
        <div className="mx-auto max-w-6xl px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <div className="kicker justify-center inline-flex mb-6">
              <Building2 className="h-4 w-4 mr-2" />
              Enterprise
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl mb-6 font-[800] tracking-[-0.04em] text-[var(--ink)]">
              LET'S TALK ABOUT YOUR RETENTION.
            </h1>
            <p className="text-base text-[var(--ink-soft)] font-medium max-w-xl mx-auto leading-relaxed">
              Book a session audit. We'll pull a sample of your existing session data and show you exactly what's been recorded — and never acted on.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* What you get */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-8"
            >
              <h2 className="text-2xl font-[800] text-[var(--ink)] tracking-[-0.04em]">What an audit covers</h2>
              <ul className="space-y-4">
                {[
                  "14-day historical analysis of your session data",
                  "Identification of top 5 silent friction paths",
                  "Revenue leakage estimate per path",
                  "Action mapping: Slack, Jira, and Salesforce",
                  "LLM reasoning demonstration on your actual data",
                  "Implementation and security review",
                ].map((feat) => (
                  <li key={feat} className="flex items-start gap-3 text-[15px] font-medium text-[var(--ink-soft)]">
                    <CheckCircle2 className="h-5 w-5 text-[var(--ember)] mt-0.5 shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>

              <div className="glass-panel p-8 space-y-4 mt-8">
                <p className="font-[700] text-[var(--ink)] text-base">Prefer email or a call?</p>
                <div className="flex items-center gap-4 font-medium text-[var(--ink-muted)]">
                  <Mail className="h-5 w-5 text-[var(--ember)]" />
                  <a href="mailto:info@usersessions.io" className="hover:text-[var(--ink)] transition-colors">
                    info@usersessions.io
                  </a>
                </div>
                <div className="flex items-center gap-4 font-medium text-[var(--ink-muted)]">
                  <Phone className="h-5 w-5 text-[var(--ember)]" />
                  <span>We'll share our number once we connect</span>
                </div>
              </div>
            </motion.div>

            {/* Contact form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-panel p-8"
            >
              {status === "sent" ? (
                <div className="flex flex-col items-center justify-center text-center h-full py-12 gap-4">
                  <CheckCircle2 className="h-14 w-14 text-[var(--ember)]" />
                  <h3 className="text-2xl font-[800] text-[var(--ink)]">Message sent!</h3>
                  <p className="font-medium text-[var(--ink-soft)] max-w-xs leading-relaxed text-sm">
                    Thanks for reaching out. We'll get back to you within one business day.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <h3 className="text-xl font-[800] text-[var(--ink)] mb-6">Get in touch</h3>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="name" className="text-[13px] font-[600] text-[var(--ink-muted)]">
                        Full name <span className="text-red-500">*</span>
                      </label>
                      <div className="border border-[var(--line)] bg-white rounded-xl px-3 py-2 focus-within:border-[var(--ember)] focus-within:ring-2 focus-within:ring-[var(--ember-glow)] transition-all">
                        <input
                          id="name"
                          name="name"
                          required
                          value={form.name}
                          onChange={handleChange}
                          placeholder="Jane Smith"
                          className="w-full bg-transparent outline-none font-[500] text-[14px] text-[var(--ink)] placeholder-[var(--ink-muted)]"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="email" className="text-[13px] font-[600] text-[var(--ink-muted)]">
                        Work email <span className="text-red-500">*</span>
                      </label>
                      <div className="border border-[var(--line)] bg-white rounded-xl px-3 py-2 focus-within:border-[var(--ember)] focus-within:ring-2 focus-within:ring-[var(--ember-glow)] transition-all">
                        <input
                          id="email"
                          name="email"
                          type="email"
                          required
                          value={form.email}
                          onChange={handleChange}
                          placeholder="jane@agency.com"
                          className="w-full bg-transparent outline-none font-[500] text-[14px] text-[var(--ink)] placeholder-[var(--ink-muted)]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="company" className="text-[13px] font-[600] text-[var(--ink-muted)]">
                      Company <span className="text-red-500">*</span>
                    </label>
                    <div className="border border-[var(--line)] bg-white rounded-xl px-3 py-2 focus-within:border-[var(--ember)] focus-within:ring-2 focus-within:ring-[var(--ember-glow)] transition-all">
                      <input
                        id="company"
                        name="company"
                        required
                        value={form.company}
                        onChange={handleChange}
                        placeholder="Acme Corp"
                        className="w-full bg-transparent outline-none font-[500] text-[14px] text-[var(--ink)] placeholder-[var(--ink-muted)]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="sessionTool" className="text-[13px] font-[600] text-[var(--ink-muted)]">
                      Current session recording tool
                    </label>
                    <div className="border border-[var(--line)] bg-white rounded-xl px-3 py-2 focus-within:border-[var(--ember)] focus-within:ring-2 focus-within:ring-[var(--ember-glow)] transition-all relative">
                      <select
                        id="sessionTool"
                        name="sessionTool"
                        value={form.sessionTool}
                        onChange={handleChange}
                        className="w-full bg-transparent outline-none font-[500] text-[14px] text-[var(--ink)] appearance-none"
                      >
                        <option value="">Select tool</option>
                        <option value="fullstory">FullStory</option>
                        <option value="posthog">PostHog</option>
                        <option value="datadog">Datadog RUM</option>
                        <option value="other">Other</option>
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 text-[var(--ink)]">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="message" className="text-[13px] font-[600] text-[var(--ink-muted)]">
                      Message <span className="text-red-500">*</span>
                    </label>
                    <div className="border border-[var(--line)] bg-white rounded-xl px-3 py-2 focus-within:border-[var(--ember)] focus-within:ring-2 focus-within:ring-[var(--ember-glow)] transition-all">
                      <textarea
                        id="message"
                        name="message"
                        required
                        rows={4}
                        value={form.message}
                        onChange={handleChange}
                        placeholder="Any specific paths or friction points you want to focus on?"
                        className="w-full bg-transparent outline-none font-[500] text-[14px] text-[var(--ink)] placeholder-[var(--ink-muted)] resize-none mt-1"
                      />
                    </div>
                  </div>

                  {status === "error" && error && (
                    <p className="text-sm font-medium text-red-500">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="btn btn--ember w-full justify-center mt-6 py-[14px]"
                  >
                    <Send className="h-4 w-4" />
                    {status === "sending" ? "Sending…" : "Send message"}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
