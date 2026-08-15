import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  Firestore,
  Unsubscribe,
} from 'firebase/firestore';
import { School, Competition, Judge, ScoreRecord, ActivityLog, AppSettings } from '../types';
import { INITIAL_SCHOOLS, INITIAL_COMPETITIONS, INITIAL_JUDGES, INITIAL_SETTINGS } from '../data/seedData';

// Firebase Client Configuration
export const FIREBASE_CONFIG = {
  projectId: 'penilaianjamrankuningan',
  appId: '1:538334166757:web:c6836f4f2b4f53ce911e0c',
  apiKey: 'AIzaSyDIZJlVu0kBSbyppN21i3tENEMUKtCGnms',
  authDomain: 'penilaianjamrankuningan.firebaseapp.com',
  firestoreDatabaseId: '(default)',
  storageBucket: 'penilaianjamrankuningan.firebasestorage.app',
  messagingSenderId: '538334166757',
};

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!appInstance) {
    if (getApps().length > 0) {
      appInstance = getApp();
    } else {
      appInstance = initializeApp(FIREBASE_CONFIG);
    }
  }
  return appInstance;
}

export function getClientDb(): Firestore {
  if (!dbInstance) {
    const app = getFirebaseApp();
    dbInstance = getFirestore(app);
  }
  return dbInstance;
}

// 1. Fetch All Data Directly from Cloud Firestore
export async function fetchAllFromFirestoreClient(): Promise<{
  schools: School[];
  competitions: Competition[];
  judges: Judge[];
  scores: ScoreRecord[];
  logs: ActivityLog[];
  settings: AppSettings;
}> {
  const db = getClientDb();

  try {
    const [schoolsSnap, compsSnap, judgesSnap, scoresSnap, logsSnap, settingsSnap] = await Promise.all([
      getDocs(collection(db, 'schools')).catch(() => null),
      getDocs(collection(db, 'competitions')).catch(() => null),
      getDocs(collection(db, 'judges')).catch(() => null),
      getDocs(collection(db, 'scores')).catch(() => null),
      getDocs(collection(db, 'activity_logs')).catch(() => null),
      getDoc(doc(db, 'settings', 'app_settings')).catch(() => null),
    ]);

    let schools: School[] = [];
    if (schoolsSnap && !schoolsSnap.empty) {
      schools = schoolsSnap.docs.map((d) => d.data() as School);
    }

    let competitions: Competition[] = [];
    if (compsSnap && !compsSnap.empty) {
      competitions = compsSnap.docs.map((d) => d.data() as Competition);
    }

    let judges: Judge[] = [];
    if (judgesSnap && !judgesSnap.empty) {
      judges = judgesSnap.docs.map((d) => d.data() as Judge);
    }

    let scores: ScoreRecord[] = [];
    if (scoresSnap && !scoresSnap.empty) {
      scores = scoresSnap.docs.map((d) => d.data() as ScoreRecord);
    }

    let logs: ActivityLog[] = [];
    if (logsSnap && !logsSnap.empty) {
      logs = logsSnap.docs.map((d) => d.data() as ActivityLog);
    }

    let settings: AppSettings = { ...INITIAL_SETTINGS };
    if (settingsSnap && settingsSnap.exists()) {
      settings = { ...INITIAL_SETTINGS, ...(settingsSnap.data() as AppSettings) };
    }

    // Auto-seed to Cloud Firestore if database is empty
    if (schools.length === 0 || competitions.length === 0 || judges.length === 0) {
      console.log('[Firestore Client] Inisialisasi awal database Firestore dengan master data...');
      if (schools.length === 0) schools = [...INITIAL_SCHOOLS];
      if (competitions.length === 0) competitions = [...INITIAL_COMPETITIONS];
      if (judges.length === 0) judges = [...INITIAL_JUDGES];

      // Seed asynchronously in background
      seedMasterDataToFirestoreClient(schools, competitions, judges, settings).catch((err) => {
        console.warn('[Firestore Client] Seeding master data error:', err);
      });
    }

    return {
      schools: schools.sort((a, b) => Number(a.id) - Number(b.id)),
      competitions,
      judges,
      scores,
      logs,
      settings,
    };
  } catch (err) {
    console.warn('[Firestore Client] Error fetching from Cloud Firestore:', err);
    return {
      schools: INITIAL_SCHOOLS,
      competitions: INITIAL_COMPETITIONS,
      judges: INITIAL_JUDGES,
      scores: [],
      logs: [],
      settings: INITIAL_SETTINGS,
    };
  }
}

// 2. Auto Seed Initial Master Data to Firestore
export async function seedMasterDataToFirestoreClient(
  schools: School[],
  competitions: Competition[],
  judges: Judge[],
  settings: AppSettings
) {
  const db = getClientDb();
  const batch = writeBatch(db);

  for (const s of schools) {
    batch.set(doc(db, 'schools', `school_${s.id}`), s);
  }
  for (const c of competitions) {
    batch.set(doc(db, 'competitions', c.id), c);
  }
  for (const j of judges) {
    batch.set(doc(db, 'judges', j.id), j);
  }
  batch.set(doc(db, 'settings', 'app_settings'), {
    ...settings,
    updatedAt: new Date().toISOString(),
  });

  await batch.commit();
  console.log('[Firestore Client] Master data berhasil disemai ke Cloud Firestore!');
}

// 3. Save / Update Score
export async function saveScoreToFirestoreClient(score: ScoreRecord, log?: ActivityLog): Promise<void> {
  const db = getClientDb();
  const batch = writeBatch(db);

  batch.set(doc(db, 'scores', score.id), score);
  if (log) {
    batch.set(doc(db, 'activity_logs', log.id), log);
  }

  await batch.commit();
}

