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

  /**
   * [UPDATED] Mengambil Statistik Dashboard Admin
   */
  async getDashboardStats() {
    const realCounts = await this.adminRepository.getSystemStats();

    const dummyTraffic = [
      { name: "00:00", requests: Math.floor(Math.random() * 50) + 10 },
      { name: "04:00", requests: Math.floor(Math.random() * 50) + 20 },
      { name: "08:00", requests: Math.floor(Math.random() * 200) + 100 },
      { name: "12:00", requests: Math.floor(Math.random() * 500) + 300 },
      { name: "16:00", requests: Math.floor(Math.random() * 400) + 200 },
      { name: "20:00", requests: Math.floor(Math.random() * 200) + 100 },
      { name: "23:59", requests: Math.floor(Math.random() * 100) + 50 },
    ];

    const dummyTrends = {
      users: 12.5,
      documents: -2.4,
      groups: 5.0,
      verifications: 0.0,
    };

    return {
      counts: {
        users: realCounts.totalUsers,
        documents: realCounts.totalDocuments,
        groups: realCounts.totalGroups,
        verifications: realCounts.totalSignatures,
      },
      traffic: dummyTraffic,
      trends: dummyTrends,
    };
  }

  async getAllDocuments() {
    return this.adminRepository.findAllDocuments();
  }

  async getAllAuditLogs() {
    if (!this.auditService) return [];
    return this.auditService.getAllLogs();
  }

  async forceDeleteDocument(adminId, documentId, reason, req) {
    const result = await this.adminRepository.forceDeleteDocument(documentId);

    if (this.auditService) {
      await this.auditService.log("FORCE_DELETE_DOCUMENT", adminId, documentId, `Admin menghapus paksa dokumen. Alasan: ${reason || "_"}`, req);
    }
    return result;
  }
}
