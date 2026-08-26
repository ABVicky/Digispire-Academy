import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  X, RotateCw, Printer, ShieldCheck,
  Sparkles, CreditCard, Award, CheckCircle2, Shield
} from 'lucide-react';

export default function StudentIDCardModal({ student, onClose }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  const studentData = student || {};
  const studentName = studentData.name || 'Student Name';
  const studentId = studentData.studentId || 'DS-STD-0000';
  const courseName = studentData.course || studentData.courseName || 'Full Stack Web Development';
  const photoURL = studentData.photoURL || '';
  const batchName = studentData.batchName || (Array.isArray(studentData.batchIds) ? studentData.batchIds.join(', ') : (studentData.batchId || 'Academic Batch'));
  const isIntern = !!studentData.isIntern;
  const issueYear = new Date().getFullYear();
  const validUntil = `${issueYear} – ${issueYear + 1}`;

  // Generate QR Code
  useEffect(() => {
    const payload = JSON.stringify({
      org: 'DIGISPIRE ACADEMY',
      id: studentId,
      name: studentName,
      valid: validUntil,
      ver: '2.0'
    });

    QRCode.toDataURL(payload, {
      width: 260,
      margin: 1,
      color: {
        dark: '#0B192C',
        light: '#FFFFFF'
      }
    }).then(setQrCodeUrl).catch(console.error);
  }, [studentId, studentName, validUntil]);

  const handleFlip = () => {
    if (navigator.vibrate) navigator.vibrate(20);
    setIsFlipped(!isFlipped);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-backdrop-premium" onClick={onClose}>
      <div
        className="modal-container-premium max-w-md w-full p-0 overflow-hidden bg-slate-950 border border-slate-700/80 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-xs">
              <CreditCard size={14} />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Digital Identity Credential</h3>
              <p className="text-[10px] text-slate-400">Official DIGISPIRE Student ID Card</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body / 3D Card Stage */}
        <div className="p-6 flex flex-col items-center gap-5 bg-radial from-slate-900 via-slate-950 to-slate-950">
          
          {/* 3D Perspective Card Container */}
          <div
            className="id-card-perspective w-72 sm:w-80 h-[480px] cursor-pointer group shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-3xl"
            onClick={handleFlip}
            title="Click to flip ID card"
          >
            <div className={`id-card-inner ${isFlipped ? 'id-card-flipped' : ''}`}>
              
              {/* ═══════════ CARD FRONT ═══════════ */}
              <div className="id-card-front bg-gradient-to-br from-[#0B192C] via-[#153448] to-[#1E3E62] text-white p-5 rounded-3xl border border-white/20 shadow-2xl flex flex-col justify-between select-none absolute inset-0">
                {/* Soft Aurora Ambient Glows */}
                <div className="absolute -top-12 -right-12 w-44 h-44 bg-gradient-to-br from-cyan-400/30 via-sky-500/20 to-transparent rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-12 -left-12 w-44 h-44 bg-gradient-to-tr from-amber-400/20 via-orange-500/15 to-transparent rounded-full blur-2xl pointer-events-none" />
                <div className="absolute inset-0 bg-[radial-gradient(#38BDF8_1px,transparent_1px)] [background-size:18px_18px] opacity-[0.08] pointer-events-none rounded-3xl" />

                {/* Header: Institutional Emblem & Verified Ribbon */}
                <div className="relative z-10 flex items-center justify-between border-b border-white/15 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 bg-white/95 backdrop-blur-md rounded-xl flex items-center justify-center p-1 shadow-md border border-white/40 shrink-0">
                      <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
                    </div>
                    <div>
                      <h4 className="font-heading font-black tracking-tight text-xs sm:text-sm text-white leading-none">
                        DIGISPIRE
                      </h4>
                      <span className="text-[8px] font-bold text-sky-300 tracking-widest uppercase mt-0.5 block">
                        ACADEMY
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center gap-1 shadow-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Verified
                    </span>
                  </div>
                </div>

                {/* Student Photo & Gold Smart Chip Section */}
                <div className="relative z-10 my-auto py-1 text-center flex flex-col items-center space-y-2.5">
                  <div className="relative">
                    {/* Glowing Soft Gradient Avatar Ring */}
                    <div className="p-1 rounded-2xl bg-gradient-to-tr from-cyan-400 via-indigo-400 to-amber-300 shadow-xl">
                      <div className="h-24 w-24 rounded-xl bg-slate-900 p-0.5 overflow-hidden">
                        {photoURL ? (
                          <img src={photoURL} alt={studentName} className="h-full w-full object-cover rounded-lg" />
                        ) : (
                          <div className="h-full w-full bg-slate-800 flex items-center justify-center rounded-lg p-2">
                            <img src="/logo.png" alt="Logo" className="h-full w-full object-contain opacity-80" />
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Gold Verified Badge */}
                    <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 p-1 rounded-full shadow-md border-2 border-slate-900">
                      <ShieldCheck size={13} />
                    </div>
                  </div>

                  {/* Student Identity Information */}
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-black text-white tracking-tight leading-tight drop-shadow-sm">
                      {studentName}
                    </h3>
                    <p className="text-[11px] font-semibold text-sky-200 line-clamp-1">
                      {courseName}
                    </p>
                    <div className="flex items-center justify-center gap-1.5 pt-0.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-white/10 backdrop-blur-md text-white font-mono text-[9px] font-bold tracking-wider border border-white/15 uppercase shadow-2xs">
                        {isIntern ? 'Internship Track' : batchName}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Holographic Prismatic Security Ribbon */}
                <div className="relative z-10 py-1.5 px-3 rounded-xl bg-gradient-to-r from-amber-400/20 via-cyan-400/25 to-purple-400/20 border border-white/20 backdrop-blur-md flex items-center justify-between text-[8px] font-mono tracking-widest text-slate-200 uppercase shadow-xs">
                  <span className="flex items-center gap-1 text-sky-200">
                    <Shield size={10} className="text-cyan-300" /> SECURE PASS
                  </span>
                  <Sparkles size={11} className="text-amber-300 animate-spin-slow" />
                  <span className="text-amber-200">VALID {validUntil}</span>
                </div>

                {/* Footer Bar: Student ID and Validity */}
                <div className="relative z-10 border-t border-white/15 pt-2.5 flex items-end justify-between text-xs">
                  <div className="space-y-0.5 text-left">
                    <p className="text-[8px] font-bold uppercase tracking-wider text-slate-300">STUDENT ID</p>
                    <p className="font-mono font-black text-white text-xs tracking-wider bg-white/10 px-1.5 py-0.5 rounded border border-white/10 inline-block">
                      {studentId}
                    </p>
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="text-[8px] font-bold uppercase tracking-wider text-slate-300">STATUS</p>
                    <p className="text-[10px] font-extrabold text-amber-300 uppercase tracking-wide">
                      {studentData.role === 'admin' ? 'Faculty' : isIntern ? 'Intern' : 'Active Student'}
                    </p>
                  </div>
                </div>
              </div>

              {/* ═══════════ CARD BACK ═══════════ */}
              <div className="id-card-back bg-gradient-to-br from-[#0B192C] via-[#153448] to-[#1E3E62] text-white p-5 rounded-3xl border border-white/20 shadow-2xl flex flex-col justify-between select-none absolute inset-0">
                {/* Ambient Soft Glows */}
                <div className="absolute -top-12 -left-12 w-44 h-44 bg-gradient-to-br from-indigo-400/25 to-transparent rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-12 -right-12 w-44 h-44 bg-gradient-to-tl from-cyan-400/25 to-transparent rounded-full blur-2xl pointer-events-none" />
                <div className="absolute inset-0 bg-[radial-gradient(#38BDF8_1px,transparent_1px)] [background-size:18px_18px] opacity-[0.08] pointer-events-none rounded-3xl" />

                {/* Back Header */}
                <div className="relative z-10 text-center border-b border-white/15 pb-2">
                  <h4 className="font-heading font-black text-xs tracking-tight text-white uppercase">
                    DIGISPIRE ACADEMY
                  </h4>
                  <span className="text-[8px] text-sky-300 uppercase tracking-widest block mt-0.5 font-bold">
                    Official Verification Barcode
                  </span>
                </div>

                {/* Verification QR Code Stage */}
                <div className="relative z-10 my-auto text-center space-y-2.5">
                  <div className="w-32 h-32 bg-white p-2 rounded-2xl flex items-center justify-center mx-auto shadow-2xl border-2 border-white/40">
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="Student Verification QR" className="h-full w-full object-contain" />
                    ) : (
                      <div className="text-xs text-slate-400 font-mono">Generating QR...</div>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[8px] font-mono text-sky-200 uppercase tracking-widest font-bold">
                      Scan to Verify Enrolment
                    </p>
                    <p className="text-[7px] text-slate-400 font-mono">
                      Institutional Cloud Verification
                    </p>
                  </div>
                </div>

                {/* Academy Information & Barcode Simulation */}
                <div className="relative z-10 border-t border-white/15 pt-2.5 space-y-2 text-[8px] text-slate-300 text-center leading-relaxed">
                  <div className="flex justify-center items-center gap-0.5 opacity-40">
                    {[2,4,1,3,2,1,4,2,3,1,2,4,1,3,2,1,4,2,1,3,2,4,1,3].map((w, i) => (
                      <div key={i} className="bg-white h-4.5" style={{ width: `${w}px` }} />
                    ))}
                  </div>

                  <p className="text-slate-400 text-[7.5px] leading-tight">
                    This credential confirms official student membership. If found, please return to DIGISPIRE Academy office.
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-0.5 text-slate-400 font-mono text-[8px]">
                    <span className="text-white font-bold">{studentId}</span>
                    <span>•</span>
                    <span>Session: {validUntil}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Interactive Controls Bar */}
          <div className="w-full flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleFlip}
              className="flex-1 py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition border border-white/20 flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
            >
              <RotateCw size={14} className={isFlipped ? 'rotate-180 transition-transform duration-500' : ''} />
              <span>{isFlipped ? 'Show Front' : 'Flip to Back'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="py-2.5 px-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl text-xs font-extrabold uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95"
              title="Print or Save as PDF"
            >
              <Printer size={14} />
              <span>Print / Save</span>
            </button>
          </div>

          <p className="text-[10px] text-slate-400 text-center">
            Tip: Tap anywhere on the card to flip between front details and the verification QR code.
          </p>
        </div>
      </div>
    </div>
  );
}
