import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Users, Star, Trophy, ArrowRight, Sparkles,
  GraduationCap, Target, Zap, Globe, CheckCircle2, TrendingUp,
  PlayCircle, Code, ShieldCheck, Flame, BarChart3, Layers,
  Terminal, Search, Cpu, Check, ExternalLink, Award, ArrowUpRight,
  ChevronRight, Compass, RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/* ─── Animation variants ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};
const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

function InViewSection({ children, className = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  return (
    <motion.div
      ref={ref}
      variants={stagger}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Search input state
  const [heroSearch, setHeroSearch] = useState('');
  
  // Interactive sandbox state
  const [activeSandboxTab, setActiveSandboxTab] = useState('code');
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [codeOutput, setCodeOutput] = useState(null);

  // Career tracks tab state
  const [selectedTrack, setSelectedTrack] = useState('ai');

  const handleHeroSearchSubmit = (e) => {
    e.preventDefault();
    if (heroSearch.trim()) {
      navigate(`/courses?search=${encodeURIComponent(heroSearch.trim())}`);
    } else {
      navigate('/courses');
    }
  };

  const runCodeSimulation = () => {
    setIsRunningCode(true);
    setCodeOutput(null);
    setTimeout(() => {
      setIsRunningCode(false);
      setCodeOutput({
        status: 'success',
        duration: '14ms',
        memory: '3.8 MB',
        passed: '4/4 assertions passed',
        points: '+50 SkillPoints awarded',
      });
    }, 900);
  };

  const trendingTopics = [
    'TypeScript 5.6', 'Next.js 15 & React 19', 'Distributed Systems (Go)',
    'Kubernetes SRE', 'LLM Agents & RAG', 'Rust Systems'
  ];

  const stats = [
    { value: '5,000+', label: 'Engineering Modules', icon: <BookOpen className="h-4 w-4 text-primary" /> },
    { value: '140,000+', label: 'Active Developers', icon: <Users className="h-4 w-4 text-cyan-500" /> },
    { value: '98.6%', label: 'Credential Verification', icon: <ShieldCheck className="h-4 w-4 text-emerald-500" /> },
    { value: '52M+', label: 'SkillPoints Distributed', icon: <Zap className="h-4 w-4 text-amber-500" /> },
  ];

  const careerTracks = {
    ai: {
      title: 'AI & LLM Systems Engineer',
      badge: 'Highest Demand',
      description: 'Master transformer architectures, autonomous agent workflows, fine-tuning open models, and high-throughput vector retrieval pipelines.',
      timeline: '12-16 Weeks',
      salary: '$165,000 – $240,000',
      enrolled: '14,200+ Engineers',
      modules: ['Transformer Math & PyTorch', 'LangGraph & Multi-Agent Swarms', 'vLLM Inference & Quantization', 'Enterprise RAG Architectures'],
      searchQuery: 'AI',
    },
    cloud: {
      title: 'Cloud Native & SRE Architect',
      badge: 'Core Infrastructure',
      description: 'Design zero-downtime distributed systems across multi-region Kubernetes clusters, service meshes, and GitOps pipelines.',
      timeline: '10-14 Weeks',
      salary: '$150,000 – $215,000',
      enrolled: '11,800+ Engineers',
      modules: ['Kubernetes Internals & CNI', 'Terraform & Infrastructure-as-Code', 'Prometheus & OpenTelemetry', 'Chaos Engineering at Scale'],
      searchQuery: 'Cloud',
    },
    fullstack: {
      title: 'Full-Stack Software Architect',
      badge: 'Product Engineering',
      description: 'End-to-end modern full-stack development with React 19 Server Components, distributed event streams, and real-time WebSocket systems.',
      timeline: '8-12 Weeks',
      salary: '$140,000 – $195,000',
      enrolled: '22,400+ Engineers',
      modules: ['React 19 & Next.js App Router', 'Node.js & Go Microservices', 'PostgreSQL Query Optimization', 'Distributed Cache (Redis/Kafka)'],
      searchQuery: 'React',
    },
    systems: {
      title: 'High-Performance Systems & Web3',
      badge: 'Advanced Systems',
      description: 'Write ultra-low-latency code in Rust and Go. Construct verifiable cryptographic smart contracts and decentralized protocols.',
      timeline: '12-18 Weeks',
      salary: '$170,000 – $260,000',
      enrolled: '9,500+ Engineers',
      modules: ['Rust Memory Safety & Async', 'Cryptographic Primitives', 'Solidity & EVM Bytecode', 'High-Frequency Matching Engines'],
      searchQuery: 'Web3',
    },
  };

  const partnerLogos = [
    'Google Cloud', 'Microsoft Azure', 'Stripe', 'AWS', 'Meta Open Source', 'Netflix', 'OpenAI', 'Vercel'
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ════════════════════════════════════════
          1. HERO SECTION (CYBER OBSIDIAN / COBALT)
          ════════════════════════════════════════ */}
      <section className="relative pt-24 pb-20 md:pt-32 md:pb-28 overflow-hidden border-b border-border/60">
        {/* Subtle Ambient Radial Lighting */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[450px] bg-primary/10 rounded-full blur-[140px]" />
          <div className="absolute top-1/3 -right-40 w-[450px] h-[450px] bg-cyan-500/8 rounded-full blur-[120px]" />
          {/* Micro dot grid */}
          <div
            className="absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage: `radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)`,
              backgroundSize: '24px 24px',
            }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">

            {/* Version Badge */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border bg-card/80 backdrop-blur-md text-xs font-semibold text-muted-foreground mb-8 shadow-sm hover:border-primary/40 transition-colors cursor-default"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="text-foreground font-bold">SkillVerse v2.4</span>
              <span className="text-muted-foreground/50">•</span>
              <span>Next-Gen Decentralized Developer Curriculum</span>
            </motion.div>

            {/* Main Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08 }}
              className="font-display text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] mb-6"
            >
              Architect Your Future.{' '}
              <br className="hidden sm:inline" />
              <span className="text-gradient-cobalt">Master Modern Engineering.</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16 }}
              className="text-base sm:text-xl text-muted-foreground max-w-2xl leading-relaxed mb-10"
            >
              The premier developer platform featuring interactive cloud sandboxes, tamper-proof blockchain credentials, and a tokenized SkillPoints economy.
            </motion.p>

            {/* ── Instant Search Bar ── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.22 }}
              className="w-full max-w-2xl mb-6"
            >
              <form onSubmit={handleHeroSearchSubmit} className="relative flex items-center">
                <Search className="absolute left-4 w-5 h-5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={heroSearch}
                  onChange={(e) => setHeroSearch(e.target.value)}
                  placeholder="Search 5,000+ developer courses, frameworks, or certifications..."
                  className="w-full pl-12 pr-28 py-3.5 rounded-2xl bg-card/90 border border-border shadow-lg shadow-black/5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 backdrop-blur-xl transition-all"
                />
                <button
                  type="submit"
                  className="btn-primary absolute right-2 !py-2 !px-4 text-xs font-semibold !rounded-xl"
                >
                  Explore
                </button>
              </form>

              {/* Trending Topic Pills */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                <span className="text-xs font-medium text-muted-foreground mr-1">Trending:</span>
                {trendingTopics.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => navigate(`/courses?search=${encodeURIComponent(topic.split(' ')[0])}`)}
                    className="px-2.5 py-1 rounded-lg bg-secondary/60 hover:bg-primary/10 hover:text-primary hover:border-primary/30 border border-border/80 text-xs text-muted-foreground transition-all duration-150"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.28 }}
              className="flex flex-col sm:flex-row gap-3.5 items-center justify-center mt-2 mb-16"
            >
              <Link to="/courses">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-primary text-sm !px-7 !py-3.5 gap-2 !rounded-xl shadow-md shadow-primary/20"
                >
                  <PlayCircle className="w-4 h-4" />
                  <span>Browse Full Curriculum</span>
                </motion.button>
              </Link>
              {!isAuthenticated && (
                <Link to="/register">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn-secondary text-sm !px-6 !py-3.5 gap-2 !rounded-xl"
                  >
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span>Claim 500 SkillPoints Free</span>
                  </motion.button>
                </Link>
              )}
            </motion.div>

            {/* ════════════════════════════════════════
                INTERACTIVE HERO SANDBOX SHOWCASE WIDGET
                ════════════════════════════════════════ */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="w-full max-w-4xl rounded-2xl border border-border bg-card/90 backdrop-blur-2xl shadow-2xl overflow-hidden text-left"
            >
              {/* Window Header */}
              <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-border bg-muted/40 gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/70" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/70" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground ml-2">skillverse-cloud-env</span>
                </div>

                {/* Tab Switcher */}
                <div className="flex items-center gap-1 bg-secondary/80 p-1 rounded-xl border border-border text-xs">
                  <button
                    onClick={() => setActiveSandboxTab('code')}
                    className={`px-3 py-1 rounded-lg font-medium transition-all ${
                      activeSandboxTab === 'code'
                        ? 'bg-card text-foreground shadow-sm font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Code Lab
                  </button>
                  <button
                    onClick={() => setActiveSandboxTab('points')}
                    className={`px-3 py-1 rounded-lg font-medium transition-all ${
                      activeSandboxTab === 'points'
                        ? 'bg-card text-foreground shadow-sm font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    SkillPoints Yield
                  </button>
                  <button
                    onClick={() => setActiveSandboxTab('cert')}
                    className={`px-3 py-1 rounded-lg font-medium transition-all ${
                      activeSandboxTab === 'cert'
                        ? 'bg-card text-foreground shadow-sm font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    On-Chain Cert
                  </button>
                </div>
              </div>

              {/* Window Body */}
              <div className="p-5 sm:p-6 font-mono text-xs">
                {activeSandboxTab === 'code' && (
                  <div>
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-border text-muted-foreground text-[11px]">
                      <span className="flex items-center gap-1.5 text-primary">
                        <Code className="w-3.5 h-3.5" />
                        <span>rate_limiter.go (Distributed Token Bucket)</span>
                      </span>
                      <button
                        onClick={runCodeSimulation}
                        disabled={isRunningCode}
                        className="btn-primary !py-1.5 !px-3 text-xs gap-1.5 !rounded-lg"
                      >
                        {isRunningCode ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>Compiling...</span>
                          </>
                        ) : (
                          <>
                            <PlayCircle className="w-3.5 h-3.5" />
                            <span>Run Sandbox</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Code Lines */}
                    <pre className="text-muted-foreground overflow-x-auto leading-relaxed text-[11px] sm:text-xs">
                      <code>
                        <span className="text-primary">package</span> main{'\n\n'}
                        <span className="text-muted-foreground/60">// SkillVerse Lab #402: High-throughput token bucket</span>{'\n'}
                        <span className="text-primary">func</span> <span className="text-cyan-400">TakeToken</span>(ctx context.Context, bucket <span className="text-emerald-400">*RedisCluster</span>) <span className="text-amber-400">bool</span> {'{\n'}
                        {'  '}currentTokens, err := bucket.Eval(ctx, luaRateLimiterScript, []<span className="text-amber-400">string</span>&#123;<span className="text-emerald-300">"user:req"</span>&#125;){'\n'}
                        {'  '}<span className="text-primary">return</span> err == nil && currentTokens &gt; 0{'\n'}
                        &#125;
                      </code>
                    </pre>

                    {/* Live Output Banner */}
                    {codeOutput && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="font-semibold">{codeOutput.passed}</span>
                          <span className="text-muted-foreground/60">({codeOutput.duration} • {codeOutput.memory})</span>
                        </div>
                        <span className="bg-emerald-500/20 px-2 py-0.5 rounded font-bold text-[11px]">
                          {codeOutput.points}
                        </span>
                      </motion.div>
                    )}
                  </div>
                )}

                {activeSandboxTab === 'points' && (
                  <div className="space-y-4 font-sans text-sm">
                    <div className="flex items-center justify-between pb-3 border-b border-border">
                      <span className="font-semibold text-foreground">Decentralized SkillPoints Yield Calculator</span>
                      <span className="text-xs text-amber-500 font-mono font-bold">Base Multiplier: 1.85x</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3.5 rounded-xl bg-secondary/50 border border-border">
                        <div className="text-xs text-muted-foreground mb-1">Daily Streak Bonus</div>
                        <div className="text-xl font-bold font-display text-foreground">7 Days</div>
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">+25% XP multiplier</div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-secondary/50 border border-border">
                        <div className="text-xs text-muted-foreground mb-1">Lab Code Passes</div>
                        <div className="text-xl font-bold font-display text-foreground">12 Labs</div>
                        <div className="text-xs text-primary mt-1">600 Base SkillPoints</div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-secondary/50 border border-border">
                        <div className="text-xs text-muted-foreground mb-1">Redemption Power</div>
                        <div className="text-xl font-bold font-display text-foreground">1,250 pts</div>
                        <div className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">Unlocks Verified Cert</div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      SkillPoints are earned by completing interactive labs and passed tests. Reinvest them directly into premium masterclasses or verified certifications.
                    </p>
                  </div>
                )}

                {activeSandboxTab === 'cert' && (
                  <div className="space-y-4 font-sans text-sm">
                    <div className="flex items-center justify-between pb-3 border-b border-border">
                      <span className="font-semibold text-foreground">Tamper-Proof Cryptographic Verification</span>
                      <span className="badge-teal text-[11px]">ERC-721 Compatible</span>
                    </div>
                    <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-xs font-mono text-muted-foreground">CERTIFICATE ID: SKV-8942-0X</div>
                        <div className="font-display font-bold text-foreground text-base">Advanced Cloud Distributed Systems</div>
                        <div className="text-xs text-muted-foreground">Recipient: Kanav T. • Issued on Polygon Ledger</div>
                      </div>
                      <Link
                        to="/verify/SKV-DEMO"
                        className="btn-outline !py-1.5 !px-3 text-xs gap-1.5 shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Verify On-Chain</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          2. ENTERPRISE PARTNER & TRUST MARQUEE
          ════════════════════════════════════════ */}
      <section className="py-8 border-b border-border/60 bg-secondary/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-6">
            Engineers & builders from leading organizations learn on SkillVerse
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-12 opacity-70 hover:opacity-100 transition-opacity">
            {partnerLogos.map((name) => (
              <span
                key={name}
                className="font-display font-bold text-sm sm:text-base text-muted-foreground hover:text-foreground transition-colors tracking-tight"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          3. PLATFORM CORE METRICS
          ════════════════════════════════════════ */}
      <section className="py-16 border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <InViewSection>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((stat, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  className="card-base p-6 rounded-2xl hover:border-primary/40 transition-all duration-200"
                >
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2">
                    {stat.icon}
                    <span>{stat.label}</span>
                  </div>
                  <div className="font-display text-3xl sm:text-4xl font-black text-foreground">
                    {stat.value}
                  </div>
                </motion.div>
              ))}
            </div>
          </InViewSection>
        </div>
      </section>

      {/* ════════════════════════════════════════
          4. BENTO GRID: "ENGINEERED FOR MASTERY"
          ════════════════════════════════════════ */}
      <section id="features" className="py-24 border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <InViewSection className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-4">
              <Cpu className="w-3.5 h-3.5" />
              <span>Platform Capabilities</span>
            </div>
            <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
              Engineered for absolute mastery.
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
              Every feature is built around the modern software engineering lifecycle: practical code execution, verifiable achievement, and continuous retention.
            </p>
          </InViewSection>

          <InViewSection>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Bento Card 1: 2-col Adaptive AI Engine */}
              <motion.div
                variants={fadeUp}
                className="md:col-span-2 card-base rounded-2xl p-8 hover:border-primary/40 transition-all relative overflow-hidden"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <span className="badge-teal">Adaptive Engine</span>
                </div>
                <h3 className="font-display text-2xl font-bold text-foreground mb-2">
                  Personalized AI Code & Architecture Paths
                </h3>
                <p className="text-sm text-muted-foreground max-w-xl leading-relaxed mb-6">
                  SkillVerse continuously benchmarks your code quality, algorithm efficiency, and architecture decisions to assemble custom curriculum modules in real time.
                </p>

                {/* Visual Roadmap Pill Stream */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-secondary/50 border border-border">
                    <div className="text-muted-foreground text-[10px]">STEP 01</div>
                    <div className="font-bold text-foreground mt-1">Diagnostic</div>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/50 border border-border">
                    <div className="text-muted-foreground text-[10px]">STEP 02</div>
                    <div className="font-bold text-foreground mt-1">Cloud Labs</div>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/50 border border-border">
                    <div className="text-muted-foreground text-[10px]">STEP 03</div>
                    <div className="font-bold text-foreground mt-1">Code Review</div>
                  </div>
                  <div className="p-3 rounded-xl bg-primary/10 border border-primary/25">
                    <div className="text-primary text-[10px]">STEP 04</div>
                    <div className="font-bold text-primary mt-1">On-Chain Cert</div>
                  </div>
                </div>
              </motion.div>

              {/* Bento Card 2: 1-col Proof-of-Skill */}
              <motion.div
                variants={fadeUp}
                className="card-base rounded-2xl p-8 hover:border-primary/40 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mb-4">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground mb-2">
                  Verifiable Credentials
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Cryptographically signed certificates that employers and hiring partners can verify on-chain in milliseconds.
                </p>
                <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                  <span>Zero fraud guarantee</span>
                  <Check className="w-4 h-4 text-emerald-500" />
                </div>
              </motion.div>

              {/* Bento Card 3: 1-col Zero Friction Sandboxes */}
              <motion.div
                variants={fadeUp}
                className="card-base rounded-2xl p-8 hover:border-primary/40 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 mb-4">
                  <Terminal className="w-5 h-5" />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground mb-2">
                  Zero-Config Sandboxes
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Spin up instant cloud execution environments for Go, TypeScript, Python, and Rust straight inside your browser.
                </p>
                <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                  <span>No Docker setup needed</span>
                  <Check className="w-4 h-4 text-cyan-500" />
                </div>
              </motion.div>

              {/* Bento Card 4: 2-col SkillPoints Economy */}
              <motion.div
                variants={fadeUp}
                className="md:col-span-2 card-base rounded-2xl p-8 hover:border-primary/40 transition-all relative overflow-hidden"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                    <Zap className="w-5 h-5" />
                  </div>
                  <span className="badge-amber">Points Economy</span>
                </div>
                <h3 className="font-display text-2xl font-bold text-foreground mb-2">
                  Tokenized SkillPoints & Daily Retention
                </h3>
                <p className="text-sm text-muted-foreground max-w-xl leading-relaxed mb-6">
                  Learn, code, pass automated test suites, and earn SkillPoints. Use points to unlock exclusive masterclasses, redeem premium tracks, or mint tamper-proof diplomas.
                </p>

                <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <Flame className="w-4 h-4 text-amber-500" />
                    Daily Streak Multiplier
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5 text-foreground">
                    <Trophy className="w-4 h-4 text-primary" />
                    Global Developer Leaderboard
                  </span>
                </div>
              </motion.div>

            </div>
          </InViewSection>
        </div>
      </section>

      {/* ════════════════════════════════════════
          5. CAREER PATHS & CURRICULUM EXPLORER
          ════════════════════════════════════════ */}
      <section id="paths" className="py-24 border-b border-border/60 bg-secondary/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <InViewSection className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-4">
              <Compass className="w-3.5 h-3.5" />
              <span>Structured Career Pathways</span>
            </div>
            <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
              Fast-track your engineering trajectory.
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
              Curated, production-tested roadmaps designed with leading engineering directors to take you from practitioner to staff-level mastery.
            </p>

            {/* Track Selector Tabs */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
              {Object.entries(careerTracks).map(([key, track]) => (
                <button
                  key={key}
                  onClick={() => setSelectedTrack(key)}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                    selectedTrack === key
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                      : 'bg-card text-muted-foreground hover:text-foreground border border-border'
                  }`}
                >
                  {track.title.split(' ')[0]} {track.title.split(' ')[1]}
                </button>
              ))}
            </div>
          </InViewSection>

          {/* Active Track Showcase Card */}
          <InViewSection>
            <motion.div
              key={selectedTrack}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="card-base rounded-3xl p-8 sm:p-10 border border-border shadow-xl max-w-5xl mx-auto"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-8 border-b border-border">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="badge-teal">{careerTracks[selectedTrack].badge}</span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {careerTracks[selectedTrack].enrolled}
                    </span>
                  </div>
                  <h3 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                    {careerTracks[selectedTrack].title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
                    {careerTracks[selectedTrack].description}
                  </p>
                </div>

                <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground uppercase font-semibold">Compensation Benchmark</div>
                    <div className="font-display text-xl sm:text-2xl font-bold text-foreground">
                      {careerTracks[selectedTrack].salary}
                    </div>
                  </div>
                  <Link to={`/courses?search=${careerTracks[selectedTrack].searchQuery}`}>
                    <button className="btn-primary text-xs sm:text-sm !py-2.5 !px-5 gap-1.5">
                      <span>Explore Track</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </Link>
                </div>
              </div>

              {/* Modules breakdown */}
              <div className="pt-8">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  Key Production Modules Covered:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {careerTracks[selectedTrack].modules.map((mod, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl bg-secondary/50 border border-border flex items-start gap-2.5"
                    >
                      <div className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                        {i + 1}
                      </div>
                      <span className="text-xs font-semibold text-foreground leading-snug">{mod}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </InViewSection>
        </div>
      </section>

      {/* ════════════════════════════════════════
          6. LIVE PLATFORM ACTIVITY TICKER
          ════════════════════════════════════════ */}
      <section className="py-6 border-b border-border/60 bg-card/60 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0 text-xs font-bold text-primary">
            <Flame className="w-4 h-4 text-amber-500" />
            <span>LIVE MILESTONES</span>
            <div className="h-4 w-px bg-border ml-2" />
          </div>

          <div className="overflow-x-auto no-scrollbar flex items-center gap-8 text-xs text-muted-foreground whitespace-nowrap">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <strong className="text-foreground">Alex M.</strong> passed "Distributed Consensus in Raft"
              <span className="text-amber-500 font-semibold">(+120 pts)</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-primary" />
              <strong className="text-foreground">Sarah K.</strong> achieved Diamond Tier rank
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-500" />
              <strong className="text-foreground">David R.</strong> minted Verified Certificate #SKV-8910
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <strong className="text-foreground">Elena V.</strong> reached 30-Day Code Streak
            </span>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          7. VERIFIED REVIEWS & SOCIAL PROOF
          ════════════════════════════════════════ */}
      <section className="py-24 border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <InViewSection className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-4">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>Verified Testimonials</span>
            </div>
            <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
              Validated by practicing tech leaders.
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
              Read how software architects and senior engineers elevate their production skills on SkillVerse.
            </p>
          </InViewSection>

          <InViewSection>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  quote: "SkillVerse is on a completely different level compared to standard video course sites. The real-time cloud labs and instant test assertions make mastering distributed systems intuitive.",
                  author: "Elena Rostova",
                  role: "Staff Infrastructure Engineer",
                  company: "Fintech Cloud Systems",
                  course: "Distributed Go Microservices",
                },
                {
                  quote: "The blockchain verification for credentials actually carries weight with engineering directors. It proved my proficiency in Kubernetes SRE during my recent team transition.",
                  author: "Marcus Vance",
                  role: "Senior Cloud Architect",
                  company: "SaaS Scaleups",
                  course: "Production Kubernetes & Service Mesh",
                },
                {
                  quote: "The SkillPoints incentive keeps you genuinely locked in. Passing quizzes and challenges to accumulate yield for advanced masterclasses makes learning feel exhilarating.",
                  author: "Priya Sharma",
                  role: "Principal AI Engineer",
                  company: "Enterprise AI Labs",
                  course: "LLM Autonomous Systems & RAG",
                },
              ].map((rev, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  className="card-base rounded-2xl p-7 flex flex-col justify-between hover:border-primary/40 transition-all"
                >
                  <div>
                    <div className="flex gap-1 mb-4">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className="w-4 h-4 text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed mb-6 italic">
                      "{rev.quote}"
                    </p>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <div className="font-semibold text-foreground text-sm">{rev.author}</div>
                    <div className="text-xs text-muted-foreground">{rev.role} • {rev.company}</div>
                    <div className="inline-flex items-center gap-1 text-[11px] text-primary mt-2 font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Verified: {rev.course}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </InViewSection>
        </div>
      </section>

      {/* ════════════════════════════════════════
          8. MODERN BOTTOM EXECUTIVE CTA BANNER
          ════════════════════════════════════════ */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <InViewSection>
            <motion.div
              variants={fadeUp}
              className="relative rounded-3xl overflow-hidden p-10 sm:p-16 text-center border border-border bg-gradient-to-b from-card via-card to-secondary/40 shadow-2xl"
            >
              {/* Subtle top glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-primary/15 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-2xl mx-auto">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-6">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Start Your Apprenticeship Today</span>
                </div>

                <h2 className="font-display text-3xl sm:text-5xl font-extrabold text-foreground mb-6 tracking-tight">
                  Ready to architect your mastery?
                </h2>
                <p className="text-muted-foreground text-base sm:text-lg mb-8 leading-relaxed">
                  Join 140,000+ developers leveling up their technical depth. Enroll for free and claim your 500 initial SkillPoints immediately.
                </p>

                <div className="flex flex-col sm:flex-row gap-3.5 justify-center items-center">
                  <Link to={isAuthenticated ? '/courses' : '/register'}>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="btn-primary text-base !px-8 !py-3.5 gap-2 !rounded-xl shadow-lg shadow-primary/25"
                    >
                      <span>{isAuthenticated ? 'Go to Learning Hub' : 'Get Started Free'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </motion.button>
                  </Link>
                  <Link to="/courses">
                    <button className="btn-ghost text-base !px-6 !py-3.5 text-muted-foreground hover:text-foreground">
                      Browse All Modules
                    </button>
                  </Link>
                </div>

                <div className="flex items-center justify-center gap-6 mt-8 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    No credit card required
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    Instant sandbox access
                  </span>
                </div>
              </div>
            </motion.div>
          </InViewSection>
        </div>
      </section>

    </div>
  );
}
