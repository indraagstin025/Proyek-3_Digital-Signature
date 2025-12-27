import CommonError from "../errors/CommonError.js";

const DASHBOARD_LIMIT = 5;

/**
 * @class DashboardService
 * @description Service untuk menangani logika bisnis dashboard, termasuk ringkasan status, item tindakan, dan aktivitas terbaru.
 */
export class DashboardService {
  /**
   * @constructor
   * @param {import('../repositories/dashboardRepository.js').DashboardRepository} dashboardRepository - Repository utama dashboard.
   * @param {import('../repositories/groupDocumentSignerRepository.js').GroupDocumentSignerRepository} groupDocumentSignerRepository - Repository untuk tugas tanda tangan grup.
   * @throws {CommonError} Jika repository utama tidak disediakan.
   */
  constructor(dashboardRepository, groupDocumentSignerRepository) {
    if (!dashboardRepository) {
      throw CommonError.InternalServerError("DashboardRepository harus disediakan.");
    }
    // groupDocumentSignerRepository opsional secara teknis, tapi sangat disarankan untuk fitur lengkap
    this.dashboardRepository = dashboardRepository;
    this.groupDocumentSignerRepository = groupDocumentSignerRepository;
  }

  /**
   * @function getDashboardSummary
   * @description Mengambil ringkasan dashboard lengkap (Counts, Actions, Activities) untuk user tertentu.
   * @param {string} userId - ID pengguna.
   * @returns {Promise<Object>} Objek berisi counts, actions, dan activities.
   */
  async getDashboardSummary(userId) {
    this._validateUserId(userId);

    // Menggunakan allSettled agar jika satu query gagal, dashboard tidak mati total
    const results = await Promise.allSettled([
      this._getDocumentCounts(userId),
      this._getActionItems(userId),
      this._getRecentActivities(userId),
    ]);

    const getValue = (result, defaultValue) => (result.status === "fulfilled" ? result.value : defaultValue);

    // Opsional: Log error untuk debugging server jika ada yang rejected
    results.forEach((res, index) => {
      if (res.status === "rejected") {
        console.error(`[DashboardService] Query index ${index} failed:`, res.reason);
      }
    });

    return {
      counts: getValue(results[0], { waiting: 0, process: 0, completed: 0 }),
      actions: getValue(results[1], []),
      activities: getValue(results[2], []),
    };
  }

  /**
   * @private
   * @function _validateUserId
   * @description Memvalidasi keberadaan User ID.
   */
  _validateUserId(userId) {
    if (!userId) {
      throw CommonError.BadRequest("User ID tidak valid atau tidak ditemukan.");
    }
  }

  /**
   * @private
   * @function _getDocumentCounts
   * @description Menghitung jumlah dokumen berdasarkan status.
   */
  async _getDocumentCounts(userId) {
    const counts = await this.dashboardRepository.countAllStatuses(userId);
    return {
      waiting: counts.draft || 0,
      process: counts.pending || 0,
      completed: counts.completed || 0,
    };
  }

