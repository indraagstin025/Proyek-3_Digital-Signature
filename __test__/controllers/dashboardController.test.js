import { createDashboardController } from "../../src/controllers/dashboardController.js";
import CommonError from "../../src/errors/CommonError.js";

// --- MOCK SERVICE ---
// Kita buat mock object sederhana yang meniru fungsi dashboardService
const mockDashboardService = {
  getDashboardSummary: jest.fn(),
};

describe("DashboardController", () => {
  let controller;
  let req, res, next;

  // Setup sebelum setiap test
  beforeEach(() => {
    jest.clearAllMocks(); // Bersihkan panggilan fungsi sebelumnya

    // 1. Inisialisasi Controller dengan Mock Service
    controller = createDashboardController(mockDashboardService);

    // 2. Setup Mock Objects untuk Express (req, res, next)
    req = {
      user: { id: "user-123" }, // Default user login
    };

    res = {
      status: jest.fn().mockReturnThis(), // Agar bisa chaining: res.status().json()
      json: jest.fn(),
    };

    next = jest.fn(); // Mock untuk menangkap error
  });

  // =================================================================
  // TEST: getSummary
  // =================================================================
  describe("getSummary", () => {
    test("should return 200 and dashboard data when successful", async () => {
      // ARRANGE
      const mockSummaryData = {
        counts: { waiting: 1 },
        actions: [],
        activities: [],
      };
      // Mock service supaya sukses mengembalikan data
      mockDashboardService.getDashboardSummary.mockResolvedValue(mockSummaryData);

      // ACT
      await controller.getSummary(req, res, next);

      // ASSERT
      // 1. Pastikan Service dipanggil dengan ID yang benar
      expect(mockDashboardService.getDashboardSummary).toHaveBeenCalledWith("user-123");

      // 2. Pastikan Response Status 200
      expect(res.status).toHaveBeenCalledWith(200);

      // 3. Pastikan format JSON response sesuai standar
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Data dashboard berhasil dimuat.",
        data: mockSummaryData,
      });

      // 4. Pastikan next TIDAK dipanggil (karena tidak error)
      expect(next).not.toHaveBeenCalled();
    });

    test("should call next(error) with Unauthorized if req.user is missing", async () => {
      // ARRANGE
      req.user = undefined; // Simulasi user belum login / token invalid

      // ACT
      await controller.getSummary(req, res, next);

      // ASSERT
      // 1. Service TIDAK boleh dipanggil
      expect(mockDashboardService.getDashboardSummary).not.toHaveBeenCalled();

      // 2. next() harus dipanggil dengan error
      expect(next).toHaveBeenCalledTimes(1);
      
      // 3. Cek tipe error-nya
      const errorArg = next.mock.calls[0][0];
      expect(errorArg).toBeInstanceOf(CommonError);
      expect(errorArg.statusCode).toBe(401); // Unauthorized code
    });

    test("should call next(error) if Service throws an error", async () => {
      // ARRANGE
      const dbError = new Error("Database connection failed");
      // Simulasi service gagal (misal DB mati)
      mockDashboardService.getDashboardSummary.mockRejectedValue(dbError);

      // ACT
      await controller.getSummary(req, res, next);

      // ASSERT
      // 1. Service tetap dipanggil
      expect(mockDashboardService.getDashboardSummary).toHaveBeenCalledWith("user-123");

      // 2. Response sukses TIDAK boleh dikirim
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();

      // 3. Error harus dioper ke middleware error handler (next)
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });
});