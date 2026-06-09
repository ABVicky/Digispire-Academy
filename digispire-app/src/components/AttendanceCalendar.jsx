import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Info, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AttendanceCalendar({
  student,
  dailyStatus = {},
  attendanceLogs = [],
  batchSchedule,
  holidays = [],
  cancelledClasses = [],
  courses = [],
  modules = [],
  topics = [],
  onUpdateStatus = null
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayStr, setSelectedDayStr] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly' | 'weekly'

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // First day of the month (0 = Sunday, 1 = Monday, etc.)
  const firstDayIndex = new Date(year, month, 1).getDay();
  // Total days in the month
  const totalDays = new Date(year, month + 1, 0).getDate();

  const daysGrid = [];

  if (viewMode === 'monthly') {
    // Add empty spaces for offset before the 1st of the month
    for (let i = 0; i < firstDayIndex; i++) {
      daysGrid.push({ isPadding: true });
    }
    // Add actual days
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      daysGrid.push({ isPadding: false, dayNum: day, dateStr });
    }
  } else {
    // Weekly grid containing Sunday - Saturday of the week of currentDate
    const startOfWeek = new Date(currentDate);
    const dayOfWeek = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek); // Go to Sunday

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      daysGrid.push({ isPadding: false, dayNum: d.getDate(), dateStr });
    }
  }

  const handlePrev = () => {
    if (viewMode === 'monthly') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else {
      const prevWeek = new Date(currentDate);
      prevWeek.setDate(prevWeek.getDate() - 7);
      setCurrentDate(prevWeek);
    }
  };

  const handleNext = () => {
    if (viewMode === 'monthly') {
      setCurrentDate(new Date(year, month + 1, 1));
    } else {
      const nextWeek = new Date(currentDate);
      nextWeek.setDate(nextWeek.getDate() + 7);
      setCurrentDate(nextWeek);
    }
  };

  const getWeekHeaderText = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    return `${startOfWeek.getDate()} ${MONTHS[startOfWeek.getMonth()].substring(0, 3)} - ${endOfWeek.getDate()} ${MONTHS[endOfWeek.getMonth()].substring(0, 3)}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present':
        return 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm shadow-emerald-500/20';
      case 'absent':
        return 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm shadow-rose-500/20';
      case 'leave':
        return 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm shadow-amber-500/20';
      case 'holiday':
        return 'bg-yellow-500 text-slate-800 hover:bg-yellow-600 shadow-sm shadow-yellow-500/10';
      case 'makeup':
        return 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-500/20';
      case 'cancelled':
        return 'bg-slate-300 text-slate-600 line-through hover:bg-slate-400';
      default:
        return 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-slate-100/50';
    }
  };

  // Inspect the details of the selected day
  const getSelectedDayDetails = () => {
    if (!selectedDayStr) return null;
    const status = dailyStatus[selectedDayStr] || 'no-class';
    
    const rawLog = attendanceLogs.find(l => l.date === selectedDayStr);
    const holiday = holidays.find(h => h.date === selectedDayStr);
    const cancellation = cancelledClasses.find(
      c => c.date === selectedDayStr && (c.batchId === 'all' || c.batchId === student.batchId || (student.isIntern && c.batchId === 'internship'))
    );
    const isMakeup = batchSchedule?.makeupClasses?.find(m => m.date === selectedDayStr);
    const isTempSchedule = batchSchedule?.temporarySchedules?.find(t => t.date === selectedDayStr);

    let timing = 'No class scheduled';
    if (status !== 'no-class' && status !== 'holiday' && status !== 'cancelled') {
      if (isMakeup) {
        timing = `Makeup: ${isMakeup.startTime} - ${isMakeup.endTime}`;
      } else if (isTempSchedule) {
        timing = `Temporary Override: ${isTempSchedule.startTime} - ${isTempSchedule.endTime}`;
      } else if (batchSchedule) {
        timing = `Regular: ${batchSchedule.startTime} - ${batchSchedule.endTime}`;
      }
    }

    return {
      date: selectedDayStr,
      status,
      timing,
      rawLog,
      holiday,
      cancellation,
      isMakeup
    };
  };

  const dayDetails = getSelectedDayDetails();

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-50 pb-4">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-[#255A84]" />
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Attendance Calendar</h3>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                viewMode === 'monthly' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setViewMode('weekly')}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                viewMode === 'weekly' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Week
            </button>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl">
            <button onClick={handlePrev} className="p-1.5 hover:bg-white rounded-xl transition text-slate-400">
              <ChevronLeft size={16} />
            </button>
            <span className="text-[11px] font-bold text-slate-700 min-w-[125px] text-center uppercase tracking-widest">
              {viewMode === 'monthly' ? `${MONTHS[month]} ${year}` : getWeekHeaderText()}
            </span>
            <button onClick={handleNext} className="p-1.5 hover:bg-white rounded-xl transition text-slate-400">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div>
        <div className="grid grid-cols-7 gap-2 text-center mb-2">
          {WEEKDAYS.map(day => (
            <span key={day} className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              {day}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {daysGrid.map((item, idx) => {
            if (item.isPadding) {
              return <div key={`empty-${idx}`} className="aspect-square" />;
            }

            const { dayNum, dateStr } = item;
            const status = dailyStatus[dateStr] || 'no-class';
            const isSelected = selectedDayStr === dateStr;

            return (
              <button
                key={`day-${idx}-${dayNum}`}
                onClick={() => setSelectedDayStr(dateStr)}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center text-xs font-bold transition-all relative ${getStatusColor(status)} ${
                  isSelected ? 'ring-4 ring-offset-2 ring-[#255A84]/70 scale-105' : 'active:scale-95'
                }`}
              >
                <span>{dayNum}</span>
                {status !== 'no-class' && (
                  <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-white/70" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Color Legend */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 pt-4 border-t border-slate-50 text-[11px] font-bold uppercase tracking-widest text-slate-400">
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-lg bg-emerald-500 shadow-sm shadow-emerald-500/10 block shrink-0" />
          <span>Present</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-lg bg-rose-500 shadow-sm shadow-rose-500/10 block shrink-0" />
          <span>Absent</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-lg bg-amber-500 shadow-sm shadow-amber-500/10 block shrink-0" />
          <span>Leave</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-lg bg-yellow-500 shadow-sm shadow-yellow-500/10 block shrink-0" />
          <span>Holiday</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-lg bg-blue-600 shadow-sm shadow-blue-500/10 block shrink-0" />
          <span>Makeup</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-lg bg-slate-300 block shrink-0 line-through" />
          <span>Cancelled</span>
        </div>
      </div>

      {/* Details Inspector Panel */}
      {dayDetails && (
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100/60 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Selected Day Details</p>
              <p className="text-sm font-bold text-slate-800 mt-1">
                {new Date(dayDetails.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            
            <span className={`px-3 py-1 rounded-xl text-[11px] font-black uppercase tracking-widest border ${
              dayDetails.status === 'present' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
              dayDetails.status === 'absent' ? 'bg-rose-50 text-rose-600 border-rose-100' :
              dayDetails.status === 'leave' ? 'bg-amber-50 text-amber-600 border-amber-100' :
              dayDetails.status === 'holiday' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
              dayDetails.status === 'makeup' ? 'bg-blue-50 text-blue-600 border-blue-100' :
              dayDetails.status === 'cancelled' ? 'bg-slate-100 text-slate-500 border-slate-200' :
              'bg-slate-100 text-slate-400 border-transparent'
            }`}>
              {dayDetails.status === 'no-class' ? 'No Class' : dayDetails.status}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600 font-medium">
            <div className="flex items-center gap-2.5">
              <Clock size={15} className="text-slate-400 shrink-0" />
              <span>{dayDetails.timing}</span>
            </div>

            {dayDetails.status === 'present' && dayDetails.rawLog && (
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                <span>
                  Checked in at:{' '}
                  {dayDetails.rawLog.timestamp?.toDate
                    ? dayDetails.rawLog.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Just now'}
                </span>
              </div>
            )}

            {dayDetails.status === 'holiday' && dayDetails.holiday && (
              <div className="flex items-center gap-2.5">
                <Info size={15} className="text-yellow-600 shrink-0" />
                <span>Holiday: {dayDetails.holiday.title}</span>
              </div>
            )}

            {dayDetails.status === 'cancelled' && dayDetails.cancellation && (
              <div className="flex items-center gap-2.5">
                <XCircle size={15} className="text-rose-500 shrink-0" />
                <span>Cancelled: {dayDetails.cancellation.reason}</span>
              </div>
            )}

            {dayDetails.status === 'leave' && (
              <div className="flex items-center gap-2.5">
                <AlertCircle size={15} className="text-amber-500 shrink-0" />
                <span>Authorized Leave of Absence</span>
              </div>
            )}

            {dayDetails.status === 'absent' && (
              <div className="flex items-center gap-2.5">
                <XCircle size={15} className="text-rose-500 shrink-0" />
                <span>Missed class session</span>
              </div>
            )}
          </div>

          {dayDetails.rawLog && dayDetails.rawLog.coveredCourse && (
            <div className="mt-4 pt-4 border-t border-slate-200/60 text-xs space-y-2">
              <p className="font-bold text-slate-700">Academic Curriculum Covered:</p>
              <div className="bg-slate-100/60 p-3 rounded-xl space-y-2">
                <p className="font-bold text-slate-800 text-[11px]">
                  Course: <span className="font-semibold text-slate-600">{courses.find(c => c.id === dayDetails.rawLog.coveredCourse)?.name || 'General Course'}</span>
                </p>
                <p className="font-bold text-slate-800 text-[11px]">
                  Module: <span className="font-semibold text-slate-600">{modules.find(m => m.id === dayDetails.rawLog.coveredModule)?.title || 'General Module'}</span>
                </p>
                {dayDetails.rawLog.coveredTopics && dayDetails.rawLog.coveredTopics.length > 0 && (
                  <div className="mt-2">
                    <p className="font-bold text-slate-800 text-[11px] mb-1.5">Topics Completed:</p>
                    <div className="flex flex-col gap-1.5 pl-2">
                      {dayDetails.rawLog.coveredTopics.map(topicId => (
                        <span key={topicId} className="text-slate-600 font-medium text-[11px] flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#255A84] shrink-0" />
                          {topics.find(t => t.id === topicId)?.title || 'Unknown Topic'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {onUpdateStatus && dayDetails.status !== 'no-class' && (
            <div className="mt-4 pt-4 border-t border-slate-200/60 space-y-2">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Admin Actions</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => onUpdateStatus(dayDetails.date, 'present')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer ${
                    dayDetails.status === 'present' || dayDetails.status === 'makeup'
                      ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Set Present
                </button>
                <button
                  onClick={() => onUpdateStatus(dayDetails.date, 'leave')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer ${
                    dayDetails.status === 'leave'
                      ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Set Leave
                </button>
                <button
                  onClick={() => onUpdateStatus(dayDetails.date, 'absent')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer ${
                    dayDetails.status === 'absent'
                      ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Set Absent
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
