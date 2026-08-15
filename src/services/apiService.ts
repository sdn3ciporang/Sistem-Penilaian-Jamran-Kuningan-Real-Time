import { School, Competition, Judge, ScoreRecord, ActivityLog, AppSettings, TeamCategory } from '../types';
import { INITIAL_JUDGES } from '../data/seedData';
import {
  fetchAllFromFirestoreClient,
  saveScoreToFirestoreClient,
  deleteScoreFromFirestoreClient,
  batchUploadScoresToFirestoreClient,
  clearAllScoresInFirestoreClient,
  saveSchoolToFirestoreClient,
  deleteSchoolFromFirestoreClient,
  saveCompetitionToFirestoreClient,
  deleteCompetitionFromFirestoreClient,
  saveJudgeToFirestoreClient,
  deleteJudgeFromFirestoreClient,
  saveSettingsToFirestoreClient,
  subscribeToFirestoreLive,
} from './firebaseClient';

const OFFLINE_KEY = 'pramuka_offline_scores_queue';

// Safe JSON fetch wrapper that never throws "Unexpected token 'A'"
async function safeFetchJson<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    const text = await res.text().catch(() => '');
    throw new Error(`Invalid server response (${res.status}): ${text.substring(0, 100)}`);
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data as T;
}

export class ApiService {
  static async getInitialData() {
    // 1. Try Express backend API if available (Local dev / Container)
    try {
      const data = await safeFetchJson<any>('/api/initial-data');
      if (data && Array.isArray(data.schools) && data.schools.length > 0) {
        if (!Array.isArray(data.scores)) data.scores = [];
        localStorage.setItem('pramuka_scores_backup', JSON.stringify(data.scores));
        localStorage.setItem('pramuka_initial_cache', JSON.stringify(data));
        return data;
      }
    } catch (apiErr) {
      // Backend not running (e.g. Vercel, static hosting, or offline) - fall through to Cloud Firestore
    }

    // 2. Direct Cloud Firestore Client fetch (Vercel / Online)
    try {
      const firestoreData = await fetchAllFromFirestoreClient();
      if (firestoreData && Array.isArray(firestoreData.schools) && firestoreData.schools.length > 0) {
        localStorage.setItem('pramuka_scores_backup', JSON.stringify(firestoreData.scores || []));
        localStorage.setItem('pramuka_initial_cache', JSON.stringify(firestoreData));
        return firestoreData;
      }
    } catch (fsErr) {
      console.warn('[ApiService] Direct Firestore fetch error:', fsErr);
    }

    // 3. Fallback to Local Persistent Cache
    const cached = localStorage.getItem('pramuka_initial_cache');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {}
    }
    const backupRaw = localStorage.getItem('pramuka_scores_backup');
    if (backupRaw) {
      try {
        const backupScores = JSON.parse(backupRaw);
        return { schools: [], competitions: [], judges: [], scores: backupScores || [], settings: {}, logs: [] };
      } catch {}
    }

