export class AuditService {
  constructor(auditRepository) {
    this.auditRepository = auditRepository;
  }

  /**
   * Helper function praktis untuk mencatat log.
   * @param {string} action - Enum Action (CREATE_USER, DELETE_USER, dll)
   * @param {string} actorId - ID Admin yang melakukan
   * @param {string} targetId - ID User/Dokumen yang terkena dampak
   * @param {string} description - Pesan detail
   * @param {Object} req - Object Request Express (untuk ambil IP/UserAgent)
   */
  async log(action, actorId, targetId, description, req = null) {
    const ipAddress = req ? req.headers["x-forwarded-for"] || req.socket.remoteAddress : null;
    const userAgent = req ? req.headers["user-agent"] : null;

    return this.auditRepository.createLog({
      action,
      actorId,
      targetId: targetId ? String(targetId) : null,
      description,
      ipAddress,
      userAgent,
    });
  }

  async getAllLogs(page, limit) {
    return this.auditRepository.findAllLogs(page, limit);
  }
}
