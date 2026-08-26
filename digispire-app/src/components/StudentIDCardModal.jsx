import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  X, RotateCw, Printer, ShieldCheck,
  Sparkles, Radio, CheckCircle2, QrCode
} from 'lucide-react';

export default function StudentIDCardModal({ student, onClose }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const cardContainerRef = useRef(null);

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
      ver: '3.0'
    });

    QRCode.toDataURL(payload, {
      width: 280,
      margin: 1,
      color: {
        dark: '#0A1128',
        light: '#FFFFFF'
      }
    }).then(setQrCodeUrl).catch(console.error);
  }, [studentId, studentName, validUntil]);

  const handleFlip = () => {
    if (navigator.vibrate) navigator.vibrate(25);
    setIsFlipped(!isFlipped);
  };

  const handleMouseMove = (e) => {
    if (!cardContainerRef.current) return;
    const rect = cardContainerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMouseOffset({ x: x * 15, y: y * -15 });
  };

  const handleMouseLeave = () => {
    setMouseOffset({ x: 0, y: 0 });
  };

  return (
    <div className="modal-backdrop-premium" onClick={onClose}>
      <div
        className="modal-container-premium max-w-md w-full p-0 overflow-hidden bg-[#0A0E17] border border-slate-800 shadow-[0_25px_70px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-bold shadow-sm">
              <Sparkles size={14} />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Digital Student Credential</h3>
              <p className="text-[10px] text-slate-400">Official DIGISPIRE Smart Identity Pass</p>
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

        {/* Modal Body / Lanyard Card Stage */}
        <div className="p-6 flex flex-col items-center gap-5 bg-gradient-to-b from-[#0D1527] via-[#080C14] to-[#04060A]">
          
          {/* Lanyard Top Fixture (Visual Realism) */}
          <div className="flex flex-col items-center -mb-3 z-20 pointer-events-none">
            <div className="w-12 h-2.5 bg-gradient-to-r from-slate-600 via-slate-400 to-slate-600 rounded-t-sm shadow-md" />
            <div className="w-6 h-3 bg-gradient-to-b from-slate-400 to-slate-700 rounded-b-sm border-t border-slate-800" />
            <div className="w-8 h-2 bg-slate-900 rounded-full border border-slate-700 shadow-inner -mt-0.5" />
          </div>

          {/* 3D Perspective Card Container */}
          <div
            ref={cardContainerRef}
            className="id-card-perspective w-[300px] sm:w-[320px] h-[490px] cursor-pointer group shadow-[0_20px_60px_rgba(0,0,0,0.7)] rounded-[26px]"
            onClick={handleFlip}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            title="Click to flip ID card"
            style={{
              transform: `rotateY(${mouseOffset.x}deg) rotateX(${mouseOffset.y}deg)`,
              transition: 'transform 0.15s ease-out'
            }}
          >
            <div className={`id-card-inner ${isFlipped ? 'id-card-flipped' : ''}`}>
              
              {/* ═══════════ CARD FRONT ═══════════ */}
              <div className="id-card-front bg-[#0C1527] text-white p-5 rounded-[26px] border border-white/20 shadow-2xl flex flex-col justify-between select-none absolute inset-0 overflow-hidden">
                
                {/* Metallic Refraction & Mesh Overlays */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/15 via-transparent to-amber-500/10 pointer-events-none" />
                <div className="absolute -top-24 -right-24 w-56 h-56 bg-sky-400/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px] opacity-[0.04] pointer-events-none" />

                {/* Top Notch Slot (Lanyard Hole) */}
                <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 bg-white rounded-xl flex items-center justify-center p-1 shadow-md border border-white/30 shrink-0">
                      <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="font-heading font-black tracking-wider text-xs sm:text-sm text-white leading-none">
                          DIGISPIRE
                        </span>
                      </div>
                      <span className="text-[7.5px] font-extrabold tracking-[0.25em] text-sky-400 uppercase mt-0.5 block">
                        ACADEMY OF SKILLS
                      </span>
                    </div>
                  </div>

                  {/* NFC Contactless Symbol & Chip */}
                  <div className="flex items-center gap-2 text-white/60">
                    <Radio size={15} className="rotate-90 text-sky-300 animate-pulse" />
                    <span className="px-2 py-0.5 rounded-full text-[7.5px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      VERIFIED
                    </span>
                  </div>
                </div>

                {/* Center Stage: Smart Chip + Photo + Details */}
                <div className="relative z-10 my-auto py-1 flex flex-col items-center text-center space-y-3">
                  
                  {/* Photo with Luxury Dual Ring & Verified Seal */}
                  <div className="relative">
                    <div className="p-1 rounded-2xl bg-gradient-to-tr from-amber-400 via-sky-400 to-indigo-500 shadow-xl">
                      <div className="h-24 w-24 rounded-xl bg-slate-900 overflow-hidden border border-slate-800">
                        {photoURL ? (
                          <img src={photoURL} alt={studentName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-slate-900 flex items-center justify-center p-2.5">
                            <img src="/logo.png" alt="Logo" className="h-full w-full object-contain opacity-75" />
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Gold Verified Check Badge */}
                    <div className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-950 p-1 rounded-full shadow-md border-2 border-slate-950">
                      <ShieldCheck size={13} />
                    </div>
                  </div>

                  {/* Student Name and Track */}
                  <div className="space-y-1 max-w-[260px]">
                    <h3 className="text-base sm:text-lg font-black text-white tracking-tight leading-snug drop-shadow-md">
                      {studentName}
                    </h3>
                    <p className="text-[11px] font-semibold text-sky-200/90 truncate">
                      {courseName}
                    </p>
                    <div className="pt-0.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-white/10 backdrop-blur-md text-white font-mono text-[8.5px] font-bold tracking-wider border border-white/15 uppercase">
                        {isIntern ? 'Internship Fellow' : batchName}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Gold Simulated EMV Smart Chip Bar */}
                <div className="relative z-10 px-3 py-2 rounded-xl bg-gradient-to-r from-slate-900/80 via-slate-800/80 to-slate-900/80 border border-white/10 backdrop-blur-md flex items-center justify-between shadow-inner">
                  {/* EMV Microchip graphic */}
                  <div className="w-9 h-6.5 rounded-md bg-gradient-to-br from-amber-300 via-amber-400 to-yellow-600 p-0.5 shadow-sm flex flex-col justify-between border border-amber-200/40">
                    <div className="flex justify-between h-full">
                      <div className="w-1/3 border-r border-amber-800/40" />
                      <div className="w-1/3 border-r border-amber-800/40" />
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[7px] font-bold tracking-widest text-slate-400 uppercase block">IDENTIFIER</span>
                    <span className="font-mono font-black text-white text-xs tracking-widest">{studentId}</span>
                  </div>
                </div>

                {/* Card Front Footer */}
                <div className="relative z-10 border-t border-white/10 pt-2 flex items-center justify-between text-[8px] font-mono text-slate-400">
                  <span>SESSION {validUntil}</span>
                  <span className="font-bold text-amber-300 uppercase tracking-wider">
                    {studentData.role === 'admin' ? 'FACULTY' : isIntern ? 'INTERN' : 'STUDENT'}
                  </span>
                </div>
              </div>

              {/* ═══════════ CARD BACK ═══════════ */}
              <div className="id-card-back bg-[#0C1527] text-white rounded-[26px] border border-white/20 shadow-2xl flex flex-col justify-between select-none absolute inset-0 overflow-hidden">
                
                {/* Magnetic Stripe on Top */}
                <div className="w-full h-11 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-white/10 shadow-inner mt-4" />

                {/* Verification QR Code Section */}
                <div className="px-5 my-auto flex flex-col items-center text-center space-y-2.5">
                  <div className="p-2 bg-white rounded-2xl shadow-2xl border-2 border-white/40">
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="Verification QR" className="w-28 h-28 object-contain" />
                    ) : (
                      <div className="w-28 h-28 flex items-center justify-center text-xs text-slate-400 font-mono">
                        Generating...
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <span className="text-[8px] font-mono font-bold text-sky-300 uppercase tracking-widest block">
                      SCAN FOR CLOUD VERIFICATION
                    </span>
                    <span className="text-[7px] text-slate-400 font-mono">
                      Institutional Digital Authentication
                    </span>
                  </div>
                </div>

                {/* Signature Strip & Barcode Simulation */}
                <div className="px-5 pb-4 space-y-2">
                  {/* Signature line */}
                  <div className="w-full h-6 bg-slate-200/90 rounded-md flex items-center justify-between px-3 text-[8px] font-mono text-slate-600">
                    <span className="italic font-serif opacity-75">{studentName}</span>
                    <span className="text-[6.5px] uppercase font-bold text-slate-500">AUTH SIGNATURE</span>
                  </div>

                  {/* Scalable Barcode */}
                  <div className="flex justify-center items-center gap-0.5 opacity-50 py-0.5">
                    {[2,4,1,3,2,1,4,2,3,1,2,4,1,3,2,1,4,2,1,3,2,4,1,3,2,1,4].map((w, i) => (
                      <div key={i} className="bg-white h-4" style={{ width: `${w}px` }} />
                    ))}
                  </div>

                  <p className="text-[7px] text-slate-400 text-center leading-tight">
                    Official credential of DIGISPIRE Academy. If found, please return to administration.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Interactive Controls Bar */}
          <div className="w-full flex items-center justify-center gap-3 pt-1">
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
              title="Print or Save ID Card"
            >
              <Printer size={14} />
              <span>Print / Save</span>
            </button>
          </div>

          <p className="text-[10px] text-slate-400 text-center">
            Tip: Hover or move your cursor over the badge to see interactive 3D physics. Tap to flip.
          </p>
        </div>
      </div>
    </div>
  );
}
