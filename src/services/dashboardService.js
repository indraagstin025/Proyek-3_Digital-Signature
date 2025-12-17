import CommonError from "../errors/CommonError.js";

export class DashboardService {
  /**
   * @param {Object} dashboardRepository - Repository utama dashboard
   * @param {Object} groupDocumentSignerRepository - Repository untuk cek tugas tanda tangan grup (NEW)
   */
  constructor(dashboardRepository, groupDocumentSignerRepository) {
    this.dashboardRepository = dashboardRepository;
    this.groupDocumentSignerRepository = groupDocumentSignerRepository;
  }

  async getDashboardSummary(userId) {
    this._validateUserId(userId);

    const [counts, actions, activities] = await Promise.all([this._getDocumentCounts(userId), this._getActionItems(userId), this._getRecentActivities(userId)]);

    return {
      counts,
      actions,
      activities,
    };
  }

  _validateUserId(userId) {
    if (!userId) {
      throw CommonError.BadRequest("User ID tidak valid atau tidak ditemukan.");
    }
  }

  async _getDocumentCounts(userId) {
    const counts = await this.dashboardRepository.countAllStatuses(userId);
    return {
      waiting: counts.draft || 0,
      process: counts.pending || 0,
      completed: counts.completed || 0,
    };
  }

  /**
   * [UPDATED] Mengambil item tindakan dengan PENCEGAHAN DUPLIKASI.
   */
  async _getActionItems(userId) {
    const [incomingRequests, myDrafts, groupPending] = await Promise.all([
      this.dashboardRepository.findPendingSignatures(userId, 5),

      this.dashboardRepository.findActionRequiredDocuments(userId, 5),

      this.groupDocumentSignerRepository ? this.groupDocumentSignerRepository.findPendingByUser(userId) : Promise.resolve([]),
    ]);

    const actionMap = new Map();

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

    groupPending.forEach((task) => {
      if (!actionMap.has(task.document.id)) {
        actionMap.set(task.document.id, {
          id: task.document.id,
          title: task.document.title,
          ownerName: task.document.group?.name ? `Grup: ${task.document.group.name}` : "Group Request",
          status: "NEED_YOUR_SIGNATURE",
          type: "group",
          updatedAt: task.document.updatedAt,
        });
      }
    });

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
      .slice(0, 5);
  }

  /**
   * [UPDATED] Mengambil aktivitas terbaru (History) Personal & Group.
   */
  async _getRecentActivities(userId) {
    const [recentDocs, recentSignatures, recentGroupSignatures, recentPackageSignatures] = await Promise.all([
      this.dashboardRepository.findRecentUpdatedDocuments(userId, 5),
      this.dashboardRepository.findRecentSignatures(userId, 5),
      this.dashboardRepository.findRecentGroupSignatures(userId, 5),
      this.dashboardRepository.findRecentPackageSignatures(userId, 5),
    ]);

    const formattedDocs = recentDocs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      status: doc.status,
      updatedAt: doc.updatedAt,
      type: "personal",
      activityType: "edit",
    }));

    const formattedPersonalSigs = this._normalizeSignatures(recentSignatures, "personal");

    const formattedGroupSigs = this._normalizeSignatures(recentGroupSignatures, "group");

    const formattedPackageSignatures = this._normalizePackageSignatures(recentPackageSignatures);

    return [...formattedDocs, ...formattedPersonalSigs, ...formattedGroupSigs, ...formattedPackageSignatures].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5);
  }

  /**
   * Helper Normalisasi Personal/Group
   * @param {Array} signatures - Data dari DB
   * @param {String} forcedType - 'personal' atau 'group' (opsional)
   */
  _normalizeSignatures(signatures, forcedType = null) {
    return signatures.map((sig) => {
      const doc = sig.documentVersion.document;

      let type = forcedType || "personal";
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
      };
    });
  }

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

import { prismaDashboardRepository } from "../repository/prisma/PrismaDashboardRepository.js";
export const dashboardService = new DashboardService(prismaDashboardRepository);
