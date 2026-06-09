import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const arraysEqual = (a, b) => {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

export async function initializeDatabase() {
  const defaultBatches = [
    {
      id: 'morning',
      name: 'Morning Batch',
      weeklyDays: [2, 4], // Tuesday, Thursday
      startTime: '09:00',
      endTime: '11:00',
      startDate: '2026-05-01',
      temporarySchedules: [],
      makeupClasses: []
    },
    {
      id: 'evening',
      name: 'Evening Batch',
      weeklyDays: [2, 4], // Tuesday, Thursday
      startTime: '18:00',
      endTime: '20:00',
      startDate: '2026-05-01',
      temporarySchedules: [],
      makeupClasses: []
    },
    {
      id: 'internship',
      name: 'Internship Batch',
      weeklyDays: [1, 5], // Monday, Friday
      startTime: '10:00',
      endTime: '17:00',
      startDate: '2026-05-01',
      temporarySchedules: [],
      makeupClasses: []
    }
  ];

  try {
    // Check if the batches collection has any documents
    const batchesCol = collection(db, 'batches');
    const snapCol = await getDocs(batchesCol);
    if (!snapCol.empty) {
      console.log("Batches collection is not empty. Skipping default initialization.");
      return;
    }

    for (const batch of defaultBatches) {
      const docRef = doc(db, 'batches', batch.id);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        await setDoc(docRef, batch);
        console.log(`Initialized default batch schedule for: ${batch.id}`);
      } else {
        const data = snap.data();
        let needsUpdate = false;

        // Migrate to new schedule defaults if batch is on the old system defaults
        if (batch.id === 'morning' && arraysEqual(data.weeklyDays, [1, 2, 3, 4, 5])) {
          needsUpdate = true;
        } else if (batch.id === 'evening' && arraysEqual(data.weeklyDays, [1, 3, 5])) {
          needsUpdate = true;
        } else if (batch.id === 'internship' && arraysEqual(data.weeklyDays, [1, 2, 3, 4, 5])) {
          needsUpdate = true;
        }

        if (needsUpdate) {
          await setDoc(docRef, {
            weeklyDays: batch.weeklyDays,
            startTime: batch.startTime,
            endTime: batch.endTime
          }, { merge: true });
          console.log(`Migrated batch ${batch.id} schedule to new defaults.`);
        }
      }
    }
  } catch (err) {
    console.error('Database initialization failed:', err);
  }
}

