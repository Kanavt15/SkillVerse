import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, ShieldCheck, Zap, Globe, Github,
  Twitter, Linkedin, CheckCircle2, ArrowRight,
  ExternalLink, Heart, Sparkles, Send
} from 'lucide-react';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    setSubscribed(true);
    setEmail('');
  };

  return (
    <footer className="border-t border-border bg-card/60 backdrop-blur-xl transition-colors">
      {/* ── Top Highlight Bar: Newsletter & Live Status ── */}
      <div className="border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>SkillVerse Engineering Pulse</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold font-display text-foreground tracking-tight">
                Stay ahead of the developer curve.
              </h3>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Join 120,000+ engineers receiving curated deep-dives into AI engineering, system architecture, and high-yield SkillPoint drops every Tuesday.
              </p>
            </div>

            {/* Newsletter form */}
            <div className="w-full lg:w-auto min-w-[320px] sm:min-w-[380px]">
              {subscribed ? (
                <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>You're in! Check your inbox for your first starter drop.</span>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your work email..."
                    required
                    className="input-styled text-sm !py-2.5 flex-1"
                  />
                  <button
                    type="submit"
                    className="btn-primary !py-2.5 !px-5 text-sm shrink-0 gap-1.5 shadow-sm"
                  >
                    <span>Subscribe</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
              <p className="text-[11px] text-muted-foreground/70 mt-2">
                Zero spam. One-click unsubscribe at any time. Verified developer community.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Navigation Columns ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12">

          {/* Col 1: Brand & Mission */}
          <div className="col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white shadow-md shadow-primary/25 group-hover:scale-105 transition-transform">
                <BookOpen className="h-4.5 w-4.5" />
              </div>
              <span className="text-xl font-bold font-display tracking-tight text-foreground">
                Skill<span className="text-primary">Verse</span>
              </span>
            </Link>

            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              The professional decentralized learning platform engineered for continuous developer excellence. Master modern stacks, earn cryptographic credentials, and scale your career.
            </p>

            {/* System Status Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/80 border border-border text-xs font-mono text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>All Systems Operational</span>
              <span className="text-muted-foreground/40">•</span>
              <span className="text-[11px]">99.98% SLA</span>
            </div>
          </div>

          {/* Col 2: Learning Tracks */}
          <div>
            <h4 className="text-xs font-semibold text-foreground tracking-wider uppercase mb-4">
              Curriculum Tracks
            </h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link to="/courses?search=AI" className="hover:text-foreground transition-colors flex items-center gap-1 group">
                  <span>AI & Machine Learning</span>
                </Link>
              </li>
              <li>
                <Link to="/courses?search=React" className="hover:text-foreground transition-colors">
                  Full-Stack Architecture
                </Link>
              </li>
              <li>
                <Link to="/courses?search=Cloud" className="hover:text-foreground transition-colors">
                  Cloud & Kubernetes SRE
                </Link>
              </li>
              <li>
                <Link to="/courses?search=Security" className="hover:text-foreground transition-colors">
                  Systems Security & Rust
                </Link>
              </li>
              <li>
                <Link to="/courses?search=Web3" className="hover:text-foreground transition-colors">
                  Decentralized Protocols
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Platform Features */}
          <div>
            <h4 className="text-xs font-semibold text-foreground tracking-wider uppercase mb-4">
              Platform
            </h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link to="/courses" className="hover:text-foreground transition-colors">
                  Browse Catalog
                </Link>
              </li>
              <li>
                <Link to="/profile" className="hover:text-foreground transition-colors flex items-center gap-1.5">
                  <span>SkillPoints Economy</span>
                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">2.0</span>
                </Link>
              </li>
              <li>
                <Link to="/instructor/dashboard" className="hover:text-foreground transition-colors">
                  Instructor Studio
                </Link>
              </li>
              <li>
                <Link to="/verify/SKV-DEMO" className="hover:text-foreground transition-colors">
                  Verify Credentials
                </Link>
              </li>
              <li>
                <Link to="/my-courses" className="hover:text-foreground transition-colors">
                  Learning Workspace
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Resources & Trust */}
          <div>
            <h4 className="text-xs font-semibold text-foreground tracking-wider uppercase mb-4">
              Enterprise & Docs
            </h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <a href="#features" className="hover:text-foreground transition-colors">
                  Architecture Overview
                </a>
              </li>
              <li>
                <a href="#paths" className="hover:text-foreground transition-colors">
                  Career Pathways
                </a>
              </li>
              <li>
                <span className="hover:text-foreground transition-colors cursor-pointer">
                  Verification API
                </span>
              </li>
              <li>
                <span className="hover:text-foreground transition-colors cursor-pointer">
                  Enterprise Licensing
                </span>
              </li>
              <li>
                <span className="hover:text-foreground transition-colors cursor-pointer">
                  Compliance & Security
                </span>
              </li>
            </ul>
          </div>

        </div>

        {/* ── Bottom Bar: Legal & Socials ── */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>© {new Date().getFullYear()} SkillVerse Technologies Inc.</span>
            <span>•</span>
            <span>All rights reserved.</span>
          </div>

          {/* Social Icons */}
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Github className="w-4 h-4" />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Twitter"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Twitter className="w-4 h-4" />
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noreferrer"
              aria-label="LinkedIn"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Linkedin className="w-4 h-4" />
            </a>
            <a
              href="#"
              aria-label="Global"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Globe className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
