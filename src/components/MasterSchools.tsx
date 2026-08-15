import React, { useState, useMemo, useRef } from 'react';
import { School } from '../types';
import { ApiService } from '../services/apiService';
import { School as SchoolIcon, Search, Plus, Edit2, Trash2, Check, X, Download, Upload, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

interface MasterSchoolsProps {
  schools: School[];
  onRefresh: () => void;
}

export const MasterSchools: React.FC<MasterSchoolsProps> = ({ schools, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<Partial<School> | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [hasPutra, setHasPutra] = useState(true);
  const [hasPutri, setHasPutri] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingSchool, setDeletingSchool] = useState<School | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return schools
      .filter((s) => {
        const paddedId = String(s.id).padStart(2, '0');
        return (
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          String(s.id).includes(q) ||
          paddedId.includes(q)
        );
      })
      .sort((a, b) => Number(a.id) - Number(b.id));
  }, [schools, search]);

  const handleOpenAdd = () => {
    setEditingSchool(null);
    setName('');
    setCode('');
    setHasPutra(true);
    setHasPutri(true);
    setModalOpen(true);
  };

  const handleOpenEdit = (s: School) => {
    setEditingSchool(s);
    setName(s.name);
    setCode(s.code);
    setHasPutra(s.hasPutra);
    setHasPutri(s.hasPutri);
    setModalOpen(true);
  };

  // 1. Download Template Excel Pangkalan
  const handleDownloadTemplate = () => {
    const headers = ['No Pangkalan', 'Nama Pangkalan', 'Kode Pangkalan', 'Regu Putra (Ada/Tidak)', 'Regu Putri (Ada/Tidak)'];
    
    // Sample rows or current schools
    const sampleRows = schools.length > 0 
      ? schools.slice(0, 10).map((s) => [
          s.id,
          s.name,
          s.code || `PKG-${String(s.id).padStart(2, '0')}`,
          s.hasPutra ? 'Ada' : 'Tidak',
          s.hasPutri ? 'Ada' : 'Tidak',
        ])
      : [
          [1, 'SDN 1 Kuningan', 'PKG-01', 'Ada', 'Ada'],
          [2, 'SDN 2 Kuningan', 'PKG-02', 'Ada', 'Ada'],
          [3, 'SDN 3 Ciporang', 'PKG-03', 'Ada', 'Ada'],
          [4, 'MI Al-Hikmah', 'PKG-04', 'Ada', 'Tidak'],
          [5, 'SDIT Al-Ittihad', 'PKG-05', 'Tidak', 'Ada'],
        ];

    const guideHeaders = ['KOLOM', 'TIPE DATA', 'KETERANGAN & CONTOH'];
    const guideRows = [
      ['No Pangkalan', 'Angka (1, 2, 3, dst)', 'Wajib diisi angka nomor urut tenda/pangkalan peserta'],
      ['Nama Pangkalan', 'Teks', 'Nama resmi sekolah/madrasah (Contoh: SDN 3 Ciporang)'],
      ['Kode Pangkalan', 'Teks (Opsional)', 'Kode pangkalan unik jika ada (Contoh: PKG-17)'],
      ['Regu Putra', 'Ada / Tidak', 'Isi "Ada" jika mengirimkan regu putra, "Tidak" jika tidak'],
      ['Regu Putri', 'Ada / Tidak', 'Isi "Ada" jika mengirimkan regu putri, "Tidak" jika tidak'],
    ];

    const wsData = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    const wsGuide = XLSX.utils.aoa_to_sheet([guideHeaders, ...guideRows]);

    wsData['!cols'] = [{ wch: 15 }, { wch: 32 }, { wch: 18 }, { wch: 22 }, { wch: 22 }];
    wsGuide['!cols'] = [{ wch: 20 }, { wch: 22 }, { wch: 60 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsData, 'Data_Pangkalan');
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Panduan_Format');

    XLSX.writeFile(wb, `Template_Import_Pangkalan_${Date.now()}.xlsx`);
  };

  // 2. Upload Excel Pangkalan
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('Membaca berkas Excel...');

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = wb.SheetNames[0];
      const worksheet = wb.Sheets[firstSheetName];
      const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonRows.length <= 1) {
        throw new Error('Berkas Excel tidak berisi data pangkalan.');
      }

      const dataRows = jsonRows.slice(1);
      let successCount = 0;

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (!row || row.length === 0) continue;

        const rawId = Number(row[0]);
        const rawName = String(row[1] || '').trim();
        const rawCode = String(row[2] || '').trim();
        const rawPutra = String(row[3] || 'Ada').trim().toLowerCase();
        const rawPutri = String(row[4] || 'Ada').trim().toLowerCase();

        if (rawName) {
          const finalId = !isNaN(rawId) && rawId > 0 ? rawId : (schools.length + successCount + 1);
          const hasPa = rawPutra === 'ada' || rawPutra === 'ya' || rawPutra === 'true' || rawPutra === '1';
          const hasPi = rawPutri === 'ada' || rawPutri === 'ya' || rawPutri === 'true' || rawPutri === '1';

          await ApiService.saveSchool({
            id: finalId,
            name: rawName,
            code: rawCode || `PKG-${String(finalId).padStart(2, '0')}`,
            hasPutra: hasPa,
            hasPutri: hasPi,
          });
          successCount++;
        }
      }

      setUploadStatus(`Berhasil mengimpor ${successCount} data pangkalan!`);
      onRefresh();
      setTimeout(() => {
        setUploadStatus(null);
      }, 2500);
    } catch (err: any) {
      alert(err.message || 'Gagal membaca berkas Excel');
      setUploadStatus(null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      await ApiService.saveSchool({
        id: editingSchool?.id,
        name: name.trim(),
        code: code.trim(),
        hasPutra,
        hasPutri,
      });
      setModalOpen(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan pangkalan');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingSchool) return;
    setIsDeleting(true);
    try {
      await ApiService.deleteSchool(deletingSchool.id);
      setDeletingSchool(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus pangkalan');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <SchoolIcon className="w-6 h-6 text-blue-600" />
            Master Data Pangkalan ({schools.length} Sekolah)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar peserta pangkalan SD/MI yang mengikuti lomba Pramuka. Anda dapat mengimpor banyak pangkalan sekaligus via Excel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Download Template Excel */}
          <button
            onClick={handleDownloadTemplate}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-slate-300 transition-all cursor-pointer"
            title="Download Template Format Excel Pangkalan"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>DOWNLOAD TEMPLATE</span>
          </button>

          {/* Upload Excel */}
          <label className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>{isUploading ? 'MENGIMPOR...' : 'IMPORT EXCEL'}</span>
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isUploading}
            />
          </label>

          {/* Tambah Manual */}
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>TAMBAH PANGKALAN</span>
          </button>
        </div>
      </div>

      {/* Upload Status Banner */}
      {uploadStatus && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2 shadow-xs">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>{uploadStatus}</span>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama pangkalan atau kode (Cth: 17, Ciporang)..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs"
        />
      </div>

      {/* Table List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-16">No</th>
                <th className="py-3.5 px-4 w-28">Kode</th>
                <th className="py-3.5 px-4">Nama Pangkalan</th>
                <th className="py-3.5 px-4 text-center">Regu Putra</th>
                <th className="py-3.5 px-4 text-center">Regu Putri</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-medium">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-500 font-bold">#{String(s.id).padStart(2, '0')}</td>
                  <td className="py-3 px-4 font-mono text-xs font-bold text-blue-900 bg-blue-50/50 rounded">{s.code || `PKG-${String(s.id).padStart(2, '0')}`}</td>
                  <td className="py-3 px-4 font-extrabold text-slate-900">{s.name}</td>
                  <td className="py-3 px-4 text-center">
                    {s.hasPutra ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">
                        <Check className="w-3 h-3" /> Ada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        <X className="w-3 h-3" /> Tidak
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {s.hasPutri ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold bg-pink-100 text-pink-800 px-2.5 py-0.5 rounded-full">
                        <Check className="w-3 h-3" /> Ada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        <X className="w-3 h-3" /> Tidak
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenEdit(s)}
                        className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingSchool(s)}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-black text-slate-900">
              {editingSchool ? 'Edit Pangkalan' : 'Tambah Pangkalan Baru'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Pangkalan</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: SDN 17 Kuningan"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kode Pangkalan</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Opsional (Cth: PKG-56)"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasPutra"
                    checked={hasPutra}
                    onChange={(e) => setHasPutra(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <label htmlFor="hasPutra" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Memiliki Regu Putra (Pa)
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasPutri"
                    checked={hasPutri}
                    onChange={(e) => setHasPutri(e.target.checked)}
                    className="w-4 h-4 text-pink-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <label htmlFor="hasPutri" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Memiliki Regu Putri (Pi)
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
                >
                  {isSaving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirm Delete */}
      {deletingSchool && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Hapus Pangkalan?</h3>
                <p className="text-xs text-slate-500">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-900">
              {deletingSchool.name} ({deletingSchool.code})
            </div>

            <p className="text-xs text-slate-600">
              Apakah Anda yakin ingin menghapus pangkalan ini dari master data?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingSchool(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus Pangkalan'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
