import { useEffect, useState, useMemo, useCallback } from 'react';
import { collection, getDocs, query, where, doc, updateDoc, arrayUnion, arrayRemove, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Users, Search, Download, GraduationCap, X,
  CheckCircle2, AlertTriangle, TrendingUp, ChevronRight,
  Award, Check, LayoutGrid, Table as TableIcon,
  RotateCcw, ArrowUpRight, Loader2, Sparkles, CheckCheck
} from 'lucide-react';
import { triggerHaptic } from '../../utils/haptic';
import { downloadCSV } from '../../utils/csvExport';

// Helper to calculate days elapsed since student joined
function getDaysElapsed(joiningDateStr) {
  if (!joiningDateStr) return 0;
  const start = new Date(joiningDateStr);
  const now = new Date();
  if (isNaN(start.getTime())) return 0;
  const diffTime = Math.max(0, now - start);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// Compute expected progress % based on elapsed days (default 90 days total course duration)
function getExpectedProgress(daysElapsed, durationDays = 90) {
  if (daysElapsed <= 0) return 0;
  return Math.min(100, Math.round((daysElapsed / durationDays) * 100));
}

// Determine pacing status object
function getPacingStatus(actualProgress, expectedProgress) {
  if (actualProgress >= 100) {
    return {
      label: 'Completed',
      badgeClass: 'bg-emerald-500/10 text-emerald-700 border-emerald-200/80',
      pillClass: 'bg-emerald-500 text-white',
      icon: Award
    };
  }
  const diff = actualProgress - expectedProgress;
  if (diff >= 10) {
    return {
      label: 'Ahead of Schedule',
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
      pillClass: 'bg-indigo-600 text-white',
      icon: TrendingUp
    };
  }
  if (diff >= -10) {
    return {
      label: 'On Track',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
      pillClass: 'bg-emerald-600 text-white',
      icon: CheckCircle2
    };
  }
  return {
    label: 'Behind Schedule',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
    pillClass: 'bg-rose-600 text-white',
    icon: AlertTriangle
  };
}

export default function CourseCompletionReportPage() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [modules, setModules] = useState([]);
  const [topics, setTopics] = useState([]);
  const [batches, setBatches] = useState([]);
  const [staff, setStaff] = useState([]);

  // UI View Mode: 'cards' or 'table'
  const [viewMode, setViewMode] = useState('cards');

  // Filter States
  const [search, setSearch] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('all');
  const [selectedBatchId, setSelectedBatchId] = useState('all');
  const [selectedMentorId, setSelectedMentorId] = useState('all');
  const [selectedPacing, setSelectedPacing] = useState('all');

  // Modal & Interactive Completion State
  const [inspectStudentId, setInspectStudentId] = useState(null);
  const [activeModalTab, setActiveModalTab] = useState('modules'); // 'modules' or 'pacing'
  const [updatingTarget, setUpdatingTarget] = useState(null); // 'module-${id}' | 'topic-${id}' | 'all-course'
  const [actionToast, setActionToast] = useState(null); // { type, message }

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [uSnap, cSnap, mSnap, tSnap, bSnap, sSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
        getDocs(collection(db, 'courses')),
        getDocs(collection(db, 'modules')),
        getDocs(collection(db, 'topics')),
        getDocs(collection(db, 'batches')),
        getDocs(query(collection(db, 'users'), where('role', '==', 'staff')))
      ]);

      setStudents(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCourses(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setModules(mSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTopics(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setBatches(bSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setStaff(sSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error fetching course completion data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset filters helper
  const handleResetFilters = () => {
    setSearch('');
    setSelectedCourseId('all');
    setSelectedBatchId('all');
    setSelectedMentorId('all');
    setSelectedPacing('all');
  };

  const hasActiveFilters = search || selectedCourseId !== 'all' || selectedBatchId !== 'all' || selectedMentorId !== 'all' || selectedPacing !== 'all';

  // Helper function to calculate module completion stats for a student
  const getStudentModuleStats = useCallback((student, courseId) => {
    const studentUid = student.uid || student.id;
    const courseModules = modules.filter(m => !courseId || m.courseId === courseId);

    return courseModules.map(moduleItem => {
      const moduleTopics = topics.filter(t => t.moduleId === moduleItem.id);
      if (moduleTopics.length === 0) {
        return {
          id: moduleItem.id,
          title: moduleItem.title,
          totalTopics: 0,
          completedTopics: 0,
          percent: 0,
          status: 'not_started',
          topics: []
        };
      }

      const completedCount = moduleTopics.filter(t => t.completedStudents?.includes(studentUid)).length;
      const pct = Math.round((completedCount / moduleTopics.length) * 100);

      let status = 'not_started';
      if (pct === 100) status = 'completed';
      else if (pct > 0) status = 'in_progress';

      return {
        id: moduleItem.id,
        title: moduleItem.title,
        totalTopics: moduleTopics.length,
        completedTopics: completedCount,
        percent: pct,
        status,
        topics: moduleTopics.map(t => ({
          id: t.id,
          title: t.title,
          isCompleted: t.completedStudents?.includes(studentUid) || false
        }))
      };
    });
  }, [modules, topics]);

  // Enriched student data with pacing calculations
  const enrichedStudents = useMemo(() => {
    return students.map(student => {
      const studentUid = student.uid || student.id;
      const studentCourse = courses.find(c => c.id === student.courseId) || null;
      const courseName = studentCourse ? studentCourse.name : (student.course || 'General Track');
      const courseDuration = studentCourse?.durationDays || 90;

      const relevantModules = student.courseId
        ? modules.filter(m => m.courseId === student.courseId)
        : modules;

      const relevantModuleIds = relevantModules.map(m => m.id);
      const relevantTopics = topics.filter(t => relevantModuleIds.includes(t.moduleId));

      let actualProgress = 0;
      if (relevantTopics.length > 0) {
        const completedCount = relevantTopics.filter(t => t.completedStudents?.includes(studentUid)).length;
        actualProgress = Math.round((completedCount / relevantTopics.length) * 100);
      }

      const daysElapsed = getDaysElapsed(student.joiningDate);
      const expectedProgress = getExpectedProgress(daysElapsed, courseDuration);
      const pacing = getPacingStatus(actualProgress, expectedProgress);
      const moduleStats = getStudentModuleStats(student, student.courseId);

      const completedModulesCount = moduleStats.filter(m => m.status === 'completed').length;
      const inProgressModulesCount = moduleStats.filter(m => m.status === 'in_progress').length;
      const mentorObj = staff.find(s => s.id === student.mentorId);

      return {
        ...student,
        courseName,
        courseDuration,
        actualProgress,
        daysElapsed,
        expectedProgress,
        pacing,
        moduleStats,
        completedModulesCount,
        inProgressModulesCount,
        totalModulesCount: moduleStats.length,
        mentorName: mentorObj ? mentorObj.name : 'Unassigned'
      };
    });
  }, [students, courses, modules, topics, staff, getStudentModuleStats]);

  // Filter students based on toolbar
  const filteredStudents = useMemo(() => {
    return enrichedStudents.filter(student => {
      const q = search.toLowerCase().trim();
      const matchesSearch = !q ||
        student.name?.toLowerCase().includes(q) ||
        student.studentId?.toLowerCase().includes(q) ||
        student.email?.toLowerCase().includes(q) ||
        student.phone?.includes(q);

      const matchesCourse = selectedCourseId === 'all' || student.courseId === selectedCourseId;

      const enrolledBatches = student.batchIds || (student.batchId ? [student.batchId] : []);
      const matchesBatch = selectedBatchId === 'all' ||
        (selectedBatchId === 'internship' && student.isIntern) ||
        enrolledBatches.includes(selectedBatchId);

      const matchesMentor = selectedMentorId === 'all' || student.mentorId === selectedMentorId;

      let matchesPacing = true;
      if (selectedPacing === 'completed') matchesPacing = student.actualProgress === 100;
      else if (selectedPacing === 'ahead') matchesPacing = student.pacing.label === 'Ahead of Schedule';
      else if (selectedPacing === 'ontrack') matchesPacing = student.pacing.label === 'On Track';
      else if (selectedPacing === 'behind') matchesPacing = student.pacing.label === 'Behind Schedule';

      return matchesSearch && matchesCourse && matchesBatch && matchesMentor && matchesPacing;
    });
  }, [enrichedStudents, search, selectedCourseId, selectedBatchId, selectedMentorId, selectedPacing]);

  // Current student being inspected (reactively calculated from enrichedStudents)
  const currentInspectStudent = useMemo(() => {
    if (!inspectStudentId) return null;
    return enrichedStudents.find(s => s.id === inspectStudentId) || null;
  }, [enrichedStudents, inspectStudentId]);

  // Handler: Toggle individual topic completion for a student
  const handleToggleTopic = async (topicId, studentUid, currentCompleted) => {
    if (!topicId || !studentUid) return;
    setUpdatingTarget(`topic-${topicId}`);
    try {
      const topicRef = doc(db, 'topics', topicId);
      if (currentCompleted) {
        await updateDoc(topicRef, {
          completedStudents: arrayRemove(studentUid)
        });
        setTopics(prev => prev.map(t => t.id === topicId ? {
          ...t,
          completedStudents: (t.completedStudents || []).filter(uid => uid !== studentUid)
        } : t));
        triggerHaptic('light');
        setActionToast({ type: 'info', message: 'Topic uncompleted' });
      } else {
        await updateDoc(topicRef, {
          completedStudents: arrayUnion(studentUid)
        });
        setTopics(prev => prev.map(t => t.id === topicId ? {
          ...t,
          completedStudents: (t.completedStudents || []).includes(studentUid)
            ? (t.completedStudents || [])
            : [...(t.completedStudents || []), studentUid]
        } : t));
        triggerHaptic('success');
        setActionToast({ type: 'success', message: 'Topic marked complete!' });
      }
      setTimeout(() => setActionToast(null), 2500);
    } catch (err) {
      console.error('Failed to toggle topic completion:', err);
      setActionToast({ type: 'error', message: 'Error updating topic status' });
      setTimeout(() => setActionToast(null), 3000);
    } finally {
      setUpdatingTarget(null);
    }
  };

  // Handler: Mark entire module complete / reset module for a student
  const handleToggleModule = async (moduleId, studentUid, isModuleCompleted) => {
    if (!moduleId || !studentUid) return;
    setUpdatingTarget(`module-${moduleId}`);
    try {
      const moduleTopics = topics.filter(t => t.moduleId === moduleId);
      
      if (moduleTopics.length === 0) {
        // If module has no topics created yet, create a default topic to represent the module
        const newTopicRef = await addDoc(collection(db, 'topics'), {
          title: 'Core Module Syllabus',
          moduleId: moduleId,
          completedStudents: isModuleCompleted ? [] : [studentUid]
        });
        setTopics(prev => [...prev, {
          id: newTopicRef.id,
          title: 'Core Module Syllabus',
          moduleId: moduleId,
          completedStudents: isModuleCompleted ? [] : [studentUid]
        }]);
        triggerHaptic('success');
      } else {
        if (isModuleCompleted) {
          // Unmark all topics
          await Promise.all(moduleTopics.map(t =>
            updateDoc(doc(db, 'topics', t.id), {
              completedStudents: arrayRemove(studentUid)
            })
          ));
          setTopics(prev => prev.map(t => t.moduleId === moduleId ? {
            ...t,
            completedStudents: (t.completedStudents || []).filter(uid => uid !== studentUid)
          } : t));
          triggerHaptic('light');
          setActionToast({ type: 'info', message: 'Module marked incomplete' });
        } else {
          // Mark all topics complete
          await Promise.all(moduleTopics.map(t =>
            updateDoc(doc(db, 'topics', t.id), {
              completedStudents: arrayUnion(studentUid)
            })
          ));
          setTopics(prev => prev.map(t => t.moduleId === moduleId ? {
            ...t,
            completedStudents: (t.completedStudents || []).includes(studentUid)
              ? (t.completedStudents || [])
              : [...(t.completedStudents || []), studentUid]
          } : t));
          triggerHaptic('success');
          setActionToast({ type: 'success', message: 'Module marked 100% complete!' });
        }
      }
      setTimeout(() => setActionToast(null), 2500);
    } catch (err) {
      console.error('Failed to toggle module completion:', err);
      setActionToast({ type: 'error', message: 'Failed to update module status' });
      setTimeout(() => setActionToast(null), 3000);
    } finally {
      setUpdatingTarget(null);
    }
  };

  // Handler: Mark all modules of a course as complete / reset all
  const handleMarkAllCourseModules = async (studentUid, courseId, markComplete = true) => {
    if (!studentUid) return;
    setUpdatingTarget('all-course');
    try {
      const relevantCourseModules = modules.filter(m => !courseId || m.courseId === courseId);
      const relevantModuleIds = relevantCourseModules.map(m => m.id);
      const courseTopics = topics.filter(t => relevantModuleIds.includes(t.moduleId));

      if (courseTopics.length === 0) {
        alert('No topics found under this course curriculum to update.');
        return;
      }

      if (markComplete) {
        await Promise.all(courseTopics.map(t =>
          updateDoc(doc(db, 'topics', t.id), {
            completedStudents: arrayUnion(studentUid)
          })
        ));
        setTopics(prev => prev.map(t => relevantModuleIds.includes(t.moduleId) ? {
          ...t,
          completedStudents: (t.completedStudents || []).includes(studentUid)
            ? (t.completedStudents || [])
            : [...(t.completedStudents || []), studentUid]
        } : t));
        triggerHaptic('success');
        setActionToast({ type: 'success', message: 'All course modules marked as 100% finished!' });
      } else {
        await Promise.all(courseTopics.map(t =>
          updateDoc(doc(db, 'topics', t.id), {
            completedStudents: arrayRemove(studentUid)
          })
        ));
        setTopics(prev => prev.map(t => relevantModuleIds.includes(t.moduleId) ? {
          ...t,
          completedStudents: (t.completedStudents || []).filter(uid => uid !== studentUid)
        } : t));
        triggerHaptic('light');
        setActionToast({ type: 'info', message: 'Course progress reset to 0%' });
      }
      setTimeout(() => setActionToast(null), 3000);
    } catch (err) {
      console.error('Failed to update all course modules:', err);
      setActionToast({ type: 'error', message: 'Failed to update course progress' });
      setTimeout(() => setActionToast(null), 3000);
    } finally {
      setUpdatingTarget(null);
    }
  };

  // Executive summary counts
  const totalStudentsCount = filteredStudents.length;
  const avgProgress = totalStudentsCount > 0
    ? Math.round(filteredStudents.reduce((acc, s) => acc + s.actualProgress, 0) / totalStudentsCount)
    : 0;
  const onTrackCount = filteredStudents.filter(s => s.pacing.label === 'On Track' || s.pacing.label === 'Ahead of Schedule' || s.actualProgress === 100).length;
  const behindCount = filteredStudents.filter(s => s.pacing.label === 'Behind Schedule').length;

  // Handle Export CSV
  const handleDownloadCSV = () => {
    if (filteredStudents.length === 0) {
      alert('No student records available to export.');
      return;
    }

    const headers = [
      'Student ID',
      'Name',
      'Email',
      'Phone',
      'Course Track',
      'Assigned Mentor',
      'Joining Date',
      'Days Active',
      'Completed Modules',
      'Total Modules',
      'Actual Progress (%)',
      'Expected Progress (%)',
      'Pacing Status'
    ];

    const rows = filteredStudents.map(s => [
      s.studentId || '—',
      s.name || '—',
      s.email || '—',
      s.phone || '—',
      s.courseName,
      s.mentorName,
      s.joiningDate || '—',
      `${s.daysElapsed} days`,
      `${s.completedModulesCount}/${s.totalModulesCount}`,
      s.totalModulesCount,
      `${s.actualProgress}%`,
      `${s.expectedProgress}%`,
      s.pacing.label
    ]);

    downloadCSV('Student_Course_Completion_Report.csv', headers, rows);
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#255A84] to-[#1a4261] text-white flex items-center justify-center shadow-md shadow-[#255A84]/20">
              <Award size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Course Completion & Pacing Reports</h1>
              <p className="text-xs text-slate-500 font-medium">
                Monitor student module completions, actual progress %, and time-elapsed pacing velocity
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* View Mode Toggle */}
          <div className="bg-slate-200/60 p-1 rounded-xl flex items-center gap-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'cards'
                  ? 'bg-white text-[#255A84] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid size={14} />
              <span>Cards</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-[#255A84] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <TableIcon size={14} />
              <span>Table</span>
            </button>
          </div>

          <button
            onClick={handleDownloadCSV}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#255A84] hover:bg-[#1c4566] text-white text-xs font-bold rounded-xl shadow-md shadow-[#255A84]/20 transition-all active:scale-95"
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100/80 flex items-center gap-3.5 hover:shadow-md transition">
          <div className="h-11 w-11 rounded-xl bg-blue-50 text-[#255A84] flex items-center justify-center shrink-0 font-bold">
            <Users size={20} />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-800 leading-none">{totalStudentsCount}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Enrolled Students</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100/80 flex items-center gap-3.5 hover:shadow-md transition">
          <div className="h-11 w-11 rounded-xl bg-amber-50 text-[#F48B1F] flex items-center justify-center shrink-0 font-bold">
            <GraduationCap size={20} />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-800 leading-none">{avgProgress}%</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Average Completion</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100/80 flex items-center gap-3.5 hover:shadow-md transition">
          <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 font-bold">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-800 leading-none">{onTrackCount}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">On Track / Ahead</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100/80 flex items-center gap-3.5 hover:shadow-md transition">
          <div className="h-11 w-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 font-bold">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-800 leading-none">{behindCount}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Needs Pacing Support</p>
          </div>
        </div>
      </div>

      {/* ── Toolbar Filters ── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name, ID, email or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Course Filter */}
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all truncate"
            >
              <option value="all">All Courses</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Batch Filter */}
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all truncate"
            >
              <option value="all">All Batches</option>
              <option value="morning">Morning Batch</option>
              <option value="evening">Evening Batch</option>
              <option value="internship">Internship Track</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            {/* Mentor Filter */}
            <select
              value={selectedMentorId}
              onChange={(e) => setSelectedMentorId(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all truncate"
            >
              <option value="all">All Mentors</option>
              {staff.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            {/* Pacing Filter */}
            <select
              value={selectedPacing}
              onChange={(e) => setSelectedPacing(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all truncate"
            >
              <option value="all">All Pacing Statuses</option>
              <option value="completed">🎓 Completed (100%)</option>
              <option value="ahead">🚀 Ahead of Schedule</option>
              <option value="ontrack">🟢 On Track</option>
              <option value="behind">⚠️ Behind Schedule</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-400 font-medium">Showing {filteredStudents.length} matching students</span>
            <button
              onClick={handleResetFilters}
              className="text-[#255A84] font-bold hover:underline flex items-center gap-1"
            >
              <RotateCcw size={12} />
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* ── Main Content Area ── */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-100 text-center flex flex-col items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#255A84] border-t-transparent" />
          <p className="text-xs text-slate-400 font-bold">Loading completion and time pacing analytics...</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-100 text-center text-slate-400 text-xs font-semibold space-y-2">
          <p className="text-base font-bold text-slate-700">No Student Records Found</p>
          <p>Try adjusting your search query or filter dropdown selections.</p>
        </div>
      ) : viewMode === 'cards' ? (
        /* ── CARD GRID VIEW ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStudents.map((student) => {
            const PacingIcon = student.pacing.icon;
            return (
              <div
                key={student.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 p-5 flex flex-col justify-between space-y-4 group"
              >
                {/* Header info */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#255A84] to-[#1a4261] text-white font-bold text-sm flex items-center justify-center shadow-md overflow-hidden shrink-0">
                        {student.photoURL ? (
                          <img src={student.photoURL} alt={student.name} className="h-full w-full object-cover" />
                        ) : (
                          <span>{student.name?.charAt(0) || 'S'}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-800 text-sm truncate group-hover:text-[#255A84] transition-colors">
                          {student.name}
                        </h3>
                        <p className="text-[10px] font-mono text-slate-400 font-bold">{student.studentId || 'ID Pending'}</p>
                      </div>
                    </div>

                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${student.pacing.badgeClass} shrink-0`}>
                      <PacingIcon size={12} />
                      {student.pacing.label}
                    </span>
                  </div>

                  {/* Course & Mentor details */}
                  <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100/60 flex items-center justify-between text-xs">
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Course Track</p>
                      <p className="font-bold text-slate-800 text-xs truncate mt-0.5">{student.courseName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mentor</p>
                      <p className="font-semibold text-slate-700 text-xs mt-0.5">{student.mentorName}</p>
                    </div>
                  </div>

                  {/* Progress vs Expected Pacing Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-slate-800">{student.actualProgress}% Completed</span>
                      <span className="text-[10px] font-semibold text-slate-400">
                        Target: {student.expectedProgress}% ({student.daysElapsed}d active)
                      </span>
                    </div>

                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 relative">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          student.actualProgress === 100 ? 'bg-emerald-500' : 'bg-[#255A84]'
                        }`}
                        style={{ width: `${student.actualProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Module Completion Stepper Dots */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-700">Module Breakdown</span>
                      <span className="font-semibold text-[#F48B1F]">
                        {student.completedModulesCount} of {student.totalModulesCount} Done
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {student.moduleStats.map((mod, idx) => {
                        let dotClass = 'bg-slate-200 text-slate-600 border-slate-300';
                        if (mod.status === 'completed') dotClass = 'bg-emerald-500 text-white border-emerald-600';
                        else if (mod.status === 'in_progress') dotClass = 'bg-amber-500 text-white border-amber-600';

                        return (
                          <div
                            key={mod.id || idx}
                            title={`${mod.title}: ${mod.completedTopics}/${mod.totalTopics} Topics (${mod.percent}%)`}
                            className={`h-6 px-2 rounded-lg text-[10px] font-bold border flex items-center gap-1 transition cursor-help ${dotClass}`}
                          >
                            <span>M{idx + 1}</span>
                            {mod.status === 'completed' && <Check size={10} strokeWidth={3} />}
                            {mod.status === 'in_progress' && <span className="text-[9px]">{mod.percent}%</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Inspect Button */}
                <button
                  onClick={() => {
                    setInspectStudentId(student.id);
                    setActiveModalTab('modules');
                  }}
                  className="w-full py-2 bg-slate-100 hover:bg-[#255A84] text-slate-700 hover:text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
                >
                  <span>Manage & Inspect Progress</span>
                  <ArrowUpRight size={14} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── TABLE VIEW ── */
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  <th className="px-5 py-3.5">Student Details</th>
                  <th className="px-4 py-3.5">Track & Mentor</th>
                  <th className="px-4 py-3.5">Module Completion Status</th>
                  <th className="px-4 py-3.5">Actual vs Expected Pacing</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredStudents.map((student) => {
                  const PacingIcon = student.pacing.icon;
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Student Details */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-[#255A84] text-white font-bold text-xs flex items-center justify-center shadow-xs overflow-hidden shrink-0">
                            {student.photoURL ? (
                              <img src={student.photoURL} alt={student.name} className="h-full w-full object-cover" />
                            ) : (
                              <span>{student.name?.charAt(0) || 'S'}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-xs truncate">{student.name}</p>
                            <p className="text-[10px] font-mono text-slate-400 font-bold">{student.studentId || 'N/A'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Track & Mentor */}
                      <td className="px-4 py-4">
                        <p className="text-xs font-bold text-slate-800 truncate">{student.courseName}</p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Mentor: {student.mentorName}</p>
                      </td>

                      {/* Module Completion Status */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-slate-800">
                            {student.completedModulesCount} / {student.totalModulesCount}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">Modules Completed</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                          {student.moduleStats.map((mod, idx) => (
                            <div
                              key={mod.id || idx}
                              title={`${mod.title} (${mod.percent}%)`}
                              className={`h-2 rounded-full transition-all ${
                                mod.status === 'completed' ? 'w-5 bg-emerald-500' :
                                mod.status === 'in_progress' ? 'w-3 bg-amber-500' : 'w-2 bg-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                      </td>

                      {/* Actual vs Expected Pacing */}
                      <td className="px-4 py-4 min-w-[200px]">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-extrabold text-slate-800">{student.actualProgress}% Done</span>
                            <span className="text-[10px] text-slate-400">Target: {student.expectedProgress}%</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                            <div
                              className={`h-full transition-all rounded-full ${
                                student.actualProgress === 100 ? 'bg-emerald-500' : 'bg-[#255A84]'
                              }`}
                              style={{ width: `${student.actualProgress}%` }}
                            />
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${student.pacing.badgeClass} mt-1`}>
                            <PacingIcon size={10} />
                            {student.pacing.label}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => {
                            setInspectStudentId(student.id);
                            setActiveModalTab('modules');
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-[#255A84] hover:text-white text-slate-700 text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Manage</span>
                          <ChevronRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Student Inspection & Completion Management Dialog ── */}
      {currentInspectStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-slate-100 font-sans">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#255A84] to-[#1a4261] text-white font-bold text-base flex items-center justify-center shadow-md overflow-hidden shrink-0">
                  {currentInspectStudent.photoURL ? (
                    <img src={currentInspectStudent.photoURL} alt={currentInspectStudent.name} className="h-full w-full object-cover" />
                  ) : (
                    <span>{currentInspectStudent.name?.charAt(0)}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-slate-900 text-base truncate">{currentInspectStudent.name}</h2>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${currentInspectStudent.pacing.badgeClass}`}>
                      {currentInspectStudent.actualProgress}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-semibold font-mono truncate mt-0.5">
                    {currentInspectStudent.studentId || 'No ID'} • {currentInspectStudent.courseName}
                  </p>
                </div>
              </div>

              {/* Fast Batch Actions */}
              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  disabled={updatingTarget === 'all-course'}
                  onClick={() => handleMarkAllCourseModules(currentInspectStudent.uid || currentInspectStudent.id, currentInspectStudent.courseId, true)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-60"
                  title="Mark all course modules & topics as 100% finished"
                >
                  {updatingTarget === 'all-course' ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Sparkles size={13} />
                  )}
                  <span>Mark All 100%</span>
                </button>

                <button
                  type="button"
                  disabled={updatingTarget === 'all-course'}
                  onClick={() => {
                    if (window.confirm("Are you sure you want to reset all course module completions for this student?")) {
                      handleMarkAllCourseModules(currentInspectStudent.uid || currentInspectStudent.id, currentInspectStudent.courseId, false);
                    }
                  }}
                  className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-60"
                  title="Reset all progress to 0%"
                >
                  <RotateCcw size={12} />
                  <span>Reset</span>
                </button>

                <button
                  onClick={() => setInspectStudentId(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 transition cursor-pointer ml-1"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Toast Notification Banner */}
            {actionToast && (
              <div className={`mx-6 mt-3 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-150 ${
                actionToast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                actionToast.type === 'error' ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-blue-50 text-blue-800 border border-blue-200'
              }`}>
                <CheckCircle2 size={15} className="shrink-0" />
                <span>{actionToast.message}</span>
              </div>
            )}

            {/* Modal Tabs */}
            <div className="px-6 border-b border-slate-100 bg-white flex gap-4 text-xs font-bold">
              <button
                onClick={() => setActiveModalTab('modules')}
                className={`py-3 border-b-2 transition-all cursor-pointer ${
                  activeModalTab === 'modules'
                    ? 'border-[#255A84] text-[#255A84]'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Module-by-Module Progress ({currentInspectStudent.completedModulesCount}/{currentInspectStudent.totalModulesCount})
              </button>
              <button
                onClick={() => setActiveModalTab('pacing')}
                className={`py-3 border-b-2 transition-all cursor-pointer ${
                  activeModalTab === 'pacing'
                    ? 'border-[#255A84] text-[#255A84]'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Time & Pacing Analytics
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {activeModalTab === 'modules' ? (
                /* Module Breakdown Tab with Interactive Marking */
                <div className="space-y-4">
                  <div className="bg-sky-50/70 border border-sky-200/60 rounded-xl p-3 text-xs text-sky-900 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">Educator Course Module Controls</p>
                      <p className="text-[11px] text-sky-700 mt-0.5">
                        Click <strong>&quot;Mark Module Complete&quot;</strong> to complete all topics within a module at once, or click individual topic pills below to toggle specific topics.
                      </p>
                    </div>
                  </div>

                  {currentInspectStudent.moduleStats.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-8">No modules defined for this course track.</p>
                  ) : (
                    currentInspectStudent.moduleStats.map((mod, idx) => {
                      const isModUpdating = updatingTarget === `module-${mod.id}`;
                      const isCompleted = mod.status === 'completed' || mod.percent === 100;
                      const studentUid = currentInspectStudent.uid || currentInspectStudent.id;

                      return (
                        <div
                          key={mod.id || idx}
                          className="bg-slate-50/90 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-3.5 transition-all hover:border-slate-300 shadow-2xs"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="h-7 w-7 rounded-xl bg-white border border-slate-200 text-[#255A84] font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                {idx + 1}
                              </span>
                              <div className="min-w-0">
                                <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate">{mod.title}</h4>
                                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                  {mod.completedTopics} of {mod.totalTopics} topics completed ({mod.percent}%)
                                </p>
                              </div>
                            </div>

                            {/* Mark Module Complete / Undo Toggle */}
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                disabled={isModUpdating}
                                onClick={() => handleToggleModule(mod.id, studentUid, isCompleted)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer disabled:opacity-60 ${
                                  isCompleted
                                    ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300'
                                    : 'bg-[#255A84] hover:bg-[#1c4566] text-white border border-[#255A84]'
                                }`}
                              >
                                {isModUpdating ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : isCompleted ? (
                                  <>
                                    <CheckCheck size={14} className="text-emerald-700" />
                                    <span>Completed</span>
                                    <RotateCcw size={11} className="text-emerald-600 hover:text-emerald-950 ml-0.5" title="Undo complete" />
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 size={14} />
                                    <span>Mark Module Complete</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="h-2 w-full bg-slate-200/80 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isCompleted ? 'bg-emerald-500' : 'bg-[#255A84]'
                              }`}
                              style={{ width: `${mod.percent}%` }}
                            />
                          </div>

                          {/* Individual Topic Pills */}
                          {mod.topics.length > 0 && (
                            <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Topics ({mod.completedTopics}/{mod.totalTopics}) · Click to toggle
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {mod.topics.map((top) => {
                                  const isTopicUpdating = updatingTarget === `topic-${top.id}`;
                                  return (
                                    <button
                                      type="button"
                                      key={top.id}
                                      disabled={isTopicUpdating}
                                      onClick={() => handleToggleTopic(top.id, studentUid, top.isCompleted)}
                                      className={`flex items-center gap-2 p-2 rounded-xl text-xs text-left transition-all border cursor-pointer active:scale-98 ${
                                        top.isCompleted
                                          ? 'bg-emerald-50/90 border-emerald-300/80 text-emerald-900 hover:bg-emerald-100/80 font-semibold'
                                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                      }`}
                                      title={top.isCompleted ? 'Completed. Click to unmark.' : 'Click to mark complete.'}
                                    >
                                      <div className={`h-4 w-4 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                                        top.isCompleted
                                          ? 'bg-emerald-500 border-emerald-600 text-white'
                                          : 'bg-white border-slate-300 text-transparent hover:border-slate-400'
                                      }`}>
                                        {isTopicUpdating ? (
                                          <Loader2 size={10} className="animate-spin text-slate-500" />
                                        ) : (
                                          <Check size={11} strokeWidth={3} />
                                        )}
                                      </div>
                                      <span className="truncate text-xs flex-1">{top.title}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                /* Time Pacing Tab */
                <div className="space-y-4">
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Joining Date</p>
                        <p className="text-sm font-bold text-slate-800 mt-0.5">{currentInspectStudent.joiningDate || 'Not Specified'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Time Active</p>
                        <p className="text-sm font-bold text-[#F48B1F] mt-0.5">{currentInspectStudent.daysElapsed} Days Elapsed</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="bg-white p-3 rounded-xl border border-slate-100">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Actual Completion</p>
                        <p className="text-xl font-extrabold text-slate-800 mt-1">{currentInspectStudent.actualProgress}%</p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-100">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Target Time Pace</p>
                        <p className="text-xl font-extrabold text-slate-800 mt-1">{currentInspectStudent.expectedProgress}%</p>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-100 flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-600">Pacing Assessment</span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold border ${currentInspectStudent.pacing.badgeClass}`}>
                        {currentInspectStudent.pacing.label}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">
                Changes saved automatically to student academic record
              </span>
              <button
                onClick={() => setInspectStudentId(null)}
                className="px-5 py-2 bg-[#255A84] text-white text-xs font-bold rounded-xl hover:bg-[#1c4566] transition shadow-md cursor-pointer"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
