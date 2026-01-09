import CommonError from "../errors/CommonError.js";

export class HistoryService {
  /**
   * Inisialisasi HistoryService dengan repository data histori.
   * Repository wajib diberikan untuk memastikan service dapat melakukan query.
   * @class
   * @constructor
   * @param {import('../repository/interface/HistoryRepository.js').HistoryRepository} historyRepository
   * Repository yang menangani penyimpanan & pengambilan riwayat penandatanganan dokumen.
   * @throws {CommonError} Jika repository tidak di-pass saat inisialisasi.
   */
  constructor(historyRepository) {
    if (!historyRepository) {
      throw CommonError.InternalServerError("HistoryService: historyRepository harus disediakan.");
    }
    this.historyRepository = historyRepository;
  }

  /**
   * Mengambil seluruh riwayat aktivitas tanda tangan dokumen berdasarkan userId.
   *
   * **Alur kerja:**
   * 1. Service melakukan query paralel untuk mengambil:
   *    - Riwayat tanda tangan personal
   *    - Riwayat tanda tangan dokumen grup
   *    - Riwayat tanda tangan paket
   * 2. Hasil dari tiap tipe tanda tangan kemudian diformat ke struktur data seragam.
   * 3. Semua hasil digabung menjadi satu array.
   * 4. Data diurutkan berdasarkan tanggal terbaru.
   *
   * @async
   * @param {string} userId ID user yang ingin diambil histori tanda tangannya.
   * @returns {Promise<Array<Object>>} Daftar aktivitas tanda tangan dalam urutan terbaru → terlama.
   *
   * @example
   * const history = await historyService.getUserSigningHistory("USER123");
   */
  async getUserSigningHistory(userId) {
    const [personalSigs, groupSigs, packageSigs] = await Promise.all([this.historyRepository.findPersonalSignatures(userId), this.historyRepository.findGroupSignatures(userId), this.historyRepository.findPackageSignatures(userId)]);

    const formattedPersonal = personalSigs.map((sig) => ({
      id: sig.id,
      type: "PERSONAL",
      documentTitle: sig.documentVersion?.document?.title || "Unknown Document",
      signedAt: sig.signedAt,
      ipAddress: sig.ipAddress,
    }));

    const formattedGroup = groupSigs.map((sig) => ({
      id: sig.id,
      type: "GROUP",
      documentTitle: sig.documentVersion?.document?.title || "Unknown Document",
      signedAt: sig.signedAt,
      ipAddress: sig.ipAddress,
    }));

    const formattedPackage = packageSigs.map((sig) => ({
      id: sig.id,
      type: "PACKAGE",
      documentTitle: sig.packageDocument?.docVersion?.document?.title || "Unknown Document",
      signedAt: sig.createdAt,
      ipAddress: sig.ipAddress,
    }));

    const allHistory = [...formattedPersonal, ...formattedGroup, ...formattedPackage];
    allHistory.sort((a, b) => new Date(b.signedAt) - new Date(a.signedAt));

    return allHistory;
  }
}
