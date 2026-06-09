/**
 * Unified Attendance Calculation Engine
 * Formula:
 * Eligible Classes = Scheduled Classes Since Joining Date - Holidays - Cancelled Classes
 * Attendance Percentage = Present Classes / Eligible Classes * 100
 */
export function calculateAttendance({
  student,
  attendanceLogs = [],
  batchSchedule,
  holidays = [],
  cancelledClasses = [],
  endDateStr = new Date().toISOString().split('T')[0]
}) {
  if (!student || !batchSchedule) {
    return {
      eligibleClasses: 0,
      presentClasses: 0,
      leaveClasses: 0,
      holidaysCount: 0,
      cancelledCount: 0,
      attendancePercentage: 0,
      dailyStatus: {}
    };
  }

  // Set start date strictly to student joining date.
  // Fallback to student.createdAt, or a sensible system minimum date, never the batch schedule start date.
  const joinStr = student.joiningDate || 
    (student.createdAt ? new Date(student.createdAt.seconds * 1000).toISOString().split('T')[0] : '2026-05-01');

  // Normalize dates to timezone-safe strings
  const start = new Date(joinStr);
  const end = new Date(endDateStr);

  let eligibleClasses = 0;
  let presentClasses = 0;
  let leaveClasses = 0;
  let holidaysCount = 0;
  let cancelledCount = 0;

  // Standardize weeklyDays (both numeric format like [2, 4] and string format like ['tuesday', 'thursday'])
  const getWeeklyDays = (schedule) => {
    if (schedule.weeklyDays && Array.isArray(schedule.weeklyDays)) {
      return schedule.weeklyDays;
    }
    if (schedule.schedule && Array.isArray(schedule.schedule)) {
      const dayMap = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6
      };
      return schedule.schedule.map(d => dayMap[d.toLowerCase()]).filter(d => d !== undefined);
    }
    return [];
  };

  const weeklyDays = getWeeklyDays(batchSchedule);

  // Filter and map attendance logs for this batch
  const logsMap = new Map();
  attendanceLogs.forEach(log => {
    const isInternshipBatch = batchSchedule.id === 'internship';
    const matchesBatch = log.batchId === batchSchedule.id;
    if (matchesBatch || (isInternshipBatch && log.type === 'internship')) {
      logsMap.set(log.date, log.status || 'present');
    }
  });

  const holidaysSet = new Set(holidays.map(h => h.date));
  
  const cancelledSet = new Set(
    cancelledClasses
      .filter(c => c.batchId === 'all' || c.batchId === batchSchedule.id)
      .map(c => c.date)
  );

  const makeupMap = new Map();
  if (batchSchedule.makeupClasses) {
    batchSchedule.makeupClasses.forEach(m => {
      makeupMap.set(m.date, m);
    });
  }

  const dailyStatus = {}; // Map of YYYY-MM-DD -> status

  if (start <= end) {
    // Iterate day by day from start date to end date
    const tempDate = new Date(start);
    while (tempDate <= end) {
      const dateStr = tempDate.toISOString().split('T')[0];
      const dayOfWeek = tempDate.getDay();

      const isRegularDay = weeklyDays.includes(dayOfWeek);
      const isMakeup = makeupMap.has(dateStr);
      const isHoliday = holidaysSet.has(dateStr);
      const isCancelled = cancelledSet.has(dateStr);

      if (isHoliday) {
        if (isRegularDay || isMakeup) {
          holidaysCount++;
          dailyStatus[dateStr] = 'holiday';
        } else {
          dailyStatus[dateStr] = 'no-class';
        }
      } else if (isCancelled) {
        if (isRegularDay || isMakeup) {
          cancelledCount++;
          dailyStatus[dateStr] = 'cancelled';
        } else {
          dailyStatus[dateStr] = 'no-class';
        }
      } else if (isRegularDay || isMakeup) {
        eligibleClasses++;
        if (logsMap.has(dateStr)) {
          const status = logsMap.get(dateStr);
          if (status === 'leave') {
            leaveClasses++;
            dailyStatus[dateStr] = 'leave';
          } else if (status === 'absent') {
            dailyStatus[dateStr] = 'absent';
          } else {
            presentClasses++;
            dailyStatus[dateStr] = isMakeup ? 'makeup' : 'present';
          }
        } else {
          // If educator does not mark present/leave: Absent = 1
          dailyStatus[dateStr] = 'absent';
        }
      } else {
        dailyStatus[dateStr] = 'no-class';
      }

      tempDate.setDate(tempDate.getDate() + 1);
    }
  }

  const attendancePercentage = eligibleClasses > 0 
    ? Math.round((presentClasses / eligibleClasses) * 100) 
    : 100;

  return {
    eligibleClasses,
    presentClasses,
    leaveClasses,
    holidaysCount,
    cancelledCount,
    attendancePercentage,
    dailyStatus
  };
}
