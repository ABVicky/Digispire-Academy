import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  X, RotateCw, Download, Printer, ShieldCheck, CheckCircle2,
  Sparkles, CreditCard, Building2, Phone, Mail, Award, Calendar, QrCode
} from 'lucide-react';
import { playNotificationSound } from '../utils/notificationEngine';

export default function StudentIDCardModal({ student, onClose }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef(null);

  const studentData = student || {};
  const studentName = studentData.name || 'Student Name';
  const studentId = studentData.studentId || 'DS-STD-0000';
  const courseName = studentData.course || studentData.courseName || 'Full Stack Web Development';
  const phone = studentData.phone || '9876543210';
  const email = studentData.email || 'student@digispire.in';
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
      ver: '1.0'
    });

    QRCode.toDataURL(payload, {
      width: 260,
      margin: 1,
      color: {
        dark: '#0F243E',
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
        className="modal-container-premium max-w-md w-full p-0 overflow-hidden bg-slate-900 border border-slate-700 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-[#1E3A5F] text-white flex items-center justify-center border border-slate-600">
              <CreditCard size={14} />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Student Identity Card</h3>
              <p className="text-[10px] text-slate-400">Official DIGISPIRE Digital Credential</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body / 3D Card Stage */}
        <div className="p-6 flex flex-col items-center gap-5 bg-radial from-slate-800 via-slate-900 to-slate-950">
          
          {/* 3D Perspective Card Container */}
          <div
            className="id-card-perspective w-72 sm:w-80 h-[480px] cursor-pointer group"
            onClick={handleFlip}
            title="Click to flip ID card"
          >
            <div className={`id-card-inner rounded-3xl transition-transform duration-700 shadow-2xl ${isFlipped ? 'id-card-flipped' : ''}`}>
              
              {/* ═══════════ CARD FRONT ═══════════ */}
              <div className="id-card-front bg-gradient-to-br from-[#0F243E] via-[#163355] to-[#1E3A5F] text-white p-5 rounded-3xl border-2 border-white/20 flex flex-col justify-between select-none relative">
                {/* Background Ambient Guilloche Pattern */}
                <div className="absolute inset-0 bg-[radial-gradient(#38BDF8_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none rounded-3xl" />
                <div className="absolute -top-16 -right-16 w-36 h-36 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

                {/* Header: Institution Branding & Hologram Pill */}
                <div className="relative z-10 flex items-center justify-between border-b border-white/15 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 bg-white rounded-xl flex items-center justify-center p-1 shadow-md border border-white/30 shrink-0">
                      <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
                    </div>
                    <div>
                      <h4 className="font-heading font-black tracking-tight text-xs sm:text-sm text-white leading-none">DIGISPIRE</h4>
                      <span className="text-[8px] font-bold text-sky-300 tracking-widest uppercase mt-0.5 block">ACADEMY</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Verified
                    </span>
                  </div>
                </div>

                {/* Student Photo & Gold Smart Chip Section */}
                <div className="relative z-10 my-auto py-2 text-center flex flex-col items-center space-y-3">
                  <div className="relative">
                    <div className="h-24 w-24 rounded-2xl bg-white p-1 shadow-lg border-2 border-white/30 overflow-hidden mx-auto">
                      {photoURL ? (
                        <img src={photoURL} alt={studentName} className="h-full w-full object-cover rounded-xl" />
                      ) : (
                        <div className="h-full w-full bg-slate-100 flex items-center justify-center rounded-xl p-2">
                          <img src="/logo.png" alt="Logo" className="h-full w-full object-contain opacity-70" />
                        </div>
                      )}
                    </div>
                    {/* Golden Verified Badge */}
                    <div className="absolute -bottom-1.5 -right-1.5 bg-amber-400 text-slate-950 p-1 rounded-full shadow-md border border-white">
                      <ShieldCheck size={14} />
                    </div>
                  </div>

                  {/* Student Identity Information */}
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight leading-tight">
                      {studentName}
                    </h3>
                    <p className="text-[11px] font-semibold text-sky-200 mt-0.5 line-clamp-1">
                      {courseName}
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-white/10 text-white font-mono text-[9px] font-bold tracking-wider border border-white/10 uppercase">
                        {isIntern ? 'Internship Track' : batchName}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Holographic Security Band */}
                <div className="relative z-10 py-1.5 px-3 my-1 rounded-lg bg-gradient-to-r from-amber-400/20 via-sky-400/20 to-purple-400/20 border border-white/15 flex items-center justify-between text-[8px] font-mono tracking-widest text-slate-300 uppercase">
                  <span>SECURE IDENTITY</span>
                  <Sparkles size={11} className="text-amber-300" />
                  <span>SESSION {validUntil}</span>
                </div>

                {/* Footer Bar: Student ID and Validity */}
                <div className="relative z-10 border-t border-white/15 pt-2.5 flex items-end justify-between text-xs">
                  <div className="space-y-0.5 text-left">
                    <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">STUDENT ID</p>
                    <p className="font-mono font-black text-white text-xs tracking-wider">{studentId}</p>
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">ROLE</p>
                    <p className="text-[10px] font-extrabold text-amber-300 uppercase tracking-wide">
                      {studentData.role === 'admin' ? 'Faculty' : isIntern ? 'Intern' : 'Student'}
                    </p>
                  </div>
                </div>
              </div>

              {/* ═══════════ CARD BACK ═══════════ */}
              <div className="id-card-back bg-gradient-to-br from-[#0F243E] via-[#163355] to-[#1E3A5F] text-white p-5 rounded-3xl border-2 border-white/20 flex flex-col justify-between select-none relative">
                {/* Background Ambient Pattern */}
                <div className="absolute inset-0 bg-[radial-gradient(#38BDF8_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none rounded-3xl" />

                {/* Back Header */}
                <div className="relative z-10 text-center border-b border-white/15 pb-2">
                  <h4 className="font-heading font-extrabold text-xs tracking-tight text-white uppercase">
                    DIGISPIRE ACADEMY
                  </h4>
                  <span className="text-[8px] text-sky-300 uppercase tracking-widest block mt-0.5 font-bold">
                    Official Verification Barcode
                  </span>
                </div>

                {/* Verification QR Code Stage */}
                <div className="relative z-10 my-auto text-center space-y-2">
                  <div className="w-32 h-32 bg-white p-2 rounded-2xl flex items-center justify-center mx-auto shadow-xl border-2 border-white/30">
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="Student Verification QR" className="h-full w-full object-contain" />
                    ) : (
                      <div className="text-xs text-slate-400 font-mono">Generating QR...</div>
                    )}
                  </div>
                  <p className="text-[8px] font-mono text-sky-200 uppercase tracking-widest font-semibold">
                    Scan to Verify Enrollment
                  </p>
                </div>

                {/* Academy Information & Terms */}
                <div className="relative z-10 border-t border-white/15 pt-2.5 space-y-1.5 text-[8px] text-slate-300 text-center leading-relaxed">
                  <p className="font-semibold text-white">DIGISPIRE Academy of Advanced Skills</p>
                  <p className="text-slate-400">
                    This digital card confirms official student enrolment. If found, please notify the academy administration.
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-1 text-slate-400 font-mono text-[8px]">
                    <span>ID: {studentId}</span>
                    <span>•</span>
                    <span>Valid: {validUntil}</span>
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
              className="py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-extrabold uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95"
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
