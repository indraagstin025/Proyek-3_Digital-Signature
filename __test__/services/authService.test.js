/**
 * @fileoverview Test untuk AuthService menggunakan Jest dengan mock repository dan mock Supabase.
 * Setiap unit test memastikan validasi dan integrasi logika service berjalan dengan benar.
 */

import { jest } from "@jest/globals";
import { AuthService } from "../../src/services/authService.js";
import AuthError from "../../src/errors/AuthError.js";
import CommonError from "../../src/errors/CommonError.js";
import supabaseAuth from "../../src/config/supabaseAuth.js";

/**
 * Mock supabaseAuth untuk mencegah eksekusi API Supabase asli.
 */
jest.mock("../../src/config/supabaseAuth.js", () => ({
  auth: {
    setSession: jest.fn(),
    updateUser: jest.fn(),
  },
}));

describe("AuthService", () => {
  let authService;
  let mockAuthRepository;

  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});

    mockAuthRepository = {
      registerUser: jest.fn(),
      loginUser: jest.fn(),
      logoutUser: jest.fn(),
      forgotPassword: jest.fn(),
    };

    authService = new AuthService(mockAuthRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  /**
   * @test
   * @description Memastikan constructor melempar error jika repository tidak diberikan.
   */
  it("Constructor: Harus throw error jika repository tidak disediakan", () => {
    expect(() => new AuthService(null)).toThrow(CommonError);
    expect(() => new AuthService(null)).toThrow("AuthRepository harus disediakan.");
  });

  describe("registerUser", () => {
    const validEmail = "test@example.com";
    const validPassword = "PasswordKuat123!";
    const validData = { name: "Test", phoneNumber: "08123456789" };

    /**
     * @test
     * @description Validasi password null atau undefined.
     */
    it("Harus throw AuthError jika password null atau undefined", async () => {
      await expect(authService.registerUser(validEmail, null, validData)).rejects.toThrow(AuthError);
      await expect(authService.registerUser(validEmail, null, validData)).rejects.toThrow("Password minimal 8 karakter.");

      await expect(authService.registerUser(validEmail, undefined, validData)).rejects.toThrow("Password minimal 8 karakter.");
    });

    /**
     * @test
     * @description Validasi password string kosong.
     */
    it("Harus throw AuthError jika password adalah string kosong", async () => {
      await expect(authService.registerUser(validEmail, "", validData)).rejects.toThrow(AuthError);
      await expect(authService.registerUser(validEmail, "", validData)).rejects.toThrow("Password minimal 8 karakter.");
    });

    /**
     * @test
     * @description Validasi password minimal 8 karakter.
     */
    it("Harus throw AuthError jika password kurang dari 8 karakter", async () => {
      await expect(authService.registerUser(validEmail, "Pass1!", validData)).rejects.toThrow(AuthError);

      await expect(authService.registerUser(validEmail, "Pass1!", validData)).rejects.toThrow("Password minimal 8 karakter.");
    });

    /**
     * @test
     * @description Validasi password tepat 7 karakter (boundary test).
     */
    it("Harus throw AuthError jika password tepat 7 karakter", async () => {
      await expect(authService.registerUser(validEmail, "Abc123!", validData)).rejects.toThrow("Password minimal 8 karakter.");
    });

    /**
     * @test
     * @description Password tepat 8 karakter harus lolos validasi panjang.
     */
    it("Harus lolos validasi panjang jika password tepat 8 karakter dengan kriteria lengkap", async () => {
      const mockResult = { id: 1, email: validEmail };
      mockAuthRepository.registerUser.mockResolvedValue(mockResult);

      const result = await authService.registerUser(validEmail, "Abcd123!", validData);

      expect(mockAuthRepository.registerUser).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    /**
     * @test
     * @description Validasi password harus memiliki angka.
     */
    it("Harus throw AuthError jika password tidak mengandung angka", async () => {
      await expect(authService.registerUser(validEmail, "PasswordValidTapiNoAngka", validData)).rejects.toThrow("Password harus mengandung minimal satu angka.");
    });

    /**
     * @test
     * @description Validasi password hanya huruf tanpa angka.
     */
    it("Harus throw AuthError jika password hanya berisi huruf (tanpa angka)", async () => {
      await expect(authService.registerUser(validEmail, "AbcdefghIjklmnop", validData)).rejects.toThrow("Password harus mengandung minimal satu angka.");
    });

    /**
     * @test
     * @description Validasi password harus mengandung huruf kapital.
     */
    it("Harus throw AuthError jika password tidak mengandung huruf kapital", async () => {
      await expect(authService.registerUser(validEmail, "password123!", validData)).rejects.toThrow("Password harus mengandung minimal satu huruf kapital.");
    });

    /**
     * @test
     * @description Validasi password hanya angka dan huruf kecil (tanpa kapital).
     */
    it("Harus throw AuthError jika password hanya angka dan huruf kecil", async () => {
      await expect(authService.registerUser(validEmail, "password12345", validData)).rejects.toThrow("Password harus mengandung minimal satu huruf kapital.");
    });

    /**
     * @test
     * @description Validasi password harus mengandung huruf kecil.
     */
    it("Harus throw AuthError jika password tidak mengandung huruf kecil", async () => {
      await expect(authService.registerUser(validEmail, "PASSWORD123!", validData)).rejects.toThrow("Password harus mengandung minimal satu huruf kecil.");
    });

    /**
     * @test
     * @description Validasi password hanya angka dan huruf kapital (tanpa kecil).
     */
    it("Harus throw AuthError jika password hanya angka dan huruf kapital", async () => {
      await expect(authService.registerUser(validEmail, "PASSWORD12345", validData)).rejects.toThrow("Password harus mengandung minimal satu huruf kecil.");
    });

    /**
     * @test
     * @description Validasi password hanya angka.
     */
    it("Harus throw AuthError jika password hanya berisi angka", async () => {
      await expect(authService.registerUser(validEmail, "1234567890", validData)).rejects.toThrow("Password harus mengandung minimal satu huruf kapital.");
    });

    /**
     * @test
     * @description Validasi password dengan spasi.
     */
    it("Harus lolos validasi jika password mengandung spasi tapi memenuhi kriteria lain", async () => {
      const mockResult = { id: 1, email: validEmail };
      mockAuthRepository.registerUser.mockResolvedValue(mockResult);

      const result = await authService.registerUser(validEmail, "Pass word123", validData);

      expect(mockAuthRepository.registerUser).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    /**
     * @test
     * @description Validasi password dengan karakter khusus.
     */
    it("Harus lolos validasi jika password mengandung karakter khusus dan memenuhi kriteria", async () => {
      const mockResult = { id: 1, email: validEmail };
      mockAuthRepository.registerUser.mockResolvedValue(mockResult);

      const result = await authService.registerUser(validEmail, "P@ssw0rd!#$%", validData);

      expect(mockAuthRepository.registerUser).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    /**
     * @test
     * @description Memastikan registerUser berhasil memanggil repository dan mengembalikan hasilnya.
     */
    it("Harus memanggil repository.registerUser jika semua validasi lolos", async () => {
      const mockResult = { id: 1, email: validEmail };
      mockAuthRepository.registerUser.mockResolvedValue(mockResult);

      const result = await authService.registerUser(validEmail, "PasswordKuat123!", validData);

      expect(mockAuthRepository.registerUser).toHaveBeenCalledWith(validEmail, "PasswordKuat123!", validData);

      expect(result).toEqual(mockResult);
    });

    /**
     * @test
     * @description Memastikan data user yang dikembalikan sesuai dengan yang diharapkan.
     */
    it("Harus mengembalikan data user yang dibuat oleh repository", async () => {
      const mockCreatedUser = {
        id: "uuid-12345",
        email: validEmail,
        name: validData.name,
        phoneNumber: validData.phoneNumber,
        createdAt: new Date().toISOString(),
      };
      mockAuthRepository.registerUser.mockResolvedValue(mockCreatedUser);

      const result = await authService.registerUser(validEmail, validPassword, validData);

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("email", validEmail);
      expect(result).toHaveProperty("name", validData.name);
    });

    /**
     * @test
     * @description Memastikan parameter diteruskan dengan benar ke repository.
     */
    it("Harus meneruskan email, password, dan additionalData ke repository dengan benar", async () => {
      const mockResult = { id: 1 };
      mockAuthRepository.registerUser.mockResolvedValue(mockResult);

      const additionalData = {
        name: "John Doe",
        phoneNumber: "081234567890",
        address: "Jl. Test No. 123",
      };

      await authService.registerUser("john@test.com", "SecurePass123!", additionalData);

      expect(mockAuthRepository.registerUser).toHaveBeenCalledTimes(1);
      expect(mockAuthRepository.registerUser).toHaveBeenCalledWith("john@test.com", "SecurePass123!", additionalData);
    });

    /**
     * @test
     * @description Memastikan additionalData kosong tetap diteruskan.
     */
    it("Harus tetap berfungsi jika additionalData adalah objek kosong", async () => {
      const mockResult = { id: 1, email: validEmail };
      mockAuthRepository.registerUser.mockResolvedValue(mockResult);

      const result = await authService.registerUser(validEmail, validPassword, {});

      expect(mockAuthRepository.registerUser).toHaveBeenCalledWith(validEmail, validPassword, {});
      expect(result).toEqual(mockResult);
    });

    /**
     * @test
     * @description Memastikan additionalData null/undefined tetap diteruskan.
     */
    it("Harus tetap berfungsi jika additionalData adalah null atau undefined", async () => {
      const mockResult = { id: 1, email: validEmail };
      mockAuthRepository.registerUser.mockResolvedValue(mockResult);

      const result1 = await authService.registerUser(validEmail, validPassword, null);
      expect(result1).toEqual(mockResult);

      const result2 = await authService.registerUser(validEmail, validPassword, undefined);
      expect(result2).toEqual(mockResult);
    });

    /**
     * @test
     * @description Harus throw error jika repository.registerUser gagal.
     */
    it("Harus throw error jika repository.registerUser melempar error", async () => {
      mockAuthRepository.registerUser.mockRejectedValue(new Error("Database connection failed"));

      await expect(authService.registerUser(validEmail, validPassword, validData)).rejects.toThrow("Database connection failed");
    });

    /**
     * @test
     * @description Harus throw error jika email sudah terdaftar.
     */
    it("Harus throw error jika email sudah terdaftar (duplicate email)", async () => {
      mockAuthRepository.registerUser.mockRejectedValue(AuthError.EmailAlreadyExist("Email sudah terdaftar."));

      await expect(authService.registerUser(validEmail, validPassword, validData)).rejects.toThrow(AuthError);
    });

    /**
     * @test
     * @description Harus throw AuthError dengan kode yang benar dari repository.
     */
    it("Harus throw AuthError dengan tipe yang benar dari repository", async () => {
      const authError = new AuthError("User already registered", 409, "USER_EXISTS");
      mockAuthRepository.registerUser.mockRejectedValue(authError);

      await expect(authService.registerUser(validEmail, validPassword, validData)).rejects.toThrow(AuthError);
    });

    /**
     * @test
     * @description Password dengan angka di awal harus valid.
     */
    it("Harus lolos validasi dengan password yang diawali angka", async () => {
      const mockResult = { id: 1, email: validEmail };
      mockAuthRepository.registerUser.mockResolvedValue(mockResult);

      const result = await authService.registerUser(validEmail, "1Password!", validData);

      expect(result).toEqual(mockResult);
    });

    /**
     * @test
     * @description Password sangat panjang harus valid.
     */
    it("Harus lolos validasi dengan password sangat panjang", async () => {
      const mockResult = { id: 1, email: validEmail };
      mockAuthRepository.registerUser.mockResolvedValue(mockResult);

      const longPassword = "Abc123!" + "x".repeat(100);
      const result = await authService.registerUser(validEmail, longPassword, validData);

      expect(result).toEqual(mockResult);
    });

    /**
     * @test
     * @description Password dengan unicode characters.
     */
    it("Harus lolos validasi dengan password mengandung unicode jika kriteria terpenuhi", async () => {
      const mockResult = { id: 1, email: validEmail };
      mockAuthRepository.registerUser.mockResolvedValue(mockResult);

      const result = await authService.registerUser(validEmail, "Pässwörd123!", validData);

      expect(result).toEqual(mockResult);
    });
  });

  describe("loginUser", () => {
    /**
     * @test
     * @description Memastikan loginUser memanggil repository dan mengembalikan hasilnya.
     */
    it("Harus memanggil repository.loginUser dan mengembalikan hasilnya", async () => {
      const email = "user@test.com";
      const password = "Password123!";
      const mockResponse = { session: "abc", user: "xyz" };

      mockAuthRepository.loginUser.mockResolvedValue(mockResponse);

      const result = await authService.loginUser(email, password);

      expect(mockAuthRepository.loginUser).toHaveBeenCalledWith(email, password);
      expect(result).toEqual(mockResponse);
    });
  });

  describe("logoutUser", () => {
    /**
     * @test
     * @description Memastikan logoutUser memanggil repository.logoutUser.
     */
    it("Harus memanggil repository.logoutUser", async () => {
      const mockResponse = { message: "Logout sukses" };
      mockAuthRepository.logoutUser.mockResolvedValue(mockResponse);

      const result = await authService.logoutUser();

      expect(mockAuthRepository.logoutUser).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });
  });

  describe("forgotPassword", () => {
    /**
     * @test
     * @description Validasi email wajib ada.
     */
    it("Harus throw AuthError.UserNotFound jika email kosong atau null", async () => {
      await expect(authService.forgotPassword("")).rejects.toThrow(AuthError);
      await expect(authService.forgotPassword("")).rejects.toThrow("Email wajib diisi.");
      await expect(authService.forgotPassword(null)).rejects.toThrow(AuthError);
    });

    /**
     * @test
     * @description Memastikan forgotPassword memanggil repository dengan email valid.
     */
    it("Harus memanggil repository.forgotPassword jika email valid", async () => {
      const email = "lupa@test.com";
      const mockResponse = { message: "Link dikirim" };
      mockAuthRepository.forgotPassword.mockResolvedValue(mockResponse);

      const result = await authService.forgotPassword(email);

      expect(mockAuthRepository.forgotPassword).toHaveBeenCalledWith(email);
      expect(result).toEqual(mockResponse);
    });
  });

  describe("resetPassword", () => {
    const validToken = "access-token-123";
    const validRefresh = "refresh-token-456";
    const validNewPass = "NewPass123!";

    /**
     * @test
     * @description Validasi token harus lengkap.
     */
    it("Harus throw AuthError jika token tidak lengkap", async () => {
      await expect(authService.resetPassword(null, validRefresh, validNewPass)).rejects.toThrow("Access token atau refresh token tidak ditemukan.");

      await expect(authService.resetPassword(validToken, null, validNewPass)).rejects.toThrow(AuthError);
    });

    /**
     * @test
     * @description Validasi password baru harus memenuhi seluruh aturan kompleksitas.
     */
    it("Harus throw AuthError jika password baru tidak memenuhi syarat kompleksitas", async () => {
      await expect(authService.resetPassword(validToken, validRefresh, "weak")).rejects.toThrow("Password minimal 8 karakter.");

      await expect(authService.resetPassword(validToken, validRefresh, "PasswordNoAngka!")).rejects.toThrow("Password harus mengandung minimal satu angka.");

      await expect(authService.resetPassword(validToken, validRefresh, "passwordkecil1!")).rejects.toThrow("Password harus mengandung minimal satu huruf kapital.");

      await expect(authService.resetPassword(validToken, validRefresh, "PASSWORDGEDE1!")).rejects.toThrow("Password harus mengandung minimal satu huruf kecil.");
    });

    /**
     * @test
     * @description Menangani kondisi gagal setSession (token Supabase invalid/expired).
     */
    it("Harus throw AuthError jika setSession gagal (token invalid/expired)", async () => {
      supabaseAuth.auth.setSession.mockResolvedValue({
        data: null,
        error: { message: "Refresh Token Not Found" },
      });

      await expect(authService.resetPassword(validToken, validRefresh, validNewPass)).rejects.toThrow("Tautan reset password sudah tidak valid atau kedaluwarsa.");
    });

    /**
     * @test
     * @description Menangani kondisi updateUser gagal (misal password pernah dipakai).
     */
    it("Harus throw AuthError jika updateUser gagal", async () => {
      supabaseAuth.auth.setSession.mockResolvedValue({ data: {}, error: null });

      supabaseAuth.auth.updateUser.mockResolvedValue({
        data: null,
        error: { message: "New password should be different" },
      });

      await expect(authService.resetPassword(validToken, validRefresh, validNewPass)).rejects.toThrow("Password tidak memenuhi syarat atau token sudah tidak valid.");
    });

    /**
     * @test
     * @description Proses reset password berhasil jika semua langkah sukses.
     */
    it("Harus mengembalikan pesan sukses jika semua proses berhasil", async () => {
      supabaseAuth.auth.setSession.mockResolvedValue({ data: {}, error: null });
      supabaseAuth.auth.updateUser.mockResolvedValue({ data: {}, error: null });

      const result = await authService.resetPassword(validToken, validRefresh, validNewPass);

      expect(supabaseAuth.auth.setSession).toHaveBeenCalledWith({
        access_token: validToken,
        refresh_token: validRefresh,
      });

      expect(supabaseAuth.auth.updateUser).toHaveBeenCalledWith({
        password: validNewPass,
      });

      expect(result).toEqual({ message: "Password berhasil diubah." });
    });
  });
});
