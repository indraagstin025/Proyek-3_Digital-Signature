import asyncHandler from "../utils/asyncHandler.js";
import GroupError from "../errors/GroupError.js";

/**
 * @description Helper internal untuk memvalidasi dan mengonversi ID Grup dari string (params) ke integer.
 * @param {string} idParam - ID yang didapat dari URL parameter.
 * @returns {number} ID Grup dalam bentuk Integer.
 * @throws {GroupError.BadRequest} Jika ID bukan angka valid.
 */
const validateAndParseGroupId = (idParam) => {
  const groupId = parseInt(idParam, 10);
  if (isNaN(groupId)) {
    throw GroupError.BadRequest("Format ID Grup tidak valid. Harap gunakan Angka.");
  }
  return groupId;
};

/**
 * Membuat instance GroupController dengan dependency injection.
 * @param {import('../services/groupService.js').GroupService} groupService - Instance logika bisnis grup.
 * @returns {object} Kumpulan method controller untuk manajemen grup.
 */
export const createGroupController = (groupService) => {
  return {
    /**
     * @description Membuat grup baru (User pembuat otomatis menjadi Admin).
     * * **Proses Kode:**
     * 1. Mengambil `name` grup dari body request.
     * 2. Mengambil `adminId` dari user yang sedang login.
     * 3. Memanggil `groupService.createGroup` untuk menyimpan grup ke DB dan menambahkan relasi member admin.
     * 4. Mengembalikan data grup yang baru dibuat.
     * * @route   POST /groups
     * @param {import("express").Request} req - Body: name.
     * @param {import("express").Response} res - Response object.
     */
    createGroup: asyncHandler(async (req, res, next) => {
      const { name } = req.body;
      const adminId = req.user?.id;

      const newGroup = await groupService.createGroup(adminId, name);

      return res.status(201).json({
        status: "success",
        message: "Grup berhasil dibuat.",
        data: newGroup,
      });
    }),

    /**
     * @description Mengambil daftar semua grup di mana user terdaftar sebagai anggota.
     * * **Proses Kode:**
     * 1. Mengambil `userId` dari token sesi.
     * 2. Memanggil `groupService.getAllUserGroups` untuk query daftar grup terkait.
     * 3. Mengembalikan array data grup.
     * * @route   GET /groups
     * @param {import("express").Request} req - User ID dari token.
     * @param {import("express").Response} res - Response object.
     */
    getAllUserGroups: asyncHandler(async (req, res, next) => {
      const userId = req.user?.id;
      const groups = await groupService.getAllUserGroups(userId);

      return res.status(200).json({
        status: "success",
        data: groups,
      });
    }),

    /**
     * @description Mengambil detail spesifik sebuah grup (termasuk daftar anggota dan dokumen).
     * * **Proses Kode:**
     * 1. Mengonversi `groupId` dari parameter URL menjadi integer.
     * 2. Memanggil `groupService.getGroupById`. Service akan memvalidasi apakah user adalah anggota grup tersebut.
     * 3. Mengembalikan detail grup jika validasi lolos.
     * * @route   GET /groups/:groupId
     * @param {import("express").Request} req - Params: groupId.
     * @param {import("express").Response} res - Response object.
     */
    getGroupById: asyncHandler(async (req, res, next) => {
      const groupId = validateAndParseGroupId(req.params.groupId);
      const userId = req.user?.id;

      const group = await groupService.getGroupById(groupId, userId);

      return res.status(200).json({
        status: "success",
        data: group,
      });
    }),

    /**
     * @description Mengubah nama grup yang sudah ada.
     * * **Proses Kode:**
     * 1. Validasi `groupId` dan memastikan `name` tidak kosong.
     * 2. Memanggil `groupService.updateGroup`. Service akan mengecek apakah user memiliki izin (Admin/Owner) untuk mengedit.
     * 3. Menyimpan perubahan dan mengembalikan data terbaru.
     * * @route   PUT /groups/:groupId
     * @param {import("express").Request} req - Params: groupId, Body: name.
     * @param {import("express").Response} res - Response object.
     */
    updateGroup: asyncHandler(async (req, res, next) => {
      const groupId = validateAndParseGroupId(req.params.groupId);
      const userId = req.user?.id;
      const { name } = req.body;

      if (!name) {
        throw GroupError.BadRequest("Properti 'name' wajib diisi.");
      }

      const updatedGroup = await groupService.updateGroup(groupId, userId, name);

      return res.status(200).json({
        status: "success",
        message: "Nama grup berhasil diperbarui.",
        data: updatedGroup,
      });
    }),

    /**
     * @description Menghapus grup secara permanen.
     * * **Proses Kode:**
     * 1. Validasi `groupId`.
     * 2. Memanggil `groupService.deleteGroup`. Service memverifikasi hak akses user (biasanya hanya Owner/Admin).
     * 3. Menghapus grup dan relasi anggotanya dari database.
     * * @route   DELETE /groups/:groupId
     * @param {import("express").Request} req - Params: groupId.
     * @param {import("express").Response} res - Response object.
     */
    deleteGroup: asyncHandler(async (req, res, next) => {
      const groupId = validateAndParseGroupId(req.params.groupId);
      const userId = req.user?.id;

      await groupService.deleteGroup(groupId, userId);

      return res.status(200).json({
        status: "success",
        message: "Grup berhasil dihapus.",
      });
    }),

    /**
     * @description Membuat tautan undangan (invitation link) untuk bergabung ke grup.
     * * **Proses Kode:**
     * 1. Validasi `groupId` dan memastikan `role` (peran anggota baru) disertakan.
     * 2. Memanggil service untuk membuat token undangan unik di database.
     * 3. Menyusun URL lengkap menggunakan `SITE_URL` (dari env) dan token.
     * 4. Mengembalikan objek undangan beserta link yang bisa dibagikan.
     * * @route   POST /groups/:groupId/invitations
     * @param {import("express").Request} req - Params: groupId, Body: role.
     * @param {import("express").Response} res - Response object.
     */
    createInvitation: asyncHandler(async (req, res, next) => {
      const groupId = validateAndParseGroupId(req.params.groupId);
      const inviterId = req.user?.id;
      const { role } = req.body;

      if (!role) {
        throw GroupError.BadRequest("Properti 'role' wajib diisi (cth: 'viewer' atau 'editor').");
      }

      const invitation = await groupService.createInvitation(groupId, inviterId, role);

      // KODE LAMA (Nonaktif): Langsung menggabungkan URL sehingga berisiko double slash jika .env diakhiri "/"
      // const frontendUrl = process.env.SITE_URL || "http://localhost:5173";
      // const invitationLink = `${frontendUrl}/join?token=${invitation.token}`;

      // KODE BARU: Normalisasi URL dengan menghapus trailing slash (/) agar tidak terjadi error 404 (Double Slash)
      const frontendUrl = (process.env.SITE_URL || "http://localhost:5173").replace(/\/$/, "");
      const invitationLink = `${frontendUrl}/join?token=${invitation.token}`;

      return res.status(201).json({
        status: "success",
        message: "Link undangan berhasil dibuat.",
        data: {
          ...invitation,
          invitationLink: invitationLink,
        },
      });
    }),

    /**
     * @description Menerima undangan dan menambahkan user ke dalam grup.
     * * **Proses Kode:**
     * 1. Menerima `token` dari body request.
     * 2. Memanggil `groupService.acceptInvitation` untuk memvalidasi token (apakah expired atau tidak valid).
     * 3. Jika valid, user ditambahkan ke tabel anggota grup dengan role yang sudah ditentukan di undangan.
     * 4. Token undangan ditandai sebagai terpakai (jika one-time use) atau dibiarkan (tergantung logika bisnis).
     * * @route   POST /groups/invitations/accept
     * @param {import("express").Request} req - Body: token.
     * @param {import("express").Response} res - Response object.
     */
    acceptInvitation: asyncHandler(async (req, res, next) => {
      const { token } = req.body;
      const userId = req.user?.id;

      if (!token) {
        throw GroupError.BadRequest("Token undangan wajib diisi.");
      }

      const newMember = await groupService.acceptInvitation(token, userId);

      return res.status(201).json({
        status: "success",
        message: "Berhasil bergabung dengan grup.",
        data: newMember,
      });
    }),

    /**
     * @description Mengeluarkan anggota dari grup (Kick Member).
     * * **Proses Kode:**
     * 1. Mengambil `groupId` dan `userIdToRemove` (ID member yg akan dikeluarkan).
     * 2. Memanggil service untuk menghapus relasi user dari grup.
     * 3. Service akan memastikan yang melakukan request adalah Admin/Owner.
     * * @route   DELETE /groups/:groupId/members/:userIdToRemove
     * @param {import("express").Request} req - Params: groupId, userIdToRemove.
     * @param {import("express").Response} res - Response object.
     */
    removeMember: asyncHandler(async (req, res, next) => {
      const groupId = validateAndParseGroupId(req.params.groupId);
      const adminId = req.user?.id;
      const { userIdToRemove } = req.params;

      await groupService.removeMember(groupId, adminId, userIdToRemove);

      return res.status(200).json({
        status: "success",
        message: "Anggota berhasil dikeluarkan dari grup.",
      });
    }),

    /**
     * @description Menambahkan/Membagikan dokumen pribadi ke dalam grup.
     * * **Proses Kode:**
     * 1. Validasi `groupId` dan `documentId`.
     * 2. Memanggil service untuk memperbarui metadata dokumen agar terkait dengan grup.
     * 3. Dokumen kini dapat diakses oleh anggota grup sesuai policy.
     * * @route   PUT /groups/:groupId/documents
     * @param {import("express").Request} req - Params: groupId, Body: documentId.
     * @param {import("express").Response} res - Response object.
     */
      assignDocumentToGroup: asyncHandler(async (req, res, next) => {

          const groupId = validateAndParseGroupId(req.params.groupId);
          const userId = req.user?.id;
          const { documentId, signerUserIds } = req.body;

          if (!documentId) {
              throw GroupError.BadRequest("Properti 'documentId' wajib diisi.");
          }

          const updatedDocument = await groupService.assignDocumentToGroup(
              documentId,
              groupId,
              userId,
              signerUserIds
          );

          return res.status(200).json({
              status: "success",
              message: "Dokumen berhasil dimasukkan ke grup.",
              data: updatedDocument,
          });
      }),

    /**
     * @description Melepaskan dokumen dari grup (Mengembalikan menjadi privat).
     * * **Proses Kode:**
     * 1. Mengambil `groupId` dan `documentId` dari parameter URL.
     * 2. Memanggil service untuk menghapus relasi dokumen dengan grup (set groupId = null).
     * 3. Dokumen tidak lagi terlihat di list grup.
     * * @route   DELETE /groups/:groupId/documents/:documentId
     * @param {import("express").Request} req - Params: groupId, documentId.
     * @param {import("express").Response} res - Response object.
     */
    unassignDocumentFromGroup: asyncHandler(async (req, res, next) => {
      const groupId = validateAndParseGroupId(req.params.groupId);
      const { documentId } = req.params;
      const userId = req.user?.id;

      await groupService.unassignDocumentFromGroup(groupId, documentId, userId);

      return res.status(200).json({
        status: "success",
        message: "Dokumen berhasil dilepaskan dari grup.",
      });
    }),

      /**
       * @description Upload dokumen baru ke grup dan menentukan siapa yang harus tanda tangan.
       * * **Proses Kode:**
       * 1. Menerima file PDF dan list `signerUserIds` dari form-data.
       * 2. Memanggil service `uploadGroupDocument`.
       * * @route   POST /groups/:groupId/documents/upload
       */
      uploadGroupDocument: asyncHandler(async (req, res, next) => {
          const groupId = validateAndParseGroupId(req.params.groupId);
          const userId = req.user?.id;
          const file = req.file; // Dari Middleware Multer
          const { title, signerUserIds } = req.body;

          if (!file) throw GroupError.BadRequest("File dokumen wajib diunggah.");

          // Handling parsing jika dikirim sebagai JSON string via Form-Data
          let parsedSigners = [];
          if (signerUserIds) {
              if (typeof signerUserIds === 'string') {
                  try {
                      parsedSigners = JSON.parse(signerUserIds);
                  } catch (e) {
                      throw GroupError.BadRequest("Format signerUserIds tidak valid (harus JSON Array).");
                  }
              } else if (Array.isArray(signerUserIds)) {
                  parsedSigners = signerUserIds;
              }
          }

          if (parsedSigners.length === 0) {
              throw GroupError.BadRequest("Minimal harus ada 1 anggota yang dipilih untuk tanda tangan.");
          }

          const newDoc = await groupService.uploadGroupDocument(userId, groupId, file, title, parsedSigners);

          return res.status(201).json({
              status: "success",
              message: "Dokumen grup berhasil dibuat dan permintaan tanda tangan telah dikirim.",
              data: newDoc,
          });
      }),

      /**
       * @description Mengupdate list penanda tangan (tambah/hapus) di tengah jalan.
       * [FIX] Bungkus dengan asyncHandler agar error handling berjalan.
       */
      updateDocumentSigners: asyncHandler(async (req, res, next) => {
          const { groupId, documentId } = req.params;
          const { signerUserIds } = req.body;
          const requestorId = req.user.id;
          const groupIdInt = parseInt(groupId); // Pastikan parse int

          const updatedDocument = await groupService.updateGroupDocumentSigners(
              groupIdInt,
              documentId,
              requestorId,
              signerUserIds
          );

          return res.status(200).json({
              status: "success",
              message: "Daftar penanda tangan diperbarui.",
              data: updatedDocument,
          });
      }),

      /**
       * @description Menghapus dokumen grup secara permanen.
       * @route DELETE /groups/:groupId/documents/:documentId/delete
       */
      deleteGroupDocument: asyncHandler(async (req, res, next) => {
          const groupId = validateAndParseGroupId(req.params.groupId);
          const { documentId } = req.params;
          const userId = req.user?.id;

          await groupService.deleteGroupDocument(groupId, documentId, userId);

          return res.status(200).json({
              status: "success",
              message: "Dokumen berhasil dihapus permanen.",
          });
      }),

      finalizeDocument: asyncHandler(async (req, res) => {
          const {groupId, documentId} = req.params;
          const requestorId = req.user.id;

          // Panggil Service
          const result = await groupService.finalizeGroupDocument(
              parseInt(groupId),
              documentId,
              requestorId
          );

          return res.status(200).json({
              status: "success",
              message: "Dokumen berhasil difinalisasi.",
              data: {
                  url: result.url,
                  accessCode: result.accessCode, // [PENTING] Kirim PIN ke frontend
                  document: result.document
              }
          });
      }),
  };
};
