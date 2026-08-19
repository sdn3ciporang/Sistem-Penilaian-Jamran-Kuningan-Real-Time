import React, { useState, useMemo, useEffect } from 'react';
import { School, Competition, ScoreRecord } from '../types';
import { ApiService } from '../services/apiService';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import {
  FileText,
  Download,
  Printer,
  Search,
  Upload,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Filter,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Compass,
  Trophy,
  Clock,
  Layers,
  Award,
  FileSpreadsheet,
} from 'lucide-react';

interface RekapViewProps {
  schools: School[];
  competitions: Competition[];
  scores: ScoreRecord[];
  onOpenUploadModal?: () => void;
}

export type RekapTabType = 'PUTRA' | 'PUTRI' | 'PENJELAJAHAN_PUTRA' | 'PENJELAJAHAN_PUTRI';

export const RekapView: React.FC<RekapViewProps> = ({
  schools,
  competitions,
  scores,
  onOpenUploadModal,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<RekapTabType>('PUTRA');
  const [search, setSearch] = useState('');

  // Penjelajahan competition object
  const penjelajahanComp = useMemo(() => {
    return (
      competitions.find((c) => c.isExploration) ||
      competitions.find((c) => c.name.toLowerCase().includes('penjelajahan')) ||
      null
    );
  }, [competitions]);

  // Custom Pos Filter State (IDs of selected competitions or sub-posts)
  const [selectedCompIds, setSelectedCompIds] = useState<string[]>([]);
  const [selectedSubPostIds, setSelectedSubPostIds] = useState<string[]>([]);
  const [showPosFilter, setShowPosFilter] = useState(false);

  // Sync selected IDs when competitions or penjelajahanComp load
  useEffect(() => {
    if (competitions.length > 0) {
      setSelectedCompIds((prev) => {
        if (prev.length === 0) return competitions.map((c) => c.id);
        const valid = prev.filter((id) => competitions.some((c) => c.id === id));
        return valid.length > 0 ? valid : competitions.map((c) => c.id);
      });
    }
  }, [competitions]);

  useEffect(() => {
    if (penjelajahanComp?.subPosts) {
      const subIds = penjelajahanComp.subPosts.map((sp) => sp.id);
      setSelectedSubPostIds((prev) => {
        if (prev.length === 0) return subIds;
        const valid = prev.filter((id) => subIds.includes(id));
        return valid.length > 0 ? valid : subIds;
      });
    }
  }, [penjelajahanComp]);

  // Check if current tab is exploration/penjelajahan
  const isPenjelajahan = activeSubTab === 'PENJELAJAHAN_PUTRA' || activeSubTab === 'PENJELAJAHAN_PUTRI';
  const currentCategory = activeSubTab === 'PUTRA' || activeSubTab === 'PENJELAJAHAN_PUTRA' ? 'PUTRA' : 'PUTRI';

  const availableItems = useMemo(() => {
    if (isPenjelajahan) {
      return penjelajahanComp?.subPosts || [];
    }
    return competitions;
  }, [isPenjelajahan, penjelajahanComp, competitions]);

  const selectedIds = useMemo(() => {
    if (isPenjelajahan) {
      return selectedSubPostIds;
    }
    return selectedCompIds;
  }, [isPenjelajahan, selectedSubPostIds, selectedCompIds]);

  const filteredSubPosts = useMemo(() => {
    return (penjelajahanComp?.subPosts || []).filter((sp) => selectedSubPostIds.includes(sp.id));
  }, [penjelajahanComp, selectedSubPostIds]);

  const filteredCompetitions = useMemo(() => {
    return competitions.filter((c) => selectedCompIds.includes(c.id));
  }, [competitions, selectedCompIds]);

  const handleSelectAllPos = () => {
    if (isPenjelajahan) {
      setSelectedSubPostIds((penjelajahanComp?.subPosts || []).map((sp) => sp.id));
    } else {
      setSelectedCompIds(competitions.map((c) => c.id));
    }
  };

  const handleDeselectAllPos = () => {
    if (isPenjelajahan) {
      setSelectedSubPostIds([]);
    } else {
      setSelectedCompIds([]);
    }
  };

  const handleTogglePosItem = (id: string) => {
    if (isPenjelajahan) {
      setSelectedSubPostIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    } else {
      setSelectedCompIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    }
  };

  // Google Sheets Live Sync State
  const [gsheetsInfo, setGsheetsInfo] = useState<{
    spreadsheetUrl: string;
    lastGoogleSync: string | null;
    isSyncing: boolean;
    syncSuccessMsg: string | null;
    error: string | null;
  }>({
    spreadsheetUrl: '',
    lastGoogleSync: null,
    isSyncing: false,
    syncSuccessMsg: null,
    error: null,
  });

  const fetchGSheetsStatus = async () => {
    try {
      const status = await ApiService.getGSheetsStatus();
      setGsheetsInfo((prev) => ({
        ...prev,
        spreadsheetUrl: status.spreadsheetUrl || '',
        lastGoogleSync: status.lastGoogleSync || null,
      }));
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchGSheetsStatus();

    const unsubscribe = ApiService.subscribeToRealtime((event, data) => {
      if (event === 'gsheets_synced') {
        setGsheetsInfo((prev) => ({
          ...prev,
          spreadsheetUrl: data.spreadsheetUrl || prev.spreadsheetUrl,
          lastGoogleSync: data.lastSyncTime || new Date().toISOString(),
          syncSuccessMsg: 'Laporan otomatis ter-update di Google Sheets!',
        }));
        setTimeout(() => {
          setGsheetsInfo((prev) => ({ ...prev, syncSuccessMsg: null }));
        }, 3000);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleManualSyncGSheets = async () => {
    setGsheetsInfo((prev) => ({ ...prev, isSyncing: true, error: null, syncSuccessMsg: null }));
    try {
      const res = await ApiService.syncGSheets();
      setGsheetsInfo((prev) => ({
        ...prev,
        spreadsheetUrl: res.spreadsheetUrl,
        lastGoogleSync: res.lastSyncTime,
        isSyncing: false,
        syncSuccessMsg: 'Berhasil melakukan Live Sync seluruh laporan ke Google Sheets!',
      }));
      setTimeout(() => {
        setGsheetsInfo((prev) => ({ ...prev, syncSuccessMsg: null }));
      }, 4000);
    } catch (err: any) {
      setGsheetsInfo((prev) => ({
        ...prev,
        isSyncing: false,
        error: err.message || 'Gagal sinkronisasi ke Google Sheets',
      }));
    }
  };

  // Helper time formatter
  const formatMs = (ms: number) => {
    if (!ms || ms <= 0) return '-';
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const mmm = ms % 1000;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(mmm).padStart(3, '0')}`;
  };

  // Calculate Rekap Data Matrix
  const rekapMatrix = useMemo(() => {
    const isExplorationTab = activeSubTab === 'PENJELAJAHAN_PUTRA' || activeSubTab === 'PENJELAJAHAN_PUTRI';
    const cat = activeSubTab === 'PUTRA' || activeSubTab === 'PENJELAJAHAN_PUTRA' ? 'PUTRA' : 'PUTRI';

    return schools
      .filter((s) => {
        if (cat === 'PUTRA') return s.hasPutra;
        if (cat === 'PUTRI') return s.hasPutri;
        return true;
      })
      .filter((s) => {
        const q = search.toLowerCase().trim();
        if (!q) return true;
        const paddedId = String(s.id).padStart(2, '0');
        return (
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          String(s.id).includes(q) ||
          paddedId.includes(q)
        );
      })
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map((school) => {
        const compScores: Record<
          string,
          { score: number; timeMs: number; notes?: string; judgeName?: string; hasRecord: boolean }
        > = {};
        let grandTotal = 0;
        let totalTimeMs = 0;
        let filledCount = 0;

        if (isExplorationTab) {
          // Calculate for filtered sub-posts of Penjelajahan for specific category (PUTRA or PUTRI)
          filteredSubPosts.forEach((sub) => {
            const record = scores.find(
              (s) =>
                s.schoolId === school.id &&
                s.teamCategory === cat &&
                s.competitionId === penjelajahanComp?.id &&
                s.subPostId === sub.id
            );
            if (record) {
              compScores[sub.id] = {
                score: record.score,
                timeMs: record.timeInMs,
                notes: record.notes,
                judgeName: record.judgeName,
                hasRecord: true,
              };
              grandTotal += record.score;
              totalTimeMs += record.timeInMs;
              filledCount += 1;
            } else {
              compScores[sub.id] = { score: 0, timeMs: 0, hasRecord: false };
            }
          });
        } else {
          // Standard Competitions for PUTRA or PUTRI (filtered ones)
          filteredCompetitions.forEach((comp) => {
            if (comp.isExploration && comp.subPosts) {
              // Sum up sub-posts for total Penjelajahan score in standard rekap
              let subTotal = 0;
              let subTime = 0;
              let subFilled = 0;
              const notesList: string[] = [];
              comp.subPosts.forEach((sub) => {
                const rec = scores.find(
                  (s) =>
                    s.schoolId === school.id &&
                    s.teamCategory === cat &&
                    s.competitionId === comp.id &&
                    s.subPostId === sub.id
                );
                if (rec) {
                  subTotal += rec.score;
                  subTime += rec.timeInMs;
                  subFilled += 1;
                  if (rec.notes) notesList.push(`${sub.name}: ${rec.notes}`);
                }
              });
              compScores[comp.id] = {
                score: subTotal,
                timeMs: subTime,
                notes: notesList.join(' | '),
                hasRecord: subFilled > 0,
              };
              grandTotal += subTotal;
              totalTimeMs += subTime;
              if (subFilled > 0) filledCount += 1;
            } else {
              const rec = scores.find(
                (s) =>
                  s.schoolId === school.id &&
                  s.teamCategory === cat &&
                  s.competitionId === comp.id &&
                  !s.subPostId
              );
              if (rec) {
                compScores[comp.id] = {
                  score: rec.score,
                  timeMs: rec.timeInMs,
                  notes: rec.notes,
                  judgeName: rec.judgeName,
                  hasRecord: true,
                };
                grandTotal += rec.score;
                totalTimeMs += rec.timeInMs;
                filledCount += 1;
              } else {
                compScores[comp.id] = { score: 0, timeMs: 0, hasRecord: false };
              }
            }
          });
        }

        return {
          schoolId: school.id,
          code: school.code || `PKG-${String(school.id).padStart(2, '0')}`,
          name: school.name,
          compScores,
          grandTotal,
          totalTimeMs,
          filledCount,
        };
      });
  }, [
    schools,
    competitions,
    scores,
    activeSubTab,
    search,
    penjelajahanComp,
    filteredSubPosts,
    filteredCompetitions,
  ]);

  // Statistics for active tab
  const tabStats = useMemo(() => {
    const totalPangkalan = rekapMatrix.length;
    const totalSlots =
      totalPangkalan * (isPenjelajahan ? filteredSubPosts.length : filteredCompetitions.length);
    let filledSlots = 0;
    let totalScoreSum = 0;
    let highestScore = 0;
    let highestSchoolName = '-';

    rekapMatrix.forEach((m) => {
      filledSlots += m.filledCount;
      totalScoreSum += m.grandTotal;
      if (m.grandTotal > highestScore) {
        highestScore = m.grandTotal;
        highestSchoolName = m.name;
      }
    });

    const averageScore = totalPangkalan > 0 ? (totalScoreSum / totalPangkalan).toFixed(1) : '0';
    const percentDone = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

    return {
      totalPangkalan,
      totalSlots,
      filledSlots,
      percentDone,
      averageScore,
      highestScore,
      highestSchoolName,
    };
  }, [rekapMatrix, isPenjelajahan, filteredSubPosts, filteredCompetitions]);

  // Export Excel Function for Current Tab
  const handleExportExcel = () => {
    const workbook = XLSX.utils.book_new();
    const catLabel = currentCategory === 'PUTRA' ? 'PUTRA (PA)' : 'PUTRI (PI)';
    const typeLabel = isPenjelajahan ? 'Penjelajahan_SubPos' : 'Rekap_Umum';

    // Sheet 1: Rekap Nilai
    const headersNilai = ['No', 'Kode Pangkalan', 'Nama Pangkalan'];
    if (isPenjelajahan) {
      filteredSubPosts.forEach((sp) => headersNilai.push(sp.name));
    } else {
      filteredCompetitions.forEach((c) => headersNilai.push(c.name));
    }
    headersNilai.push('Total Nilai');
    headersNilai.push('Total Waktu (MM:SS:mmm)');

    const rowsNilai = rekapMatrix.map((item, idx) => {
      const row: any[] = [String(idx + 1).padStart(2, '0'), item.code, item.name];
      if (isPenjelajahan) {
        filteredSubPosts.forEach((sp) => {
          row.push(item.compScores[sp.id]?.score || 0);
        });
      } else {
        filteredCompetitions.forEach((c) => {
          row.push(item.compScores[c.id]?.score || 0);
        });
      }
      row.push(item.grandTotal);
      row.push(formatMs(item.totalTimeMs));
      return row;
    });

    // Sheet 2: Waktu Per Pos
    const headersWaktu = ['No', 'Kode Pangkalan', 'Nama Pangkalan'];
    if (isPenjelajahan) {
      filteredSubPosts.forEach((sp) => headersWaktu.push(`${sp.name} (Waktu)`));
    } else {
      filteredCompetitions.forEach((c) => headersWaktu.push(`${c.name} (Waktu)`));
    }
    headersWaktu.push('Total Akumulasi Waktu (MM:SS:mmm)');

    const rowsWaktu = rekapMatrix.map((item, idx) => {
      const row: any[] = [String(idx + 1).padStart(2, '0'), item.code, item.name];
      if (isPenjelajahan) {
        filteredSubPosts.forEach((sp) => {
          const timeMs = item.compScores[sp.id]?.timeMs || 0;
          row.push(timeMs > 0 ? formatMs(timeMs) : '-');
        });
      } else {
        filteredCompetitions.forEach((c) => {
          const timeMs = item.compScores[c.id]?.timeMs || 0;
          row.push(timeMs > 0 ? formatMs(timeMs) : '-');
        });
      }
      row.push(formatMs(item.totalTimeMs));
      return row;
    });

    // Sheet 3: Catatan Juri
    const headersNotes = ['No', 'Kode Pangkalan', 'Nama Pangkalan'];
    if (isPenjelajahan) {
      filteredSubPosts.forEach((sp) => headersNotes.push(`${sp.name} (Catatan)`));
    } else {
      filteredCompetitions.forEach((c) => headersNotes.push(`${c.name} (Catatan)`));
    }

    const rowsNotes = rekapMatrix.map((item, idx) => {
      const row: any[] = [String(idx + 1).padStart(2, '0'), item.code, item.name];
      if (isPenjelajahan) {
        filteredSubPosts.forEach((sp) => {
          row.push(item.compScores[sp.id]?.notes || '-');
        });
      } else {
        filteredCompetitions.forEach((c) => {
          row.push(item.compScores[c.id]?.notes || '-');
        });
      }
      return row;
    });

    const worksheetNilai = XLSX.utils.aoa_to_sheet([headersNilai, ...rowsNilai]);
    const worksheetWaktu = XLSX.utils.aoa_to_sheet([headersWaktu, ...rowsWaktu]);
    const worksheetNotes = XLSX.utils.aoa_to_sheet([headersNotes, ...rowsNotes]);

    const sheetSuffix = isPenjelajahan
      ? `Penjelajahan_${currentCategory}`
      : `Rekap_Nilai_${currentCategory}`;

    XLSX.utils.book_append_sheet(workbook, worksheetNilai, `Nilai_${currentCategory}`);
    XLSX.utils.book_append_sheet(workbook, worksheetWaktu, `Waktu_${currentCategory}`);
    XLSX.utils.book_append_sheet(workbook, worksheetNotes, `Catatan_${currentCategory}`);

    XLSX.writeFile(
      workbook,
      `Rekap_${typeLabel}_${currentCategory}_${Date.now()}.xlsx`
    );
  };

  // Export Complete Penjelajahan Multi-Sheet (Both Putra and Putri)
  const handleExportAllPenjelajahanExcel = () => {
    if (!penjelajahanComp || !penjelajahanComp.subPosts) return;

    const workbook = XLSX.utils.book_new();
    const subs = penjelajahanComp.subPosts;

    (['PUTRA', 'PUTRI'] as const).forEach((cat) => {
      const targetSchools = schools.filter((s) => (cat === 'PUTRA' ? s.hasPutra : s.hasPutri));

      // Sheet Nilai
      const headersNilai = ['No', 'Kode Pangkalan', 'Nama Pangkalan', ...subs.map((sp) => sp.name), 'Total Nilai', 'Total Waktu'];
      const rowsNilai: any[][] = [];

      // Sheet Waktu
      const headersWaktu = ['No', 'Kode Pangkalan', 'Nama Pangkalan', ...subs.map((sp) => `${sp.name} (Waktu)`), 'Total Waktu'];
      const rowsWaktu: any[][] = [];

      targetSchools.forEach((school, idx) => {
        let totalScore = 0;
        let totalTime = 0;
        const rowN: any[] = [String(idx + 1).padStart(2, '0'), school.code || `PKG-${String(school.id).padStart(2, '0')}`, school.name];
        const rowW: any[] = [String(idx + 1).padStart(2, '0'), school.code || `PKG-${String(school.id).padStart(2, '0')}`, school.name];

        subs.forEach((sp) => {
          const rec = scores.find(
            (s) =>
              s.schoolId === school.id &&
              s.teamCategory === cat &&
              s.competitionId === penjelajahanComp.id &&
              s.subPostId === sp.id
          );
          if (rec) {
            rowN.push(rec.score);
            rowW.push(rec.timeInMs > 0 ? formatMs(rec.timeInMs) : '-');
            totalScore += rec.score;
            totalTime += rec.timeInMs;
          } else {
            rowN.push(0);
            rowW.push('-');
          }
        });

        rowN.push(totalScore, formatMs(totalTime));
        rowW.push(formatMs(totalTime));

        rowsNilai.push(rowN);
        rowsWaktu.push(rowW);
      });

      const wsNilai = XLSX.utils.aoa_to_sheet([headersNilai, ...rowsNilai]);
      const wsWaktu = XLSX.utils.aoa_to_sheet([headersWaktu, ...rowsWaktu]);

      XLSX.utils.book_append_sheet(workbook, wsNilai, `Nilai_Penjelajahan_${cat}`);
      XLSX.utils.book_append_sheet(workbook, wsWaktu, `Waktu_Penjelajahan_${cat}`);
    });

    XLSX.writeFile(workbook, `Rekap_Lengkap_Penjelajahan_PA_dan_PI_${Date.now()}.xlsx`);
  };

  // Export PDF Function
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);

    const titlePrefix = isPenjelajahan
      ? `REKAPITULASI PENILAIAN LOMBA PENJELAJAHAN (SUB-POS) - REGU ${currentCategory === 'PUTRA' ? 'PUTRA (PA)' : 'PUTRI (PI)'}`
      : `REKAPITULASI PEROLEHAN NILAI & TOTAL WAKTU LOMBA PRAMUKA - REGU ${currentCategory === 'PUTRA' ? 'PUTRA (PA)' : 'PUTRI (PI)'}`;

    doc.text(titlePrefix, 14, 15);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Pos Terhitung: ${selectedIds.length} dari ${availableItems.length} Pos/Sub-Pos | Dicetak pada: ${new Date().toLocaleString('id-ID')}`,
      14,
      22
    );

    let yPos = 30;
    doc.setFontSize(8);

    rekapMatrix.forEach((item, idx) => {
      if (yPos > 185) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(
        `${String(idx + 1).padStart(2, '0')}. [${item.code}] ${item.name} - Total Nilai: ${item.grandTotal} | Total Waktu: ${formatMs(item.totalTimeMs)}`,
        14,
        yPos
      );
      yPos += 6;
    });

    doc.save(`Rekap_${activeSubTab}_${Date.now()}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300">
              PUSAT REKAPITULASI LOMBA
            </span>
            {isPenjelajahan && (
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-950 border border-amber-300 flex items-center gap-1">
                <Compass className="w-3 h-3 text-amber-700" />
                RINCIAN SUB-POS PENJELAJAHAN
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-600 shrink-0" />
            <span>
              {isPenjelajahan
                ? `Rekap Sub-Pos Penjelajahan: Regu ${currentCategory === 'PUTRA' ? 'Putra (PA)' : 'Putri (PI)'}`
                : `Rekapitulasi Perolehan Nilai: Regu ${currentCategory === 'PUTRA' ? 'Putra (PA)' : 'Putri (PI)'}`}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isPenjelajahan
              ? `Menampilkan nilai rinci per sub-materi pos penjelajahan khusus Regu ${currentCategory === 'PUTRA' ? 'Putra (PA)' : 'Putri (PI)'} lengkap dengan akumulasi waktu & catatan juri.`
              : 'Menampilkan akumulasi nilai lengkap seluruh mata lomba beserta total durasi waktu perlombaan.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {isPenjelajahan && penjelajahanComp && (
            <button
              onClick={handleExportAllPenjelajahanExcel}
              className="px-3.5 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
              title="Unduh file Excel komprehensif memuat 4 sheet (Putra & Putri Nilai dan Waktu)"
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-200" />
              <span>EXCEL PENJELAJAHAN (PA & PI)</span>
            </button>
          )}

          {onOpenUploadModal && (
            <button
              onClick={onOpenUploadModal}
              className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
            >
              <Upload className="w-4 h-4 text-sky-300" />
              <span>UPLOAD EXCEL</span>
            </button>
          )}

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
          >
            <Download className="w-4 h-4" />
            <span>EXCEL TAB INI</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="px-3.5 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
          >
            <Download className="w-4 h-4" />
            <span>PDF</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>CETAK</span>
          </button>
        </div>
      </div>

      {/* GOOGLE SHEETS LIVE SYNC BANNER */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-5 rounded-3xl shadow-xl border border-emerald-700/50 space-y-3 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <h3 className="text-sm font-black tracking-tight text-emerald-300 uppercase flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Live Sync Google Sheets (Real-Time Synchronized)
              </h3>
            </div>
            <p className="text-xs text-slate-200">
              Setiap input juri otomatis tersimpan dan memperbarui sheet Pos, Rekap, dan Rangking di Google Drive secara langsung.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {gsheetsInfo.spreadsheetUrl && (
              <a
                href={gsheetsInfo.spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>BUKA GOOGLE SHEETS</span>
              </a>
            )}

            <button
              onClick={handleManualSyncGSheets}
              disabled={gsheetsInfo.isSyncing}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  gsheetsInfo.isSyncing ? 'animate-spin text-amber-300' : 'text-emerald-300'
                }`}
              />
              <span>{gsheetsInfo.isSyncing ? 'Proses Sync...' : 'SINKRON SEKARANG'}</span>
            </button>
          </div>
        </div>

        {gsheetsInfo.lastGoogleSync && (
          <div className="text-[11px] text-emerald-200/90 font-mono flex items-center gap-2 pt-1 border-t border-white/10">
            <span>🕒 Terakhir disinkronkan: {new Date(gsheetsInfo.lastGoogleSync).toLocaleString('id-ID')}</span>
          </div>
        )}

        {gsheetsInfo.syncSuccessMsg && (
          <div className="p-2.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{gsheetsInfo.syncSuccessMsg}</span>
          </div>
        )}

        {gsheetsInfo.error && (
          <div className="p-2.5 bg-rose-500/20 border border-rose-400/40 text-rose-200 rounded-xl text-xs font-bold">
            ⚠️ {gsheetsInfo.error}
          </div>
        )}
      </div>

      {/* Main Navigation Tabs: UMUM & PENJELAJAHAN SEPARATED FOR PUTRA & PUTRI */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        
        {/* Navigation Category Tabs */}
        <div className="flex items-center gap-2 bg-slate-200 p-1.5 rounded-2xl flex-wrap">
          <button
            onClick={() => setActiveSubTab('PUTRA')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'PUTRA'
                ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400/50'
                : 'text-slate-700 hover:text-slate-900 bg-white/50'
            }`}
          >
            <span>👦 REKAP UMUM PUTRA (PA)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('PUTRI')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'PUTRI'
                ? 'bg-pink-600 text-white shadow-md ring-2 ring-pink-400/50'
                : 'text-slate-700 hover:text-slate-900 bg-white/50'
            }`}
          >
            <span>👧 REKAP UMUM PUTRI (PI)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('PENJELAJAHAN_PUTRA')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'PENJELAJAHAN_PUTRA'
                ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-400/50'
                : 'text-slate-700 hover:text-slate-900 bg-amber-50 border border-amber-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>🧭 PENJELAJAHAN PUTRA ({penjelajahanComp?.subPosts?.length || 0} SUB)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('PENJELAJAHAN_PUTRI')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'PENJELAJAHAN_PUTRI'
                ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-400/50'
                : 'text-slate-700 hover:text-slate-900 bg-rose-50 border border-rose-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>🧭 PENJELAJAHAN PUTRI ({penjelajahanComp?.subPosts?.length || 0} SUB)</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau kode pangkalan..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs"
          />
        </div>
      </div>

      {/* Quick Summary Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 print:hidden">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Total Regu {currentCategory === 'PUTRA' ? 'Putra (PA)' : 'Putri (PI)'}
          </p>
          <div className="text-2xl font-black text-slate-900">{tabStats.totalPangkalan}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Pangkalan terdaftar</p>
        </div>

        <div className="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-200 shadow-2xs">
          <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-1">
            Progress Input Nilai
          </p>
          <div className="text-2xl font-black text-emerald-950 flex items-center gap-1.5">
            <span>{tabStats.percentDone}%</span>
            <span className="text-xs font-bold text-emerald-700">
              ({tabStats.filledSlots}/{tabStats.totalSlots})
            </span>
          </div>
          <p className="text-[11px] text-emerald-700 mt-0.5">
            {isPenjelajahan ? 'Slot sub-pos terisi' : 'Slot pos lomba terisi'}
          </p>
        </div>

        <div className="bg-blue-50/80 p-4 rounded-2xl border border-blue-200 shadow-2xs">
          <p className="text-[11px] font-bold text-blue-800 uppercase tracking-wider mb-1">
            Rata-rata Nilai
          </p>
          <div className="text-2xl font-black text-blue-950">{tabStats.averageScore}</div>
          <p className="text-[11px] text-blue-700 mt-0.5">
            {isPenjelajahan ? 'Akumulasi penjelajahan' : 'Akumulasi semua pos'}
          </p>
        </div>

        <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200 shadow-2xs">
          <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-1">
            Nilai Tertinggi Sementara
          </p>
          <div className="text-2xl font-black text-amber-950 font-mono">{tabStats.highestScore}</div>
          <p className="text-[11px] text-amber-800 font-bold truncate mt-0.5" title={tabStats.highestSchoolName}>
            {tabStats.highestSchoolName}
          </p>
        </div>
      </div>

      {/* CUSTOM POS FILTER CONTROL PANEL */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3 print:hidden">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 flex-wrap">
                <span>
                  {isPenjelajahan
                    ? `Filter Sub-Pos Penjelajahan (${currentCategory === 'PUTRA' ? 'Regu Putra' : 'Regu Putri'})`
                    : `Filter Pos / Mata Lomba (${currentCategory === 'PUTRA' ? 'Regu Putra' : 'Regu Putri'})`}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    selectedIds.length === availableItems.length
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : selectedIds.length === 0
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                  }`}
                >
                  {selectedIds.length} dari {availableItems.length} {isPenjelajahan ? 'Sub-Pos' : 'Pos'} Terpilih
                </span>
              </h4>
              <p className="text-[11px] text-slate-500">
                Pilih pos mana saja yang ingin dihitung total nilai & waktunya dalam tabel rekapitulasi.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleSelectAllPos}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span>Pilih Semua</span>
            </button>
            <button
              type="button"
              onClick={handleDeselectAllPos}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 text-rose-500" />
              <span>Hapus Semua</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPosFilter(!showPosFilter)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{showPosFilter ? 'Sembunyikan Opsi' : 'Atur Pilihan Pos'}</span>
              {showPosFilter ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Expanded Checkbox Chips */}
        {showPosFilter && (
          <div className="pt-3 border-t border-slate-100 animate-fadeIn">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {availableItems.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleTogglePosItem(item.id)}
                    className={`p-2 rounded-xl text-xs font-extrabold flex items-center gap-2 border transition-all text-left cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/90 border-indigo-300 text-indigo-950 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-400 line-through opacity-70 hover:opacity-100'
                    }`}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span className="truncate">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Printable Title */}
      <div className="hidden print:block text-center space-y-1 mb-4">
        <h1 className="text-xl font-black">
          {isPenjelajahan
            ? `REKAPITULASI PENILAIAN LOMBA PENJELAJAHAN (SUB-POS) - REGU ${currentCategory === 'PUTRA' ? 'PUTRA (PA)' : 'PUTRI (PI)'}`
            : `REKAPITULASI PENILAIAN & TOTAL WAKTU LOMBA PRAMUKA - REGU ${currentCategory === 'PUTRA' ? 'PUTRA (PA)' : 'PUTRI (PI)'}`}
        </h1>
        <p className="text-sm font-bold uppercase">
          Kategori: {currentCategory === 'PUTRA' ? 'REGU PUTRA (PA)' : 'REGU PUTRI (PI)'} ({selectedIds.length} Pos Terpilih)
        </p>
        <p className="text-xs text-slate-500">Tanggal Cetak: {new Date().toLocaleDateString('id-ID')}</p>
      </div>

      {/* Matrix Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Table Sub-header indicator */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                currentCategory === 'PUTRA' ? 'bg-blue-600' : 'bg-pink-600'
              }`}
            ></span>
            <span className="text-xs font-black uppercase text-slate-800 tracking-wider">
              {isPenjelajahan
                ? `Tabel Sub-Pos Penjelajahan ${currentCategory === 'PUTRA' ? 'Putra (PA)' : 'Putri (PI)'} (${rekapMatrix.length} Pangkalan Terdaftar)`
                : `Tabel Rekap Nilai Umum ${currentCategory === 'PUTRA' ? 'Putra (PA)' : 'Putri (PI)'} (${rekapMatrix.length} Pangkalan Terdaftar)`}
            </span>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Nilai diurutkan berdasarkan Nomor Pangkalan (PKG)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider">
                <th className="py-3.5 px-3 w-12 text-center border-r border-slate-800">No</th>
                <th className="py-3.5 px-3 w-20 border-r border-slate-800">Kode</th>
                <th className="py-3.5 px-3 min-w-[200px] border-r border-slate-800">Nama Pangkalan</th>
                
                {/* Dynamic Columns */}
                {isPenjelajahan
                  ? filteredSubPosts.map((sp) => (
                      <th key={sp.id} className="py-3 px-2 text-center border-r border-slate-800 min-w-[105px]">
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-white font-bold">{sp.name}</span>
                          <span className="text-[10px] text-amber-300 font-mono font-normal">
                            ({sp.minScore}-{sp.maxScore})
                          </span>
                        </div>
                      </th>
                    ))
                  : filteredCompetitions.map((comp) => (
                      <th key={comp.id} className="py-3 px-2 text-center border-r border-slate-800 min-w-[105px]">
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-white font-bold">{comp.name}</span>
                          {comp.isExploration && (
                            <span className="text-[9px] text-amber-300 font-mono font-normal uppercase">
                              (Total {comp.subPosts?.length || 0} Sub)
                            </span>
                          )}
                        </div>
                      </th>
                    ))}

                <th className="py-3.5 px-3 text-center bg-amber-500 text-slate-950 font-black min-w-[105px] border-r border-amber-600">
                  {isPenjelajahan ? 'TOTAL PENJELAJAHAN' : 'TOTAL NILAI'}
                </th>
                <th className="py-3.5 px-3 text-center bg-sky-600 text-white font-black min-w-[120px]">
                  TOTAL WAKTU
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-medium">
              {selectedIds.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      3 +
                      (isPenjelajahan ? filteredSubPosts.length : filteredCompetitions.length) +
                      2
                    }
                    className="py-12 text-center text-slate-500 font-medium"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Filter className="w-8 h-8 text-indigo-400 animate-bounce" />
                      <p className="text-sm font-bold text-slate-700">Belum Ada Pos / Sub-Pos yang Dipilih</p>
                      <p className="text-xs text-slate-400">
                        Klik tombol <span className="font-bold text-indigo-600">"Pilih Semua"</span> atau centang pos di atas untuk menampilkan nilai rekap.
                      </p>
                      <button
                        type="button"
                        onClick={handleSelectAllPos}
                        className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-colors"
                      >
                        Centang Semua Sekarang
                      </button>
                    </div>
                  </td>
                </tr>
              ) : rekapMatrix.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      3 +
                      (isPenjelajahan ? filteredSubPosts.length : filteredCompetitions.length) +
                      2
                    }
                    className="py-8 text-center text-slate-400"
                  >
                    Tidak ada data pangkalan yang sesuai.
                  </td>
                </tr>
              ) : (
                rekapMatrix.map((item, idx) => (
                  <tr key={item.schoolId} className="hover:bg-blue-50/50 transition-colors">
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500 border-r border-slate-100">
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td
                      className={`py-2.5 px-3 font-mono font-bold border-r border-slate-100 ${
                        currentCategory === 'PUTRA' ? 'text-blue-900' : 'text-pink-900'
                      }`}
                    >
                      {item.code}
                    </td>
                    <td className="py-2.5 px-3 font-extrabold text-slate-900 border-r border-slate-100">
                      {item.name}
                    </td>

                    {/* Render Scores & Time */}
                    {isPenjelajahan
                      ? filteredSubPosts.map((sp) => {
                          const scoreData = item.compScores[sp.id];
                          const hasRecord = scoreData?.hasRecord;
                          const val = scoreData?.score || 0;
                          const timeMs = scoreData?.timeMs || 0;
                          const note = scoreData?.notes;
                          return (
                            <td
                              key={sp.id}
                              className="py-2.5 px-2 text-center font-mono font-bold border-r border-slate-100"
                            >
                              <div className="flex flex-col items-center justify-center gap-0.5">
                                <span
                                  className={
                                    hasRecord
                                      ? 'text-slate-900 font-black text-xs bg-slate-100 px-2 py-0.5 rounded'
                                      : 'text-slate-300 italic text-[11px]'
                                  }
                                >
                                  {hasRecord ? val : '-'}
                                </span>
                                {timeMs > 0 && (
                                  <span className="text-[10px] font-mono text-amber-800 bg-amber-50 border border-amber-200/80 px-1 py-0.5 rounded font-bold leading-tight whitespace-nowrap">
                                    ⏱ {formatMs(timeMs)}
                                  </span>
                                )}
                                {note && (
                                  <span
                                    title={note}
                                    className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded font-sans font-medium leading-tight max-w-[110px] truncate cursor-help"
                                  >
                                    📝 {note}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })
                      : filteredCompetitions.map((comp) => {
                          const scoreData = item.compScores[comp.id];
                          const hasRecord = scoreData?.hasRecord;
                          const val = scoreData?.score || 0;
                          const timeMs = scoreData?.timeMs || 0;
                          const note = scoreData?.notes;
                          return (
                            <td
                              key={comp.id}
                              className="py-2.5 px-2 text-center font-mono font-bold border-r border-slate-100"
                            >
                              <div className="flex flex-col items-center justify-center gap-0.5">
                                <span
                                  className={
                                    hasRecord
                                      ? 'text-slate-900 font-black text-xs bg-slate-100 px-2 py-0.5 rounded'
                                      : 'text-slate-300 italic text-[11px]'
                                  }
                                >
                                  {hasRecord ? val : '-'}
                                </span>
                                {timeMs > 0 && (
                                  <span className="text-[10px] font-mono text-amber-800 bg-amber-50 border border-amber-200/80 px-1 py-0.5 rounded font-bold leading-tight whitespace-nowrap">
                                    ⏱ {formatMs(timeMs)}
                                  </span>
                                )}
                                {note && (
                                  <span
                                    title={note}
                                    className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded font-sans font-medium leading-tight max-w-[110px] truncate cursor-help"
                                  >
                                    📝 {note}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}

                    <td className="py-2.5 px-3 text-center font-mono font-black text-amber-950 bg-amber-50 border-r border-amber-200 text-sm">
                      {item.grandTotal}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-sky-900 bg-sky-50">
                      {formatMs(item.totalTimeMs)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
