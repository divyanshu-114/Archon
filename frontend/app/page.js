'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { motion, useScroll, useTransform } from 'framer-motion';
import styles from './page.module.css';

const GlobeScene = dynamic(() => import('@/components/GlobeScene'), { ssr: false });

const AGENTS = [
  { id: '01', name: 'Manager', role: 'Task Orchestration', desc: 'Parses your task, extracts company context, identifies target audience, and creates a structured content brief for the pipeline.' },
  { id: '02', name: 'Researcher', role: 'Web Intelligence', desc: 'Searches the web in real-time for industry trends, engagement strategies, and platform-specific content insights.' },
  { id: '03', name: 'Content Creator', role: 'Creative Writing', desc: 'Writes platform-optimized content using research insights. Markdown formatting, hooks, and CTAs — crafted for engagement.' },
  { id: '04', name: 'Critic', role: 'Quality Assurance', desc: 'Scores content on six criteria. Autonomously rejects anything below 7.5 and sends it back for revision. No human needed.' },
  { id: '05', name: 'Scheduler', role: 'Timing Strategy', desc: 'Analyzes platform engagement patterns and assigns each message an optimal posting time for maximum reach.' },
  { id: '06', name: 'Poster', role: 'API Integration', desc: 'Connects directly to platform APIs. Publishes approved content, handles formatting and rate limits automatically.' },
];

const PLATFORMS = [
  { name: 'Telegram', sub: 'Channels & Groups', status: 'live' },
  { name: 'Instagram', sub: 'Posts & Reels', status: 'soon' },
  { name: 'LinkedIn', sub: 'Professional Posts', status: 'soon' },
  { name: 'X / Twitter', sub: 'Tweets & Threads', status: 'soon' },
  { name: 'YouTube', sub: 'Community Posts', status: 'soon' },
];

const TECH = [
  { name: 'LangGraph', role: 'Agent Orchestration' },
  { name: 'Groq', role: 'LLM Inference (Llama 3.3)' },
  { name: 'Flask', role: 'Backend & API' },
  { name: 'Telegram Bot API', role: 'Publishing Layer' },
  { name: 'DuckDuckGo Search', role: 'Web Intelligence' },
  { name: 'Three.js', role: '3D Visualization' },
];

const STEPS = [
  { n: '01', title: 'Describe the Task', desc: '"Create 3 posts for our AI startup targeting small business owners in India"' },
  { n: '02', title: 'Agents Take Over', desc: 'Manager analyzes, Researcher searches the web, Creator writes, Critic reviews and rejects if below 7.5, Scheduler picks times.' },
  { n: '03', title: 'You Review & Approve', desc: 'Preview every message on the dashboard. Approve, reject, or regenerate with one click.' },
  { n: '04', title: 'Published Instantly', desc: 'Approved content goes live on your channel. Check your phone — it is already there.' },
];

