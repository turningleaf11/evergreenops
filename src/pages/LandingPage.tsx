import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Compass, Target, Megaphone, Package, ArrowRight,
  CheckCircle2, Zap, Brain, Users, BarChart3,
  MessageSquare, BookOpen, Clock, Building,
} from "lucide-react";

const features = [
  { icon: Brain, label: "Brain Dump", desc: "Capture raw thoughts — AI extracts action items" },
  { icon: Compass, label: "Command Center", desc: "Your priorities, delegation board, and decision log" },
  { icon: Users, label: "Delegation", desc: "Assign, track, and follow up — all in one view" },
];

const executionSteps = [
  { label: "Goals", desc: "Set quarterly rocks and measurable targets" },
  { label: "Projects", desc: "Break goals into trackable initiatives" },
  { label: "Tasks", desc: "Assign work with due dates and priorities" },
  { label: "Issues", desc: "Surface and resolve friction fast" },
];

const intranetItems = [
  { icon: Megaphone, label: "Social Feed" },
  { icon: MessageSquare, label: "Polls & Kudos" },
  { icon: BookOpen, label: "Wiki & Knowledge Base" },
];

const addons = [
  { icon: Clock, label: "Time Clock", desc: "Track hours, manage time-off requests" },
  { icon: Building, label: "Market Research AI", desc: "AI-powered market analysis for your industry" },
  { icon: Package, label: "More Coming", desc: "Custom add-ons built for your workflow" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[hsl(224,24%,4%)] text-[hsl(210,20%,92%)] overflow-x-hidden">
      {/* Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[hsl(224,24%,4%)]/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight">EvergreenOps</span>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="text-[hsl(210,20%,80%)] hover:text-white hover:bg-white/10">
                Sign In
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="bg-[hsl(220,65%,55%)] hover:bg-[hsl(220,65%,50%)] text-white">
                Get Started Free
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* 1. Hero */}
      <section className="relative py-28 px-6">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(220,65%,55%)]/10 via-transparent to-[hsl(280,60%,50%)]/5" />
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-[hsl(210,20%,70%)] mb-6">
            <Zap className="h-3 w-3 text-[hsl(220,65%,55%)]" /> Built for the person steering the ship
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
            The Operating System for CEOs Who Actually{" "}
            <span className="bg-gradient-to-r from-[hsl(220,65%,55%)] to-[hsl(280,60%,60%)] bg-clip-text text-transparent">
              Run Things
            </span>
          </h1>
          <p className="text-lg text-[hsl(210,20%,60%)] max-w-2xl mx-auto mb-10">
            Strategy, execution, and team communication — unified in one workspace.
            No more juggling 5+ tools that don't talk to each other.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/signup">
              <Button size="lg" className="bg-[hsl(220,65%,55%)] hover:bg-[hsl(220,65%,50%)] text-white px-8 text-base gap-2">
                Start Free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg" className="border-white/10 text-[hsl(210,20%,80%)] hover:bg-white/5 px-8 text-base">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Problem Statement */}
      <section className="py-20 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">The Problem</h2>
          <p className="text-lg text-[hsl(210,20%,55%)] leading-relaxed">
            Your team uses Notion for docs, Asana for tasks, Slack for chat, and a spreadsheet for everything else.
            None of them talk to each other.{" "}
            <span className="text-[hsl(210,20%,80%)] font-medium">
              And none of them are built for the person steering the ship.
            </span>
          </p>
        </div>
      </section>

      {/* 3. CEO Cockpit */}
      <section className="py-20 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(220,65%,55%)]/10 border border-[hsl(220,65%,55%)]/20 text-xs text-[hsl(220,65%,65%)] mb-4">
              <Compass className="h-3 w-3" /> What sets us apart
            </div>
            <h2 className="text-3xl font-bold mb-3">CEO Cockpit</h2>
            <p className="text-[hsl(210,20%,55%)] max-w-xl mx-auto">
              No other tool puts the CEO at the center. Brain dump ideas, command your team, and track delegation — all from one dashboard.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.label} className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
                <div className="h-10 w-10 rounded-xl bg-[hsl(220,65%,55%)]/10 flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-[hsl(220,65%,55%)]" />
                </div>
                <h3 className="font-semibold mb-1">{f.label}</h3>
                <p className="text-sm text-[hsl(210,20%,50%)]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Strategy Flow */}
      <section className="py-20 px-6 border-t border-white/5 bg-white/[0.01]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Strategy That Actually Flows Down</h2>
            <p className="text-[hsl(210,20%,55%)] max-w-lg mx-auto">
              Push objectives to your leadership team. They acknowledge, translate into department action, and report back — structured, not chaotic.
            </p>
          </div>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {["CEO Sets Direction", "Leaders Acknowledge", "Departments Execute", "Progress Rolls Up"].map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/5">
                  <span className="h-6 w-6 rounded-full bg-[hsl(220,65%,55%)]/20 text-[hsl(220,65%,65%)] flex items-center justify-center text-xs font-bold">{i + 1}</span>
                  <span className="text-sm font-medium">{step}</span>
                </div>
                {i < 3 && <ArrowRight className="h-4 w-4 text-[hsl(210,20%,30%)] hidden md:block" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Execution Hub */}
      <section className="py-20 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Execution Hub</h2>
            <p className="text-[hsl(210,20%,55%)] max-w-lg mx-auto">
              Notion meets ClickUp — built for operators. Goals cascade to projects, projects break into tasks, and issues get resolved.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {executionSteps.map((s, i) => (
              <div key={s.label} className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
                <div className="h-8 w-8 rounded-full bg-[hsl(220,65%,55%)]/15 flex items-center justify-center mx-auto mb-3 text-sm font-bold text-[hsl(220,65%,65%)]">
                  {i + 1}
                </div>
                <h3 className="font-semibold text-sm mb-1">{s.label}</h3>
                <p className="text-xs text-[hsl(210,20%,45%)]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Company Intranet */}
      <section className="py-20 px-6 border-t border-white/5 bg-white/[0.01]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-3">Your Team's Digital HQ</h2>
          <p className="text-[hsl(210,20%,55%)] mb-10 max-w-lg mx-auto">
            A company intranet that people actually use — social feed, polls, kudos, and a wiki-style knowledge base.
          </p>
          <div className="flex items-center justify-center gap-6 flex-wrap">
            {intranetItems.map((item) => (
              <div key={item.label} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/[0.04] border border-white/5">
                <item.icon className="h-4 w-4 text-[hsl(220,65%,55%)]" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Add-On Packs */}
      <section className="py-20 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Add-On Packs</h2>
            <p className="text-[hsl(210,20%,55%)]">Only pay for what you need. Extend your workspace with modular features.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {addons.map((a) => (
              <div key={a.label} className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
                <a.icon className="h-6 w-6 text-[hsl(220,65%,55%)] mb-3" />
                <h3 className="font-semibold mb-1">{a.label}</h3>
                <p className="text-sm text-[hsl(210,20%,50%)]">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. CTA Footer */}
      <section className="py-24 px-6 border-t border-white/5 bg-gradient-to-b from-transparent to-[hsl(220,65%,55%)]/5">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Start running your company,{" "}
            <span className="text-[hsl(210,20%,45%)]">not chasing it.</span>
          </h2>
          <p className="text-[hsl(210,20%,55%)] mb-8">
            Free to start. Set up your workspace in under 2 minutes.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/signup">
              <Button size="lg" className="bg-[hsl(220,65%,55%)] hover:bg-[hsl(220,65%,50%)] text-white px-10 text-base gap-2">
                Get Started Free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-[hsl(210,20%,35%)]">
          <span>© {new Date().getFullYear()} EvergreenOps</span>
          <div className="flex gap-4">
            <Link to="/login" className="hover:text-[hsl(210,20%,60%)]">Sign In</Link>
            <Link to="/signup" className="hover:text-[hsl(210,20%,60%)]">Sign Up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