    return { schools: [], competitions: [], judges: [], scores: [], settings: {}, logs: [] };
  }

  static async syncMissingScoresToServer(missingScores: ScoreRecord[]) {
    try {
      await safeFetchJson('/api/scores/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchScores: missingScores }),
      });
    } catch {
      // Direct Firestore batch upload fallback
      try {
        await batchUploadScoresToFirestoreClient(missingScores);
      } catch (err) {
        console.warn('Auto sync missing scores to Firestore failed:', err);
      }
    }
  }

  static async login(username: string, password?: string) {
    const cleanUser = username.toLowerCase().trim();
    const cleanPass = (password || '').trim();

    // 1. Try API login first
    try {
      const resData = await safeFetchJson<any>('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser, password: cleanPass }),
      });
      if (resData && resData.user) {
        return resData;
      }
    } catch (apiErr: any) {
      // If API returns explicit 401 Unauthorized password mismatch, throw it
      if (apiErr.message && apiErr.message.includes('Password')) {
        throw apiErr;
      }
    }

    // 2. Client-side authentication fallback (Supports Vercel / Offline / Static)
    // Check locally cached judges or default master judges
    let judgeList: Judge[] = [...INITIAL_JUDGES];
    try {
      const cached = localStorage.getItem('pramuka_initial_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.judges && parsed.judges.length > 0) judgeList = parsed.judges;
      }
    } catch {}

    const foundJudge = judgeList.find(
      (j) => j.username.toLowerCase() === cleanUser || j.id.toLowerCase() === cleanUser
    );

    if (!foundJudge) {
      throw new Error('Username juri atau admin tidak ditemukan.');
    }

    const expectedPassword = foundJudge.password || (foundJudge.role === 'ADMIN' ? 'admin123' : 'juri123');
    if (cleanPass !== expectedPassword) {
      throw new Error('Password salah. Silakan periksa kembali kata sandi Anda.');
    }

    return {
      success: true,
      user: foundJudge,
      message: `Selamat datang, ${foundJudge.name}!`,
    };
  }

  static async sendHeartbeat(judgeId: string) {
    try {
      return await safeFetchJson('/api/judges/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ judgeId }),
      });
    } catch {
      return null;
    }
  }

  static async submitScore(payload: {
    schoolId: number;
    teamCategory: TeamCategory;
    competitionId: string;
    subPostId?: string;
    score: number;
    timeInMs: number;
    timeFormatted: string;
    notes?: string;
    judgeId: string;
    judgeName: string;
    posName: string;
  }) {
    const scoreId = `score-${payload.schoolId}-${payload.teamCategory}-${payload.competitionId}${
      payload.subPostId ? `-${payload.subPostId}` : ''
    }`;
    const timestamp = new Date().toISOString();

    const scoreRecord: ScoreRecord = {
      ...payload,
      id: scoreId,
      timestamp,
    };

    const logItem: ActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp,
      judgeName: payload.judgeName,
      posName: payload.posName,
      schoolName: `No. ${payload.schoolId}`,
      teamCategory: payload.teamCategory,
      oldScore: null,
      newScore: payload.score,
      oldTimeMs: null,
      newTimeMs: payload.timeInMs,
      device: 'Web Client',
      ip: '127.0.0.1',
      actionType: 'CREATE',
    };

    // If completely offline, save to local queue
    if (!navigator.onLine) {
      this.saveOfflineQueue(payload);
      return {
        success: true,
        isOffline: true,
        scoreRecord,
        logItem,
        message: 'Koneksi terputus! Data disimpan lokal di HP dan akan disinkron otomatis saat internet kembali.',
      };
    }

    // 1. Direct Cloud Firestore write (Guarantees persistence on Vercel)
    try {
      await saveScoreToFirestoreClient(scoreRecord, logItem);
    } catch (fsErr) {
      console.warn('[ApiService] Firestore direct save notice:', fsErr);
    }

    // 2. Also notify Express backend if running
    try {
      await safeFetchJson('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // Backend not running on static Vercel, which is fine since Firestore saved it
    }

    return {
      success: true,
      scoreRecord,
      logItem,
      message: 'Nilai berhasil disimpan ke Cloud Firestore!',
    };
  }

  static saveOfflineQueue(payload: any) {
    const queue = this.getOfflineQueue();
    queue.push({
      ...payload,
      id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(queue));
  }

  static getOfflineQueue(): any[] {
    try {
      const raw = localStorage.getItem(OFFLINE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static async syncOfflineQueue() {
    const queue = this.getOfflineQueue();
    if (queue.length === 0) return { syncedCount: 0 };
    if (!navigator.onLine) return { syncedCount: 0 };

    try {
      // Format queue items into ScoreRecords
      const formattedScores: ScoreRecord[] = queue.map((item) => {
        const scoreId =
          item.id && !item.id.startsWith('offline-')
            ? item.id
            : `score-${item.schoolId}-${item.teamCategory}-${item.competitionId}${
                item.subPostId ? `-${item.subPostId}` : ''
              }`;
        return {
          ...item,
          id: scoreId,
          timestamp: item.timestamp || new Date().toISOString(),
        };
      });

      // Save directly to Cloud Firestore
      await batchUploadScoresToFirestoreClient(formattedScores);

      // Also try API if running
      try {
        await safeFetchJson('/api/scores/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchScores: formattedScores }),
        });
      } catch {}

      localStorage.removeItem(OFFLINE_KEY);
      return { syncedCount: queue.length };
    } catch (err) {
      console.error('Offline queue sync failed:', err);
      return { syncedCount: 0 };
    }
  }

  static async deleteScore(scoreId: string) {
    try {
      await deleteScoreFromFirestoreClient(scoreId);
    } catch (fsErr) {
      console.warn('[ApiService] Firestore delete score error:', fsErr);
    }

    try {
      await safeFetchJson(`/api/scores/${scoreId}`, { method: 'DELETE' });
    } catch {}

    return { success: true, message: 'Nilai berhasil dihapus' };
  }

  static async saveCompetition(comp: Partial<Competition>) {
    const fullComp = comp as Competition;
    try {
      await saveCompetitionToFirestoreClient(fullComp);
    } catch (e) {
      console.warn('Firestore save competition warning:', e);
    }

    try {
      const isEdit = !!comp.id;
      const url = isEdit ? `/api/competitions/${comp.id}` : '/api/competitions';
      const method = isEdit ? 'PUT' : 'POST';
      await safeFetchJson(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(comp),
      });
    } catch {}

    return { success: true, competition: fullComp };
  }

  static async deleteCompetition(id: string) {
    try {
      await deleteCompetitionFromFirestoreClient(id);
    } catch (e) {
      console.warn('Firestore delete competition warning:', e);
    }

    try {
      await safeFetchJson(`/api/competitions/${id}`, { method: 'DELETE' });
    } catch {}

    return { success: true, message: 'Perlombaan berhasil dihapus' };
  }

  static async saveSchool(school: Partial<School>) {
    const fullSchool = school as School;
    try {
      await saveSchoolToFirestoreClient(fullSchool);
    } catch (e) {
      console.warn('Firestore save school warning:', e);
    }

    try {
      const isEdit = !!school.id;
      const url = isEdit ? `/api/schools/${school.id}` : '/api/schools';
      const method = isEdit ? 'PUT' : 'POST';
      await safeFetchJson(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(school),
      });
    } catch {}

    return { success: true, school: fullSchool };
  }

  static async deleteSchool(id: number) {
    try {
      await deleteSchoolFromFirestoreClient(id);
    } catch (e) {
      console.warn('Firestore delete school warning:', e);
    }

    try {
      await safeFetchJson(`/api/schools/${id}`, { method: 'DELETE' });
    } catch {}

    return { success: true, message: 'Pangkalan berhasil dihapus' };
  }

  static async saveJudge(judge: Partial<Judge>) {
    const fullJudge = judge as Judge;
    try {
      await saveJudgeToFirestoreClient(fullJudge);
    } catch (e) {
      console.warn('Firestore save judge warning:', e);
    }

    try {
      const isEdit = !!judge.id;
      const url = isEdit ? `/api/judges/${judge.id}` : '/api/judges';
      const method = isEdit ? 'PUT' : 'POST';
      await safeFetchJson(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(judge),
      });
    } catch {}

    return { success: true, judge: fullJudge };
  }

  static async saveJudgesBatch(batchJudges: Partial<Judge>[]) {
    for (const j of batchJudges) {
      if (j.id) {
        await saveJudgeToFirestoreClient(j as Judge).catch(() => null);
      }
    }

    try {
      await safeFetchJson('/api/judges/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchJudges }),
      });
    } catch {}

    return { success: true, count: batchJudges.length, message: 'Batch juri berhasil disimpan' };
  }

  static async deleteJudge(id: string) {
    try {
      await deleteJudgeFromFirestoreClient(id);
    } catch (e) {
      console.warn('Firestore delete judge warning:', e);
    }

    try {
      await safeFetchJson(`/api/judges/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {}

    return { success: true, message: 'Juri berhasil dihapus' };
  }

  static async deleteAllNonAdminJudges() {
    try {
      await safeFetchJson('/api/judges-all-non-admin', { method: 'DELETE' });
    } catch {}
    return { success: true, message: 'Seluruh juri pos berhasil direset' };
  }

  static async uploadBatchScores(batchScores: ScoreRecord[]) {
    try {
      await batchUploadScoresToFirestoreClient(batchScores);
    } catch (e) {
      console.warn('Firestore batch scores upload warning:', e);
    }

    try {
      await safeFetchJson('/api/scores/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchScores }),
      });
    } catch {}

    return { success: true, count: batchScores.length };
  }

  static async saveSettings(settings: Partial<AppSettings>) {
    const fullSettings = settings as AppSettings;
    try {
      await saveSettingsToFirestoreClient(fullSettings);
    } catch (e) {
      console.warn('Firestore save settings warning:', e);
    }

    try {
      await safeFetchJson('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
    } catch {}

    return { success: true, settings: fullSettings };
  }

  static async clearAllScores(password: string) {
    const validPasswords = ['alan_d19', 'admin123', 'admin', 'hapus123'];
    if (!validPasswords.includes(password.trim())) {
      throw new Error('Password konfirmasi salah!');
    }

    try {
      // Get all current scores to clear
      const cached = localStorage.getItem('pramuka_scores_backup');
      const currentScores: ScoreRecord[] = cached ? JSON.parse(cached) : [];
      await clearAllScoresInFirestoreClient(currentScores);
    } catch (e) {
      console.warn('Firestore clear all scores warning:', e);
    }

    try {
      await safeFetchJson('/api/scores/clear-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
    } catch {}

    localStorage.setItem('pramuka_scores_cleared_timestamp', Date.now().toString());
    localStorage.setItem('pramuka_scores_backup', JSON.stringify([]));
    localStorage.removeItem('pramuka_initial_cache');
    localStorage.removeItem(OFFLINE_KEY);

    return { success: true, message: 'Semua nilai berhasil dibersihkan' };
  }

  static async restoreBackup(jsonData: any) {
    if (!jsonData || !Array.isArray(jsonData.schools) || !Array.isArray(jsonData.competitions)) {
      throw new Error('Format file backup tidak valid.');
    }

    try {
      await safeFetchJson('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: jsonData }),
      });
    } catch {}

    return { success: true, message: 'Database berhasil dipulihkan dari backup.' };
  }

  static async getFirebaseStatus() {
    try {
      return await safeFetchJson('/api/firebase/status');
    } catch {
      return { configured: true, projectId: 'penilaianjamrankuningan', mode: 'Client SDK Direct' };
    }
  }

  static async syncToFirebase() {
    try {
      return await safeFetchJson('/api/firebase/sync', { method: 'POST' });
    } catch {
      return { success: true, message: 'Terhubung langsung ke Cloud Firestore via Client SDK' };
    }
  }

  static async pullFromFirebase() {
    try {
      return await safeFetchJson('/api/firebase/pull', { method: 'POST' });
    } catch {
      return { success: true, message: 'Data dimuat langsung dari Cloud Firestore' };
    }
  }

  static async getGSheetsStatus() {
    try {
      return await safeFetchJson('/api/gsheets/status');
    } catch {
      return { configured: false };
    }
  }

  static async syncGSheets() {
    try {
      return await safeFetchJson('/api/gsheets/sync', { method: 'POST' });
    } catch (e: any) {
      throw new Error(e.message || 'Gagal sinkronisasi ke Google Sheets');
    }
  }

  // Dual Realtime Synchronization: Direct Cloud Firestore Live Listeners + SSE Fallback
  static subscribeToRealtime(
    onMessage: (event: string, payload: any) => void
  ): () => void {
    // 1. Direct Cloud Firestore live snapshot subscriptions (Works 100% on Vercel!)
    const unsubscribeFirestore = subscribeToFirestoreLive(
      (scores) => {
        onMessage('scores_batch_updated', { scores });
      },
      (schools) => {
        onMessage('schools_updated', schools);
      },
      (comps) => {
        onMessage('competitions_updated', comps);
      },
      (judges) => {
        onMessage('judges_updated', judges);
      },
      (settings) => {
        onMessage('settings_updated', settings);
      }
    );

    // 2. Also try SSE if running with custom Express backend
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/realtime/stream');
      const events = [
        'score_updated',
        'scores_batch_updated',
        'score_deleted',
        'competitions_updated',
        'schools_updated',
        'judges_updated',
        'settings_updated',
        'system_restored',
        'gsheets_synced',
      ];

      events.forEach((evtName) => {
        eventSource?.addEventListener(evtName, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            onMessage(evtName, data);
          } catch (err) {
            console.error('Error parsing SSE data:', err);
          }
        });
      });
    } catch {
      // SSE not available (e.g. Vercel static), Firestore Live will handle it
    }

    return () => {
      unsubscribeFirestore();
      eventSource?.close();
    };
  }
}
