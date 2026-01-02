/**
 * Unit Tests for HistoryService
 *
 * @file historyService.test.js
 * @description Tests for HistoryService methods:
 *  - constructor: Dependency injection validation
 *  - getUserSigningHistory: Get all signing history for a user
 */

import { jest } from "@jest/globals";
import { HistoryService } from "../../src/services/historyService.js";

describe("HistoryService", () => {
  let historyService;
  let mockHistoryRepository;

  beforeEach(() => {
    // Mock repository
    mockHistoryRepository = {
      findPersonalSignatures: jest.fn(),
      findGroupSignatures: jest.fn(),
      findPackageSignatures: jest.fn(),
    };

    historyService = new HistoryService(mockHistoryRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // CONSTRUCTOR VALIDATION
  // ==========================================================================
  describe("constructor", () => {
    it("Harus throw InternalServerError jika historyRepository tidak disediakan", () => {
      expect(() => new HistoryService(null)).toThrow("HistoryService: historyRepository harus disediakan.");
    });

    it("Harus throw InternalServerError jika historyRepository undefined", () => {
      expect(() => new HistoryService(undefined)).toThrow("HistoryService: historyRepository harus disediakan.");
    });

    it("Harus berhasil membuat instance jika historyRepository valid", () => {
      const service = new HistoryService(mockHistoryRepository);

      expect(service).toBeDefined();
      expect(service.historyRepository).toBe(mockHistoryRepository);
    });
  });

  // ==========================================================================
  // GET USER SIGNING HISTORY
  // ==========================================================================
  describe("getUserSigningHistory", () => {
    const userId = "user-123";

    it("Harus return array kosong jika tidak ada history", async () => {
      mockHistoryRepository.findPersonalSignatures.mockResolvedValue([]);
      mockHistoryRepository.findGroupSignatures.mockResolvedValue([]);
      mockHistoryRepository.findPackageSignatures.mockResolvedValue([]);

      const result = await historyService.getUserSigningHistory(userId);

      expect(mockHistoryRepository.findPersonalSignatures).toHaveBeenCalledWith(userId);
      expect(mockHistoryRepository.findGroupSignatures).toHaveBeenCalledWith(userId);
      expect(mockHistoryRepository.findPackageSignatures).toHaveBeenCalledWith(userId);
      expect(result).toEqual([]);
    });

    it("Harus format dan return personal signatures dengan benar", async () => {
      const personalSigs = [
        {
          id: "sig-personal-1",
          signedAt: new Date("2025-01-15T10:00:00Z"),
          ipAddress: "192.168.1.1",
          documentVersion: {
            document: { title: "Personal Document 1" },
          },
        },
      ];

      mockHistoryRepository.findPersonalSignatures.mockResolvedValue(personalSigs);
      mockHistoryRepository.findGroupSignatures.mockResolvedValue([]);
      mockHistoryRepository.findPackageSignatures.mockResolvedValue([]);

      const result = await historyService.getUserSigningHistory(userId);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "sig-personal-1",
        type: "PERSONAL",
        documentTitle: "Personal Document 1",
        signedAt: new Date("2025-01-15T10:00:00Z"),
        ipAddress: "192.168.1.1",
      });
    });

    it("Harus format dan return group signatures dengan benar", async () => {
      const groupSigs = [
        {
          id: "sig-group-1",
          signedAt: new Date("2025-01-14T08:00:00Z"),
          ipAddress: "192.168.1.2",
          documentVersion: {
            document: { title: "Group Document 1" },
          },
        },
      ];

      mockHistoryRepository.findPersonalSignatures.mockResolvedValue([]);
      mockHistoryRepository.findGroupSignatures.mockResolvedValue(groupSigs);
      mockHistoryRepository.findPackageSignatures.mockResolvedValue([]);

      const result = await historyService.getUserSigningHistory(userId);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "sig-group-1",
        type: "GROUP",
        documentTitle: "Group Document 1",
        signedAt: new Date("2025-01-14T08:00:00Z"),
        ipAddress: "192.168.1.2",
      });
    });

    it("Harus format dan return package signatures dengan benar", async () => {
      const packageSigs = [
        {
          id: "sig-package-1",
          createdAt: new Date("2025-01-13T12:00:00Z"),
          ipAddress: "192.168.1.3",
          packageDocument: {
            docVersion: {
              document: { title: "Package Document 1" },
            },
          },
        },
      ];

      mockHistoryRepository.findPersonalSignatures.mockResolvedValue([]);
      mockHistoryRepository.findGroupSignatures.mockResolvedValue([]);
      mockHistoryRepository.findPackageSignatures.mockResolvedValue(packageSigs);

      const result = await historyService.getUserSigningHistory(userId);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "sig-package-1",
        type: "PACKAGE",
        documentTitle: "Package Document 1",
        signedAt: new Date("2025-01-13T12:00:00Z"),
        ipAddress: "192.168.1.3",
      });
    });

    it("Harus menggabungkan semua tipe history dan sort berdasarkan tanggal terbaru", async () => {
      const personalSigs = [
        {
          id: "sig-personal-1",
          signedAt: new Date("2025-01-10T10:00:00Z"),
          ipAddress: "192.168.1.1",
          documentVersion: { document: { title: "Personal Doc" } },
        },
      ];
      const groupSigs = [
        {
          id: "sig-group-1",
          signedAt: new Date("2025-01-15T08:00:00Z"), // Terbaru
          ipAddress: "192.168.1.2",
          documentVersion: { document: { title: "Group Doc" } },
        },
      ];
      const packageSigs = [
        {
          id: "sig-package-1",
          createdAt: new Date("2025-01-12T12:00:00Z"),
          ipAddress: "192.168.1.3",
          packageDocument: { docVersion: { document: { title: "Package Doc" } } },
        },
      ];

      mockHistoryRepository.findPersonalSignatures.mockResolvedValue(personalSigs);
      mockHistoryRepository.findGroupSignatures.mockResolvedValue(groupSigs);
      mockHistoryRepository.findPackageSignatures.mockResolvedValue(packageSigs);

      const result = await historyService.getUserSigningHistory(userId);

      expect(result).toHaveLength(3);
      // Harus urut dari terbaru ke terlama
      expect(result[0].id).toBe("sig-group-1"); // 15 Jan
      expect(result[1].id).toBe("sig-package-1"); // 12 Jan
      expect(result[2].id).toBe("sig-personal-1"); // 10 Jan
    });

    it("Harus return 'Unknown Document' jika documentVersion null (personal)", async () => {
      const personalSigs = [
        {
          id: "sig-1",
          signedAt: new Date("2025-01-15"),
          ipAddress: "1.2.3.4",
          documentVersion: null,
        },
      ];

      mockHistoryRepository.findPersonalSignatures.mockResolvedValue(personalSigs);
      mockHistoryRepository.findGroupSignatures.mockResolvedValue([]);
      mockHistoryRepository.findPackageSignatures.mockResolvedValue([]);

      const result = await historyService.getUserSigningHistory(userId);

      expect(result[0].documentTitle).toBe("Unknown Document");
    });

    it("Harus return 'Unknown Document' jika document null (personal)", async () => {
      const personalSigs = [
        {
          id: "sig-1",
          signedAt: new Date("2025-01-15"),
          ipAddress: "1.2.3.4",
          documentVersion: { document: null },
        },
      ];

      mockHistoryRepository.findPersonalSignatures.mockResolvedValue(personalSigs);
      mockHistoryRepository.findGroupSignatures.mockResolvedValue([]);
      mockHistoryRepository.findPackageSignatures.mockResolvedValue([]);

      const result = await historyService.getUserSigningHistory(userId);

      expect(result[0].documentTitle).toBe("Unknown Document");
    });

    it("Harus return 'Unknown Document' jika documentVersion null (group)", async () => {
      const groupSigs = [
        {
          id: "sig-1",
          signedAt: new Date("2025-01-15"),
          ipAddress: "1.2.3.4",
          documentVersion: null,
        },
      ];

      mockHistoryRepository.findPersonalSignatures.mockResolvedValue([]);
      mockHistoryRepository.findGroupSignatures.mockResolvedValue(groupSigs);
      mockHistoryRepository.findPackageSignatures.mockResolvedValue([]);

      const result = await historyService.getUserSigningHistory(userId);

      expect(result[0].documentTitle).toBe("Unknown Document");
    });

    it("Harus return 'Unknown Document' jika packageDocument null (package)", async () => {
      const packageSigs = [
        {
          id: "sig-1",
          createdAt: new Date("2025-01-15"),
          ipAddress: "1.2.3.4",
          packageDocument: null,
        },
      ];

      mockHistoryRepository.findPersonalSignatures.mockResolvedValue([]);
      mockHistoryRepository.findGroupSignatures.mockResolvedValue([]);
      mockHistoryRepository.findPackageSignatures.mockResolvedValue(packageSigs);

      const result = await historyService.getUserSigningHistory(userId);

      expect(result[0].documentTitle).toBe("Unknown Document");
    });

    it("Harus return 'Unknown Document' jika docVersion null (package)", async () => {
      const packageSigs = [
        {
          id: "sig-1",
          createdAt: new Date("2025-01-15"),
          ipAddress: "1.2.3.4",
          packageDocument: { docVersion: null },
        },
      ];

      mockHistoryRepository.findPersonalSignatures.mockResolvedValue([]);
      mockHistoryRepository.findGroupSignatures.mockResolvedValue([]);
      mockHistoryRepository.findPackageSignatures.mockResolvedValue(packageSigs);

      const result = await historyService.getUserSigningHistory(userId);

      expect(result[0].documentTitle).toBe("Unknown Document");
    });

    it("Harus handle multiple signatures per type", async () => {
      const personalSigs = [
        {
          id: "p1",
          signedAt: new Date("2025-01-01"),
          ipAddress: "1.1.1.1",
          documentVersion: { document: { title: "P1" } },
        },
        {
          id: "p2",
          signedAt: new Date("2025-01-02"),
          ipAddress: "1.1.1.2",
          documentVersion: { document: { title: "P2" } },
        },
      ];
      const groupSigs = [
        {
          id: "g1",
          signedAt: new Date("2025-01-03"),
          ipAddress: "2.2.2.1",
          documentVersion: { document: { title: "G1" } },
        },
      ];
      const packageSigs = [
        {
          id: "pk1",
          createdAt: new Date("2025-01-04"),
          ipAddress: "3.3.3.1",
          packageDocument: { docVersion: { document: { title: "PK1" } } },
        },
        {
          id: "pk2",
          createdAt: new Date("2025-01-05"),
          ipAddress: "3.3.3.2",
          packageDocument: { docVersion: { document: { title: "PK2" } } },
        },
      ];

      mockHistoryRepository.findPersonalSignatures.mockResolvedValue(personalSigs);
      mockHistoryRepository.findGroupSignatures.mockResolvedValue(groupSigs);
      mockHistoryRepository.findPackageSignatures.mockResolvedValue(packageSigs);

      const result = await historyService.getUserSigningHistory(userId);

      expect(result).toHaveLength(5);
      // Verify sorted by date descending
      expect(result[0].id).toBe("pk2"); // 5 Jan
      expect(result[1].id).toBe("pk1"); // 4 Jan
      expect(result[2].id).toBe("g1"); // 3 Jan
      expect(result[3].id).toBe("p2"); // 2 Jan
      expect(result[4].id).toBe("p1"); // 1 Jan
    });

    it("Harus memanggil repository secara paralel (Promise.all)", async () => {
      mockHistoryRepository.findPersonalSignatures.mockResolvedValue([]);
      mockHistoryRepository.findGroupSignatures.mockResolvedValue([]);
      mockHistoryRepository.findPackageSignatures.mockResolvedValue([]);

      await historyService.getUserSigningHistory(userId);

      // Semua repository harus dipanggil
      expect(mockHistoryRepository.findPersonalSignatures).toHaveBeenCalledTimes(1);
      expect(mockHistoryRepository.findGroupSignatures).toHaveBeenCalledTimes(1);
      expect(mockHistoryRepository.findPackageSignatures).toHaveBeenCalledTimes(1);
    });
  });
});
