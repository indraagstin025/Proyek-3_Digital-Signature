import { DashboardService } from "../../src/services/dashboardService.js";
import CommonError from "../../src/errors/CommonError.js";

// Mock Repositories
const mockDashboardRepository = {
  countAllStatuses: jest.fn(),
  findPendingSignatures: jest.fn(),
  findActionRequiredDocuments: jest.fn(),
  findRecentUpdatedDocuments: jest.fn(),
  findRecentSignatures: jest.fn(),
  findRecentGroupSignatures: jest.fn(),
  findRecentPackageSignatures: jest.fn(),
};

const mockGroupDocumentSignerRepository = {
  findPendingByUser: jest.fn(),
};

describe("DashboardService", () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DashboardService(mockDashboardRepository, mockGroupDocumentSignerRepository);
  });

  // =================================================================
  // 1. CONSTRUCTOR TESTS
  // =================================================================
  describe("Constructor", () => {
    test("should initialize service with both repositories", () => {
      expect(service.dashboardRepository).toBe(mockDashboardRepository);
      expect(service.groupDocumentSignerRepository).toBe(mockGroupDocumentSignerRepository);
    });

    test("should initialize service with only dashboardRepository", () => {
      const serviceOnlyDash = new DashboardService(mockDashboardRepository);
      expect(serviceOnlyDash.dashboardRepository).toBe(mockDashboardRepository);
      expect(serviceOnlyDash.groupDocumentSignerRepository).toBeUndefined();
    });

    test("should throw CommonError when dashboardRepository is missing", () => {
      expect(() => {
        new DashboardService(null);
      }).toThrow(CommonError);
    });
  });

  // =================================================================
  // 2. GET DASHBOARD SUMMARY TESTS (Main Orchestrator)
  // =================================================================
  describe("getDashboardSummary", () => {
    test("should return complete dashboard summary with all data", async () => {
      // Mock Success Responses
      mockDashboardRepository.countAllStatuses.mockResolvedValue({
        draft: 2,
        pending: 3,
        completed: 10,
      });

      // Mock Action Items Data
      mockDashboardRepository.findPendingSignatures.mockResolvedValue([
        {
          documentVersion: {
            document: {
              id: "doc1",
              title: "Personal Sig",
              owner: { name: "John" },
              updatedAt: new Date(),
            },
          },
        },
      ]);
      mockDashboardRepository.findActionRequiredDocuments.mockResolvedValue([]);
      mockGroupDocumentSignerRepository.findPendingByUser.mockResolvedValue([]);

      // Mock Recent Activities Data
      mockDashboardRepository.findRecentUpdatedDocuments.mockResolvedValue([
        {
          id: "doc2",
          title: "Recent Edit",
          status: "PENDING",
          groupId: null,
          updatedAt: new Date(),
        },
      ]);
      mockDashboardRepository.findRecentSignatures.mockResolvedValue([]);
      mockDashboardRepository.findRecentGroupSignatures.mockResolvedValue([]);
      mockDashboardRepository.findRecentPackageSignatures.mockResolvedValue([]);

      const result = await service.getDashboardSummary("user123");

      expect(result).toHaveProperty("counts");
      expect(result).toHaveProperty("actions");
      expect(result).toHaveProperty("activities");
      
      // Check Values
      expect(result.counts).toEqual({ waiting: 2, process: 3, completed: 10 });
      expect(result.actions).toHaveLength(1);
      expect(result.activities).toHaveLength(1);
    });

    test("should handle missing userId validation", async () => {
      await expect(service.getDashboardSummary("")).rejects.toThrow(CommonError);
      await expect(service.getDashboardSummary(null)).rejects.toThrow(CommonError);
    });

    test("should return default counts/actions/activities when specific queries fail (Promise.allSettled)", async () => {
      // Skenario: Count sukses, tapi Action & Activity error database
      mockDashboardRepository.countAllStatuses.mockResolvedValue({
        draft: 0,
        pending: 0,
        completed: 0,
      });
      
      // Simulate DB Errors
      mockDashboardRepository.findPendingSignatures.mockRejectedValue(new Error("DB Error"));
      mockDashboardRepository.findActionRequiredDocuments.mockRejectedValue(new Error("DB Error"));
      mockGroupDocumentSignerRepository.findPendingByUser.mockRejectedValue(new Error("DB Error"));
      
      // Simulate Activity Errors
      mockDashboardRepository.findRecentUpdatedDocuments.mockRejectedValue(new Error("DB Error"));
      
      // Mock console.error to keep test output clean
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.getDashboardSummary("user123");

      expect(result.counts).toEqual({ waiting: 0, process: 0, completed: 0 }); // Sukses
      expect(result.actions).toEqual([]); // Fallback default
      expect(result.activities).toEqual([]); // Fallback default
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test("should work without groupDocumentSignerRepository (Graceful degradation)", async () => {
      const serviceNoGroup = new DashboardService(mockDashboardRepository);

      mockDashboardRepository.countAllStatuses.mockResolvedValue({});
      mockDashboardRepository.findPendingSignatures.mockResolvedValue([]);
      mockDashboardRepository.findActionRequiredDocuments.mockResolvedValue([]);
      // Tidak perlu mock group repo karena undefined

      mockDashboardRepository.findRecentUpdatedDocuments.mockResolvedValue([]);
      mockDashboardRepository.findRecentSignatures.mockResolvedValue([]);
      mockDashboardRepository.findRecentGroupSignatures.mockResolvedValue([]);
      mockDashboardRepository.findRecentPackageSignatures.mockResolvedValue([]);

      const result = await serviceNoGroup.getDashboardSummary("user123");

      expect(result.actions).toEqual([]);
      expect(result.activities).toEqual([]);
    });
  });

  // =================================================================
  // 3. PRIVATE METHODS LOGIC TESTS
  // =================================================================
  
  describe("_getDocumentCounts", () => {
    test("should map repository result to dashboard format", async () => {
      mockDashboardRepository.countAllStatuses.mockResolvedValue({
        draft: 5,
        pending: 3,
        completed: 20,
      });

      const result = await service._getDocumentCounts("user123");

      expect(result).toEqual({
        waiting: 5,
        process: 3,
        completed: 20,
      });
    });

    test("should use 0 as default if counts are missing", async () => {
      mockDashboardRepository.countAllStatuses.mockResolvedValue({}); // Empty object

      const result = await service._getDocumentCounts("user123");

      expect(result).toEqual({
        waiting: 0,
        process: 0,
        completed: 0,
      });
    });
  });

  describe("_getActionItems (Priority & Sorting)", () => {
    test("should prioritize Personal Request over Draft (Deduplication Logic)", async () => {
      const date1 = new Date("2024-01-15");
      const date2 = new Date("2024-01-14"); // Older

      // Personal Request (ID: doc1)
      mockDashboardRepository.findPendingSignatures.mockResolvedValue([
        {
          documentVersion: {
            document: {
              id: "doc1",
              title: "Personal Request",
              owner: { name: "John" },
              updatedAt: date1,
            },
          },
        },
      ]);

      // Draft (ID: doc1) - Same ID!
      mockDashboardRepository.findActionRequiredDocuments.mockResolvedValue([
        {
          id: "doc1",
          title: "My Draft",
          status: "DRAFT",
          updatedAt: date2,
        },
      ]);
      mockGroupDocumentSignerRepository.findPendingByUser.mockResolvedValue([]);

      const result = await service._getActionItems("user123");

      // Harus cuma ada 1 item, dan tipenya harus 'personal' (karena diproses duluan di Map)
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("personal");
      expect(result[0].title).toBe("Personal Request");
    });

    test("should sort items by updatedAt descending", async () => {
      const dateNew = new Date("2024-02-01");
      const dateOld = new Date("2024-01-01");

      mockDashboardRepository.findPendingSignatures.mockResolvedValue([
        {
          documentVersion: {
            document: { id: "doc1", title: "Old", owner: { name: "A" }, updatedAt: dateOld },
          },
        },
      ]);

      mockDashboardRepository.findActionRequiredDocuments.mockResolvedValue([
        { id: "doc2", title: "New", status: "DRAFT", updatedAt: dateNew },
      ]);
      mockGroupDocumentSignerRepository.findPendingByUser.mockResolvedValue([]);

      const result = await service._getActionItems("user123");

      expect(result[0].id).toBe("doc2"); // Newest first
      expect(result[1].id).toBe("doc1"); // Oldest last
    });

    test("should limit results to 5 items", async () => {
      // Generate 10 drafts
      const drafts = Array.from({ length: 10 }, (_, i) => ({
        id: `doc${i}`,
        title: `Draft ${i}`,
        status: "DRAFT",
        updatedAt: new Date(),
      }));

      mockDashboardRepository.findPendingSignatures.mockResolvedValue([]);
      mockDashboardRepository.findActionRequiredDocuments.mockResolvedValue(drafts);
      mockGroupDocumentSignerRepository.findPendingByUser.mockResolvedValue([]);

      const result = await service._getActionItems("user123");

      expect(result).toHaveLength(5); // DASHBOARD_LIMIT
    });
  });

  describe("_getRecentActivities (Aggregation)", () => {
    test("should combine and normalize activities from all sources", async () => {
      const now = new Date();

      // 1. Recent Doc (Edit)
      mockDashboardRepository.findRecentUpdatedDocuments.mockResolvedValue([
        { id: "doc1", title: "Edited Doc", status: "PENDING", groupId: null, updatedAt: now },
      ]);

      // 2. Recent Sig (Personal)
      mockDashboardRepository.findRecentSignatures.mockResolvedValue([
        {
          documentVersion: {
            document: { id: "doc2", title: "Signed Doc", groupId: null, updatedAt: now },
          },
          signedAt: now,
        },
      ]);

      // 3. Recent Package Sig
      mockDashboardRepository.findRecentPackageSignatures.mockResolvedValue([
        {
          packageDocument: {
            package: { title: "Pkg1" },
            docVersion: { document: { id: "doc3", title: "Doc3" } },
          },
          createdAt: now,
        },
      ]);

      mockDashboardRepository.findRecentGroupSignatures.mockResolvedValue([]);

      const result = await service._getRecentActivities("user123");

      expect(result).toHaveLength(3);
      
      const editActivity = result.find(a => a.id === "doc1");
      expect(editActivity.activityType).toBe("edit");

      const sigActivity = result.find(a => a.id === "doc2");
      expect(sigActivity.activityType).toBe("signature");
      expect(sigActivity.type).toBe("personal");

      const pkgActivity = result.find(a => a.id === "doc3");
      expect(pkgActivity.type).toBe("package");
      expect(pkgActivity.title).toBe("Pkg1 - Doc3");
    });
  });

  // =================================================================
  // 4. HELPER METHODS TESTS
  // =================================================================

  describe("_normalizeSignatures", () => {
    test("should detect 'group' type if document has groupId", () => {
      const signatures = [{
        documentVersion: {
          document: { id: "doc1", title: "Group Doc", groupId: "g1", updatedAt: new Date() }
        },
        signedAt: new Date()
      }];

      const result = service._normalizeSignatures(signatures);
      expect(result[0].type).toBe("group");
      expect(result[0].groupId).toBe("g1");
    });

    test("should force type if provided", () => {
      const signatures = [{
        documentVersion: {
          document: { id: "doc1", title: "Doc", groupId: null, updatedAt: new Date() }
        },
        signedAt: new Date()
      }];

      const result = service._normalizeSignatures(signatures, "group");
      expect(result[0].type).toBe("group");
    });
  });

  describe("_normalizePackageSignatures", () => {
    test("should format package title correctly", () => {
      const sigs = [{
        packageDocument: {
          package: { title: "MyPackage" },
          docVersion: { document: { id: "d1", title: "MyDoc" } }
        },
        createdAt: new Date()
      }];

      const result = service._normalizePackageSignatures(sigs);
      expect(result[0].title).toBe("MyPackage - MyDoc");
      expect(result[0].type).toBe("package");
    });

    test("should handle missing package title", () => {
        const sigs = [{
          packageDocument: {
            package: { title: null },
            docVersion: { document: { id: "d1", title: "MyDoc" } }
          },
          createdAt: new Date()
        }];
  
        const result = service._normalizePackageSignatures(sigs);
        expect(result[0].title).toBe("Paket - MyDoc");
      });
  });
});