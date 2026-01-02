import { jest } from "@jest/globals";
import { DocumentService } from "../../src/services/documentService.js";
import DocumentError from "../../src/errors/DocumentError.js";
import CommonError from "../../src/errors/CommonError.js";

describe("DocumentService", () => {
  let documentService;
  let mockDocumentRepository;
  let mockVersionRepository;
  let mockSignatureRepository;
  let mockFileStorage;
  let mockPdfService;
  let mockGroupMemberRepository;
  let mockGroupDocumentSignerRepository;
  let mockAiService;
  let mockGroupSignatureRepository;
  let mockUserService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDocumentRepository = {
      createWithFirstVersion: jest.fn(),
      findAllByUserId: jest.fn(),
      findById: jest.fn(),
      findByIdSimple: jest.fn(),
      update: jest.fn(),
      deleteById: jest.fn(),
    };

    mockVersionRepository = {
      findByUserAndHash: jest.fn(),
      findById: jest.fn(),
      findAllByDocumentId: jest.fn(),
      countByDocumentId: jest.fn(),
      deleteById: jest.fn(),
    };

    mockSignatureRepository = {
      deleteBySignerAndVersion: jest.fn(),
    };

    mockFileStorage = {
      uploadDocument: jest.fn(),
      getSignedUrl: jest.fn(),
      deleteFile: jest.fn(),
    };

    mockPdfService = {};

    mockGroupMemberRepository = {
      findByGroupAndUser: jest.fn(),
    };

    mockGroupDocumentSignerRepository = {
      resetSigners: jest.fn(),
    };

    mockAiService = {};

    mockGroupSignatureRepository = {
      deleteBySignerAndVersion: jest.fn(),
    };

    mockUserService = {
      isUserPremium: jest.fn(),
    };

    documentService = new DocumentService(
      mockDocumentRepository,
      mockVersionRepository,
      mockSignatureRepository,
      mockFileStorage,
      mockPdfService,
      mockGroupMemberRepository,
      mockGroupDocumentSignerRepository,
      mockAiService,
      mockGroupSignatureRepository,
      mockUserService
    );
  });

  describe("constructor", () => {
    it("Harus throw error jika ada dependency yang tidak disediakan", () => {
      expect(() => new DocumentService()).toThrow("Semua repository dan service harus disediakan.");
      expect(() => new DocumentService(mockDocumentRepository)).toThrow();
      expect(
        () =>
          new DocumentService(
            mockDocumentRepository,
            mockVersionRepository,
            mockSignatureRepository,
            mockFileStorage,
            mockPdfService,
            mockGroupMemberRepository,
            mockGroupDocumentSignerRepository,
            mockAiService,
            null // missing groupSignatureRepository
          )
      ).toThrow();
    });

    it("Harus berhasil membuat instance jika semua dependency tersedia", () => {
      expect(documentService).toBeInstanceOf(DocumentService);
    });
  });

  describe("_validateFile", () => {
    // Note: Test untuk _validateFile memerlukan mocking module isPdfEncrypted
    // yang sulit dilakukan dengan Jest + ES Modules tanpa top-level await
    // Test ini hanya memverifikasi bahwa non-PDF file di-skip
    it("Harus skip validasi jika bukan PDF", async () => {
      const file = { mimetype: "image/png", buffer: Buffer.from("test") };
      // Untuk non-PDF, fungsi seharusnya langsung return tanpa error
      await expect(documentService._validateFile(file)).resolves.toBeUndefined();
    });

    // TODO: Full test untuk PDF encryption memerlukan mocking isPdfEncrypted
    // Alternatif: gunakan integration test atau refactor agar isPdfEncrypted di-inject
  });

  describe("createDocument", () => {
    const mockFile = {
      mimetype: "application/pdf",
      buffer: Buffer.from("pdf-content"),
      size: 1024 * 1024, // 1MB
      originalname: "test.pdf",
    };

    beforeEach(() => {
      // Spy pada _validateFile untuk bypass PDF encryption check
      jest.spyOn(documentService, "_validateFile").mockResolvedValue(undefined);
    });

    it("Harus throw error jika file tidak ada", async () => {
      await expect(documentService.createDocument("user-123", null, "Test")).rejects.toThrow("File dokumen wajib diunggah.");
    });

    it("Harus throw error jika ukuran file melebihi batas FREE (10MB)", async () => {
      const largeFile = { ...mockFile, size: 15 * 1024 * 1024 }; // 15MB
      mockUserService.isUserPremium.mockResolvedValue(false);

      await expect(documentService.createDocument("user-123", largeFile, "Test")).rejects.toThrow(CommonError.BadRequest("Ukuran file melebihi batas paket Anda (10MB). Upgrade ke Premium untuk upload hingga 50MB."));
    });

    it("Harus throw error jika ukuran file melebihi batas PREMIUM (50MB)", async () => {
      const hugeFile = { ...mockFile, size: 60 * 1024 * 1024 }; // 60MB
      mockUserService.isUserPremium.mockResolvedValue(true);

      await expect(documentService.createDocument("user-123", hugeFile, "Test")).rejects.toThrow(CommonError.BadRequest("Ukuran file melebihi batas paket Anda (50MB). "));
    });

    it("Harus throw error jika file sudah pernah diupload (duplikat)", async () => {
      mockUserService.isUserPremium.mockResolvedValue(false);
      mockVersionRepository.findByUserAndHash.mockResolvedValue({
        document: { title: "Dokumen Lama" },
      });

      await expect(documentService.createDocument("user-123", mockFile, "Test")).rejects.toThrow(CommonError.BadRequest('File ini sudah pernah diunggah pada dokumen: "Dokumen Lama". Tidak diizinkan mengupload file duplikat.'));
    });

    it("Harus berhasil membuat dokumen baru", async () => {
      mockUserService.isUserPremium.mockResolvedValue(false);
      mockVersionRepository.findByUserAndHash.mockResolvedValue(null);
      mockFileStorage.uploadDocument.mockResolvedValue("documents/user-123/test.pdf");
      mockDocumentRepository.createWithFirstVersion.mockResolvedValue({
        id: "doc-123",
        title: "Test Document",
        type: "General",
      });

      const result = await documentService.createDocument("user-123", mockFile, "Test Document");

      expect(mockFileStorage.uploadDocument).toHaveBeenCalledWith(mockFile, "user-123");
      expect(mockDocumentRepository.createWithFirstVersion).toHaveBeenCalledWith(
        "user-123",
        "Test Document",
        "documents/user-123/test.pdf",
        expect.any(String), // hash
        "General"
      );
      expect(result.id).toBe("doc-123");
    });

    it("Harus menggunakan tipe dokumen manual jika disediakan", async () => {
      mockUserService.isUserPremium.mockResolvedValue(true);
      mockVersionRepository.findByUserAndHash.mockResolvedValue(null);
      mockFileStorage.uploadDocument.mockResolvedValue("path/to/file.pdf");
      mockDocumentRepository.createWithFirstVersion.mockResolvedValue({ id: "doc-123" });

      await documentService.createDocument("user-123", mockFile, "Kontrak", "kontrak");

      expect(mockDocumentRepository.createWithFirstVersion).toHaveBeenCalledWith("user-123", "Kontrak", "path/to/file.pdf", expect.any(String), "kontrak");
    });
  });

  describe("checkVersionLimitOrLock", () => {
    it("Harus throw Forbidden dan lock dokumen jika limit FREE tercapai (5 versi)", async () => {
      mockUserService.isUserPremium.mockResolvedValue(false);
      mockVersionRepository.countByDocumentId.mockResolvedValue(5);

      await expect(documentService.checkVersionLimitOrLock("doc-123", "user-123")).rejects.toThrow(
        CommonError.Forbidden("Batas revisi dokumen tercapai (5 versi). Dokumen otomatis dikunci menjadi 'Completed'. Upgrade ke Premium untuk batas 20 versi.")
      );
      expect(mockDocumentRepository.update).toHaveBeenCalledWith("doc-123", { status: "completed" });
    });

    it("Harus throw Forbidden dan lock dokumen jika limit PREMIUM tercapai (20 versi)", async () => {
      mockUserService.isUserPremium.mockResolvedValue(true);
      mockVersionRepository.countByDocumentId.mockResolvedValue(20);

      await expect(documentService.checkVersionLimitOrLock("doc-123", "user-123")).rejects.toThrow(CommonError.Forbidden("Batas revisi dokumen tercapai (20 versi). Dokumen otomatis dikunci menjadi 'Completed'. "));
    });

    it("Harus tidak throw jika masih di bawah limit", async () => {
      mockUserService.isUserPremium.mockResolvedValue(false);
      mockVersionRepository.countByDocumentId.mockResolvedValue(3);

      await expect(documentService.checkVersionLimitOrLock("doc-123", "user-123")).resolves.toBeUndefined();
    });
  });

  describe("getAllDocuments", () => {
    it("Harus throw error jika userId tidak ada", async () => {
      await expect(documentService.getAllDocuments(null)).rejects.toThrow("ID user tidak ditemukan.");
    });

    it("Harus mengembalikan dokumen milik user", async () => {
      const mockDocs = [{ id: "doc-1" }, { id: "doc-2" }];
      mockDocumentRepository.findAllByUserId.mockResolvedValue(mockDocs);

      const result = await documentService.getAllDocuments("user-123", "kontrak");

      expect(mockDocumentRepository.findAllByUserId).toHaveBeenCalledWith("user-123", "kontrak");
      expect(result).toEqual(mockDocs);
    });

    it("Harus mengembalikan array kosong jika tidak ada dokumen", async () => {
      mockDocumentRepository.findAllByUserId.mockResolvedValue([]);

      const result = await documentService.getAllDocuments("user-123");
      expect(result).toEqual([]);
    });
  });

  describe("getDocumentById", () => {
    it("Harus throw NotFound jika dokumen tidak ada", async () => {
      mockDocumentRepository.findById.mockResolvedValue(null);

      await expect(documentService.getDocumentById("doc-not-exist", "user-123")).rejects.toThrow(DocumentError);
    });

    it("Harus mengembalikan dokumen jika ditemukan", async () => {
      const mockDoc = { id: "doc-123", title: "Test" };
      mockDocumentRepository.findById.mockResolvedValue(mockDoc);

      const result = await documentService.getDocumentById("doc-123", "user-123");
      expect(result).toEqual(mockDoc);
    });
  });

  describe("updateDocument", () => {
    it("Harus mengembalikan dokumen tanpa update jika tidak ada perubahan", async () => {
      const mockDoc = { id: "doc-123", title: "Test" };
      mockDocumentRepository.findById.mockResolvedValue(mockDoc);

      const result = await documentService.updateDocument("doc-123", "user-123", {});
      expect(result).toEqual(mockDoc);
      expect(mockDocumentRepository.update).not.toHaveBeenCalled();
    });

    it("Harus berhasil update title dokumen", async () => {
      const mockDoc = { id: "doc-123", title: "Old Title" };
      const updatedDoc = { id: "doc-123", title: "New Title" };
      mockDocumentRepository.findById.mockResolvedValue(mockDoc);
      mockDocumentRepository.update.mockResolvedValue(updatedDoc);

      const result = await documentService.updateDocument("doc-123", "user-123", { title: "New Title" });

      expect(mockDocumentRepository.update).toHaveBeenCalledWith("doc-123", { title: "New Title" });
      expect(result.title).toBe("New Title");
    });
  });

  describe("deleteDocument", () => {
    it("Harus throw NotFound jika dokumen tidak ditemukan", async () => {
      mockDocumentRepository.findByIdSimple.mockResolvedValue(null);

      await expect(documentService.deleteDocument("doc-not-exist", "user-123")).rejects.toThrow(DocumentError);
    });

    it("Harus throw NotFound jika repository throw error", async () => {
      mockDocumentRepository.findByIdSimple.mockRejectedValue(new Error("DB Error"));

      await expect(documentService.deleteDocument("doc-123", "user-123")).rejects.toThrow(DocumentError);
    });

    // Note: DocumentError.Forbidden tidak ada di class - ini bug di source code
    // Test akan throw TypeError karena method tidak ada
    it("Harus throw Forbidden jika user bukan pemilik dan bukan admin grup", async () => {
      mockDocumentRepository.findByIdSimple.mockResolvedValue({
        id: "doc-123",
        userId: "other-user",
        groupId: "group-123",
      });
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "member" });

      await expect(documentService.deleteDocument("doc-123", "user-123")).rejects.toThrow(
        DocumentError.Forbidden("Anda tidak memiliki izin untuk menghapus dokumen ini. Hanya pemilik dokumen atau admin grup aktif yang dapat menghapusnya.")
      );
    });

    it("Harus throw Forbidden jika user bukan pemilik dan dokumen bukan milik grup", async () => {
      mockDocumentRepository.findByIdSimple.mockResolvedValue({
        id: "doc-123",
        userId: "other-user",
        groupId: null,
      });

      await expect(documentService.deleteDocument("doc-123", "user-123")).rejects.toThrow(
        DocumentError.Forbidden("Anda tidak memiliki izin untuk menghapus dokumen ini. Hanya pemilik dokumen atau admin grup aktif yang dapat menghapusnya.")
      );
    });

    it("Harus berhasil menghapus dokumen sebagai pemilik", async () => {
      mockDocumentRepository.findByIdSimple.mockResolvedValue({
        id: "doc-123",
        userId: "user-123",
      });
      mockVersionRepository.findAllByDocumentId.mockResolvedValue([
        { id: "ver-1", url: "path/to/v1.pdf" },
        { id: "ver-2", url: "path/to/v2.pdf" },
      ]);
      mockFileStorage.deleteFile.mockResolvedValue(true);
      mockDocumentRepository.deleteById.mockResolvedValue(true);

      const result = await documentService.deleteDocument("doc-123", "user-123");

      expect(mockFileStorage.deleteFile).toHaveBeenCalledTimes(2);
      expect(mockDocumentRepository.deleteById).toHaveBeenCalledWith("doc-123");
      expect(result.message).toBe("Dokumen dan semua riwayatnya berhasil dihapus.");
    });

    it("Harus berhasil menghapus dokumen sebagai admin grup", async () => {
      mockDocumentRepository.findByIdSimple.mockResolvedValue({
        id: "doc-123",
        userId: "other-user",
        groupId: "group-123",
      });
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockVersionRepository.findAllByDocumentId.mockResolvedValue([]);
      mockDocumentRepository.deleteById.mockResolvedValue(true);

      const result = await documentService.deleteDocument("doc-123", "user-123");
      expect(result.message).toBe("Dokumen dan semua riwayatnya berhasil dihapus.");
    });

    it("Harus tetap berhasil meskipun penghapusan file fisik gagal", async () => {
      mockDocumentRepository.findByIdSimple.mockResolvedValue({
        id: "doc-123",
        userId: "user-123",
      });
      mockVersionRepository.findAllByDocumentId.mockResolvedValue([{ id: "ver-1", url: "path/to/file.pdf" }]);
      mockFileStorage.deleteFile.mockRejectedValue(new Error("Storage error"));
      mockDocumentRepository.deleteById.mockResolvedValue(true);

      const result = await documentService.deleteDocument("doc-123", "user-123");
      expect(result.message).toBe("Dokumen dan semua riwayatnya berhasil dihapus.");
    });
  });

  describe("getDocumentHistory", () => {
    it("Harus mengembalikan riwayat versi dokumen", async () => {
      const mockDoc = { id: "doc-123" };
      const mockVersions = [
        { id: "ver-1", versionNumber: 1 },
        { id: "ver-2", versionNumber: 2 },
      ];
      mockDocumentRepository.findById.mockResolvedValue(mockDoc);
      mockVersionRepository.findAllByDocumentId.mockResolvedValue(mockVersions);

      const result = await documentService.getDocumentHistory("doc-123", "user-123");

      expect(mockVersionRepository.findAllByDocumentId).toHaveBeenCalledWith("doc-123");
      expect(result).toEqual(mockVersions);
    });
  });

  describe("useOldVersion", () => {
    it("Harus throw NotFound jika dokumen tidak ada", async () => {
      mockDocumentRepository.findById.mockResolvedValue(null);

      await expect(documentService.useOldVersion("doc-not-exist", "ver-1", "user-123")).rejects.toThrow(DocumentError.NotFound("Dokumen tidak ditemukan."));
    });

    it("Harus throw InvalidVersion jika versi tidak valid", async () => {
      mockDocumentRepository.findById.mockResolvedValue({ id: "doc-123", userId: "user-123" });
      mockVersionRepository.findById.mockResolvedValue(null);

      await expect(documentService.useOldVersion("doc-123", "ver-not-exist", "user-123")).rejects.toThrow(DocumentError);
    });

    it("Harus throw InvalidVersion jika versi bukan milik dokumen tersebut", async () => {
      mockDocumentRepository.findById.mockResolvedValue({ id: "doc-123", userId: "user-123" });
      mockVersionRepository.findById.mockResolvedValue({ id: "ver-1", documentId: "other-doc" });

      await expect(documentService.useOldVersion("doc-123", "ver-1", "user-123")).rejects.toThrow(DocumentError);
    });

    it("Harus throw Forbidden jika user bukan admin grup pada dokumen grup", async () => {
      mockDocumentRepository.findById.mockResolvedValue({
        id: "doc-123",
        userId: "other-user",
        groupId: "group-123",
      });
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "member" });

      await expect(documentService.useOldVersion("doc-123", "ver-1", "user-123")).rejects.toThrow(DocumentError.Forbidden("Akses Ditolak: Hanya Admin Grup yang dapat mengembalikan versi dokumen. Signer hanya diizinkan menandatangani."));
    });

    it("Harus throw Forbidden jika user bukan pemilik pada dokumen personal", async () => {
      mockDocumentRepository.findById.mockResolvedValue({
        id: "doc-123",
        userId: "other-user",
        groupId: null,
      });

      await expect(documentService.useOldVersion("doc-123", "ver-1", "user-123")).rejects.toThrow(DocumentError.Forbidden("Anda tidak memiliki akses untuk mengubah dokumen ini."));
    });

    it("Harus berhasil rollback ke versi awal (V1) - clean signatures", async () => {
      mockDocumentRepository.findById.mockResolvedValue({ id: "doc-123", userId: "user-123" });
      mockVersionRepository.findById.mockResolvedValue({ id: "ver-1", documentId: "doc-123" });
      mockVersionRepository.findAllByDocumentId.mockResolvedValue([
        { id: "ver-1", createdAt: new Date("2024-01-01") },
        { id: "ver-2", createdAt: new Date("2024-01-02") },
      ]);
      mockDocumentRepository.update.mockResolvedValue({ id: "doc-123", currentVersionId: "ver-1", status: "pending" });

      const result = await documentService.useOldVersion("doc-123", "ver-1", "user-123");

      expect(mockSignatureRepository.deleteBySignerAndVersion).toHaveBeenCalledWith(null, "ver-1");
      expect(mockGroupSignatureRepository.deleteBySignerAndVersion).toHaveBeenCalledWith(null, "ver-1");
      expect(mockDocumentRepository.update).toHaveBeenCalledWith("doc-123", {
        currentVersionId: "ver-1",
        status: "pending",
        signedFileUrl: null,
      });
    });

    it("Harus rollback ke versi yang sudah ditandatangani - set completed", async () => {
      mockDocumentRepository.findById.mockResolvedValue({ id: "doc-123", userId: "user-123" });
      mockVersionRepository.findById.mockResolvedValue({
        id: "ver-2",
        documentId: "doc-123",
        signedFileHash: "abc123",
        url: "path/to/signed.pdf",
      });
      mockVersionRepository.findAllByDocumentId.mockResolvedValue([
        { id: "ver-1", createdAt: new Date("2024-01-01") },
        { id: "ver-2", createdAt: new Date("2024-01-02") },
      ]);
      mockDocumentRepository.update.mockResolvedValue({
        id: "doc-123",
        status: "completed",
        signedFileUrl: "path/to/signed.pdf",
      });

      const result = await documentService.useOldVersion("doc-123", "ver-2", "user-123");

      expect(mockDocumentRepository.update).toHaveBeenCalledWith("doc-123", {
        currentVersionId: "ver-2",
        status: "completed",
        signedFileUrl: "path/to/signed.pdf",
      });
    });

    it("Harus reset signers jika dokumen milik grup dan rollback ke V1", async () => {
      mockDocumentRepository.findById.mockResolvedValue({
        id: "doc-123",
        userId: "user-123",
        groupId: "group-123",
      });
      mockVersionRepository.findById.mockResolvedValue({ id: "ver-1", documentId: "doc-123" });
      mockVersionRepository.findAllByDocumentId.mockResolvedValue([{ id: "ver-1", createdAt: new Date() }]);
      mockDocumentRepository.update.mockResolvedValue({ id: "doc-123" });

      await documentService.useOldVersion("doc-123", "ver-1", "user-123");

      expect(mockGroupDocumentSignerRepository.resetSigners).toHaveBeenCalledWith("doc-123");
    });
  });

  describe("getDocumentFileUrl", () => {
    it("Harus throw error jika dokumen tidak memiliki versi aktif", async () => {
      mockDocumentRepository.findById.mockResolvedValue({
        id: "doc-123",
        currentVersionId: null,
        currentVersion: null,
      });

      await expect(documentService.getDocumentFileUrl("doc-123", "user-123")).rejects.toThrow("Dokumen tidak memiliki versi aktif.");
    });

    it("Harus mengembalikan signed URL untuk view", async () => {
      mockDocumentRepository.findById.mockResolvedValue({
        id: "doc-123",
        title: "Test Document",
        currentVersionId: "ver-1",
        currentVersion: { id: "ver-1", url: "path/to/file.pdf" },
      });
      mockFileStorage.getSignedUrl.mockResolvedValue("https://storage.example.com/signed-url");

      const result = await documentService.getDocumentFileUrl("doc-123", "user-123", false);

      expect(mockFileStorage.getSignedUrl).toHaveBeenCalledWith("path/to/file.pdf", 60, null);
      expect(result).toBe("https://storage.example.com/signed-url");
    });

    it("Harus mengembalikan signed URL untuk download dengan custom filename", async () => {
      mockDocumentRepository.findById.mockResolvedValue({
        id: "doc-123",
        title: "Test Document.pdf",
        currentVersionId: "ver-1",
        currentVersion: { id: "ver-1", url: "path/to/file.pdf" },
      });
      mockFileStorage.getSignedUrl.mockResolvedValue("https://storage.example.com/download-url");

      const result = await documentService.getDocumentFileUrl("doc-123", "user-123", true);

      expect(mockFileStorage.getSignedUrl).toHaveBeenCalledWith("path/to/file.pdf", 60, "Test_Document.pdf");
      expect(result).toBe("https://storage.example.com/download-url");
    });
  });

  describe("getVersionFileUrl", () => {
    it("Harus throw InvalidVersion jika versi tidak ada", async () => {
      mockDocumentRepository.findById.mockResolvedValue({ id: "doc-123", title: "Test" });
      mockVersionRepository.findById.mockResolvedValue(null);

      await expect(documentService.getVersionFileUrl("doc-123", "ver-not-exist", "user-123")).rejects.toThrow(DocumentError);
    });

    it("Harus throw InvalidVersion jika versi bukan milik dokumen", async () => {
      mockDocumentRepository.findById.mockResolvedValue({ id: "doc-123", title: "Test" });
      mockVersionRepository.findById.mockResolvedValue({ id: "ver-1", documentId: "other-doc" });

      await expect(documentService.getVersionFileUrl("doc-123", "ver-1", "user-123")).rejects.toThrow(DocumentError);
    });

    it("Harus mengembalikan signed URL dengan custom filename untuk download", async () => {
      mockDocumentRepository.findById.mockResolvedValue({ id: "doc-123", title: "Test Doc" });
      mockVersionRepository.findById.mockResolvedValue({
        id: "ver-2",
        documentId: "doc-123",
        url: "path/to/v2.pdf",
        versionNumber: 2,
      });
      mockFileStorage.getSignedUrl.mockResolvedValue("https://storage.example.com/ver-url");

      const result = await documentService.getVersionFileUrl("doc-123", "ver-2", "user-123", true);

      expect(mockFileStorage.getSignedUrl).toHaveBeenCalledWith("path/to/v2.pdf", 60, "signed-Test_Doc-v2.pdf");
      expect(result).toBe("https://storage.example.com/ver-url");
    });

    it("Harus menghitung versionNumber jika tidak tersedia", async () => {
      mockDocumentRepository.findById.mockResolvedValue({ id: "doc-123", title: "Test" });
      mockVersionRepository.findById.mockResolvedValue({
        id: "ver-2",
        documentId: "doc-123",
        url: "path/to/v2.pdf",
        versionNumber: null,
      });
      mockVersionRepository.findAllByDocumentId.mockResolvedValue([
        { id: "ver-1", createdAt: new Date("2024-01-01") },
        { id: "ver-2", createdAt: new Date("2024-01-02") },
        { id: "ver-3", createdAt: new Date("2024-01-03") },
      ]);
      mockFileStorage.getSignedUrl.mockResolvedValue("https://url.com");

      await documentService.getVersionFileUrl("doc-123", "ver-2", "user-123", true);

      expect(mockFileStorage.getSignedUrl).toHaveBeenCalledWith("path/to/v2.pdf", 60, "signed-Test-v2.pdf");
    });
  });

  describe("getDocumentFilePath", () => {
    it("Harus throw error jika dokumen tidak memiliki versi aktif", async () => {
      mockDocumentRepository.findById.mockResolvedValue({ id: "doc-123", currentVersionId: null });

      await expect(documentService.getDocumentFilePath("doc-123", "user-123")).rejects.toThrow("Dokumen ini tidak memiliki versi aktif.");
    });

    it("Harus throw error jika data versi tidak ditemukan", async () => {
      mockDocumentRepository.findById.mockResolvedValue({ id: "doc-123", currentVersionId: "ver-1" });
      mockVersionRepository.findById.mockResolvedValue(null);

      await expect(documentService.getDocumentFilePath("doc-123", "user-123")).rejects.toThrow("Data versi dokumen tidak ditemukan.");
    });

    it("Harus mengembalikan path file dari versi aktif", async () => {
      mockDocumentRepository.findById.mockResolvedValue({ id: "doc-123", currentVersionId: "ver-1" });
      mockVersionRepository.findById.mockResolvedValue({ id: "ver-1", url: "documents/user-123/file.pdf" });

      const result = await documentService.getDocumentFilePath("doc-123", "user-123");
      expect(result).toBe("documents/user-123/file.pdf");
    });
  });

  describe("deleteVersion", () => {
    it("Harus throw NotFound jika dokumen tidak ditemukan", async () => {
      mockDocumentRepository.findByIdSimple.mockResolvedValue(null);

      await expect(documentService.deleteVersion("doc-not-exist", "ver-1", "user-123")).rejects.toThrow(DocumentError);
    });

    it("Harus throw Forbidden jika user bukan pemilik dan bukan admin grup", async () => {
      mockDocumentRepository.findByIdSimple.mockResolvedValue({
        id: "doc-123",
        userId: "other-user",
        groupId: "group-123",
      });
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "member" });

      await expect(documentService.deleteVersion("doc-123", "ver-2", "user-123")).rejects.toThrow(DocumentError.Forbidden("Anda tidak memiliki izin untuk menghapus versi dokumen ini."));
    });

    it("Harus throw Forbidden jika user bukan pemilik pada dokumen personal", async () => {
      mockDocumentRepository.findByIdSimple.mockResolvedValue({
        id: "doc-123",
        userId: "other-user",
        groupId: null,
      });

      await expect(documentService.deleteVersion("doc-123", "ver-2", "user-123")).rejects.toThrow(DocumentError.Forbidden("Anda tidak memiliki izin untuk menghapus versi dokumen ini."));
    });

    it("Harus berhasil menghapus versi sebagai pemilik", async () => {
      mockDocumentRepository.findByIdSimple.mockResolvedValue({ id: "doc-123", userId: "user-123" });
      mockVersionRepository.findById.mockResolvedValue({ id: "ver-2", url: "path/to/v2.pdf" });
      mockVersionRepository.deleteById.mockResolvedValue(true);
      mockFileStorage.deleteFile.mockResolvedValue(true);

      const result = await documentService.deleteVersion("doc-123", "ver-2", "user-123");

      expect(mockVersionRepository.deleteById).toHaveBeenCalledWith("ver-2");
      expect(mockFileStorage.deleteFile).toHaveBeenCalledWith("path/to/v2.pdf");
      expect(result.message).toBe("Versi dokumen berhasil dihapus.");
    });

    it("Harus berhasil menghapus versi sebagai admin grup", async () => {
      mockDocumentRepository.findByIdSimple.mockResolvedValue({
        id: "doc-123",
        userId: "other-user",
        groupId: "group-123",
      });
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockVersionRepository.findById.mockResolvedValue({ id: "ver-2", url: "path/to/v2.pdf" });
      mockVersionRepository.deleteById.mockResolvedValue(true);
      mockFileStorage.deleteFile.mockResolvedValue(true);

      const result = await documentService.deleteVersion("doc-123", "ver-2", "user-123");
      expect(result.message).toBe("Versi dokumen berhasil dihapus.");
    });

    it("Harus throw NotFound jika versi tidak ditemukan di repository", async () => {
      mockDocumentRepository.findByIdSimple.mockResolvedValue({ id: "doc-123", userId: "user-123" });
      mockVersionRepository.findById.mockRejectedValue(new Error("Not found"));

      await expect(documentService.deleteVersion("doc-123", "ver-not-exist", "user-123")).rejects.toThrow(DocumentError);
    });

    it("Harus tetap berhasil meskipun penghapusan file fisik gagal", async () => {
      mockDocumentRepository.findByIdSimple.mockResolvedValue({ id: "doc-123", userId: "user-123" });
      mockVersionRepository.findById.mockResolvedValue({ id: "ver-2", url: "path/to/v2.pdf" });
      mockVersionRepository.deleteById.mockResolvedValue(true);
      mockFileStorage.deleteFile.mockRejectedValue(new Error("Storage error"));

      const result = await documentService.deleteVersion("doc-123", "ver-2", "user-123");
      expect(result.message).toBe("Versi dokumen berhasil dihapus.");
    });
  });
});
