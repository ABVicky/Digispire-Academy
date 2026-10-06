import { Link } from 'react-router-dom';
import { Shield, ArrowLeft, Lock, Camera, Bell, FileText, CheckCircle2, Mail, Globe, MapPin } from 'lucide-react';
import AmbientBackground from '../components/AmbientBackground';

export default function PrivacyPolicyPage() {
  const lastUpdated = "October 6, 2026";

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 font-sans selection:bg-[#255A84] selection:text-white relative">
      <AmbientBackground variant="dark" />

      {/* ── Top Header ── */}
      <header className="sticky top-0 z-40 bg-[#0F172A]/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 transition-colors border border-slate-700/50"
          >
            <ArrowLeft size={14} /> Back to Portal
          </Link>
          <div className="h-5 w-px bg-slate-700 hidden sm:block" />
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 bg-white/10 rounded-lg p-1 border border-white/10 flex items-center justify-center">
              <img src="/logo.png" alt="DIGISPIRE" className="h-full w-full object-contain" />
            </div>
            <span className="font-heading font-extrabold text-sm text-white tracking-tight">DIGISPIRE</span>
          </div>
        </div>

        <span className="text-[11px] font-mono text-slate-400 font-semibold">
          Effective: {lastUpdated}
        </span>
      </header>

      {/* ── Content Body ── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10 space-y-8">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-[#1E3A5F]/60 via-[#0F172A] to-slate-900 border border-slate-700/70 rounded-2xl p-6 sm:p-8 shadow-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs font-bold uppercase tracking-wider mb-4">
            <Shield size={14} /> Official Policy
          </div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-4xl text-white tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm sm:text-base text-slate-300 mt-3 leading-relaxed max-w-3xl">
            DIGISPIRE Academy (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to safeguarding the privacy and personal information of our students, faculty, and app users. This policy outlines how our mobile application and web portal collect, use, process, and protect your information.
          </p>
        </div>

        {/* Policy Sections */}
        <div className="space-y-6">
          {/* Section 1 */}
          <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 sm:p-7 space-y-3">
            <div className="flex items-center gap-2.5 text-sky-400 font-heading font-bold text-lg">
              <Lock size={20} />
              <h2>1. Information We Collect</h2>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              We collect information necessary to facilitate student learning, academic management, and credential tracking:
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-xs text-slate-300">
              <li className="flex items-start gap-2 bg-slate-800/40 p-3 rounded-lg border border-slate-800">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Account Information:</strong> Student Name, Registered Phone Number, Institutional Email, and Role.</span>
              </li>
              <li className="flex items-start gap-2 bg-slate-800/40 p-3 rounded-lg border border-slate-800">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Academic Dossier:</strong> Student ID Number, Assigned Batch, Enrolled Courses, and Syllabus Progress.</span>
              </li>
              <li className="flex items-start gap-2 bg-slate-800/40 p-3 rounded-lg border border-slate-800">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Attendance Records:</strong> Date, timestamp, module ID, and check-in confirmation status.</span>
              </li>
              <li className="flex items-start gap-2 bg-slate-800/40 p-3 rounded-lg border border-slate-800">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Course Submissions:</strong> Uploaded assignments, project files, and faculty review feedback.</span>
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 sm:p-7 space-y-4">
            <div className="flex items-center gap-2.5 text-amber-400 font-heading font-bold text-lg">
              <Camera size={20} />
              <h2>2. Device Hardware Permissions & Usage</h2>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Our application requests specific device permissions strictly to enable essential academic features:
            </p>
            <div className="space-y-3 pt-1">
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Camera size={16} className="text-amber-400" /> Camera Permission (<code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-amber-300">CAMERA</code>)
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Used exclusively for live in-app QR code optical scanning during classroom check-in. The camera stream processes QR codes locally in real-time. <strong>We do NOT record, save, or transmit photos or videos from your camera</strong> without explicit user action.
                </p>
              </div>

              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Bell size={16} className="text-sky-400" /> Push & System Notifications (<code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-sky-300">POST_NOTIFICATIONS</code>)
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Used to deliver urgent institutional announcements, attendance status confirmations, homework deadlines, and classroom notices. You can enable or disable notifications at any time in your device settings.
                </p>
              </div>

              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText size={16} className="text-emerald-400" /> Storage & Files
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Used when students choose to upload coursework assignment PDFs, documents, or personal profile photos.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 sm:p-7 space-y-3">
            <div className="flex items-center gap-2.5 text-emerald-400 font-heading font-bold text-lg">
              <Shield size={20} />
              <h2>3. How We Use & Protect Your Information</h2>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Your data is stored on secure cloud infrastructure (Google Firebase) with 256-bit SSL encryption in transit and encrypted storage at rest. We utilize role-based access control (RBAC) so that student records are only accessible by authorized academy faculty and administrators.
            </p>
            <p className="text-sm text-slate-300 leading-relaxed font-semibold text-white">
              We NEVER sell, rent, monetize, or share your personal information with third-party advertisers.
            </p>
          </section>

          {/* Section 4 */}
          <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 sm:p-7 space-y-3">
            <div className="flex items-center gap-2.5 text-purple-400 font-heading font-bold text-lg">
              <CheckCircle2 size={20} />
              <h2>4. Student Data Rights & Account Deletion</h2>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Under applicable data protection regulations (including the Digital Personal Data Protection Act and GDPR principles), you have the right to:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-300 pl-1">
              <li>Request an export of your personal and academic attendance records.</li>
              <li>Request correction of inaccurate personal or contact details.</li>
              <li>Request complete account deletion and erasure of records upon course graduation.</li>
            </ul>
            <p className="text-xs text-slate-400 pt-2">
              To request data deletion or account removal, please contact our academic support desk with your Student ID at the email below.
            </p>
          </section>

          {/* Section 5 */}
          <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 sm:p-7 space-y-4">
            <div className="flex items-center gap-2.5 text-white font-heading font-bold text-lg">
              <Mail size={20} className="text-sky-400" />
              <h2>5. Contact Information</h2>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              If you have any questions or concerns regarding this Privacy Policy or our data handling practices, please contact us:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
              <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700 flex items-center gap-2.5">
                <Mail size={16} className="text-sky-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Email Support</p>
                  <a href="mailto:support@digispire.in" className="text-white font-semibold hover:underline truncate block">
                    support@digispire.in
                  </a>
                </div>
              </div>
              <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700 flex items-center gap-2.5">
                <Globe size={16} className="text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Official Portal</p>
                  <a href="https://digispire.vercel.app" target="_blank" rel="noreferrer" className="text-white font-semibold hover:underline truncate block">
                    digispire.vercel.app
                  </a>
                </div>
              </div>
              <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700 flex items-center gap-2.5">
                <MapPin size={16} className="text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Organization</p>
                  <p className="text-white font-semibold truncate">DIGISPIRE Academy</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer Note */}
        <div className="text-center pt-4 pb-12 border-t border-slate-800 text-xs text-slate-500">
          <p>© 2026 DIGISPIRE Academy. All rights reserved.</p>
          <div className="flex items-center justify-center gap-4 mt-2">
            <Link to="/login" className="hover:text-slate-300 underline">Student Login</Link>
            <span>·</span>
            <Link to="/privacy-policy" className="hover:text-slate-300 underline">Privacy Policy</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