// 4. Delete Score
export async function deleteScoreFromFirestoreClient(scoreId: string, log?: ActivityLog): Promise<void> {
  const db = getClientDb();
  const batch = writeBatch(db);

  batch.delete(doc(db, 'scores', scoreId));
  if (log) {
    batch.set(doc(db, 'activity_logs', log.id), log);
  }

  await batch.commit();
}

// 5. Batch Upload Scores
export async function batchUploadScoresToFirestoreClient(batchScores: ScoreRecord[]): Promise<void> {
  const db = getClientDb();
  const chunkSize = 400; // Firestore batch supports up to 500

  for (let i = 0; i < batchScores.length; i += chunkSize) {
    const chunk = batchScores.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const score of chunk) {
      batch.set(doc(db, 'scores', score.id), score);
    }
    await batch.commit();
  }
}

// 6. Clear All Scores
export async function clearAllScoresInFirestoreClient(scores: ScoreRecord[]): Promise<void> {
  const db = getClientDb();
  const chunkSize = 400;

  for (let i = 0; i < scores.length; i += chunkSize) {
    const chunk = scores.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const score of chunk) {
      batch.delete(doc(db, 'scores', score.id));
    }
    await batch.commit();
  }
}

// 7. Save / Delete School
export async function saveSchoolToFirestoreClient(school: School): Promise<void> {
  const db = getClientDb();
  await setDoc(doc(db, 'schools', `school_${school.id}`), school);
}

export async function deleteSchoolFromFirestoreClient(schoolId: number): Promise<void> {
  const db = getClientDb();
  await deleteDoc(doc(db, 'schools', `school_${schoolId}`));
}

// 8. Save / Delete Competition
export async function saveCompetitionToFirestoreClient(comp: Competition): Promise<void> {
  const db = getClientDb();
  await setDoc(doc(db, 'competitions', comp.id), comp);
}

export async function deleteCompetitionFromFirestoreClient(compId: string): Promise<void> {
  const db = getClientDb();
  await deleteDoc(doc(db, 'competitions', compId));
}

// 9. Save / Delete Judge
export async function saveJudgeToFirestoreClient(judge: Judge): Promise<void> {
  const db = getClientDb();
  await setDoc(doc(db, 'judges', judge.id), judge);
}

export async function deleteJudgeFromFirestoreClient(judgeId: string): Promise<void> {
  const db = getClientDb();
  await deleteDoc(doc(db, 'judges', judgeId));
}

// 10. Save Settings
export async function saveSettingsToFirestoreClient(settings: AppSettings): Promise<void> {
  const db = getClientDb();
  await setDoc(doc(db, 'settings', 'app_settings'), {
    ...settings,
    updatedAt: new Date().toISOString(),
  });
}

// 11. Real-time Real-Time Listener on Cloud Firestore (Works on Vercel without Express!)
export function subscribeToFirestoreLive(
  onScoresChange: (scores: ScoreRecord[]) => void,
  onSchoolsChange: (schools: School[]) => void,
  onCompsChange: (comps: Competition[]) => void,
  onJudgesChange: (judges: Judge[]) => void,
  onSettingsChange: (settings: AppSettings) => void
): () => void {
  const db = getClientDb();
  const unsubscribes: Unsubscribe[] = [];

  try {
    // Scores listener
    const unsubScores = onSnapshot(
      collection(db, 'scores'),
      (snapshot) => {
        const scoresList = snapshot.docs.map((d) => d.data() as ScoreRecord);
        onScoresChange(scoresList);
      },
      (err) => {
        console.warn('[Firestore Realtime] Scores listener notice:', err);
      }
    );
    unsubscribes.push(unsubScores);

    // Schools listener
    const unsubSchools = onSnapshot(
      collection(db, 'schools'),
      (snapshot) => {
        if (!snapshot.empty) {
          const schoolsList = snapshot.docs
            .map((d) => d.data() as School)
            .sort((a, b) => Number(a.id) - Number(b.id));
          onSchoolsChange(schoolsList);
        }
      },
      (err) => {
        console.warn('[Firestore Realtime] Schools listener notice:', err);
      }
    );
    unsubscribes.push(unsubSchools);

    // Competitions listener
    const unsubComps = onSnapshot(
      collection(db, 'competitions'),
      (snapshot) => {
        if (!snapshot.empty) {
          const compsList = snapshot.docs.map((d) => d.data() as Competition);
          onCompsChange(compsList);
        }
      },
      (err) => {
        console.warn('[Firestore Realtime] Competitions listener notice:', err);
      }
    );
    unsubscribes.push(unsubComps);

    // Judges listener
    const unsubJudges = onSnapshot(
      collection(db, 'judges'),
      (snapshot) => {
        if (!snapshot.empty) {
          const judgesList = snapshot.docs.map((d) => d.data() as Judge);
          onJudgesChange(judgesList);
        }
      },
      (err) => {
        console.warn('[Firestore Realtime] Judges listener notice:', err);
      }
    );
    unsubscribes.push(unsubJudges);

    // Settings listener
    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'app_settings'),
      (snapshot) => {
        if (snapshot.exists()) {
          const settingsData = snapshot.data() as AppSettings;
          onSettingsChange(settingsData);
        }
      },
      (err) => {
        console.warn('[Firestore Realtime] Settings listener notice:', err);
      }
    );
    unsubscribes.push(unsubSettings);
  } catch (err) {
    console.warn('[Firestore Realtime] Initialization warning:', err);
  }

  return () => {
    unsubscribes.forEach((unsub) => {
      try {
        unsub();
      } catch {}
    });
  };
}
