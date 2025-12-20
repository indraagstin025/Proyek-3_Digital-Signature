import crypto from "crypto";
import GroupError from "../errors/GroupError.js";
import DocumentError from "../errors/DocumentError.js";
import CommonError from "../errors/CommonError.js";
import { sendWhatsappNotification } from "../utils/whatsappSender.js";

/**
 * Service yang menangani logika bisnis untuk Grup, Anggota, Undangan, dan Dokumen Grup.
 */
export class GroupService {
  /**
   * @param {Object} groupRepository - Repository untuk entitas Group.
   * @param {Object} groupMemberRepository - Repository untuk entitas GroupMember.
   * @param {Object} groupInvitationRepository - Repository untuk entitas GroupInvitation.
   * @param {Object} documentRepository - Repository untuk entitas Document.
   * @param {Object} fileStorage - Service untuk upload file (S3/Local).
   * @param {Object} groupDocumentSignerRepository - Repository untuk entitas GroupDocumentSigner.
   * @param {Object} signatureRepository - Repository untuk entitas Signature (Personal).
   * @param {Object} versionRepository - Repository untuk entitas DocumentVersion.
   * @param {Object} pdfService - Service untuk manipulasi PDF.
   * @param {Object} groupSignatureRepository - Repository untuk entitas Signature (Group).
   * @throws {Error} Jika dependency wajib tidak disediakan.
   */
  constructor(
      groupRepository,
      groupMemberRepository,
      groupInvitationRepository,
      documentRepository,
      fileStorage,
      groupDocumentSignerRepository,
      signatureRepository,
      versionRepository,
      pdfService,
      groupSignatureRepository
  ) {
    if (
        !groupRepository ||
        !groupMemberRepository ||
        !groupInvitationRepository ||
        !documentRepository ||
        !fileStorage ||
        !signatureRepository ||
        !versionRepository ||
        !pdfService ||
        !groupSignatureRepository
    ) {
      throw new Error("Repository utama dan FileStorage harus disediakan.");
    }

    this.groupRepository = groupRepository;
    this.groupMemberRepository = groupMemberRepository;
    this.groupInvitationRepository = groupInvitationRepository;
    this.documentRepository = documentRepository;
    this.fileStorage = fileStorage;
    this.groupDocumentSignerRepository = groupDocumentSignerRepository;
    this.signatureRepository = signatureRepository;
    this.versionRepository = versionRepository;
    this.pdfService = pdfService;
    this.groupSignatureRepository = groupSignatureRepository;
  }

  /**
   * Membuat grup baru dengan admin yang ditentukan.
   * @param {string} adminId - ID User pembuat grup.
   * @param {string} name - Nama grup.
   * @returns {Promise<Object>} Objek grup yang baru dibuat.
   * @throws {GroupError} Jika nama kosong.
   */
  async createGroup(adminId, name) {
    if (!name || name.trim() === "") throw GroupError.BadRequest("Nama grup tidak boleh kosong.");
    try {
      return await this.groupRepository.createWithAdmin(adminId, name);
    } catch (error) {
      throw new Error(`Gagal membuat grup: ${error.message}`);
    }
  }

  /**
   * Mengambil detail grup berdasarkan ID dengan validasi keanggotaan.
   * @param {number|string} groupId - ID Grup.
   * @param {string} userId - ID User yang meminta data.
   * @returns {Promise<Object>} Detail grup beserta relasinya.
   * @throws {GroupError} Jika user bukan anggota atau grup tidak ditemukan.
   */
  async getGroupById(groupId, userId) {
    const member = await this.groupMemberRepository.findByGroupAndUser(groupId, userId);
    if (!member) throw GroupError.UnauthorizedAccess("Anda bukan anggota grup ini.");

    const group = await this.groupRepository.findById(groupId);
    if (!group) throw GroupError.NotFound(groupId);
    return group;
  }