export default function LandingPage() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const heroRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(window.scrollY / docHeight, 1) : 0;
      setScrollProgress(progress);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Smooth scroll nav
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      {/* ─── FLOATING MINI ROBOT CHARACTERS ─── */}
      <div className={styles.robotsOverlay}>
        {/* Robot 1: Runner (Researcher) */}
        <div className={`${styles.miniRobot} ${styles.robotRunner}`}>
          <div className={styles.robotBody}>
            <div className={styles.rHead}>
              <div className={`${styles.rEye} ${styles.rEyeL}`} />
              <div className={`${styles.rEye} ${styles.rEyeR}`} />
              <div className={styles.rAntenna} />
            </div>
            <div className={styles.rTorso} />
            <div className={`${styles.rLeg} ${styles.rLegL}`} />
            <div className={`${styles.rLeg} ${styles.rLegR}`} />
          </div>
          <div className={styles.rShadow} />
          <div className={styles.rLabel}>Researcher</div>
        </div>

        {/* Robot 2: Jumper (Creator) */}
        <div className={`${styles.miniRobot} ${styles.robotJumper}`}>
          <div className={styles.robotBody}>
            <div className={`${styles.rHead} ${styles.rHeadTeal}`}>
              <div className={`${styles.rEye} ${styles.rEyeL} ${styles.rEyeTeal}`} />
              <div className={`${styles.rEye} ${styles.rEyeR} ${styles.rEyeTeal}`} />
            </div>
            <div className={`${styles.rTorso} ${styles.rTorsoTeal}`} />
          </div>
          <div className={styles.rShadow} />
          <div className={styles.rLabel}>Creator</div>
        </div>

        {/* Robot 3: Waver (Critic) */}
        <div className={`${styles.miniRobot} ${styles.robotWaver}`}>
          <div className={styles.robotBody}>
            <div className={`${styles.rHead} ${styles.rHeadPink}`}>
              <div className={`${styles.rEye} ${styles.rEyeL} ${styles.rEyePink}`} />
              <div className={`${styles.rEye} ${styles.rEyeR} ${styles.rEyePink}`} />
            </div>
            <div className={`${styles.rTorso} ${styles.rTorsoPink}`} />
            <div className={`${styles.rArm} ${styles.rArmWave}`} />
          </div>
          <div className={styles.rShadow} />
          <div className={styles.rLabel}>Critic</div>
        </div>

        {/* Robot 4: Dancer (Scheduler) */}
        <div className={`${styles.miniRobot} ${styles.robotDancer}`}>
          <div className={styles.robotBody}>
            <div className={`${styles.rHead} ${styles.rHeadAmber}`}>
              <div className={`${styles.rEye} ${styles.rEyeL} ${styles.rEyeAmber}`} />
              <div className={`${styles.rEye} ${styles.rEyeR} ${styles.rEyeAmber}`} />
              <div className={`${styles.rAntenna} ${styles.rAntennaAmber}`} />
            </div>
            <div className={`${styles.rTorso} ${styles.rTorsoAmber}`} />
            <div className={`${styles.rLeg} ${styles.rLegL} ${styles.rLegKick}`} />
            <div className={`${styles.rLeg} ${styles.rLegR}`} />
          </div>
          <div className={styles.rShadow} />
          <div className={styles.rLabel}>Scheduler</div>
        </div>

        {/* Robot 5: Floater (Manager) */}
        <div className={`${styles.miniRobot} ${styles.robotFloater}`}>
          <div className={styles.robotBody}>
            <div className={`${styles.rHead} ${styles.rHeadGreen}`}>
              <div className={`${styles.rEye} ${styles.rEyeL} ${styles.rEyeGreen} ${styles.rEyeBig}`} />
              <div className={`${styles.rEye} ${styles.rEyeR} ${styles.rEyeGreen} ${styles.rEyeBig}`} />
            </div>
            <div className={`${styles.rTorso} ${styles.rTorsoGreen}`} />
            <div className={styles.rJetpack} />
          </div>
          <div className={`${styles.rShadow} ${styles.rShadowSm}`} />
          <div className={styles.rLabel}>Manager</div>
        </div>
      </div>

      {/* ─── NAV ─── */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <a href="#" className={styles.navLogo}>
            <div className={styles.logoMark}>
              <div className={styles.logoRing} />
              <div className={styles.logoCore}>U</div>
            </div>
            <span className={styles.logoText}>ARCHON</span>
          </a>
          <div className={styles.navLinks}>
            <button onClick={() => scrollTo('about')} className={styles.navLink}>About</button>
            <button onClick={() => scrollTo('agents')} className={styles.navLink}>Agents</button>
            <button onClick={() => scrollTo('platforms')} className={styles.navLink}>Platforms</button>
            <button onClick={() => scrollTo('workflow')} className={styles.navLink}>Workflow</button>
            <button onClick={() => scrollTo('contact')} className={styles.navLink}>Contact</button>
          </div>
          <a href={process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://127.0.0.1:5000/dashboard"} className={styles.navCta}>Launch Dashboard</a>
        </div>
      </nav>

      {/* ─── FIXED 3D EARTH BACKGROUND ─── */}
      <div className={styles.earthBg}>
        <GlobeScene />
      </div>

      {/* ─── HERO ─── */}
      <section className={styles.hero} ref={heroRef}>
        <div className={styles.heroContent}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className={styles.heroBadge}
          >
            <span className={styles.badgeDot} />
            MULTI-AGENT AI SYSTEM
          </motion.div>

          <motion.h1
            className={styles.heroTitle}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            Your Autonomous<br />
            <span className="gradient-text">AI Digital Agency</span>
          </motion.h1>

          <motion.p
            className={styles.heroSubtitle}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.8 }}
          >
            Six AI agents that <span className={styles.highlight}>research</span>,{' '}
            <span className={styles.highlight}>create</span>,{' '}
            <span className={styles.highlight}>review</span>,{' '}
            <span className={styles.highlight}>schedule</span>, and{' '}
            <span className={styles.highlight}>publish</span> content — autonomously.{' '}
            <strong className={styles.heroStrong}>One task in, polished content out.</strong>{' '}
            No prompting loops. No copy-pasting.{' '}
            <strong className={styles.heroStrong}>Just results.</strong>
          </motion.p>

          <motion.div
            className={styles.heroActions}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
          >
            <a href={process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://127.0.0.1:5000/dashboard"} className={styles.btnPrimary}>
              <span>Get Started</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <button onClick={() => scrollTo('workflow')} className={styles.btnSecondary}>
              See How It Works
            </button>
          </motion.div>

          <motion.div
            className={styles.heroStats}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.3, duration: 0.8 }}
          >
            <div className={styles.stat}>
              <span className={styles.statValue}>6</span>
              <span className={styles.statLabel}>AI AGENTS</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>5+</span>
              <span className={styles.statLabel}>PLATFORMS</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>&infin;</span>
              <span className={styles.statLabel}>CONTENT IDEAS</span>
            </div>
          </motion.div>
        </div>

        <div className={styles.scrollIndicator}>
          <span>Scroll to explore</span>
          <div className={styles.scrollLine} />
        </div>
      </section>

      <div className={styles.sectionDivider} />

      {/* ─── ABOUT ─── */}
      <section className={styles.section} id="about">
        <div className={styles.sectionInner}>
          <span className={styles.sectionBadge}>WHAT IS ARCHON</span>
          <h2 className={styles.sectionTitle}>
            Not Just Another AI Tool.<br />
            <span className="gradient-text">An Entire Agency.</span>
          </h2>
          <p className={styles.sectionDesc}>
            Unlike single-model AI tools where you prompt, copy, and paste — ARCHON deploys a team of specialized agents
            that collaborate through a state machine. They research your industry, craft platform-optimized content,
            self-correct through quality reviews, and publish directly to your channels.
          </p>
          <div className={styles.aboutGrid}>
            {[
              { title: 'Multi-Agent Intelligence', desc: 'Six specialized agents collaborate through LangGraph — each one an expert in their domain. Not one model doing everything; a team doing it right.' },
              { title: 'Self-Correcting Pipeline', desc: 'The Critic agent evaluates all content and autonomously rejects anything below quality standards. Content gets rewritten until it meets the bar.' },
              { title: 'End-to-End Execution', desc: 'From task description to published post in under 30 seconds. Research, write, review, schedule, publish — all automatic.' },
              { title: 'Human-in-the-Loop', desc: 'Nothing goes live without your approval. Review every message, approve or reject or regenerate. Full control, zero risk.' },
            ].map((item, i) => (
              <motion.div
                key={i}
                className={styles.aboutCard}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <span className={styles.aboutNumber}>0{i + 1}</span>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── AGENTS ─── */}
      <section className={`${styles.section} ${styles.sectionAlt}`} id="agents">
        <div className={styles.sectionInner}>
          <span className={styles.sectionBadge}>THE TEAM</span>
          <h2 className={styles.sectionTitle}>
            Meet Your <span className="gradient-text">AI Agents</span>
          </h2>
          <p className={styles.sectionDesc}>
            Each agent is a specialist — trained for one job, executed with precision.
          </p>
          <div className={styles.agentsGrid}>
            {AGENTS.map((agent, i) => (
              <motion.div
                key={agent.id}
                className={styles.agentCard}
                data-number={agent.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
              >
                <span className={styles.agentNumber}>{agent.id}</span>
                <h3>{agent.name}</h3>
                <p>{agent.desc}</p>
                <span className={styles.agentTag}>{agent.role}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PLATFORMS ─── */}
      <section className={styles.section} id="platforms">
        <div className={styles.sectionInner}>
          <span className={styles.sectionBadge}>MULTI-PLATFORM</span>
          <h2 className={styles.sectionTitle}>
            One Agency.<br />
            <span className="gradient-text">Every Platform.</span>
          </h2>
          <p className={styles.sectionDesc}>
            ARCHON generates platform-optimized content. Different rules, different character limits,
            different engagement patterns — ARCHON handles them all.
          </p>
          <div className={styles.platformGrid}>
            {PLATFORMS.map((p, i) => (
              <motion.div
                key={p.name}
                className={`${styles.platformCard} ${p.status === 'live' ? styles.platformLive : ''}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
              >
                <h3>{p.name}</h3>
                <span className={styles.platformSub}>{p.sub}</span>
                <span className={p.status === 'live' ? styles.statusLive : styles.statusSoon}>
                  {p.status === 'live' ? 'Live' : 'Coming Soon'}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className={`${styles.section} ${styles.sectionAlt}`} id="workflow">
        <div className={styles.sectionInner}>
          <span className={styles.sectionBadge}>WORKFLOW</span>
          <h2 className={styles.sectionTitle}>
            How <span className="gradient-text">ARCHON</span> Works
          </h2>
          <div className={styles.timeline}>
            {STEPS.map((step, i) => (
              <motion.div
                key={step.n}
                className={styles.timelineStep}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
              >
                <div className={styles.stepNumber}>{step.n}</div>
                <div className={styles.stepContent}>
                  <h3>{step.title}</h3>
                  <p>{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.sectionDivider} />

      {/* ─── TECH STACK ─── */}
      <section className={styles.section} id="tech">
        <div className={styles.sectionInner}>
          <span className={styles.sectionBadge}>BUILT WITH</span>
          <h2 className={styles.sectionTitle}>
            The <span className="gradient-text">Tech Stack</span>
          </h2>
          <div className={styles.techGrid}>
            {TECH.map((t, i) => (
              <motion.div
                key={t.name}
                className={styles.techItem}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
              >
                <span className={styles.techName}>{t.name}</span>
                <span className={styles.techRole}>{t.role}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.sectionDivider} />

      {/* ─── CTA ─── */}
      <section className={styles.ctaSection}>
        <div className={styles.sectionInner}>
          <h2 className={styles.ctaTitle}>
            Ready to Deploy Your<br />
            <span className="gradient-text">AI Content Agency?</span>
          </h2>
          <p className={styles.ctaDesc}>One task. Six agents. Published to your channel in seconds.</p>
          <a href={process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://127.0.0.1:5000/dashboard"} className={styles.btnPrimaryLarge}>
            <span>Launch Dashboard</span>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </section>

      {/* ─── CONTACT ─── */}
      <section className={`${styles.section} ${styles.sectionAlt}`} id="contact">
        <div className={styles.sectionInner}>
          <span className={styles.sectionBadge}>GET IN TOUCH</span>
          <h2 className={styles.sectionTitle}>
            Contact & <span className="gradient-text">Connect</span>
          </h2>
          <div className={styles.contactGrid}>
            {[
              { label: 'Email', value: 'archon.agency@proton.me' },
              { label: 'Telegram', value: '@archon_agency' },
              { label: 'GitHub', value: 'github.com/divyanshu-114' },
            ].map((c, i) => (
              <div key={i} className={styles.contactCard}>
                <h3>{c.label}</h3>
                <p>{c.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.footerBrand}>ARCHON</span>
          <span className={styles.footerTag}>Autonomous AI Digital Agency</span>
          <p className={styles.footerCopy}>Built with LangGraph, Groq, and ambition. Engineered by Divyanshu Raj.</p>
        </div>
      </footer>
    </>
  );
}
