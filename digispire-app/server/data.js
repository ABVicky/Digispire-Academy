import { adminDb } from './firebaseAdmin.js';

const toDocs = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }));

export async function loadReference() {
  const db = adminDb();
  const [batches, holidays, cancelledClasses, courses, modules, topics] = await Promise.all(
    ['batches', 'holidays', 'cancelled_classes', 'courses', 'modules', 'topics'].map(name => db.collection(name).get().then(toDocs))
  );
  return { batches, holidays, cancelledClasses, courses, modules, topics };
}

export const loadStudents = async () =>
  toDocs(await adminDb().collection('users').where('role', '==', 'student').get());

export const loadStaff = async () =>
  toDocs(await adminDb().collection('users').where('role', 'in', ['admin', 'educator']).get());

export const loadClassSessionsOn = async (date) =>
  toDocs(await adminDb().collection('class_sessions').where('date', '==', date).get());

export const loadClassSessionsBetween = async (from, to) =>
  toDocs(await adminDb().collection('class_sessions').where('date', '>=', from).where('date', '<=', to).get());

export const loadAllClassSessions = async () =>
  toDocs(await adminDb().collection('class_sessions').get());

export const loadAttendanceOn = async (date) =>
  toDocs(await adminDb().collection('attendance').where('date', '==', date).get());

export const loadAttendanceBetween = async (from, to) =>
  toDocs(await adminDb().collection('attendance').where('date', '>=', from).where('date', '<=', to).get());

export async function loadAttendanceForStudentIds(studentIds) {
  const ids = [...new Set(studentIds.filter(Boolean))];
  const chunks = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  const results = await Promise.all(chunks.map(c => adminDb().collection('attendance').where('studentId', 'in', c).get().then(toDocs)));
  return results.flat();
}