  /**
   * @private
   * @function _getActionItems
   * @description Mengambil daftar tugas yang membutuhkan tindakan user (Personal, Group, Draft).
   */
  async _getActionItems(userId) {
    const [incomingRequests, myDrafts, groupPending] = await Promise.all([
      // 1. Permintaan Tanda Tangan Personal
      this.dashboardRepository.findPendingSignatures(userId, DASHBOARD_LIMIT),

      // 2. Draft Dokumen Sendiri
      this.dashboardRepository.findActionRequiredDocuments(userId, DASHBOARD_LIMIT),

      // 3. Permintaan Tanda Tangan Grup (Cek ketersediaan repository)
      this.groupDocumentSignerRepository ? this.groupDocumentSignerRepository.findPendingByUser(userId) : Promise.resolve([]),
    ]);

    const actionMap = new Map();

    // A. Prioritas: Personal Request
    incomingRequests.forEach((sig) => {
      const doc = sig.documentVersion.document;
      actionMap.set(doc.id, {
        id: doc.id,
        title: doc.title,
        ownerName: doc.owner.name,
        status: "NEED_SIGNATURE",
        type: "personal",
        updatedAt: doc.updatedAt,
      });
    });

    // B. Group Request (Cek Duplikasi)
    groupPending.forEach((task) => {
      if (!actionMap.has(task.document.id)) {
        actionMap.set(task.document.id, {
          id: task.document.id,
          title: task.document.title,
          ownerName: task.document.group?.name ? `Grup: ${task.document.group.name}` : "Group Request",
          status: "NEED_YOUR_SIGNATURE",
          type: "group",
          updatedAt: task.document.updatedAt,
          groupId: task.document.groupId
        });
      }
    });

    // C. My Drafts (Cek Duplikasi)
    myDrafts.forEach((doc) => {
      if (!actionMap.has(doc.id)) {
        actionMap.set(doc.id, {
          id: doc.id,
          title: doc.title,
          ownerName: "Me",
          status: doc.status,
          type: "draft",
          updatedAt: doc.updatedAt,
        });
      }
    });

    return Array.from(actionMap.values())
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, DASHBOARD_LIMIT);
  }

  /**
   * @private
   * @function _getRecentActivities
   * @description Mengambil histori aktivitas terbaru (Personal, Group, Package).
   */
  async _getRecentActivities(userId) {
    const [recentDocs, recentSignatures, recentGroupSignatures, recentPackageSignatures] = await Promise.all([
      this.dashboardRepository.findRecentUpdatedDocuments(userId, 5),
      this.dashboardRepository.findRecentSignatures(userId, 5),
      this.dashboardRepository.findRecentGroupSignatures(userId, 5),
      this.dashboardRepository.findRecentPackageSignatures(userId, 5),
    ]);

    // [PERBAIKAN 1] Cek doc.groupId untuk menentukan tipe
    const formattedDocs = recentDocs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      status: doc.status,
      updatedAt: doc.updatedAt,
      type: doc.groupId ? "group" : "personal", // <-- Logika deteksi otomatis
      activityType: "edit",
      groupId: doc.groupId // Opsional: bawa groupId jika butuh routing
    }));

    // [PERBAIKAN 2] Hapus parameter kedua ("personal") agar helper bisa mendeteksi otomatis
    // Sebelumnya: this._normalizeSignatures(recentSignatures, "personal");
    const formattedPersonalSigs = this._normalizeSignatures(recentSignatures);

    const formattedGroupSigs = this._normalizeSignatures(recentGroupSignatures, "group");

    const formattedPackageSignatures = this._normalizePackageSignatures(recentPackageSignatures);

    return [...formattedDocs, ...formattedPersonalSigs, ...formattedGroupSigs, ...formattedPackageSignatures]
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 5);
  }

  /**
   * @private
   * @function _normalizeSignatures
   * @description Helper untuk normalisasi format data signature Personal/Group.
   */
  _normalizeSignatures(signatures, forcedType = null) {
    return signatures.map((sig) => {
      const doc = sig.documentVersion.document;

      let type = forcedType || "personal";

      // Jika tidak dipaksa tipe tertentu, cek apakah dokumen punya grup
      if (!forcedType && doc.groupId) {
        type = "group";
      }

      return {
        id: doc.id,
        title: doc.title,
        status: "SIGNED",
        updatedAt: sig.signedAt,
        activityType: "signature",
        type: type,
        groupId: doc.groupId // Tambahan info groupId
      };
    });
  }

  /**
   * @private
   * @function _normalizePackageSignatures
   * @description Helper untuk normalisasi format data signature Paket.
   */
  _normalizePackageSignatures(packageSignatures) {
    return packageSignatures.map((sig) => {
      const pkg = sig.packageDocument.package;
      const doc = sig.packageDocument.docVersion.document;
      return {
        id: doc.id,
        title: `${pkg.title || "Paket"} - ${doc.title}`,
        status: "SIGNED",
        updatedAt: sig.createdAt,
        activityType: "signature",
        type: "package",
      };
    });
  }
}