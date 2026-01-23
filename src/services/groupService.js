import crypto from "crypto";
import GroupError from "../errors/GroupError.js";
import DocumentError from "../errors/DocumentError.js";
import CommonError from "../errors/CommonError.js";
import { sendWhatsappNotification } from "../utils/whatsappSender.js";

/**
 * Service class for handling business logic related to Groups, Members, Invitations, and Group Documents.
 * Integrates with multiple repositories and services to perform operations.
 */
export class GroupService {
  /**
   * Initializes the GroupService with necessary repositories and services.
   * @param {Object} groupRepository - Repository for Group entity.
   * @param {Object} groupMemberRepository - Repository for GroupMember entity.
   * @param {Object} groupInvitationRepository - Repository for GroupInvitation entity.
   * @param {Object} documentRepository - Repository for Document entity.
   * @param {Object} fileStorage - Service for file storage operations (e.g., S3).
   * @param {Object} groupDocumentSignerRepository - Repository for GroupDocumentSigner entity.
   * @param {Object} signatureRepository - Repository for Personal Signature entity.
   * @param {Object} versionRepository - Repository for DocumentVersion entity.
   * @param {Object} pdfService - Service for PDF manipulation (e.g., signing, burning).
   * @param {Object} groupSignatureRepository - Repository for Group Signature entity.
   * @param {Object} [io] - Socket.IO instance for realtime communication.
   * @param {object} userService for user
   * @throws {Error} Throws if mandatory repositories or services are missing.
   */
  constructor(groupRepository, groupMemberRepository, groupInvitationRepository, documentRepository, fileStorage, groupDocumentSignerRepository, versionRepository, pdfService, groupSignatureRepository, io, userService) {
    if (!groupRepository || !groupMemberRepository || !groupInvitationRepository || !documentRepository || !fileStorage || !versionRepository || !pdfService || !groupSignatureRepository || !userService) {
      throw new Error("Repository utama dan FileStorage harus disediakan.");
    }

    this.groupRepository = groupRepository;
    this.groupMemberRepository = groupMemberRepository;
    this.groupInvitationRepository = groupInvitationRepository;
    this.documentRepository = documentRepository;
    this.fileStorage = fileStorage;
    this.groupDocumentSignerRepository = groupDocumentSignerRepository;
    this.versionRepository = versionRepository;
    this.pdfService = pdfService;
    this.groupSignatureRepository = groupSignatureRepository;
    this.io = io;
    this.userService = userService;
  }

  async _isPremium(userId) {
    return await this.userService.isUserPremium(userId);
  }

  /**
   * Creates a new group and assigns the creator as the admin.
   * @param {string} adminId - The ID of the user creating the group.
   * @param {string} name - The name of the group.
   * @returns {Promise<Object>} The newly created group object.
   * @throws {GroupError} If the name is empty or validation fails.
   */
  async createGroup(adminId, name) {
    if (!name || name.trim() === "") throw GroupError.BadRequest("Nama grup tidak boleh kosong.");

    const isPremium = await this._isPremium(adminId);
    const limitGroup = isPremium ? 10 : 1;
    const ownedGroupsCount = await this.groupRepository.countByAdminId(adminId);

    if (ownedGroupsCount >= limitGroup) {
      throw CommonError.Forbidden(`Anda telah mencapai batas pembuatan grup (${limitGroup} grup). ${!isPremium ? "Upgrade ke Premium untuk membuat hingga 10 grup." : ""}`);
    }

    try {
      return await this.groupRepository.createWithAdmin(adminId, name);
    } catch (error) {
      throw new Error(`Gagal membuat grup: ${error.message}`);
    }
  }

  /**
   * Retrieves group details by ID, validating user membership.
   * @param {number|string} groupId - The ID of the group.
   * @param {string} userId - The ID of the requesting user.
   * @returns {Promise<Object>} The group details.
   * @throws {GroupError} If the user is not a member or the group is not found.
   */
  async getGroupById(groupId, userId) {
    const member = await this.groupMemberRepository.findByGroupAndUser(groupId, userId);
    if (!member) throw GroupError.UnauthorizedAccess("Anda bukan anggota grup ini.");

    const group = await this.groupRepository.findById(groupId);
    if (!group) throw GroupError.NotFound(groupId);
    return group;
  }

