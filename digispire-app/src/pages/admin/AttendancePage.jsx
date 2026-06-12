import { useState, useEffect, useCallback } from 'react';
import {
  collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp,
  doc, setDoc, deleteDoc, onSnapshot, updateDoc, arrayUnion, arrayRemove, getDoc
} from 'firebase/firestore';
import { db } from '../../firebase';
import {
  QrCode, Clock, History, Trash2, X, Users, Calendar, 
  Settings, ShieldAlert, Plus, Check, Play, UserCheck, AlertTriangle
} from 'lucide-react';
import QRCode from 'qrcode';
import { calculateAttendance } from '../../utils/attendanceEngine';
import AttendanceCalendar from '../../components/AttendanceCalendar';
import { initializeDatabase } from '../../utils/dbInit';
import { triggerHaptic } from '../../utils/haptic';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
];

export default function AttendancePage() {
  const [activeTab, setActiveTab] = useState('live'); // live, schedules, calendar, inspector
  
  // Live Broadcaster States
  const [broadcastBatch, setBroadcastBatch] = useState('morning'); // morning, evening, internship
  const [qrData, setQrData] = useState(null);
  const [qrImageUrl, setQrImageUrl] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [records, setRecords] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [stats, setStats] = useState({ total: 0, today: 0 });
  const [courses, setCourses] = useState([]);
  const [modules, setModules] = useState([]);
  const [topics, setTopics] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedTopics, setSelectedTopics] = useState([]);

  // Database lists
  const [students, setStudents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [cancellations, setCancellations] = useState([]);
  
  // Scheduling Engine States
  const [schedBatch, setSchedBatch] = useState('morning');
  const [schedForm, setSchedForm] = useState({
    startTime: '09:00',
    endTime: '11:00',
    educator: '',
    weeklyDays: [1, 2, 3, 4, 5]
  });
  const [makeupForm, setMakeupForm] = useState({ date: '', startTime: '10:00', endTime: '12:00', reason: '' });
  const [tempForm, setTempForm] = useState({ date: '', startTime: '10:00', endTime: '12:00', reason: '' });
  
  // Holidays & Cancellations States
  const [holidayForm, setHolidayForm] = useState({ date: '', title: '' });
  const [cancelForm, setCancelForm] = useState({ date: '', batchId: 'all', reason: '' });
  const [educators, setEducators] = useState([]);

  // Inspector States
  const [inspectStudentId, setInspectStudentId] = useState('');
  const [studentLogs, setStudentLogs] = useState([]);
  const [inspectTrack, setInspectTrack] = useState('academic'); // academic, internship
  const [selectedInspectBatchId, setSelectedInspectBatchId] = useState('');
  const [quickStudentId, setQuickStudentId] = useState('');

  // Manual Attendance Form States
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    studentId: '',
    date: new Date().toISOString().split('T')[0],
    track: 'academic',
    status: 'present',
    courseId: '',
    moduleId: '',
    topicIds: [],
    batchId: ''
  });

  // Create Batch Form States
  const [showCreateBatchModal, setShowCreateBatchModal] = useState(false);
  const [newBatchForm, setNewBatchForm] = useState({
    id: '',
    name: '',
    educator: '',
    startTime: '09:00',
    endTime: '11:00',
    weeklyDays: [1, 2, 3, 4, 5]
  });

  const fetchData = useCallback(async () => {
    try {
      await initializeDatabase();
    } catch (err) {
      console.error('Failed to initialize database:', err);
    }

    try {
      const cSnap = await getDocs(collection(db, 'courses'));
      setCourses(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to fetch courses:', err);
    }

    try {
      const mSnap = await getDocs(collection(db, 'modules'));
      setModules(mSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to fetch modules:', err);
    }

    try {
      const tSnap = await getDocs(collection(db, 'topics'));
      setTopics(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to fetch topics:', err);
    }

    try {
      const uSnap = await getDocs(collection(db, 'users'));
      const allUsers = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setStudents(allUsers.filter(u => u.role === 'student'));
      setEducators(allUsers.filter(u => u.role === 'admin' || u.role === 'educator'));
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }

    try {
      const bSnap = await getDocs(collection(db, 'batches'));
      setBatches(bSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to fetch batches:', err);
    }

    try {
      const hSnap = await getDocs(collection(db, 'holidays'));
      setHolidays(hSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.date.localeCompare(a.date)));
    } catch (err) {
      console.error('Failed to fetch holidays:', err);
    }

    try {
      const canSnap = await getDocs(collection(db, 'cancelled_classes'));
      setCancellations(canSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.date.localeCompare(a.date)));
    } catch (err) {
      console.error('Failed to fetch cancellations:', err);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);
    
    const q = query(collection(db, 'attendance'), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRecords(docs);

      const today = new Date().toISOString().split('T')[0];
      setStats({
        total: docs.length,
        today: docs.filter(r => r.date === today).length
      });
      setLoadingFeed(false);
    }, (err) => {
      console.error('Realtime sync error:', err);
      setLoadingFeed(false);
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [fetchData]);

  // Real-time synchronization of current batch broadcaster session
  useEffect(() => {
    const docRef = doc(db, 'qr_sessions', broadcastBatch);
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const now = Date.now();
        if (data.expiresAt > now) {
          setQrData(data);
          setTimeLeft(Math.floor((data.expiresAt - now) / 1000));
          try {
            const compressedPayload = { s: data.sessionId, b: broadcastBatch };
            const url = await QRCode.toDataURL(JSON.stringify(compressedPayload), {
              width: 300,
              margin: 2,
              color: { dark: '#255A84', light: '#F8FAFC' }
            });
            setQrImageUrl(url);
          } catch (err) {
            console.error('QR image gen error in listener:', err);
          }
        } else {
          // Clean up expired session in Firestore
          deleteDoc(docRef).catch(console.error);
          setQrData(null);
          setQrImageUrl('');
          setTimeLeft(0);
        }
      } else {
        setQrData(null);
        setQrImageUrl('');
        setTimeLeft(0);
      }
    });

    return () => unsubscribe();
  }, [broadcastBatch]);

  // Update schedule configuration form when active batch changes
  useEffect(() => {
    const activeSched = batches.find(b => b.id === schedBatch);
    if (activeSched) {
      const timer = setTimeout(() => {
        setSchedForm({
          startTime: activeSched.startTime || '09:00',
          endTime: activeSched.endTime || '11:00',
          educator: activeSched.educator || '',
          weeklyDays: activeSched.weeklyDays || [1, 2, 3, 4, 5]
        });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [schedBatch, batches]);

  // Sync schedBatch and broadcastBatch selections dynamically when batches list changes
  useEffect(() => {
    if (batches.length > 0) {
      const missingSched = !schedBatch || !batches.some(b => b.id === schedBatch);
      const missingBroadcast = !broadcastBatch || !batches.some(b => b.id === broadcastBatch);
      if (missingSched || missingBroadcast) {
        const timer = setTimeout(() => {
          if (missingSched) {
            setSchedBatch(batches[0].id);
          }
          if (missingBroadcast) {
            setBroadcastBatch(batches[0].id);
          }
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [batches, schedBatch, broadcastBatch]);  // Realtime subscribe to student logs for inspector
  useEffect(() => {
    if (!inspectStudentId) {
      const timer = setTimeout(() => setStudentLogs([]), 0);
      return () => clearTimeout(timer);
    }
    const q = query(collection(db, 'attendance'), where('studentId', '==', inspectStudentId));
    const unsubscribe = onSnapshot(q, (snap) => {
      setStudentLogs(snap.docs.map(d => d.data()));
    }, (err) => {
      console.error('Inspector logs sync error:', err);
    });
    return () => unsubscribe();
  }, [inspectStudentId]);

  const generateQR = async () => {
    if (broadcastBatch !== 'internship' && (!selectedCourse || !selectedModule)) {
      alert("Please select a Course and Module first.");
      return;
    }
    const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = Date.now() + (5 * 60 * 1000); // 5 mins

    const newQr = {
      type: broadcastBatch === 'internship' ? 'internship' : 'academic',
      batchId: broadcastBatch,
      sessionId,
      expiresAt,
      date: new Date().toISOString().split('T')[0],
      coveredCourse: selectedCourse,
      coveredModule: selectedModule,
      coveredTopics: selectedTopics
    };

    try {
      await setDoc(doc(db, 'qr_sessions', broadcastBatch), newQr);
      
      await addDoc(collection(db, 'class_sessions'), {
        type: newQr.type,
        batchId: newQr.batchId,
        date: newQr.date,
        sessionId: newQr.sessionId,
        timestamp: serverTimestamp(),
        coveredCourse: selectedCourse,
        coveredModule: selectedModule,
        coveredTopics: selectedTopics
      });
    } catch (err) {
      console.error('QR Generation Error:', err);
    }
  };

  const discardQR = useCallback(async () => {
    try {
      await deleteDoc(doc(db, 'qr_sessions', broadcastBatch));
    } catch (err) {
      console.error('Failed to discard QR:', err);
    }
  }, [broadcastBatch]);

  useEffect(() => {
    if (timeLeft <= 0) {
      if (qrData) {
        const timer = setTimeout(() => {
          discardQR();
        }, 0);
        return () => clearTimeout(timer);
      }
      return;
    }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, qrData, discardQR]);

  const handleUpdateStatus = async (dateStr, newStatus) => {
    if (!selectedStudent) return;
    try {
      const q = query(
        collection(db, 'attendance'),
        where('studentId', '==', selectedStudent.studentId),
        where('date', '==', dateStr),
        where('type', '==', inspectTrack)
      );
      const snap = await getDocs(q);
      
      if (newStatus === 'absent') {
        if (!snap.empty) {
          await Promise.all(snap.docs.map(docSnap => deleteDoc(docSnap.ref)));
        }
      } else {
        if (!snap.empty) {
          await Promise.all(snap.docs.map(docSnap => updateDoc(docSnap.ref, {
            status: newStatus,
            timestamp: serverTimestamp()
          })));
        } else {
          await addDoc(collection(db, 'attendance'), {
            studentId: selectedStudent.studentId,
            uid: selectedStudent.uid || selectedStudent.id,
            name: selectedStudent.name,
            batchId: selectedStudent.batchId || 'morning',
            isIntern: !!selectedStudent.isIntern,
            type: inspectTrack,
            date: dateStr,
            timestamp: serverTimestamp(),
            status: newStatus
          });
        }
      }
      alert(`Updated ${selectedStudent.name}'s status for ${dateStr} to ${newStatus}!`);
    } catch (err) {
      console.error(err);
      alert('Failed to update status: ' + err.message);
    }
  };

  const handleQuickCheckIn = async (e) => {
    e.preventDefault();
    if (!quickStudentId || !qrData) return;
    
    const student = students.find(s => s.studentId === quickStudentId);
    if (!student) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      
      const q = query(
        collection(db, 'attendance'),
        where('studentId', '==', student.studentId),
        where('date', '==', today),
        where('type', '==', qrData.type)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        alert(`${student.name} is already checked in for today's ${qrData.type} session.`);
        return;
      }

      const attendanceDoc = {
        studentId: student.studentId,
        uid: student.uid || student.id,
        name: student.name,
        batchId: student.batchId || 'morning',
        isIntern: !!student.isIntern,
        type: qrData.type,
        date: today,
        timestamp: serverTimestamp(),
        sessionId: qrData.sessionId,
        status: 'present',
        coveredCourse: qrData.coveredCourse || '',
        coveredModule: qrData.coveredModule || '',
        coveredTopics: qrData.coveredTopics || []
      };

      await addDoc(collection(db, 'attendance'), attendanceDoc);

      if (qrData.coveredTopics && qrData.coveredTopics.length > 0) {
        await Promise.all(qrData.coveredTopics.map(topicId => {
          return updateDoc(doc(db, 'topics', topicId), {
            completedStudents: arrayUnion(student.uid || student.id)
          }).catch(console.error);
        }));
      }

      setQuickStudentId('');
      alert(`Successfully checked in ${student.name}!`);
    } catch (err) {
      console.error(err);
      alert('Failed to check in: ' + err.message);
    }
  };

  const handleSubmitManualAttendance = async (e) => {
    e.preventDefault();
    if (!manualForm.studentId || !manualForm.date) {
      alert("Student and Date are required.");
      return;
    }

    const student = students.find(s => s.studentId === manualForm.studentId);
    if (!student) {
      alert("Student not found.");
      return;
    }

    try {
      const q = query(
        collection(db, 'attendance'),
        where('studentId', '==', manualForm.studentId),
        where('date', '==', manualForm.date),
        where('type', '==', manualForm.track)
      );
      const snap = await getDocs(q);

      if (manualForm.status === 'absent') {
        if (!snap.empty) {
          await Promise.all(snap.docs.map(docSnap => deleteDoc(docSnap.ref)));
        }
        alert(`Attendance for ${student.name} on ${manualForm.date} set to Absent.`);
      } else {
        const attendanceDoc = {
          studentId: student.studentId,
          uid: student.uid || student.id,
          name: student.name,
          batchId: manualForm.batchId || student.batchId || 'morning',
          isIntern: !!student.isIntern,
          type: manualForm.track,
          date: manualForm.date,
          status: manualForm.status,
          timestamp: serverTimestamp(),
          coveredCourse: manualForm.courseId || '',
          coveredModule: manualForm.moduleId || '',
          coveredTopics: manualForm.topicIds || []
        };

        if (!snap.empty) {
          await Promise.all(snap.docs.map(docSnap => setDoc(docSnap.ref, attendanceDoc, { merge: true })));
        } else {
          await addDoc(collection(db, 'attendance'), attendanceDoc);
        }

        if ((manualForm.status === 'present' || manualForm.status === 'makeup') && manualForm.topicIds && manualForm.topicIds.length > 0) {
          await Promise.all(manualForm.topicIds.map(topicId => {
            return updateDoc(doc(db, 'topics', topicId), {
              completedStudents: arrayUnion(student.uid || student.id)
            }).catch(console.error);
          }));
        }
        alert(`Successfully logged manual attendance for ${student.name}!`);
      }

      setShowManualModal(false);
      setManualForm({
        studentId: '',
        date: new Date().toISOString().split('T')[0],
        track: 'academic',
        status: 'present',
        courseId: '',
        moduleId: '',
        topicIds: [],
        batchId: ''
      });
    } catch (err) {
      console.error("Failed to save manual attendance:", err);
      alert("Failed to save manual attendance: " + err.message);
    }
  };

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    if (!newBatchForm.id.trim() || !newBatchForm.name.trim()) {
      alert("Batch ID/Code and Name are required.");
      return;
    }

    const cleanId = newBatchForm.id.trim().toLowerCase().replace(/\s+/g, '_');
    
    try {
      const docRef = doc(db, 'batches', cleanId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        alert(`A batch with code "${cleanId}" already exists. Please choose a different code.`);
        return;
      }

      await setDoc(docRef, {
        id: cleanId,
        name: newBatchForm.name.trim(),
        educator: newBatchForm.educator.trim(),
        startTime: newBatchForm.startTime,
        endTime: newBatchForm.endTime,
        weeklyDays: newBatchForm.weeklyDays,
        temporarySchedules: [],
        makeupClasses: []
      });

      alert(`Batch "${newBatchForm.name}" created successfully!`);
      setShowCreateBatchModal(false);
      setNewBatchForm({
        id: '',
        name: '',
        educator: '',
        startTime: '09:00',
        endTime: '11:00',
        weeklyDays: [1, 2, 3, 4, 5]
      });
      fetchData();
      setSchedBatch(cleanId);
    } catch (err) {
      console.error(err);
      alert('Failed to create batch: ' + err.message);
    }
  };

  const deleteRecord = async (id) => {
    if (!window.confirm('Remove this attendance entry?')) return;
    try {
      await deleteDoc(doc(db, 'attendance', id));
    } catch (err) { console.error(err); }
  };

  // Scheduling engine updates
  const handleSaveBatchSchedule = async (e) => {
    e.preventDefault();
    try {
      const batchRef = doc(db, 'batches', schedBatch);
      await setDoc(batchRef, {
        startTime: schedForm.startTime,
        endTime: schedForm.endTime,
        educator: schedForm.educator.trim(),
        weeklyDays: schedForm.weeklyDays
      }, { merge: true });
      alert('Batch schedule settings updated successfully!');
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteBatch = async () => {
    if (!window.confirm(`Are you sure you want to delete the batch "${schedBatch}"? Student profiles assigned to this batch will remain, but will lose this batch's configurations.`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'batches', schedBatch));
      alert("Batch deleted successfully!");
      
      const remainingBatches = batches.filter(b => b.id !== schedBatch);
      const nextBatch = remainingBatches[0]?.id || '';
      setSchedBatch(nextBatch);
      
      fetchData();
    } catch (err) {
      console.error("Failed to delete batch:", err);
      alert("Failed to delete batch: " + err.message);
    }
  };

  const handleAddMakeupClass = async (e) => {
    e.preventDefault();
    if (!makeupForm.date) return;
    try {
      const batchRef = doc(db, 'batches', schedBatch);
      await updateDoc(batchRef, {
        makeupClasses: arrayUnion({
          date: makeupForm.date,
          startTime: makeupForm.startTime,
          endTime: makeupForm.endTime,
          reason: makeupForm.reason.trim()
        })
      });
      setMakeupForm({ date: '', startTime: '10:00', endTime: '12:00', reason: '' });
      fetchData();
      alert('Makeup class scheduled!');
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveMakeup = async (makeup) => {
    if (!window.confirm('Remove this makeup class schedule?')) return;
    try {
      const batchRef = doc(db, 'batches', schedBatch);
      await updateDoc(batchRef, {
        makeupClasses: arrayRemove(makeup)
      });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleAddTempSchedule = async (e) => {
    e.preventDefault();
    if (!tempForm.date) return;
    try {
      const batchRef = doc(db, 'batches', schedBatch);
      await updateDoc(batchRef, {
        temporarySchedules: arrayUnion({
          date: tempForm.date,
          startTime: tempForm.startTime,
          endTime: tempForm.endTime,
          reason: tempForm.reason.trim()
        })
      });
      setTempForm({ date: '', startTime: '10:00', endTime: '12:00', reason: '' });
      fetchData();
      alert('Temporary schedule adjustment added!');
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveTemp = async (temp) => {
    if (!window.confirm('Remove this temporary schedule adjustment?')) return;
    try {
      const batchRef = doc(db, 'batches', schedBatch);
      await updateDoc(batchRef, {
        temporarySchedules: arrayRemove(temp)
      });
      fetchData();
    } catch (err) { console.error(err); }
  };

  // Holidays and Cancellations handlers
  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!holidayForm.date || !holidayForm.title.trim()) return;
    try {
      await setDoc(doc(db, 'holidays', holidayForm.date), {
        date: holidayForm.date,
        title: holidayForm.title.trim()
      });
      setHolidayForm({ date: '', title: '' });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleDeleteHoliday = async (id) => {
    if (!window.confirm('Remove this holiday?')) return;
    try {
      await deleteDoc(doc(db, 'holidays', id));
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleAddCancellation = async (e) => {
    e.preventDefault();
    if (!cancelForm.date || !cancelForm.reason.trim()) return;
    try {
      await addDoc(collection(db, 'cancelled_classes'), {
        date: cancelForm.date,
        batchId: cancelForm.batchId,
        reason: cancelForm.reason.trim(),
        timestamp: serverTimestamp()
      });
      setCancelForm({ date: '', batchId: 'all', reason: '' });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleDeleteCancellation = async (id) => {
    if (!window.confirm('Re-enable this class?')) return;
    try {
      await deleteDoc(doc(db, 'cancelled_classes', id));
      fetchData();
    } catch (err) { console.error(err); }
  };

  const toggleDayOfWeek = (dayVal) => {
    setSchedForm(prev => {
      const isExist = prev.weeklyDays.includes(dayVal);
      return {
        ...prev,
        weeklyDays: isExist 
          ? prev.weeklyDays.filter(d => d !== dayVal) 
          : [...prev.weeklyDays, dayVal].sort()
      };
    });
  };

  // Inspector Student Details
  const selectedStudent = students.find(s => s.studentId === inspectStudentId);
  const studentBatchIds = selectedStudent?.batchIds || (selectedStudent?.batchId ? [selectedStudent.batchId] : ['morning']);
  const activeInspectBatchId = selectedInspectBatchId || (inspectTrack === 'internship' ? 'internship' : studentBatchIds[0] || 'morning');
  const selectedBatchObj = batches.find(b => b.id === activeInspectBatchId);
  const filteredStudentLogs = studentLogs.filter(log => 
    (log.type || 'academic') === inspectTrack &&
    (inspectTrack === 'internship' ? true : log.batchId === activeInspectBatchId)
  );

  const inspectedCalc = (selectedStudent && selectedBatchObj)
    ? calculateAttendance({
        student: selectedStudent,
        attendanceLogs: filteredStudentLogs,
        batchSchedule: selectedBatchObj,
        holidays,
        cancelledClasses: cancellations
      })
    : null;

  return (
    <div className="space-y-5">
      {/* ─── Page Header ─── */}
      <div className="section-header">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Live Attendance Console</h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Broadcast check-in codes, configure schedules, and inspect records</p>
        </div>
        
        {/* Tabs + action – responsive layout */}
        <div className="flex flex-col gap-2 self-start sm:self-auto w-full sm:w-auto">
          {/* Tab bar – horizontally scrollable on tiny phones */}
          <div className="tabs-scroll bg-slate-100 rounded-2xl">
            {[
              { id: 'live', label: 'Live', icon: QrCode },
              { id: 'schedules', label: 'Schedules', icon: Settings },
              { id: 'calendar', label: 'Calendar', icon: Calendar },
              { id: 'inspector', label: 'Inspector', icon: UserCheck },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { triggerHaptic('light'); setActiveTab(tab.id); }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <tab.icon size={12} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Log Manual — full width on mobile, inline on sm+ */}
          <button
            onClick={() => { triggerHaptic('light'); setShowManualModal(true); }}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#255A84] hover:bg-[#1a4261] text-white rounded-xl text-[11px] font-bold uppercase tracking-wider shadow-sm transition active:scale-95 cursor-pointer w-full sm:w-auto"
          >
            <Plus size={13} />
            Log Manual Attendance
          </button>
        </div>
      </div>

      {/* Broadcaster Console Tab */}
      {activeTab === 'live' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {/* Left Control Card */}
          <div className="lg:col-span-1 card-premium p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <QrCode size={18} className="text-[#255A84]" /> Code Broadcaster
                </h2>
                
                {/* Switcher inside broadcaster */}
                <select
                  disabled={!!qrData}
                  value={broadcastBatch}
                  onChange={e => setBroadcastBatch(e.target.value)}
                  className="select-premium py-1 px-3.5 text-xs uppercase font-bold tracking-widest max-w-[120px] bg-slate-50 border border-slate-100 rounded-lg cursor-pointer"
                >
                  {batches.length === 0 ? (
                    <>
                      <option value="morning">Morning</option>
                      <option value="evening">Evening</option>
                      <option value="internship">Internship</option>
                    </>
                  ) : (
                    batches.map(b => (
                      <option key={b.id} value={b.id}>{b.name || b.id}</option>
                    ))
                  )}
                </select>
              </div>

              {qrData ? (
                <div className="space-y-6 text-center">
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl inline-block shadow-sm">
                    {qrImageUrl && <img src={qrImageUrl} alt="QR Code" className="h-52 w-52 mx-auto object-contain rounded-2xl" />}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Active Verification Code</p>
                    <p className="text-3xl font-black text-slate-800 tracking-widest mt-1 font-mono">{qrData.sessionId}</p>
                  </div>
                  
                  {qrData.coveredCourse && (
                    <div className="p-4 bg-blue-50/50 border border-blue-100/40 rounded-2xl text-left space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Class Details</p>
                      <p className="text-xs font-bold text-slate-700">
                        {courses.find(c => c.id === qrData.coveredCourse)?.name || qrData.coveredCourse}
                      </p>
                      {qrData.coveredModule && (
                        <p className="text-[11px] text-slate-500 font-medium">
                          {modules.find(m => m.id === qrData.coveredModule)?.title || qrData.coveredModule}
                        </p>
                      )}
                      {qrData.coveredTopics?.length > 0 && (
                        <p className="text-[10px] text-slate-400 font-semibold mt-1">
                          Topics: {qrData.coveredTopics.map(tid => topics.find(t => t.id === tid)?.title || tid).join(', ')}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center gap-3">
                    <Clock size={16} className="text-[#255A84]" />
                    <span className="text-xs font-bold text-slate-700">Expires: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
                  </div>

                  {/* Quick Manual Check-in */}
                  <form onSubmit={handleQuickCheckIn} className="pt-4 border-t border-slate-200/60 space-y-3">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest text-left ml-1">Quick Check-in Student</label>
                    <div className="flex gap-2">
                      <select
                        value={quickStudentId}
                        onChange={e => setQuickStudentId(e.target.value)}
                        className="select-premium py-2 text-xs flex-1 cursor-pointer"
                      >
                        <option value="">Select Student...</option>
                        {students
                          .filter(s => {
                            if (qrData.type === 'internship') return s.isIntern;
                            const enrolled = s.batchIds || (s.batchId ? [s.batchId] : []);
                            return enrolled.includes(qrData.batchId);
                          })
                          .map(s => (
                            <option key={s.id} value={s.studentId}>
                              {s.name} ({s.studentId})
                            </option>
                          ))
                        }
                      </select>
                      <button type="submit" disabled={!quickStudentId} className="px-4 py-2 bg-[#255A84] hover:bg-[#1a4261] text-white rounded-xl text-xs font-bold transition disabled:opacity-50 active:scale-95 shrink-0">
                        Check-in
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50/50 border border-blue-100/60 rounded-2xl text-blue-600 text-xs font-medium leading-relaxed">
                    Generate an entry pass for the <strong>{broadcastBatch}</strong> batch. Students scan this or input the session code to mark present.
                  </div>
                  
                  {broadcastBatch !== 'internship' ? (
                    <>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Enrolled Course *</label>
                        <select
                          value={selectedCourse}
                          onChange={e => { setSelectedCourse(e.target.value); setSelectedModule(''); setSelectedTopics([]); }}
                          className="select-premium cursor-pointer"
                        >
                          <option value="">Select Course...</option>
                          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Academic Module *</label>
                        <select 
                          value={selectedModule} 
                          onChange={e => { setSelectedModule(e.target.value); setSelectedTopics([]); }}
                          disabled={!selectedCourse}
                          className="select-premium disabled:opacity-50"
                        >
                          <option value="">Select Module...</option>
                          {modules.filter(m => m.courseId === selectedCourse).map(m => (
                            <option key={m.id} value={m.id}>{m.title}</option>
                          ))}
                        </select>
                      </div>

                      {selectedModule && (
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Topics Credit Synced</label>
                          <div className="mt-1 max-h-32 overflow-y-auto no-scrollbar border border-slate-100 rounded-2xl p-2 bg-slate-50/50">
                            {topics.filter(t => t.moduleId === selectedModule).length === 0 ? (
                              <p className="text-xs text-slate-400 p-2 text-center">No topics found.</p>
                            ) : (
                              topics.filter(t => t.moduleId === selectedModule).map(topic => (
                                <label key={topic.id} className="flex items-start gap-2.5 px-2.5 py-2 hover:bg-white rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-100">
                                  <input 
                                    type="checkbox" 
                                    className="mt-0.5 rounded text-[#255A84] focus:ring-[#255A84] border-slate-300 flex-shrink-0"
                                    checked={selectedTopics.includes(topic.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) setSelectedTopics(prev => [...prev, topic.id]);
                                      else setSelectedTopics(prev => prev.filter(id => id !== topic.id));
                                    }}
                                  />
                                  <span className="text-xs font-semibold text-slate-700 leading-snug">{topic.title}</span>
                                </label>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-4 bg-emerald-50/50 border border-emerald-100/60 rounded-2xl text-emerald-600 text-xs font-semibold leading-relaxed">
                      Internship track logs daily attendance only. No course curriculum topics are required.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              {qrData ? (
                <button
                  onClick={discardQR}
                  className="w-full mt-8 py-4 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-xs uppercase tracking-widest transition active:scale-95 flex items-center justify-center gap-2 border border-rose-100 cursor-pointer"
                >
                  <X size={14} /> Discard Session
                </button>
              ) : (
                <button
                  onClick={generateQR}
                  className="w-full mt-8 py-4 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer btn-primary-premium"
                >
                  <Play size={14} />
                  Start {broadcastBatch} Session
                </button>
              )}
            </div>
          </div>

          {/* Live Feed Card */}
          <div className="lg:col-span-2 card-premium overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2 font-sans">
                <History size={18} className="text-[#255A84]" /> Dynamic Live Feed (Today: {stats.today})
              </h2>
            </div>

            <div className="overflow-y-auto max-h-[60vh] sm:max-h-[500px]">
              {loadingFeed && records.length === 0 ? (
                <div className="py-20 flex justify-center"><div className="animate-spin h-6 w-6 border-2 border-[#255A84] border-t-transparent rounded-full" /></div>
              ) : records.length === 0 ? (
                <div className="py-20 text-center text-slate-400">
                  <Users size={40} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-bold">No attendance logs broadcasted today</p>
                </div>
              ) : (
                <table className="w-full text-sm responsive-table">
                  <thead className="bg-slate-50/50 text-[11px] font-bold uppercase tracking-widest text-slate-400 sticky top-0 z-10">
                    <tr>
                      <th className="text-left px-8 py-3">Student</th>
                      <th className="text-left px-4 py-3">Track</th>
                      <th className="text-left px-4 py-3">Topic Credited</th>
                      <th className="text-left px-4 py-3">Check-in Time</th>
                      <th className="text-right px-8 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {records.map(record => (
                      <tr key={record.id} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-4" data-label="Student">
                          <p className="font-bold text-slate-800">{record.name}</p>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-mono">{record.studentId}</p>
                        </td>
                        <td className="px-4 py-4" data-label="Track">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest ${
                            record.type === 'internship' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                            record.batchId === 'morning' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                          }`}>
                            {record.type === 'internship' ? 'Internship' : record.batchId}
                          </span>
                        </td>
                        <td className="px-4 py-4" data-label="Topic">
                          {record.coveredCourse ? (
                            <div>
                              <p className="text-xs font-bold text-slate-700">
                                {courses.find(c => c.id === record.coveredCourse)?.name || 'Unknown Course'}
                              </p>
                              <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                                {modules.find(m => m.id === record.coveredModule)?.title || 'Unknown Module'}
                                {record.coveredTopics?.length > 0 && ` • ${record.coveredTopics.length} Topics`}
                              </p>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium italic">General Attendance</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-slate-500 font-medium" data-label="Check-in Time">
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-slate-300" />
                            <span className="text-xs font-semibold font-mono">{record.timestamp?.toDate ? record.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}</span>
                          </div>
                        </td>
                        <td className="px-8 py-4 text-right" data-label="Actions">
                          <button onClick={() => deleteRecord(record.id)} className="p-2.5 btn-outline-premium text-slate-400 hover:text-red-500 hover:bg-slate-50 rounded-xl transition active:scale-95 border border-slate-100 sm:border-transparent hover:border-slate-100 shadow-sm sm:shadow-none sm:opacity-0 sm:group-hover:opacity-100">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Batch Scheduling Engine Tab */}
      {activeTab === 'schedules' && (
        <div className="space-y-5 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                  <Settings size={15} className="text-[#255A84]" /> Scheduling Configurations
                </h2>
                <p className="text-[11px] text-slate-400 mt-1">Modify recurring weekly schedules, hours, and batch settings</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateBatchModal(true)}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider shadow-sm transition active:scale-95 cursor-pointer w-full sm:w-auto"
              >
                <Plus size={13} />
                Create New Batch
              </button>
            </div>
            
            {/* Batch selector chips */}
            <div className="chip-scroll">
              {batches.length === 0 ? (
                ['morning', 'evening', 'internship'].map(b => (
                  <button
                    key={b} onClick={() => setSchedBatch(b)}
                    className={`px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer border whitespace-nowrap ${
                      schedBatch === b ? 'bg-[#255A84] text-white border-transparent shadow-sm' : 'bg-white text-slate-500 border-slate-200'
                    }`}
                  >
                    {b}
                  </button>
                ))
              ) : (
                batches.map(b => (
                  <button
                    key={b.id} onClick={() => setSchedBatch(b.id)}
                    className={`px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer border whitespace-nowrap ${
                      schedBatch === b.id ? 'bg-[#255A84] text-white border-transparent shadow-sm' : 'bg-white text-slate-500 border-slate-200'
                    }`}
                  >
                    {b.name || b.id}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Config Form */}
            <div className="lg:col-span-1 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
              <form onSubmit={handleSaveBatchSchedule} className="space-y-5">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-50 pb-2">Weekly Profile</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Start Time</label>
                    <input type="time" value={schedForm.startTime} onChange={e => setSchedForm(f => ({ ...f, startTime: e.target.value }))} className="input-premium" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">End Time</label>
                    <input type="time" value={schedForm.endTime} onChange={e => setSchedForm(f => ({ ...f, endTime: e.target.value }))} className="input-premium" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Educator / Teacher *</label>
                  <select
                    required
                    value={schedForm.educator}
                    onChange={e => setSchedForm(f => ({ ...f, educator: e.target.value }))}
                    className="select-premium cursor-pointer text-xs"
                  >
                    <option value="">Select Educator...</option>
                    {educators.map(ed => (
                      <option key={ed.id} value={ed.name || ed.email}>{ed.name || ed.email}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Weekly Class Days</label>
                  <div className="days-grid">
                    {DAYS_OF_WEEK.map(day => {
                      const isActive = schedForm.weeklyDays.includes(day.value);
                      return (
                        <button
                          key={day.value} type="button" onClick={() => toggleDayOfWeek(day.value)}
                          className={`py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 ${
                            isActive
                              ? 'bg-[#255A84] text-white border-transparent shadow-md shadow-[#255A84]/10'
                              : 'bg-slate-50 text-slate-500 border-transparent hover:bg-slate-100'
                          }`}
                        >
                          {day.label.substring(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-3 mt-2">
                  <button type="submit" className="flex-1 py-4 btn-primary-premium">
                    Save Configurations
                  </button>
                  {schedBatch && (
                    <button
                      type="button"
                      onClick={handleDeleteBatch}
                      className="px-4 py-4 border border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-xl text-xs font-bold uppercase tracking-wider transition active:scale-95 cursor-pointer shrink-0"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Right Column: Special Exceptions (Makeup & Temporary Schedules) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Makeup Sessions */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-50 pb-2 flex items-center justify-between">
                  <span>Makeup Classes / Extra Sessions</span>
                  <span className="text-[11px] text-slate-400 font-medium">Adds scheduled session on custom date</span>
                </h3>

                <form onSubmit={handleAddMakeupClass} className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-4 items-end">
                  <div className="sm:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Date</label>
                    <input required type="date" value={makeupForm.date} onChange={e => setMakeupForm(f => ({ ...f, date: e.target.value }))} className="input-premium py-2 text-xs" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Time</label>
                    <div className="flex gap-1">
                      <input required type="time" value={makeupForm.startTime} onChange={e => setMakeupForm(f => ({ ...f, startTime: e.target.value }))} className="input-premium py-2 px-1 text-center text-xs" />
                      <input required type="time" value={makeupForm.endTime} onChange={e => setMakeupForm(f => ({ ...f, endTime: e.target.value }))} className="input-premium py-2 px-1 text-center text-xs" />
                    </div>
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Reason / Notes</label>
                    <input required type="text" value={makeupForm.reason} onChange={e => setMakeupForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Syllabus recovery" className="input-premium py-2 text-xs" />
                  </div>
                  <button type="submit" className="py-2.5 btn-primary-premium flex items-center justify-center gap-1">
                    <Plus size={14} /> Schedule
                  </button>
                </form>

                <div className="mt-6 space-y-2 max-h-48 overflow-y-auto no-scrollbar">
                  {batches.find(b => b.id === schedBatch)?.makeupClasses?.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">No makeup sessions scheduled</p>
                  ) : (
                    batches.find(b => b.id === schedBatch)?.makeupClasses?.map((make, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-slate-800">{make.date}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{make.startTime} - {make.endTime} {make.reason ? `· ${make.reason}` : ''}</p>
                        </div>
                        <button onClick={() => handleRemoveMakeup(make)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Temporary Schedules */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-50 pb-2 flex items-center justify-between">
                  <span>Temporary Schedule Changes</span>
                  <span className="text-[11px] text-slate-400 font-medium">Overrides regular class hours for a single day</span>
                </h3>

                <form onSubmit={handleAddTempSchedule} className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-4 items-end">
                  <div className="sm:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Date</label>
                    <input required type="date" value={tempForm.date} onChange={e => setTempForm(f => ({ ...f, date: e.target.value }))} className="input-premium py-2 text-xs" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Time</label>
                    <div className="flex gap-1">
                      <input required type="time" value={tempForm.startTime} onChange={e => setTempForm(f => ({ ...f, startTime: e.target.value }))} className="input-premium py-2 px-1 text-center text-xs" />
                      <input required type="time" value={tempForm.endTime} onChange={e => setTempForm(f => ({ ...f, endTime: e.target.value }))} className="input-premium py-2 px-1 text-center text-xs" />
                    </div>
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Reason / Notes</label>
                    <input required type="text" value={tempForm.reason} onChange={e => setTempForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Exam slot" className="input-premium py-2 text-xs" />
                  </div>
                  <button type="submit" className="py-2.5 btn-primary-premium flex items-center justify-center gap-1">
                    <Plus size={14} /> Add Override
                  </button>
                </form>

                <div className="mt-6 space-y-2 max-h-48 overflow-y-auto no-scrollbar">
                  {batches.find(b => b.id === schedBatch)?.temporarySchedules?.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">No overrides registered</p>
                  ) : (
                    batches.find(b => b.id === schedBatch)?.temporarySchedules?.map((temp, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-slate-800">{temp.date}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{temp.startTime} - {temp.endTime} {temp.reason ? `· ${temp.reason}` : ''}</p>
                        </div>
                        <button onClick={() => handleRemoveTemp(temp)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Academy Exceptions Log Tab (Holidays & Cancellations) */}
      {activeTab === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
          {/* Holidays */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Calendar size={18} className="text-yellow-500" /> Academy-Wide Holidays
              </h2>
              <p className="text-xs text-slate-400 mt-1">Excludes class sessions from calculation on all batch operations</p>
            </div>

            <form onSubmit={handleAddHoliday} className="flex flex-col sm:flex-row gap-3 pt-2">
              <input required type="date" value={holidayForm.date} onChange={e => setHolidayForm(h => ({ ...h, date: e.target.value }))} className="input-premium py-2 text-xs sm:max-w-[150px]" />
              <input required type="text" value={holidayForm.title} onChange={e => setHolidayForm(h => ({ ...h, title: e.target.value }))} placeholder="e.g. Independence Day" className="input-premium py-2 text-xs flex-1" />
              <button type="submit" className="py-2 px-5 btn-primary-premium shrink-0 flex items-center gap-1.5 text-xs">
                <Plus size={14} /> Add Holiday
              </button>
            </form>

            <div className="overflow-y-auto max-h-[300px] border border-slate-50 rounded-xl mt-4 divide-y divide-slate-100">
              {holidays.length === 0 ? (
                <p className="text-xs text-slate-400 p-8 text-center italic">No holidays logged</p>
              ) : (
                holidays.map(h => (
                  <div key={h.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="font-bold text-slate-800 text-xs">{h.title}</p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">{h.date}</p>
                    </div>
                    <button onClick={() => handleDeleteHoliday(h.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cancellations */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <ShieldAlert size={18} className="text-rose-500" /> Cancelled Classes Log
              </h2>
              <p className="text-xs text-slate-400 mt-1">Logs unexpected day cancellations for specific or all batches</p>
            </div>

            <form onSubmit={handleAddCancellation} className="space-y-3 pt-2">
              <div className="flex flex-wrap sm:flex-nowrap gap-3">
                <input required type="date" value={cancelForm.date} onChange={e => setCancelForm(c => ({ ...c, date: e.target.value }))} className="input-premium py-2 text-xs flex-1" />
                <select value={cancelForm.batchId} onChange={e => setCancelForm(c => ({ ...c, batchId: e.target.value }))} className="select-premium py-2 text-xs flex-1">
                  <option value="all">All Batches</option>
                  <option value="morning">Morning Only</option>
                  <option value="evening">Evening Only</option>
                  <option value="internship">Internship Only</option>
                </select>
              </div>
              <div className="flex gap-3">
                <input required type="text" value={cancelForm.reason} onChange={e => setCancelForm(c => ({ ...c, reason: e.target.value }))} placeholder="Reason: e.g. Heavy Rain / Educator unavailable" className="input-premium py-2 text-xs flex-1" />
                <button type="submit" className="py-2.5 px-5 btn-primary-premium shrink-0 text-xs flex items-center gap-1.5">
                  <Plus size={14} /> Log Cancel
                </button>
              </div>
            </form>

            <div className="overflow-y-auto max-h-[300px] border border-slate-50 rounded-xl mt-4 divide-y divide-slate-100">
              {cancellations.length === 0 ? (
                <p className="text-xs text-slate-400 p-8 text-center italic">No cancellations logged</p>
              ) : (
                cancellations.map(c => (
                  <div key={c.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="font-bold text-slate-800 text-xs">{c.reason}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        <span className="font-mono">{c.date}</span> · <span className="uppercase font-bold text-slate-400">{c.batchId} batch</span>
                      </p>
                    </div>
                    <button onClick={() => handleDeleteCancellation(c.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Student Inspector Calendar Tab */}
      {activeTab === 'inspector' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <UserCheck size={18} className="text-[#255A84]" /> Student Logs Inspector
              </h2>
              <p className="text-xs text-slate-400 mt-1">Audit individual student attendance calendar, logs, and computations</p>
            </div>
            
            <div className="flex flex-wrap gap-3 items-center">
              {selectedStudent?.isIntern && (
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setInspectTrack('academic')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                      inspectTrack === 'academic' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Academic
                  </button>
                  <button
                    onClick={() => setInspectTrack('internship')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                      inspectTrack === 'internship' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Internship
                  </button>
                </div>
              )}

              <select
                value={inspectStudentId}
                onChange={e => {
                  setInspectStudentId(e.target.value);
                  setInspectTrack('academic');
                  setSelectedInspectBatchId('');
                }}
                className="select-premium py-2 px-4 text-xs font-bold text-slate-600 min-w-[200px] cursor-pointer"
              >
                <option value="">Select Student...</option>
                {students.map(s => (
                  <option key={s.id} value={s.studentId}>
                    {s.name} ({s.studentId})
                  </option>
                ))}
              </select>

              {selectedStudent && studentBatchIds.length > 1 && inspectTrack !== 'internship' && (
                <select
                  value={activeInspectBatchId}
                  onChange={e => setSelectedInspectBatchId(e.target.value)}
                  className="select-premium py-2 px-4 text-xs font-bold text-slate-600 min-w-[150px] cursor-pointer"
                >
                  {studentBatchIds.map(bId => {
                    const batchObj = batches.find(b => b.id === bId);
                    return (
                      <option key={bId} value={bId}>
                        {batchObj?.name || bId}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          </div>

          {!inspectStudentId ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-400">
              <Users size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-xs font-bold">Select a student from the dropdown above to audit their calendar logs</p>
            </div>
          ) : !selectedStudent ? (
            <p className="text-xs text-slate-400">Student record not found</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Computation Engine Details */}
              <div className="lg:col-span-1 space-y-6">
                {/* Profile card */}
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-[#255A84] text-white flex items-center justify-center font-bold text-sm overflow-hidden shrink-0">
                      {selectedStudent.photoURL ? (
                        <img src={selectedStudent.photoURL} alt={selectedStudent.name} className="h-full w-full object-cover" />
                      ) : (
                        <img src="/logo.png" alt="Logo" className="h-full w-full object-contain p-1.5 bg-white" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">{selectedStudent.name}</h3>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{selectedStudent.studentId} · {studentBatchIds.join(', ')}</p>
                    </div>
                  </div>

                  <div className="border-t border-slate-50 pt-4 space-y-2 text-xs font-medium text-slate-600">
                    <p><span className="text-slate-400">Date Enrolled:</span> {selectedStudent.joiningDate || 'N/A'}</p>
                    <p><span className="text-slate-400">Course Track:</span> {selectedStudent.course || 'General Digital Marketing'}</p>
                    <p><span className="text-slate-400">Phone Code:</span> {selectedStudent.phone || 'N/A'}</p>
                  </div>
                </div>

                {/* Computation Result stats */}
                {inspectedCalc && (
                  <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Calculated Metrics</h4>
                    
                    <div className="flex items-end gap-2">
                      <span className={`text-4xl font-black ${
                        inspectedCalc.attendancePercentage >= 75 ? 'text-emerald-500' :
                        inspectedCalc.attendancePercentage >= 50 ? 'text-[#F48B1F]' : 'text-rose-500'
                      }`}>
                        {inspectedCalc.attendancePercentage}%
                      </span>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Score Rate</span>
                    </div>
 
                    <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                      <div className="p-3 bg-slate-50 rounded-xl text-center">
                        <p className="text-slate-700 font-bold text-base">{inspectedCalc.presentClasses}</p>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Present</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl text-center">
                        <p className="text-slate-700 font-bold text-base">{inspectedCalc.eligibleClasses}</p>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Eligible Classes</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl text-center">
                        <p className="text-slate-700 font-bold text-base">{inspectedCalc.leaveClasses}</p>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Leaves</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl text-center">
                        <p className="text-slate-700 font-bold text-base">{inspectedCalc.holidaysCount}</p>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Holidays</p>
                      </div>
                    </div>
 
                    <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-xs text-blue-600 font-semibold leading-relaxed flex items-start gap-2">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      <span>
                        Calculations generated dynamically using parameters:<br />
                        <strong>Eligible = Scheduled Since Joining ({inspectedCalc.eligibleClasses}) - Holidays ({inspectedCalc.holidaysCount}) - Cancellations ({inspectedCalc.cancelledClassesCount})</strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Attendance Calendar Container */}
              <div className="lg:col-span-2">
                {inspectedCalc && (
                  <AttendanceCalendar
                    student={selectedStudent}
                    dailyStatus={inspectedCalc.dailyStatus}
                    attendanceLogs={filteredStudentLogs}
                    batchSchedule={selectedBatchObj}
                    holidays={holidays}
                    cancelledClasses={cancellations}
                    courses={courses}
                    modules={modules}
                    topics={topics}
                    onUpdateStatus={handleUpdateStatus}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Attendance Logger Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <UserCheck size={18} className="text-[#255A84]" /> Log Manual Attendance
                </h3>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Select a student and date to record attendance</p>
              </div>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitManualAttendance} className="p-6 space-y-4">
              {/* Student */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Student *</label>
                <select
                  required
                  value={manualForm.studentId}
                  onChange={e => {
                    const sId = e.target.value;
                    const student = students.find(s => s.studentId === sId);
                    const studentBatches = student?.batchIds || (student?.batchId ? [student.batchId] : ['morning']);
                    setManualForm(prev => ({
                      ...prev,
                      studentId: sId,
                      track: student?.isIntern ? 'internship' : 'academic',
                      courseId: student?.courseId || '',
                      moduleId: '',
                      topicIds: [],
                      batchId: studentBatches[0] || 'morning'
                    }));
                  }}
                  className="select-premium cursor-pointer"
                >
                  <option value="">Select Student...</option>
                  {students.map(s => (
                    <option key={s.id} value={s.studentId}>
                      {s.name} ({s.studentId})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Date *</label>
                  <input
                    required
                    type="date"
                    value={manualForm.date}
                    onChange={e => setManualForm(prev => ({ ...prev, date: e.target.value }))}
                    className="input-premium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Status *</label>
                  <select
                    required
                    value={manualForm.status}
                    onChange={e => setManualForm(prev => ({ ...prev, status: e.target.value }))}
                    className="select-premium cursor-pointer"
                  >
                    <option value="present">Present</option>
                    <option value="makeup">Makeup</option>
                    <option value="leave">Leave</option>
                    <option value="absent">Absent</option>
                  </select>
                </div>
              </div>

              {/* Track & Batch Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Track *</label>
                  <select
                    required
                    value={manualForm.track}
                    onChange={e => setManualForm(prev => ({ ...prev, track: e.target.value }))}
                    className="select-premium cursor-pointer"
                  >
                    <option value="academic">Academic (Regular classes)</option>
                    <option value="internship">Internship</option>
                  </select>
                </div>

                {manualForm.studentId && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Enrolled Batch *</label>
                    <select
                      required
                      value={manualForm.batchId}
                      onChange={e => setManualForm(prev => ({ ...prev, batchId: e.target.value }))}
                      className="select-premium cursor-pointer"
                    >
                      {(() => {
                        const student = students.find(s => s.studentId === manualForm.studentId);
                        const studentBatches = student?.batchIds || (student?.batchId ? [student.batchId] : ['morning']);
                        return studentBatches.map(bId => {
                          const batchObj = batches.find(b => b.id === bId);
                          return (
                            <option key={bId} value={bId}>
                              {batchObj?.name || bId}
                            </option>
                          );
                        });
                      })()}
                    </select>
                  </div>
                )}
              </div>

              {/* Credits & Topics Sync (Present status only and not internship) */}
              {manualForm.status === 'present' && manualForm.track !== 'internship' && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Credits & Topics Sync (Optional)</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Course</label>
                      <select
                        value={manualForm.courseId}
                        onChange={e => setManualForm(prev => ({ ...prev, courseId: e.target.value, moduleId: '', topicIds: [] }))}
                        className="select-premium cursor-pointer"
                      >
                        <option value="">Select Course...</option>
                        {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Module</label>
                      <select
                        value={manualForm.moduleId}
                        onChange={e => setManualForm(prev => ({ ...prev, moduleId: e.target.value, topicIds: [] }))}
                        disabled={!manualForm.courseId}
                        className="select-premium disabled:opacity-50 cursor-pointer"
                      >
                        <option value="">Select Module...</option>
                        {modules.filter(m => m.courseId === manualForm.courseId).map(m => (
                          <option key={m.id} value={m.id}>{m.title}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {manualForm.moduleId && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Topics Cover</label>
                      <div className="max-h-36 overflow-y-auto no-scrollbar border border-slate-100 rounded-xl p-2 bg-slate-50/50 space-y-1">
                        {topics.filter(t => t.moduleId === manualForm.moduleId).length === 0 ? (
                          <p className="text-xs text-slate-400 p-2 text-center">No topics found in this module.</p>
                        ) : (
                          topics.filter(t => t.moduleId === manualForm.moduleId).map(topic => (
                            <label key={topic.id} className="flex items-start gap-2.5 px-2 py-1.5 hover:bg-white rounded-lg cursor-pointer transition border border-transparent hover:border-slate-100">
                              <input
                                type="checkbox"
                                className="mt-0.5 rounded text-[#255A84] focus:ring-[#255A84] border-slate-300 flex-shrink-0"
                                checked={manualForm.topicIds.includes(topic.id)}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setManualForm(prev => ({ ...prev, topicIds: [...prev.topicIds, topic.id] }));
                                  } else {
                                    setManualForm(prev => ({ ...prev, topicIds: prev.topicIds.filter(id => id !== topic.id) }));
                                  }
                                }}
                              />
                              <span className="text-xs font-semibold text-slate-700 leading-snug">{topic.title}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-100 rounded-xl text-xs font-bold uppercase tracking-wider transition active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition active:scale-95 cursor-pointer btn-primary-premium"
                >
                  Save Attendance
                </button>
              </div>
            </form>
          </div>
        </div>
          )}

      {/* Create Batch Modal */}
      {showCreateBatchModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <Plus size={18} className="text-emerald-500" /> Create New Batch
                </h3>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Initialize a new academic or training batch profile</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateBatchModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateBatch} className="p-6 space-y-4">
              {/* Name & ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Batch Name *</label>
                  <input
                    required
                    type="text"
                    value={newBatchForm.name}
                    onChange={e => {
                      const nameVal = e.target.value;
                      const generatedId = nameVal.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                      setNewBatchForm(prev => ({
                        ...prev,
                        name: nameVal,
                        id: prev.id ? prev.id : generatedId
                      }));
                    }}
                    placeholder="e.g. Web Development July"
                    className="input-premium text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Batch Code / ID *</label>
                  <input
                    required
                    type="text"
                    value={newBatchForm.id}
                    onChange={e => setNewBatchForm(prev => ({ ...prev, id: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') }))}
                    placeholder="e.g. web_dev_july"
                    className="input-premium font-mono text-xs"
                  />
                </div>
              </div>

              {/* Start & End Times */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Start Time *</label>
                  <input
                    required
                    type="time"
                    value={newBatchForm.startTime}
                    onChange={e => setNewBatchForm(prev => ({ ...prev, startTime: e.target.value }))}
                    className="input-premium text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">End Time *</label>
                  <input
                    required
                    type="time"
                    value={newBatchForm.endTime}
                    onChange={e => setNewBatchForm(prev => ({ ...prev, endTime: e.target.value }))}
                    className="input-premium text-xs"
                  />
                </div>
              </div>

              {/* Educator selection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Educator / Teacher *</label>
                <select
                  required
                  value={newBatchForm.educator}
                  onChange={e => setNewBatchForm(prev => ({ ...prev, educator: e.target.value }))}
                  className="select-premium cursor-pointer text-xs"
                >
                  <option value="">Select Educator...</option>
                  {educators.map(ed => (
                    <option key={ed.id} value={ed.name || ed.email}>{ed.name || ed.email}</option>
                  ))}
                </select>
              </div>

              {/* Weekly Days selection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Weekly Class Days</label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                  {DAYS_OF_WEEK.map(day => {
                    const isActive = newBatchForm.weeklyDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => {
                          setNewBatchForm(prev => {
                            const isExist = prev.weeklyDays.includes(day.value);
                            const updatedDays = isExist
                              ? prev.weeklyDays.filter(d => d !== day.value)
                              : [...prev.weeklyDays, day.value].sort();
                            return { ...prev, weeklyDays: updatedDays };
                          });
                        }}
                        className={`py-2 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 ${
                          isActive
                            ? 'bg-[#255A84] text-white border-transparent'
                            : 'bg-slate-50 text-slate-500 border-transparent hover:bg-slate-100'
                        }`}
                      >
                        {day.label.substring(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateBatchModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-100 rounded-xl text-xs font-bold uppercase tracking-wider transition active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition active:scale-95 cursor-pointer"
                >
                  Create Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