  /**
   * Membuat token undangan untuk bergabung ke grup.
   * Token berlaku selama 24 jam.
   * @param {number|string} groupId - ID Grup.
   * @param {string} inviterId - ID User pembuat undangan (Harus Admin).
   * @param {string} role - Role yang akan diberikan (default: 'member').
   * @returns {Promise<Object>} Data undangan termasuk token.
   * @throws {GroupError} Jika user bukan admin grup.
   */
  async createInvitation(groupId, inviterId, role) {
    const inviter = await this.groupMemberRepository.findByGroupAndUser(groupId, inviterId);

    if (!inviter || inviter.role !== "admin_group") {
      throw GroupError.UnauthorizedAccess("Hanya admin grup yang dapat membuat undangan.");
    }

    const token = crypto.randomBytes(20).toString("hex");
    const expiresAt = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);

    return this.groupInvitationRepository.create({
      groupId,
      inviterId,
      role,
      token,
      expiresAt,
      status: "active",
      usageLimit: null,
    });
  }

  /**
   * Menerima undangan grup berdasarkan token.
   * @param {string} token - Token undangan.
   * @param {string} userId - ID User yang menerima undangan.
   * @returns {Promise<Object>} Data keanggotaan baru.
   * @throws {GroupError} Jika token tidak valid, kadaluwarsa, atau user sudah bergabung.
   */
  async acceptInvitation(token, userId) {
    const invitation = await this.groupInvitationRepository.findByToken(token);
    if (!invitation) throw GroupError.InvalidInvitation("Token undangan tidak ditemukan.");

    const existing = await this.groupMemberRepository.findByGroupAndUser(invitation.groupId, userId);
    if (existing) throw GroupError.AlreadyMember();

    if (invitation.status !== "active" || invitation.expiresAt < new Date()) {
      throw GroupError.InvalidInvitation("Undangan tidak valid atau telah kedaluwarsa.");
    }
    try {
      return await this.groupMemberRepository.createFromInvitation(invitation, userId);
    } catch (error) {
      throw new Error(`Gagal bergabung dengan grup: ${error.message}`);
    }
  }

  /**
   * Memindahkan dokumen dari personal draft ke dalam grup.
   * @param {string} documentId - ID Dokumen.
   * @param {number|string} groupId - ID Grup tujuan.
   * @param {string} userId - ID User pemilik dokumen.
   * @param {string[]} [signerUserIds=[]] - Array ID User yang harus tanda tangan.
   * @returns {Promise<Object>} Dokumen yang telah diupdate.
   */
  async assignDocumentToGroup(documentId, groupId, userId, signerUserIds = []) {
    const document = await this.documentRepository.findById(documentId, userId);
    if (!document) throw DocumentError.NotFound(documentId);

    const member = await this.groupMemberRepository.findByGroupAndUser(groupId, userId);
    if (!member) throw GroupError.UnauthorizedAccess("Anda harus menjadi anggota grup.");

    const dataToUpdate = { groupId };

    if (signerUserIds && signerUserIds.length > 0 && this.groupDocumentSignerRepository) {
      await this.groupDocumentSignerRepository.createSigners(documentId, signerUserIds);

      dataToUpdate.status = "pending";

      const group = await this.groupRepository.findById(groupId);
      const groupName = group ? group.name : "Grup Dokumen";

      this._notifySigners(signerUserIds, document.title, groupName).catch((err) =>
          console.error("Notification Error on Document Assignment:", err)
      );
    } else {
      dataToUpdate.status = "draft";
    }

    const updatedDoc = await this.documentRepository.update(documentId, dataToUpdate);

    return updatedDoc;
  }

  /**
   * Mengeluarkan anggota dari grup.
   * @param {number|string} groupId - ID Grup.
   * @param {string} adminId - ID Admin yang melakukan aksi.
   * @param {string} userIdToRemove - ID User yang akan dikeluarkan.
   * @throws {GroupError} Jika bukan admin atau mencoba mengeluarkan pemilik utama.
   */
  async removeMember(groupId, adminId, userIdToRemove) {
    const admin = await this.groupMemberRepository.findByGroupAndUser(groupId, adminId);
    if (!admin || admin.role !== "admin_group")
      throw GroupError.UnauthorizedAccess("Hanya admin grup yang dapat mengeluarkan anggota.");

    const target = await this.groupMemberRepository.findByGroupAndUser(groupId, userIdToRemove);
    if (!target) throw GroupError.NotFound("Anggota tidak ditemukan di grup ini.");

    const group = await this.groupRepository.findById(groupId);
    if (group.adminId === userIdToRemove) throw GroupError.BadRequest("Tidak dapat mengeluarkan pemilik utama grup.");

    await this.groupMemberRepository.deleteById(target.id);
  }

  /**
   * Mengubah nama grup.
   * @param {number|string} groupId - ID Grup.
   * @param {string} userId - ID Admin.
   * @param {string} name - Nama baru.
   * @returns {Promise<Object>} Data grup yang diperbarui.
   */
  async updateGroup(groupId, userId, name) {
    const member = await this.groupMemberRepository.findByGroupAndUser(groupId, userId);
    if (!member || member.role !== "admin_group")
      throw GroupError.UnauthorizedAccess("Hanya admin yang bisa mengubah nama grup.");
    return this.groupRepository.update(groupId, { name });
  }

  /**
   * Menghapus grup secara permanen.
   * @param {number|string} groupId - ID Grup.
   * @param {string} userId - ID Pemilik utama.
   */
  async deleteGroup(groupId, userId) {
    const group = await this.groupRepository.findById(groupId);
    if (!group) throw GroupError.NotFound();
    if (group.adminId !== userId)
      throw GroupError.UnauthorizedAccess("Hanya pemilik utama grup yang bisa menghapus grup.");
    await this.groupRepository.deleteById(groupId);
  }

  /**
   * Mengambil semua grup di mana user terdaftar sebagai anggota.
   * @param {string} userId - ID User.
   * @returns {Promise<Array>} Array objek ringkasan grup.
   */
  async getAllUserGroups(userId) {
    const memberships = await this.groupMemberRepository.findAllByUserId(userId, {
      include: { group: { include: { _count: { select: { members: true, documents: true } } } } },
    });
    return memberships
        .map(
            (m) =>
                m.group && {
                  id: m.group.id,
                  name: m.group.name,
                  docs_count: m.group._count ? m.group._count.documents : 0,
                  members_count: m.group._count ? m.group._count.members : 0,
                }
        )
        .filter(Boolean);
  }

  /**
   * Memperbarui daftar penanda tangan (Checklist Signer) untuk dokumen yang sudah ada.
   * Menghandle penambahan signer baru dan penghapusan signer yang belum tanda tangan (pending).
   * @param {number|string} groupId - ID Grup.
   * @param {string} documentId - ID Dokumen.
   * @param {string} adminId - ID User yang melakukan edit (Admin Grup).
   * @param {string[]} newUserIds - Array ID User hasil checklist terbaru.
   * @returns {Promise<Object>} Ringkasan perubahan (added/removed).
   */
  async updateGroupDocumentSigners(groupId, documentId, adminId, newUserIds) {
    const adminMember = await this.groupMemberRepository.findByGroupAndUser(groupId, adminId);
    if (!adminMember || adminMember.role !== "admin_group") {
      throw GroupError.UnauthorizedAccess("Hanya admin grup yang dapat mengelola penanda tangan.");
    }

    const document = await this.documentRepository.findById(documentId, adminId);
    if (!document || document.groupId !== groupId) {
      throw GroupError.NotFound("Dokumen tidak ditemukan di dalam grup ini.");
    }

    if (document.status === "completed" || document.status === "archived") {
      throw CommonError.BadRequest("Tidak dapat mengubah penanda tangan untuk dokumen yang sudah selesai.");
    }

    const currentSigners = document.signerRequests || [];
    const currentSignerIds = currentSigners.map((s) => s.userId);

    const toAdd = newUserIds.filter((id) => !currentSignerIds.includes(id));
    const toRemove = currentSignerIds.filter((id) => !newUserIds.includes(id));

    for (const userId of toRemove) {
      const signerData = currentSigners.find((s) => s.userId === userId);
      if (signerData && signerData.status === "PENDING") {
        await this.groupDocumentSignerRepository.deleteSpecificSigner(documentId, userId);
      }
    }

    if (toAdd.length > 0) {
      await this.groupDocumentSignerRepository.createSigners(documentId, toAdd);

      const group = await this.groupRepository.findById(groupId);
      this._notifySigners(toAdd, document.title, group.name).catch((err) =>
          console.error("Notification Error during Signer Update:", err)
      );
    }

    const allSignersCount = newUserIds.length;
    let newStatus = document.status;

    if (allSignersCount > 0) {
      if (newStatus === "draft") {
        newStatus = "pending";
      }
    } else if (allSignersCount === 0) {
      if (newStatus === "pending") {
        newStatus = "draft";
      }
    }

    if (document.status !== newStatus) {
      await this.documentRepository.update(documentId, { status: newStatus });
    }

    return { message: "Daftar penanda tangan diperbarui.", added: toAdd.length, removed: toRemove.length };
  }

  /**
   * Melepaskan dokumen dari grup (Unassign).
   * Dokumen akan kehilangan asosiasi grup dan semua data permintaan tanda tangan akan dihapus.
   * @param {number|string} groupId - ID Grup.
   * @param {string} documentId - ID Dokumen.
   * @param {string} userId - ID Admin.
   * @returns {Promise<Object>} Dokumen yang telah diupdate.
   */
  async unassignDocumentFromGroup(groupId, documentId, userId) {
    const member = await this.groupMemberRepository.findByGroupAndUser(groupId, userId);

    if (!member || member.role !== "admin_group") {
      throw GroupError.UnauthorizedAccess("Hanya admin yang bisa menghapus dokumen dari grup.");
    }

    const document = await this.documentRepository.findFirst({
      where: { id: documentId, groupId },
    });

    if (!document) {
      throw GroupError.NotFound("Dokumen tidak ditemukan di dalam grup ini.");
    }

    if (this.groupDocumentSignerRepository) {
      await this.groupDocumentSignerRepository.deleteByDocumentId(documentId);
    } else {
      console.error("ERROR CRITICAL: groupDocumentSignerRepository is UNDEFINED!");
    }

    return this.documentRepository.update(documentId, {
      groupId: null,
    });
  }

  /**
   * Mengupload dokumen baru langsung ke dalam grup.
   * Mengirim notifikasi WhatsApp ke anggota yang dipilih.
   * @param {string} userId - ID Uploader.
   * @param {number|string} groupId - ID Grup.
   * @param {File} file - Objek File (Multer).
   * @param {string} title - Judul Dokumen.
   * @param {string[]} signerUserIds - Array ID User penanda tangan.
   * @returns {Promise<Object>} Dokumen baru yang dibuat.
   */
  async uploadGroupDocument(userId, groupId, file, title, signerUserIds) {
    const member = await this.groupMemberRepository.findByGroupAndUser(groupId, userId);
    if (!member) throw GroupError.UnauthorizedAccess("Anda bukan anggota grup ini.");

    if (file.mimetype !== "application/pdf") throw CommonError.BadRequest("Hanya file PDF yang diizinkan.");

    const filePath = await this.fileStorage.uploadDocument(file, userId);
    const hash = crypto.createHash("sha256").update(file.buffer).digest("hex");

    const newDoc = await this.documentRepository.createGroupDocument(
        userId,
        groupId,
        title,
        filePath,
        hash,
        signerUserIds
    );

    if (signerUserIds && signerUserIds.length > 0) {
      const groupName = member.group ? member.group.name : "Grup Dokumen";

      this._notifySigners(signerUserIds, title, groupName).catch((err) => console.error("Notification Error:", err));
    }

    return newDoc;
  }

  /**
   * Finalisasi Dokumen Grup (Hanya Admin).
   * Menggabungkan semua tanda tangan visual ke dalam PDF (Burn),
   * membuat versi final, dan mengubah status dokumen menjadi 'completed'.
   * @param {number|string} groupId - ID Grup.
   * @param {string} documentId - ID Dokumen.
   * @param {string} adminId - ID Admin.
   * @returns {Promise<Object>} URL file final dan pesan sukses.
   */
  async finalizeGroupDocument(groupId, documentId, adminId) {
    const member = await this.groupMemberRepository.findByGroupAndUser(groupId, adminId);
    if (!member || member.role !== "admin_group") {
      throw GroupError.UnauthorizedAccess("Hanya admin grup yang dapat memfinalisasi dokumen.");
    }

    const pendingCount = await this.groupDocumentSignerRepository.countPendingSigners(documentId);
    if (pendingCount > 0) {
      throw CommonError.BadRequest(
          `Belum bisa finalisasi. Masih ada ${pendingCount} orang yang belum tanda tangan.`
      );
    }

    const document = await this.documentRepository.findById(documentId, adminId);
    if (document.status === "completed") {
      throw CommonError.BadRequest("Dokumen sudah difinalisasi sebelumnya.");
    }

    const currentVersion = document.currentVersion;

    const allSignatures = await this.groupSignatureRepository.findAllByVersionId(currentVersion.id);

    if (!allSignatures || allSignatures.length === 0) {
      throw new Error("Tidak ada tanda tangan yang ditemukan untuk difinalisasi.");
    }

    const signaturesPayload = allSignatures.map((sig) => ({
      signatureImageUrl: sig.signatureImageUrl,
      pageNumber: sig.pageNumber,
      positionX: sig.positionX,
      positionY: sig.positionY,
      width: sig.width,
      height: sig.height,
    }));

    const { signedFileBuffer, publicUrl } = await this.pdfService.generateSignedPdf(
        currentVersion.id,
        signaturesPayload,
        { displayQrCode: false }
    );

    const newHash = crypto.createHash("sha256").update(signedFileBuffer).digest("hex");

    const newVersion = await this.versionRepository.create({
      documentId: documentId,
      userId: adminId,
      url: publicUrl,
      hash: newHash,
      signedFileHash: newHash,
    });

    await this.documentRepository.update(documentId, {
      currentVersionId: newVersion.id,
      status: "completed",
      signedFileUrl: publicUrl,
    });

    return { message: "Dokumen berhasil difinalisasi.", url: publicUrl };
  }

  /**
   * [PRIVATE HELPER] Mengirim notifikasi WhatsApp ke daftar signer.
   * Berjalan secara paralel menggunakan Promise.allSettled.
   * @private
   * @param {string[]} signerIds - Array ID User.
   * @param {string} docTitle - Judul Dokumen.
   * @param {string} groupName - Nama Grup.
   */
  async _notifySigners(signerIds, docTitle, groupName) {
    try {
      const prisma = this.groupRepository.prisma;
      if (!prisma) {
        console.warn("[GroupService] Prisma client tidak tersedia untuk notifikasi.");
        return;
      }

      const users = await prisma.user.findMany({
        where: { id: { in: signerIds } },
        select: {
          id: true,
          name: true,
          phoneNumber: true,
        },
      });

      console.log(`[GroupService] Mencoba mengirim notifikasi ke ${users.length} user...`);

      const appUrl = process.env.CLIENT_URL || "http://localhost:5173";
      const documentLink = `${appUrl}/dashboard/documents`;

      const notificationPromises = users.map(async (user) => {
        if (!user.phoneNumber) return;

        const message = `Halo *${user.name}*! 👋

                    Anda diminta untuk menandatangani dokumen baru di *${groupName || "Signify Group"}*.
                    
                    📄 Judul: *${docTitle}*
                    
                    Silakan klik link di bawah ini untuk melihat dokumen:
                    👉 ${documentLink}
                    
                    Terima kasih.`;

        return sendWhatsappNotification(user.phoneNumber, message);
      });

      await Promise.allSettled(notificationPromises);
    } catch (error) {
      console.error("[GroupService] Gagal mengirim notifikasi batch:", error.message);
    }
  }
}