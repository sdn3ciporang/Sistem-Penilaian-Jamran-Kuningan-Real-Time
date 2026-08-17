import React, { useState, useMemo, useEffect } from 'react';
import { Judge, Competition, TeamCategory } from '../types';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import {
  Printer,
  Download,
  X,
  Filter,
  Check,
  Copy,
  CheckSquare,
  Square,
  Search,
  QrCode,
  Users,
} from 'lucide-react';

interface JudgeCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  judges: Judge[];
  competitions: Competition[];
}

export const JudgeCardsModal: React.FC<JudgeCardsModalProps> = ({
  isOpen,
  onClose,
  judges,
  competitions,
}) => {
  const [filterCat, setFilterCat] = useState<'ALL' | 'PUTRA' | 'PUTRI'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJudgeIds, setSelectedJudgeIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});

  const APP_URL = 'https://sistem-penilaian-jamran-kuningan-re-azure.vercel.app';

  const getJudgeLoginUrl = (username: string) => {
    return `${APP_URL}/?username=${encodeURIComponent(username || '')}`;
  };

  // All valid non-admin judges
  const allEligibleJudges = useMemo(() => {
    return (judges || []).filter((j) => j && !(j.role === 'ADMIN' && j.username === 'admin'));
  }, [judges]);

  // Generate QR code Data URL for each judge on mount or when judges change
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    const generateAllQrs = async () => {
      const newMap: Record<string, string> = {};
      for (const j of allEligibleJudges) {
        if (!j || !j.id) continue;
        const targetUrl = getJudgeLoginUrl(j.username);
        try {
          const url = await QRCode.toDataURL(targetUrl, {
            margin: 1,
            width: 300,
            color: {
              dark: '#0f172a', // slate-900 navy
              light: '#ffffff',
            },
          });
          newMap[j.id] = url;
        } catch (err) {
          console.error('Error generating QR Code for judge:', j.username, err);
        }
      }
      if (isMounted) {
        setQrMap(newMap);
      }
    };

    generateAllQrs();

    return () => {
      isMounted = false;
    };
  }, [isOpen, allEligibleJudges]);

  // Filtered judges according to Category & Search
  const filteredJudges = useMemo(() => {
    return allEligibleJudges.filter((j) => {
      if (!j) return false;
      if (filterCat === 'PUTRA' && j.assignedCategory === 'PUTRI') return false;
      if (filterCat === 'PUTRI' && j.assignedCategory === 'PUTRA') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const comp = (competitions || []).find((c) => c && c.id === j.assignedCompetitionId);
        const matchName = (j.name || '').toLowerCase().includes(q);
        const matchUsername = (j.username || '').toLowerCase().includes(q);
        const matchComp = (comp?.name || '').toLowerCase().includes(q);
        return matchName || matchUsername || matchComp;
      }

      return true;
    });
  }, [allEligibleJudges, filterCat, searchQuery, competitions]);

  // Sync selected IDs when modal opens or filteredJudges change initially
  useEffect(() => {
    if (isOpen) {
      setSelectedJudgeIds(filteredJudges.map((j) => j.id));
    }
  }, [isOpen, filterCat]);

  if (!isOpen) return null;

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedJudgeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedJudgeIds(filteredJudges.map((j) => j.id));
  };

  const handleDeselectAll = () => {
    setSelectedJudgeIds([]);
  };

  // Helper to get Pos Name
  const getPosName = (j: Judge) => {
    const comp = competitions.find((c) => c.id === j.assignedCompetitionId);
    let posName = comp?.name || 'Akses Umum / Sistem';
    if (comp?.isExploration && comp.subPosts && j.assignedSubPostId) {
      const sub = comp.subPosts.find((sp) => sp.id === j.assignedSubPostId);
      if (sub) posName = `${comp.name} - ${sub.name}`;
    }
    return posName;
  };

  // Helper to get Regu Label
  const getReguLabel = (cat?: TeamCategory | 'ALL') => {
    if (cat === 'PUTRA') return 'REGU PUTRA (PA)';
    if (cat === 'PUTRI') return 'REGU PUTRI (PI)';
    return 'REGU BEBAS (PA/PI)';
  };

  // Selected judges array for printing
  const judgesToPrint = filteredJudges.filter((j) => selectedJudgeIds.includes(j.id));

  // Generate A4 PDF Cards using jsPDF
  const handleDownloadPDF = async () => {
    if (judgesToPrint.length === 0) {
      alert('Pilih minimal 1 juri yang ingin dicetak kartunya.');
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Standard 3.5 x 2 inch card format:
    // 3.5 in = 88.9 mm, 2.0 in = 50.8 mm
    // A4 layout (210 x 297 mm): 2 columns x 5 rows = 10 cards per page
    const cols = 2;
    const rows = 5;
    const cardWidth = 88.9; // mm (3.5 in)
    const cardHeight = 50.8; // mm (2.0 in)
    const startX = 12.1; // mm ((210 - (2*88.9 + 8))/2)
    const startY = 9.5; // mm ((297 - (5*50.8 + 4*6))/2)
    const gapX = 8.0; // mm
    const gapY = 6.0; // mm

    for (let index = 0; index < judgesToPrint.length; index++) {
      const j = judgesToPrint[index];
      const pageIndex = Math.floor(index / (cols * rows));
      const cardIndexOnPage = index % (cols * rows);

      if (pageIndex > 0 && cardIndexOnPage === 0) {
        doc.addPage();
      }

      const col = cardIndexOnPage % cols;
      const row = Math.floor(cardIndexOnPage / cols);

      const x = startX + col * (cardWidth + gapX);
      const y = startY + row * (cardHeight + gapY);

      const posName = getPosName(j);
      const reguText = getReguLabel(j.assignedCategory);

      // 1. Card Container Outer Border & Background
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, cardWidth, cardHeight, 2.5, 2.5, 'FD');

      // 2. Scout Navy Header Bar (Compact 9.5mm height)
      doc.setFillColor(15, 23, 42); // slate-900 / navy
      doc.roundedRect(x, y, cardWidth, 9.5, 2.5, 2.5, 'F');
      doc.rect(x, y + 6, cardWidth, 3.5, 'F'); // flatten bottom radius of header

      // Gold Accent Strip
      doc.setFillColor(217, 119, 6); // amber-600
      doc.rect(x, y + 9.5, cardWidth, 0.8, 'F');

      // Header Text
      doc.setTextColor(253, 224, 71); // amber-300
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text('KARTU LOGIN JURI LOMBA', x + cardWidth / 2, y + 4.5, { align: 'center' });

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.text('JAMRAN KWARAN KUNINGAN', x + cardWidth / 2, y + 8, { align: 'center' });

      // 3. Nama Juri Section
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      const nameText = j.name.length > 26 ? j.name.substring(0, 24) + '...' : j.name;
      doc.text(nameText, x + 3.5, y + 14.5);

      // 4. Penugasan Pos Box
      doc.setFillColor(241, 245, 249); // slate-100
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x + 3, y + 16.5, 57, 8, 1.2, 1.2, 'FD');

      doc.setTextColor(30, 58, 138); // blue-900
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      const posText = posName.length > 32 ? posName.substring(0, 30) + '...' : posName;
      doc.text(`POS : ${posText}`, x + 4.5, y + 20);

      doc.setTextColor(71, 85, 105); // slate-600
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.text(`Kategori : ${reguText}`, x + 4.5, y + 23.2);

      // 5. Credentials Box (Left side)
      const credWidth = 57; // mm
      const credHeight = 18.5; // mm
      const credX = x + 3;
      const credY = y + 26;

      doc.setFillColor(254, 243, 199); // amber-100
      doc.setDrawColor(245, 158, 11); // amber-500
      doc.roundedRect(credX, credY, credWidth, credHeight, 1.5, 1.5, 'FD');

      doc.setTextColor(146, 64, 14); // amber-800
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.text('AKUN LOGIN PENILAIAN:', credX + 2.5, credY + 4);

      doc.setTextColor(15, 23, 42);
      doc.setFont('courier', 'bold');
      doc.setFontSize(7.5);
      doc.text(`USER : ${j?.username || '-'}`, credX + 2.5, credY + 10);

      const pwd = j.password || 'juri123';
      doc.text(`PASS : ${pwd}`, credX + 2.5, credY + 16);

      // QR Code Box (Right Side)
      const qrBoxX = x + 62;
      const qrBoxY = y + 11.5;
      const qrBoxWidth = 23.5; // mm
      const qrBoxHeight = 33; // mm

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(qrBoxX, qrBoxY, qrBoxWidth, qrBoxHeight, 1.5, 1.5, 'FD');

      // Get or dynamically create judge-specific QR code
      let judgeQrUrl = qrMap[j.id];
      if (!judgeQrUrl) {
        try {
          judgeQrUrl = await QRCode.toDataURL(getJudgeLoginUrl(j.username), {
            margin: 1,
            width: 300,
            color: { dark: '#0f172a', light: '#ffffff' },
          });
        } catch (err) {
          console.error('Error generating PDF QR:', err);
        }
      }

      // Render QR Code Image
      if (judgeQrUrl) {
        doc.addImage(judgeQrUrl, 'PNG', qrBoxX + 1.75, qrBoxY + 2, 20, 20);
      }

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.2);
      doc.text('SCAN LOG IN', qrBoxX + qrBoxWidth / 2, qrBoxY + 26, { align: 'center' });

      doc.setTextColor(30, 58, 138);
      doc.setFontSize(4.2);
      doc.text('Auto Username', qrBoxX + qrBoxWidth / 2, qrBoxY + 30, { align: 'center' });

      // 6. Card Footer Bar
      doc.setFillColor(248, 250, 252);
      doc.rect(x, y + 46, cardWidth, 4.8, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.line(x, y + 46, x + cardWidth, y + 46);
      doc.roundedRect(x, y, cardWidth, cardHeight, 2.5, 2.5, 'D'); // crisp outer boundary

      doc.setTextColor(100, 116, 139); // slate-500
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.8);
      doc.text('Helpdesk WA: 089625029588 | *Ukuran 3.5 x 2 Inci (10 Kartu / Lembar A4)', x + cardWidth / 2, y + 49.5, { align: 'center' });
    }

    doc.save(`Kartu_Login_Juri_3.5x2_Inci_${Date.now()}.pdf`);
  };

  const handlePrintBrowser = () => {
    window.print();
  };

  const handleCopyCredentials = (j: Judge) => {
    const directUrl = getJudgeLoginUrl(j?.username || '');
    const text = `⚜️ *AKUN LOGIN JURI PRAMUKA*\nNama: ${j?.name || 'Juri'}\nPos: ${getPosName(j)}\nKategori: ${getReguLabel(j?.assignedCategory)}\nLink Langsung: ${directUrl}\n\nUsername: *${j?.username || '-'}*\nPassword: *${j?.password || 'juri123'}*\n\n*(Buka link langsung di HP untuk otomatis mengisi username juri)*\n💬 Helpdesk WA Admin: 089625029588`;
    navigator.clipboard.writeText(text);
    setCopiedId(j.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-start p-3 sm:p-6 overflow-y-auto">
      
      {/* Top Modal Navigation Header (Hidden on Print) */}
      <div className="w-full max-w-5xl bg-white rounded-2xl p-4 sm:p-5 shadow-2xl border border-slate-200 mb-4 flex flex-col gap-4 print:hidden shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-300 font-black text-xl flex items-center justify-center shrink-0 shadow-sm">
              ⚜️
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                <span>Cetak Kartu Login Juri (PDF & QR)</span>
                <span className="bg-blue-100 text-blue-900 text-xs px-2.5 py-0.5 rounded-full font-bold border border-blue-200">
                  📐 3.5" x 2" (ID Card)
                </span>
                <span className="bg-amber-100 text-amber-900 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {judgesToPrint.length} Dipilih
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Format standar kartu nama / ID card (3.5 x 2 inci). Muat 10 kartu juri per lembar kertas A4 siap cetak & potong.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              disabled={judgesToPrint.length === 0}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all"
            >
              <Download className="w-4 h-4" />
              <span>DOWNLOAD PDF ({judgesToPrint.length})</span>
            </button>

            <button
              onClick={handlePrintBrowser}
              disabled={judgesToPrint.length === 0}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>CETAK</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters and Selection Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          {/* Select All / Deselect All */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={
                selectedJudgeIds.length === filteredJudges.length
                  ? handleDeselectAll
                  : handleSelectAll
              }
              className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {selectedJudgeIds.length === filteredJudges.length ? (
                <CheckSquare className="w-4 h-4 text-emerald-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>
                {selectedJudgeIds.length === filteredJudges.length
                  ? 'Batal Pilih Semua'
                  : 'Pilih Semua'}
              </span>
            </button>

            <span className="text-xs font-semibold text-slate-500">
              ({selectedJudgeIds.length} dari {filteredJudges.length} Juri)
            </span>
          </div>

          {/* Search Input & Category Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari juri / pos..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center bg-white p-1 rounded-lg border border-slate-300 text-xs font-bold shadow-2xs">
              <Filter className="w-3.5 h-3.5 text-slate-500 ml-1 mr-1" />
              <button
                onClick={() => setFilterCat('ALL')}
                className={`px-2 py-1 rounded transition-all cursor-pointer ${
                  filterCat === 'ALL'
                    ? 'bg-slate-900 text-amber-300 font-extrabold'
                    : 'text-slate-600'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setFilterCat('PUTRA')}
                className={`px-2 py-1 rounded transition-all cursor-pointer ${
                  filterCat === 'PUTRA'
                    ? 'bg-blue-600 text-white font-extrabold'
                    : 'text-slate-600'
                }`}
              >
                Putra
              </button>
              <button
                onClick={() => setFilterCat('PUTRI')}
                className={`px-2 py-1 rounded transition-all cursor-pointer ${
                  filterCat === 'PUTRI'
                    ? 'bg-pink-600 text-white font-extrabold'
                    : 'text-slate-600'
                }`}
              >
                Putri
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cards Preview Grid */}
      <div className="w-full max-w-5xl bg-slate-100 p-4 sm:p-6 rounded-3xl border border-slate-200 overflow-y-auto">
        {filteredJudges.length === 0 ? (
          <div className="text-center py-12 text-slate-500 space-y-2">
            <Users className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-semibold">Tidak ada akun juri yang sesuai filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2 print:gap-4 print:p-0">
            {filteredJudges.map((j) => {
              const isSelected = selectedJudgeIds.includes(j.id);
              const posName = getPosName(j);
              const reguLabel = getReguLabel(j.assignedCategory);
              const pwd = j.password || 'juri123';
              const isCopied = copiedId === j.id;

              return (
                <div
                  key={j.id}
                  onClick={() => handleToggleSelect(j.id)}
                  className={`bg-white rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between overflow-hidden print:break-inside-avoid print:shadow-none print:border-slate-400 ${
                    isSelected
                      ? 'border-blue-600 shadow-lg ring-2 ring-blue-500/30'
                      : 'border-slate-200 opacity-60 hover:opacity-100 grayscale hover:grayscale-0'
                  }`}
                >
                  {/* Selection Checkbox Pill */}
                  <div className="absolute top-2.5 left-2.5 z-20 print:hidden">
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-transparent border border-slate-300'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  </div>

                  {/* Copy Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyCredentials(j);
                    }}
                    className="absolute top-2.5 right-2.5 z-20 bg-slate-900/60 hover:bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg transition-opacity flex items-center gap-1 print:hidden cursor-pointer"
                    title="Salin Teks Akun Juri"
                  >
                    {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{isCopied ? 'Tersalin' : 'Salin'}</span>
                  </button>

                  {/* Header Card */}
                  <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 p-3 pt-3.5 text-center border-b-2 border-amber-500 text-white pl-9 pr-14">
                    <div className="text-[10px] font-black tracking-widest text-amber-300 uppercase truncate">
                      ⚜️ KARTU LOGIN JURI LOMBA
                    </div>
                    <div className="text-[8px] text-slate-300 font-medium tracking-tight mt-0.5 truncate">
                      JAMRAN KWARAN KUNINGAN
                    </div>
                  </div>

                  {/* Card Content Body */}
                  <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-black text-slate-900 leading-snug tracking-tight truncate">
                          {j.name}
                        </h3>
                        <span className="text-[8px] font-bold text-slate-400 border border-slate-200 px-1 py-0.5 rounded shrink-0">
                          3.5" x 2"
                        </span>
                      </div>

                      <div className="mt-1 bg-slate-100 p-1.5 rounded-lg border border-slate-200 space-y-0.5">
                        <div className="text-[9.5px] font-extrabold text-blue-900 truncate">
                          📍 POS: {posName}
                        </div>
                        <div className="text-[8.5px] font-bold text-slate-600 truncate">
                          👥 Kategori: {reguLabel}
                        </div>
                      </div>
                    </div>

                    {/* Credentials Box + QR Code Side-by-Side */}
                    <div className="flex gap-2 items-stretch">
                      {/* Left: Credentials */}
                      <div className="flex-1 bg-amber-50 border border-amber-300 p-1.5 rounded-lg space-y-1">
                        <div className="text-[7.5px] font-black text-amber-900 uppercase tracking-wider">
                          AKUN PENILAIAN:
                        </div>
                        <div className="font-mono text-[9.5px] font-bold text-slate-900 flex justify-between items-center bg-white px-1.5 py-0.5 rounded border border-amber-200">
                          <span className="text-slate-400 text-[8px]">USER:</span>
                          <span className="text-blue-900 font-black">{j?.username || '-'}</span>
                        </div>
                        <div className="font-mono text-[9.5px] font-bold text-slate-900 flex justify-between items-center bg-white px-1.5 py-0.5 rounded border border-amber-200">
                          <span className="text-slate-400 text-[8px]">PASS:</span>
                          <span className="text-emerald-800 font-black">{pwd}</span>
                        </div>
                      </div>

                      {/* Right: QR Code */}
                      <div className="w-18 bg-white border border-slate-200 rounded-lg p-1 flex flex-col items-center justify-center shrink-0">
                        {qrMap[j.id] ? (
                          <img
                            src={qrMap[j.id]}
                            alt={`QR Code Log In ${j.username}`}
                            className="w-12 h-12 object-contain"
                          />
                        ) : (
                          <QrCode className="w-10 h-10 text-slate-300 animate-pulse" />
                        )}
                        <span className="text-[6.5px] font-black text-slate-800 uppercase tracking-tight mt-0.5">
                          SCAN LOG IN
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Card */}
                  <div className="bg-slate-50 px-3 py-1.5 text-center text-[8.5px] font-semibold text-slate-500 border-t border-slate-100 flex items-center justify-between gap-1">
                    <span className="truncate text-slate-400">*Scan QR otomatis isi username</span>
                    <a
                      href="https://wa.me/6289625029588"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0 transition-colors"
                    >
                      <span>💬 WA Helpdesk: 089625029588</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
