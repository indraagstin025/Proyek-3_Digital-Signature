export class AdminService {
  constructor(adminRepository, auditService) {
    this.adminRepository = adminRepository;
    this.auditService = auditService;
  }

  async getAllUsers() {
    return this.adminRepository.findAllUsers();
  }

  async createNewUser(userData, adminId, req) {
    const normalizedUserData = {
      ...userData,
      email: userData.email.toLowerCase(),
    };

    const newUser = await this.adminRepository.createUser(normalizedUserData);

    if (this.auditService) {
      await this.auditService.log("CREATE_USER", adminId, newUser.id, `Admin membuat user baru: ${newUser.email}`, req);
    }
    return newUser;
  }

  async updateUser(userId, data) {
    return this.adminRepository.updateUserById(userId, data);
  }

  async deleteUser(targetUserId, adminId, req) {
    const result = await this.adminRepository.deleteUserById(targetUserId);

    if (this.auditService) {
      await this.auditService.log("DELETE_USER", adminId, targetUserId, "Admin menghapus user permanen.", req);
    }
    return result;
  }

  async getDashboardStats() {
    const realCounts = await this.adminRepository.getSystemStats();

    const trafficLogs = await this.adminRepository.getTrafficStats();

    const trafficMap = {};

    for (let i = 0; i < 24; i++) {
      const hourLabel = `${i.toString().padStart(2, "0")}:00`;
      trafficMap[hourLabel] = 0;
    }

    trafficLogs.forEach((log) => {
      const date = new Date(log.createdAt);

      const hour = date.getHours();
      const label = `${hour.toString().padStart(2, "0")}:00`;

      if (trafficMap[label] !== undefined) {
        trafficMap[label]++;
      }
    });

    const realTrafficData = Object.keys(trafficMap).map((key) => ({
      name: key,
      requests: trafficMap[key],
    }));

    const dummyTrends = {
      users: 12.5,
      documents: 5.4,
      groups: 2.0,
      verifications: 8.5,
    };

    return {
      counts: {
        users: realCounts.totalUsers,
        documents: realCounts.totalDocuments,
        groups: realCounts.totalGroups,
        verifications: realCounts.totalSignatures,
      },
      traffic: realTrafficData,
      trends: dummyTrends,
    };
  }

  async getAllDocuments() {
    return this.adminRepository.findAllDocuments();
  }

  async getAllAuditLogs(page, limit) {
    return this.auditService.getAllLogs(page, limit);
  }

  async forceDeleteDocument(adminId, documentId, reason, req) {
    const result = await this.adminRepository.forceDeleteDocument(documentId);

    if (this.auditService) {
      await this.auditService.log("FORCE_DELETE_DOCUMENT", adminId, documentId, `Admin menghapus paksa dokumen. Alasan: ${reason || "_"}`, req);
    }
    return result;
  }
  async getAllReports() {
    return this.adminRepository.findAllReports();
  }

  async updateReportStatus(adminId, reportId, status, req) {
    const validStatuses = ["PENDING", "IN_PROGRESS", "RESOLVED", "REJECTED"];
    if (!validStatuses.includes(status)) {
      throw CommonError.BadRequest("Status laporan tidak valid.");
    }

    const updatedReport = await this.adminRepository.updateReportStatus(reportId, status);

    if (this.auditService) {
      await this.auditService.log(
        "RESOLVE_USER_REPORT",
        adminId,
        reportId,
        `Admin mengubah status laporan menjadi ${status}`,
        req
      );
    }

    return updatedReport;
  }
}