  /**
   * Creates a time-limited invitation token for joining a group.
   * Only admins can create invitations.
   * @param {number|string} groupId - The ID of the group.
   * @param {string} inviterId - The ID of the user creating the invitation (must be admin).
   * @param {string} role - The role assigned to the new member (default: 'member').
   * @returns {Promise<Object>} The invitation object including the token.
   * @throws {GroupError} If the inviter is not an admin.
   */
  async createInvitation(groupId, inviterId, role) {
    const inviter = await this.groupMemberRepository.findByGroupAndUser(groupId, inviterId);
    if (!inviter || inviter.role !== "admin_group") {
      throw GroupError.UnauthorizedAccess("Hanya admin grup yang dapat membuat undangan.");
    }

    const group = await this.groupRepository.findById(groupId);
    const ownerId = group.adminId;
    const isOwnerPremium = await this._isPremium(ownerId);

    if (!isOwnerPremium) {
      const MAX_MEMBERS_FREE = 5;
      const currentMembersCount = await this.groupMemberRepository.countByGroupId(groupId);

      if (currentMembersCount >= MAX_MEMBERS_FREE) {
        throw CommonError.Forbidden(`Grup Basic (Free) maksimal hanya boleh memiliki ${MAX_MEMBERS_FREE} anggota. Upgrade akun Pemilik Grup ke Premium untuk anggota tak terbatas.`);
      }
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
   * Processes a group invitation using a token and adds the user to the group.
   * Emits a 'new_member' socket event upon success.
   * @param {string} token - The invitation token.
   * @param {string} userId - The ID of the user accepting the invitation.
   * @returns {Promise<Object>} The newly created member object.
   * @throws {GroupError} If the token is invalid, expired, or user is already a member.
   */
  async acceptInvitation(token, userId) {
    const invitation = await this.groupInvitationRepository.findByToken(token);
    if (!invitation) throw GroupError.InvalidInvitation("Token undangan tidak ditemukan.");

    const existing = await this.groupMemberRepository.findByGroupAndUser(invitation.groupId, userId);
    if (existing) throw GroupError.AlreadyMember();

    // [TAMBAHAN] Double Check Limit saat Accept (Mencegah Race Condition undangan massal)
    const group = await this.groupRepository.findById(invitation.groupId);
    const isOwnerPremium = await this._isPremium(group.adminId);
    if (!isOwnerPremium) {
      const currentCount = await this.groupMemberRepository.countByGroupId(invitation.groupId);
      if (currentCount >= 5) {
        throw CommonError.Forbidden("Grup ini sudah penuh (Maksimal 5 anggota untuk grup Free).");
      }
    }

    if (invitation.status !== "active" || invitation.expiresAt < new Date()) {
      throw GroupError.InvalidInvitation("Undangan tidak valid atau telah kedaluwarsa.");
    }

    try {
      const newMember = await this.groupMemberRepository.createFromInvitation(invitation, userId);

      if (this.io) {
        const roomName = `group_${invitation.groupId}`;
        const fullMemberData = await this.groupMemberRepository.findByGroupAndUser(invitation.groupId, userId);

        this.io.to(roomName).emit("group_member_update", {
          action: "new_member",
          member: fullMemberData || newMember,
          message: `${fullMemberData?.user?.name || "Member baru"} bergabung ke grup!`,
        });
      }

      return newMember;
    } catch (error) {
      throw new Error(`Gagal bergabung dengan grup: ${error.message}`);
    }
  }

  /**
   * Assigns an existing draft document to a group and optionally sets signers.
   * Emits a 'new_document' socket event upon success.
   * @param {string} documentId - The ID of the document.
   * @param {number|string} groupId - The ID of the group.
   * @param {string} userId - The ID of the user performing the action.
   * @param {string[]} [signerUserIds=[]] - List of user IDs required to sign the document.
   * @returns {Promise<Object>} The updated document object.
   * @throws {DocumentError} If the document is not found.
   * @throws {GroupError} If the user is not a group member.
   */
  async assignDocumentToGroup(documentId, groupId, userId, signerUserIds = []) {
    const document = await this.documentRepository.findById(documentId, userId);
    if (!document) {
      throw DocumentError.NotFound(documentId);
    }

    if (document.status === "completed" || document.status === "archived") {
      throw GroupError.BadRequest("Dokumen yang sudah selesai (Completed) atau diarsipkan tidak dapat dipindahkan ke grup.");
    }

    const member = await this.groupMemberRepository.findByGroupAndUser(groupId, userId);
    if (!member) {
      throw GroupError.UnauthorizedAccess("Anda harus menjadi anggota grup untuk melakukan ini.");
    }

    const group = await this.groupRepository.findById(groupId);
    const isAdminPremium = await this._isPremium(group.adminId);
    const maxFiles = isAdminPremium ? 100 : 10;
    const currentDocCount = await this.documentRepository.countByGroupId(groupId);

    if (currentDocCount >= maxFiles) {
      throw CommonError.Forbidden(`Gagal memindahkan dokumen. Penyimpanan grup penuh (${maxFiles} dokumen). ${!isAdminPremium ? "Upgrade Admin Grup ke Premium untuk kapasitas 100 dokumen." : ""}`);
    }

    const dataToUpdate = { groupId };

    if (signerUserIds && signerUserIds.length > 0 && this.groupDocumentSignerRepository) {
      await this.groupDocumentSignerRepository.createSigners(documentId, signerUserIds);

      dataToUpdate.status = "pending";

      const groupName = group ? group.name : "Grup Dokumen";
      this._notifySigners(signerUserIds, document.title, groupName).catch((err) => console.error("[Notification Error] Gagal kirim email assign:", err));
    } else {
      dataToUpdate.status = "draft";
    }

    const updatedDoc = await this.documentRepository.update(documentId, dataToUpdate);
    if (this.io) {
      const roomName = `group_${groupId}`;
      const fullDoc = await this.documentRepository.findById(documentId, userId);

      this.io.to(roomName).emit("group_document_update", {
        action: "new_document",
        document: fullDoc,
        uploaderName: member.user?.name || "Admin",
        message: `Dokumen "${fullDoc.title}" ditambahkan ke grup.`,
      });
    }

    return updatedDoc;
  }

  /**
   * Removes a member from the group.
   * Emits a 'kicked' socket event upon success.
   * @param {number|string} groupId - The ID of the group.
   * @param {string} adminId - The ID of the admin performing the removal.
   * @param {string} userIdToRemove - The ID of the user to be removed.
   * @returns {Promise<void>}
   * @throws {GroupError} If the requester is not admin, target not found, or target is the owner.
   */
  /**
   * [UPDATED] Removes a member from the group.
   * Melakukan validasi, pembersihan draft tanda tangan, pembersihan status signer pending,
   * menghapus member, dan mengirim notifikasi realtime.
   */
  async removeMember(groupId, adminId, userIdToRemove) {
    // 1. Validasi: Pastikan requester adalah Admin Grup
    const admin = await this.groupMemberRepository.findByGroupAndUser(groupId, adminId);
    if (!admin || admin.role !== "admin_group") throw GroupError.UnauthorizedAccess("Hanya admin grup yang dapat mengeluarkan anggota.");

    // 2. Validasi: Pastikan target yang mau di-kick memang ada di grup
    const target = await this.groupMemberRepository.findByGroupAndUser(groupId, userIdToRemove);
    if (!target) throw GroupError.NotFound("Anggota tidak ditemukan di grup ini.");

    // 3. Validasi: Ambil data grup (termasuk dokumen) & Cek Owner
    // findById di PrismaGroupRepository sudah meng-include 'documents', jadi kita manfaatkan itu.
    const group = await this.groupRepository.findById(groupId);
    if (!group) throw GroupError.NotFound("Grup tidak ditemukan.");

    if (group.adminId === userIdToRemove) {
      throw GroupError.BadRequest("Tidak dapat mengeluarkan pemilik utama grup.");
    }

    const memberName = target.user?.name || "Anggota";

    // --- [CLEANUP PROCESS START] ---

    // A. Hapus Draft Tanda Tangan (Cleanup Sampah Data)
    // Kita gunakan 'group.documents' yang didapat dari langkah no. 3
    if (this.groupSignatureRepository && group.documents && group.documents.length > 0) {
      try {
        // Jalankan penghapusan draft secara paralel untuk semua dokumen di grup ini
        const cleanupPromises = group.documents.map((doc) => this.groupSignatureRepository.deleteDrafts(doc.id, userIdToRemove));
        await Promise.all(cleanupPromises);
      } catch (err) {
        console.warn("[Cleanup Warning] Gagal membersihkan draft signature:", err.message);
        // Kita warn saja, jangan throw error agar proses kick tetap jalan
      }
    }

    // B. Hapus PENDING Signers (Cleanup Status Dokumen)
    // Agar jumlah "Total Signers" di dokumen berkurang (misal dari 3 jadi 2)
    if (this.groupDocumentSignerRepository) {
      await this.groupDocumentSignerRepository.deletePendingSignersByGroupAndUser(groupId, userIdToRemove);
    }

    // --- [CLEANUP PROCESS END] ---

    // 4. Action Utama: Hapus Member dari Database
    await this.groupMemberRepository.deleteById(target.id);

    // 5. Realtime Notification (Socket.IO)
    if (this.io) {
      const roomName = `group_${groupId}`;

      // Update Tab Anggota (User hilang dari list)
      this.io.to(roomName).emit("group_member_update", {
        action: "kicked",
        userId: userIdToRemove,
        memberName: memberName,
        message: `${memberName} dikeluarkan dari grup.`,
      });

      // Update Tab Dokumen (Refetch data agar status signer berubah)
      this.io.to(roomName).emit("group_document_update", {
        action: "signer_update",
        message: "Daftar penanda tangan disesuaikan otomatis.",
      });
    }
  }

  /**
   * Updates group information (e.g., name).
   * Emits a 'update_info' socket event upon success.
   * @param {number|string} groupId - The ID of the group.
   * @param {string} userId - The ID of the user requesting the update (must be admin).
   * @param {string} name - The new name for the group.
   * @returns {Promise<Object>} The updated group object.
   * @throws {GroupError} If the user is not an admin.
   */
  async updateGroup(groupId, userId, name) {
    const member = await this.groupMemberRepository.findByGroupAndUser(groupId, userId);
    if (!member || member.role !== "admin_group") throw GroupError.UnauthorizedAccess("Hanya admin yang bisa mengubah nama grup.");

    const updatedGroup = await this.groupRepository.update(groupId, { name });

    if (this.io) {
      const roomName = `group_${groupId}`;
      this.io.to(roomName).emit("group_info_update", {
        action: "update_info",
        group: updatedGroup,
        message: `Nama grup diubah menjadi "${name}".`,
      });
    }

    return updatedGroup;
  }

  /**
   * Deletes a group permanently.
   * @param {number|string} groupId - The ID of the group.
   * @param {string} userId - The ID of the user requesting deletion (must be owner).
   * @returns {Promise<void>}
   * @throws {GroupError} If the group is not found or user is not the owner.
   */
  async deleteGroup(groupId, userId) {
    const group = await this.groupRepository.findById(groupId);
    if (!group) throw GroupError.NotFound();
    if (group.adminId !== userId) throw GroupError.UnauthorizedAccess("Hanya pemilik utama grup yang bisa menghapus grup.");
    await this.groupRepository.deleteById(groupId);
  }

  /**
   * Retrieves all groups where the user is a member.
   * @param {string} userId - The ID of the user.
   * @returns {Promise<Array<Object>>} List of group summaries including counts.
   */
  async getAllUserGroups(userId) {
    const memberships = await this.groupMemberRepository.findAllByUserId(userId, {
      include: { group: { include: { _count: { select: { members: true, documents: true } }, admin: { select: { userStatus: true } } } } },
    });
    return memberships
      .map(
        (m) =>
          m.group && {
            id: m.group.id,
            name: m.group.name,
            docs_count: m.group._count ? m.group._count.documents : 0,
            members_count: m.group._count ? m.group._count.members : 0,
            adminStatus: m.group.admin ? m.group.admin.userStatus : "FREE",
            ownerId: m.group.adminId,
          }
      )
      .filter(Boolean);
  }

  /**
   * Updates the list of signers for a specific group document.
   * Emits a 'signer_update' socket event and returns the updated document object.
   * @param {number|string} groupId - The ID of the group.
   * @param {string} documentId - The ID of the document.
   * @param {string} adminId - The ID of the admin performing the update.
   * @param {string[]} newUserIds - List of user IDs representing the new signers.
   * @returns {Promise<Object>} The updated document object.
   * @throws {GroupError} If access denied or document not found.
   * @throws {CommonError} If attempting to modify a completed document or removing a user who has already signed.
   */
  async updateGroupDocumentSigners(groupId, documentId, requestorId, newUserIds) {
    // 1. Cek Membership
    const member = await this.groupMemberRepository.findByGroupAndUser(groupId, requestorId);
    if (!member) {
      throw GroupError.UnauthorizedAccess("Anda bukan anggota grup ini.");
    }

    // 2. Ambil Dokumen
    const document = await this.documentRepository.findById(documentId, requestorId);
    if (!document || document.groupId !== groupId) {
      throw GroupError.NotFound("Dokumen tidak ditemukan di dalam grup ini.");
    }

    // 3. [LOGIKA BARU] Cek Hak Akses
    const isAdmin = member.role === "admin_group";
    const isOwner = document.userId === requestorId;

    if (!isAdmin && !isOwner) {
      throw GroupError.UnauthorizedAccess("Hanya Admin atau Pemilik Dokumen yang dapat mengubah daftar penanda tangan.");
    }

    if (document.status === "completed" || document.status === "archived") {
      throw CommonError.BadRequest("Tidak dapat mengubah penanda tangan untuk dokumen yang sudah selesai.");
    }

    // --- Proses Diffing (Tambah/Hapus Signer) ---
    const currentSigners = document.signerRequests || [];
    const currentSignerIds = currentSigners.map((s) => s.userId);

    const toAdd = newUserIds.filter((id) => !currentSignerIds.includes(id));
    const toRemove = currentSignerIds.filter((id) => !newUserIds.includes(id));

    // Validasi: Jangan hapus user yang sudah 'SIGNED'
    for (const userId of toRemove) {
      const signerData = currentSigners.find((s) => s.userId === userId);
      if (signerData && signerData.status === "SIGNED") {
        throw CommonError.BadRequest(`User ${signerData.user?.name} sudah tanda tangan, tidak bisa dihapus.`);
      }
    }

    // Eksekusi DB Changes
    const dbPromises = [];
    for (const userId of toRemove) {
      dbPromises.push(this.groupDocumentSignerRepository.deleteSpecificSigner(documentId, userId));
    }
    if (toAdd.length > 0) {
      dbPromises.push(this.groupDocumentSignerRepository.createSigners(documentId, toAdd));
    }
    await Promise.all(dbPromises);

    // Update Status Dokumen (Draft <-> Pending)
    const allSignersCount = newUserIds.length;
    let newStatus = document.status;
    if (allSignersCount > 0 && newStatus === "draft") {
      newStatus = "pending";
    } else if (allSignersCount === 0 && newStatus === "pending") {
      newStatus = "draft";
    }
    if (document.status !== newStatus) {
      await this.documentRepository.update(documentId, { status: newStatus });
    }

    if (this.io) {
      const roomName = `group_${groupId}`;
      this.io.to(roomName).emit("group_document_update", {
        action: "signer_update",
        documentId: documentId,
        message: "Daftar penanda tangan diperbarui.",
      });
    }

    return await this.documentRepository.findById(documentId, requestorId);
  }

  /**
   * Unassigns a document from a group, effectively making it private or removing it from group context.
   * Emits a 'removed_document' socket event upon success.
   * @param {number|string} groupId - The ID of the group.
   * @param {string} documentId - The ID of the document.
   * @param {string} userId - The ID of the admin performing the unassign.
   * @returns {Promise<Object>} The update result.
   * @throws {GroupError} If access denied or document not found.
   */
  async unassignDocumentFromGroup(groupId, documentId, requestorId) {
    // 1. Cek Membership
    const member = await this.groupMemberRepository.findByGroupAndUser(groupId, requestorId);
    if (!member) throw GroupError.UnauthorizedAccess("Anda bukan anggota grup ini.");

    // 2. Ambil Dokumen
    const document = await this.documentRepository.findFirst({
      where: { id: documentId, groupId },
    });

    if (!document) {
      throw GroupError.NotFound("Dokumen tidak ditemukan di dalam grup ini.");
    }

    // 3. [LOGIKA BARU] Cek Hak Akses
    const isAdmin = member.role === "admin_group";
    const isOwner = document.userId === requestorId;

    if (!isAdmin && !isOwner) {
      throw GroupError.UnauthorizedAccess("Hanya Admin atau Pemilik Dokumen yang bisa menghapus dokumen dari grup.");
    }

    const docTitle = document.title;

    // Hapus data signer di dokumen ini sebelum di-unassign
    if (this.groupDocumentSignerRepository) {
      await this.groupDocumentSignerRepository.deleteByDocumentId(documentId);
    }

    // Set groupId jadi NULL (kembali ke privat)
    const result = await this.documentRepository.update(documentId, {
      groupId: null,
      status: "draft", // Reset status ke draft karena signer dihapus
    });

    if (this.io) {
      const roomName = `group_${groupId}`;
      this.io.to(roomName).emit("group_document_update", {
        action: "removed_document",
        documentId: documentId,
        message: `Dokumen "${docTitle}" dihapus dari grup.`,
      });
    }

    return result;
  }

  /**
   * Uploads a new PDF document directly to the group and assigns signers.
   * Emits a 'new_document' socket event and sends WhatsApp notifications.
   * @param {string} userId - The ID of the uploader.
   * @param {number|string} groupId - The ID of the group.
   * @param {Object} file - The file object (from Multer).
   * @param {string} title - The title of the document.
   * @param {string[]} signerUserIds - List of user IDs required to sign.
   * @returns {Promise<Object>} The newly created document object.
   * @throws {GroupError} If user is not a member.
   * @throws {CommonError} If the file is not a PDF.
   */
  async uploadGroupDocument(userId, groupId, file, title, signerUserIds) {
    const member = await this.groupMemberRepository.findByGroupAndUser(groupId, userId);
    if (!member) throw GroupError.UnauthorizedAccess("Anda bukan anggota grup ini.");

    if (file.mimetype !== "application/pdf") throw CommonError.BadRequest("Hanya file PDF yang diizinkan.");

    // 1. [LIMIT] Cek Size File (Berdasarkan User Pengupload)
    const isUploaderPremium = await this._isPremium(userId);
    const maxSize = isUploaderPremium ? 50 * 1024 * 1024 : 10 * 1024 * 1024; // 50MB vs 10MB

    if (file.size > maxSize) {
      throw CommonError.BadRequest(`Ukuran file terlalu besar. Maksimal ${isUploaderPremium ? "50MB" : "10MB"}.`);
    }

    // 2. [LIMIT] Cek Kapasitas Grup (Berdasarkan Admin Grup)
    const group = await this.groupRepository.findById(groupId);
    const isAdminPremium = await this._isPremium(group.adminId);
    const maxFiles = isAdminPremium ? 100 : 10;

    const currentDocCount = await this.documentRepository.countByGroupId(groupId);

    if (currentDocCount >= maxFiles) {
      throw CommonError.Forbidden(`Penyimpanan grup penuh (${maxFiles} dokumen). ${!isAdminPremium ? "Upgrade Admin Grup ke Premium untuk kapasitas 100 dokumen." : ""}`);
    }

    const filePath = await this.fileStorage.uploadDocument(file, userId);
    const hash = crypto.createHash("sha256").update(file.buffer).digest("hex");

    const newDoc = await this.documentRepository.createGroupDocument(userId, groupId, title, filePath, hash, signerUserIds);

    if (signerUserIds && signerUserIds.length > 0) {
      const groupName = member.group ? member.group.name : "Grup Dokumen";
      this._notifySigners(signerUserIds, title, groupName).catch((err) => console.error("Notification Error:", err));
    }

    if (this.io) {
      const roomName = `group_${groupId}`;
      let uploaderName = "Anggota Grup";
      try {
        if (member.user && member.user.name) uploaderName = member.user.name;
      } catch (err) { }

      this.io.to(roomName).emit("group_document_update", {
        action: "new_document",
        actorId: userId,
        document: newDoc,
        uploaderName: uploaderName,
        message: `Dokumen baru "${title}" ditambahkan.`,
      });
    }

    return newDoc;
  }

  /**
   * Finalizes a group document by burning signatures into a PDF and locking the document.
   * Emits 'finalized' and 'document_status_update' socket events.
   * @param {number|string} groupId - The ID of the group.
   * @param {string} documentId - The ID of the document.
   * @param {string} adminId - The ID of the admin finalizing the document.
   * @returns {Promise<Object>} The updated document object.
   * @throws {GroupError} If user is not admin.
   * @throws {CommonError} If document is already completed or still has pending signatures.
   /**
   * Finalizes a group document.
   * [UPDATED] Mengembalikan accessCode agar bisa ditampilkan di Controller.
   */
  async finalizeGroupDocument(groupId, documentId, requestorId) {
    const member = await this.groupMemberRepository.findByGroupAndUser(groupId, requestorId);
    if (!member) throw GroupError.UnauthorizedAccess("Anda bukan anggota grup ini.");

    const document = await this.documentRepository.findFirst({
      where: { id: documentId, groupId: groupId },
      include: { currentVersion: true },
    });

    if (!document || !document.currentVersion) throw CommonError.NotFound("Dokumen tidak valid.");

    const isAdmin = member.role === "admin_group";
    const isOwner = document.userId === requestorId;

    if (!isAdmin && !isOwner) throw GroupError.UnauthorizedAccess("Akses ditolak.");

    const pendingCount = await this.groupDocumentSignerRepository.countPendingSigners(documentId);
    if (pendingCount > 0) throw CommonError.BadRequest(`Masih ada ${pendingCount} orang yang belum tanda tangan.`);

    if (document.status === "completed") throw CommonError.BadRequest("Dokumen sudah difinalisasi.");

    // [LIMIT CHECK] Cek apakah sudah mencapai batas versi
    const group = await this.groupRepository.findById(groupId);
    const isOwnerPremium = await this._isPremium(group.adminId);
    const versionLimit = isOwnerPremium ? 20 : 5;
    const currentVersionCount = await this.versionRepository.countByDocumentId(documentId);

    if (currentVersionCount >= versionLimit) {
      throw CommonError.Forbidden(`Batas revisi dokumen grup tercapai (${versionLimit} versi). ${!isOwnerPremium ? "Upgrade Admin Grup ke Premium untuk batas 20 versi." : ""}`);
    }

    const currentVersion = document.currentVersion;
    // pastikan findAllByVersionId melakukan include: { signer: true }
    const allSignatures = await this.groupSignatureRepository.findAllByVersionId(currentVersion.id);

    if (!allSignatures || allSignatures.length === 0) throw new Error("Tidak ada tanda tangan.");

    // --- GENERATE PDF ---
    const referenceSignatureId = allSignatures[0].id;
    const BASE_VERIFY_URL = process.env.VERIFICATION_URL || "http://localhost:5173";
    const verificationUrl = `${BASE_VERIFY_URL.replace(/\/$/, "")}/verify/${referenceSignatureId}`;

    // [FIX] Map data lengkap (Visual + Audit)
    const signaturesPayload = allSignatures.map((sig) => ({
      // Data Visual
      signatureImageUrl: sig.signatureImageUrl,
      pageNumber: sig.pageNumber,
      positionX: sig.positionX,
      positionY: sig.positionY,
      width: sig.width,
      height: sig.height,

      // Data Audit (Dari relasi signer)
      id: sig.id,
      signerName: sig.signer ? sig.signer.name : "Unknown",
      signerEmail: sig.signer ? sig.signer.email : "-",
      ipAddress: sig.ipAddress || "-",
      signedAt: sig.signedAt || sig.createdAt,
    }));

    const { signedFileBuffer, publicUrl, accessCode } = await this.pdfService.generateSignedPdf(currentVersion.id, signaturesPayload, { displayQrCode: true, verificationUrl });

    // Simpan PIN
    if (accessCode) {
      await this.groupSignatureRepository.update(referenceSignatureId, { accessCode });
    }

    // Update Versi
    const newHash = crypto.createHash("sha256").update(signedFileBuffer).digest("hex");
    const newVersion = await this.versionRepository.create({
      documentId: documentId,
      userId: requestorId,
      url: publicUrl,
      hash: newHash,
      signedFileHash: newHash,
    });

    await this.documentRepository.update(documentId, {
      currentVersionId: newVersion.id,
      status: "completed",
      signedFileUrl: publicUrl,
    });

    if (this.io) {
      const roomName = `group_${groupId}`;
      this.io.to(roomName).emit("group_document_update", {
        action: "finalized",
        documentId,
        status: "completed",
        signedFileUrl: publicUrl,
      });
    }

    const updatedDoc = await this.documentRepository.findById(documentId, requestorId);

    // [FIX] Return paket lengkap agar controller bisa kirim accessCode
    return {
      document: updatedDoc,
      url: publicUrl,
      accessCode: accessCode,
    };
  }

  /**
   * Helper method to send WhatsApp notifications to a list of signers asynchronously.
   * * @private
   * @param {string[]} signerIds - List of User IDs to notify.
   * @param {string} docTitle - The title of the document.
   * @param {string} groupName - The name of the group.
   * @returns {Promise<void>}
   */
  async _notifySigners(signerIds, docTitle, groupName) {
    try {
      const prisma = this.groupRepository.prisma;
      if (!prisma) {
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

      const appUrl = (process.env.SITE_URL || process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");
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

  /**
   * Menghapus dokumen grup secara permanen (Hard Delete).
   * [REALTIME] Mengirim sinyal 'removed_document' ke grup.
   * @param {number|string} groupId - ID Grup.
   * @param {string} documentId - ID Dokumen.
   * @param {string} userId - ID User yang menghapus (Harus Admin).
   * @returns {Promise<void>}
   * @throws {GroupError} Jika user bukan admin atau dokumen tidak ditemukan.
   */
  async deleteGroupDocument(groupId, documentId, requestorId) {
    // 1. Cek Membership
    const member = await this.groupMemberRepository.findByGroupAndUser(groupId, requestorId);
    if (!member) throw GroupError.UnauthorizedAccess("Anda bukan anggota grup ini.");

    // 2. Ambil Dokumen
    const document = await this.documentRepository.findFirst({
      where: { id: documentId, groupId: groupId },
    });

    if (!document) {
      throw GroupError.NotFound("Dokumen tidak ditemukan di dalam grup ini.");
    }

    // 3. [LOGIKA BARU] Cek Hak Akses (Admin ATAU Owner)
    const isAdmin = member.role === "admin_group";
    const isOwner = document.userId === requestorId;

    if (!isAdmin && !isOwner) {
      throw GroupError.UnauthorizedAccess("Hanya Admin atau Pemilik Dokumen yang dapat menghapusnya.");
    }

    const docTitle = document.title;

    // ... Lanjutkan proses delete ...
    if (typeof this.documentRepository.deleteById === "function") {
      await this.documentRepository.deleteById(documentId);
    } else {
      // Fallback jika method deleteById belum ada/berbeda nama
      if (this.documentRepository.prisma) {
        await this.documentRepository.prisma.document.delete({ where: { id: documentId } });
      } else {
        await this.documentRepository.delete(documentId);
      }
    }

    if (this.io) {
      const roomName = `group_${groupId}`;
      const actorName = member.user?.name || "User";

      this.io.to(roomName).emit("group_document_update", {
        action: "removed_document",
        actorId: requestorId,
        uploaderName: actorName,
        document: { id: documentId, title: docTitle },
        message: `Dokumen "${docTitle}" telah dihapus.`,
      });
    }
  }
}
