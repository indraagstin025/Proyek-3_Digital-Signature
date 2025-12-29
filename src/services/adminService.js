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
    // 1. Ambil Stats Counter (User, Dokumen, dll)
    const realCounts = await this.adminRepository.getSystemStats();

    // 2. Ambil Traffic Logs (Raw Data dari DB)
    const trafficLogs = await this.adminRepository.getTrafficStats();

    // 3. Olah Traffic: Grouping per Jam (00:00 - 23:00)
    // Buat map kosong untuk 24 jam terakhir
    const trafficMap = {};

    // Inisialisasi map dengan 0
    for (let i = 0; i < 24; i++) {
      const hourLabel = `${i.toString().padStart(2, '0')}:00`;
      trafficMap[hourLabel] = 0;
    }

    // Isi map berdasarkan data log
    trafficLogs.forEach(log => {
      const date = new Date(log.createdAt);
      // Sesuaikan dengan jam server/lokal
      const hour = date.getHours();
      const label = `${hour.toString().padStart(2, '0')}:00`;

      if (trafficMap[label] !== undefined) {
        trafficMap[label]++;
      }
    });

    // Konversi ke Array format Recharts [{name: "10:00", requests: 12}, ...]
    const realTrafficData = Object.keys(trafficMap).map(key => ({
      name: key,
      requests: trafficMap[key]
    }));

    // (Opsional) Data Trends: Bisa dibuat logika hitung diff dengan bulan lalu nanti.
    // Untuk sekarang hardcode atau hitung sederhana.
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
      traffic: realTrafficData, // <-- DATA ASLI DIKIRIM KE SINI
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
}
