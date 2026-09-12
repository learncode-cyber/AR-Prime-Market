import { createFileRoute, Link } from "@tanstack/react-router";
import { Briefcase, MapPin, Clock, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/careers")({
  head: () => ({
    meta: [
      { title: "Careers — AR Prime Market" },
      { name: "description", content: "Join AR Prime Market team. Explore career opportunities." },
    ],
  }),
  component: CareersPage,
});

const jobs = [
  {
    title: "Digital Marketing Specialist",
    location: "Dhaka, BD",
    type: "Full-time",
    desc: "Drive growth through social media, SEO, and paid ads.",
  },
  {
    title: "Customer Support Executive",
    location: "Remote",
    type: "Full-time",
    desc: "Deliver exceptional customer experiences across channels.",
  },
  {
    title: "Product Photographer",
    location: "Dhaka, BD",
    type: "Part-time",
    desc: "Create stunning product visuals for our online store.",
  },
  {
    title: "Web Developer (React)",
    location: "Remote",
    type: "Full-time",
    desc: "Build and maintain our ecommerce platform.",
  },
];

function CareersPage() {
  const [form, setForm] = useState({ name: "", email: "", role: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Please fill required fields");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      toast.success("Application submitted! We'll get back to you.");
      setForm({ name: "", email: "", role: "", message: "" });
      setSubmitting(false);
    }, 1000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-8">
        <Link to="/" className="hover:text-primary transition-colors">
          Home
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Careers</span>
      </nav>

      <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-3">
        Join Our Team
      </h1>
      <p className="text-muted-foreground max-w-2xl mb-10">
        We're building the future of ecommerce in Bangladesh. If you're passionate about technology
        and innovation, we'd love to hear from you.
      </p>

      <div className="grid gap-4 mb-12">
        {jobs.map((job) => (
          <div
            key={job.title}
            className="p-5 rounded-xl border border-border bg-card hover:shadow-md transition-shadow"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="font-display font-semibold text-foreground">{job.title}</h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {job.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {job.type}
                  </span>
                </div>
              </div>
              <Briefcase className="w-5 h-5 text-primary shrink-0" />
            </div>
            <p className="text-sm text-muted-foreground mt-2">{job.desc}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 max-w-lg">
        <h2 className="font-display font-bold text-lg text-foreground mb-4 flex items-center gap-2">
          <Send className="w-5 h-5 text-primary" />
          Apply Now
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            placeholder="Full Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <input
            type="email"
            placeholder="Email *"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <input
            placeholder="Position"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <textarea
            placeholder="Tell us about yourself..."
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Application"}
          </button>
        </form>
      </div>
    </div>
  );
}
