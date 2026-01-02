import { createAuthController } from "../../src/controllers/authController.js";
import { jest } from "@jest/globals";

/**
 * Unit Test untuk AuthController
 */
describe("AuthController", () => {
  let mockAuthService;
  let authController;
  let req;
  let res;
  let next;

  /**
   * Setup sebelum setiap test dijalankan
   * - Membuat mock service
   * - Membuat instance controller
   * - Membuat mock response & next
   */
  beforeEach(() => {
    mockAuthService = {
      registerUser: jest.fn(),
      loginUser: jest.fn(),
      logoutUser: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
    };

    authController = createAuthController(mockAuthService);

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    next = jest.fn();
  });

  /**
   * Test: Register User
   * - Harus mengembalikan status 201 dan data user
   */
  it("Register: Harus mengembalikan status 201 dan data user", async () => {
    req = {
      body: {
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
        phoneNumber: "08123456789",
        address: "Jl. Test No. 1",
      },
    };

    const mockCreatedUser = {
      id: "user-id-123",
      name: "Test User",
      email: "test@example.com",
    };

    mockAuthService.registerUser.mockResolvedValue(mockCreatedUser);

    await authController.register(req, res, next);

    expect(mockAuthService.registerUser).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ email: "test@example.com" }),
      })
    );
  });

  /**
   * Test: Login
   * - Harus men-set cookie header
   * - Mengembalikan status 200
   */
  it("Login: Harus set cookie header dan return status 200", async () => {
    req = {
      body: {
        email: "user@example.com",
        password: "SecretPassword123!",
      },
    };

    const mockSession = {
      access_token: "mock-access-token-123",
      refresh_token: "mock-refresh-token-456",
      expires_in: 3600,
    };

    const mockUser = {
      id: "user-id-123",
      email: "user@example.com",
      name: "Test User",
    };

    mockAuthService.loginUser.mockResolvedValue({
      session: mockSession,
      user: mockUser,
    });

    await authController.login(req, res, next);

    expect(mockAuthService.loginUser).toHaveBeenCalledWith("user@example.com", "SecretPassword123!");
    expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", expect.any(Array));

    const cookieArgs = res.setHeader.mock.calls[0][1];
    expect(JSON.stringify(cookieArgs)).toContain("sb-access-token");
    expect(JSON.stringify(cookieArgs)).toContain("sb-refresh-token");

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Login berhasil",
      data: { user: mockUser },
    });
  });

  /**
   * Test: Logout
   * - Harus memanggil service logout
   * - Menghapus cookie
   * - Mengembalikan status 200
   */
  it("Logout: Harus memanggil service logout, menghapus cookie, dan return status 200", async () => {
    req = {};

    mockAuthService.logoutUser.mockResolvedValue();

    await authController.logout(req, res, next);

    expect(mockAuthService.logoutUser).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", expect.any(Array));

    const cookieArgs = res.setHeader.mock.calls[0][1];

    expect(cookieArgs[0]).toContain("sb-access-token=;");
    expect(cookieArgs[1]).toContain("sb-refresh-token=;");
    expect(cookieArgs[0]).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Anda telah berhasil Logout.",
    });
  });

  /**
   * Test: Forgot Password
   * - Harus memanggil service
   * - Mengembalikan pesan umum (demi keamanan)
   */
  it("Forgot Password: Harus memanggil service dan return pesan umum (security)", async () => {
    req = {
      body: {
        email: "lupa@example.com",
      },
    };

    mockAuthService.forgotPassword.mockResolvedValue({
      message: "Jika email terdaftar, link reset telah dikirim.",
    });

    await authController.forgotPassword(req, res, next);

    expect(mockAuthService.forgotPassword).toHaveBeenCalledWith("lupa@example.com");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Jika email terdaftar, link reset password sudah dikirim ke email Anda.",
    });
  });

  /**
   * Test: Reset Password
   * - Memanggil service dengan token dan password baru
   * - Return status 200
   */
  it("Reset Password: Harus memanggil service dengan token dan password baru, lalu return status 200", async () => {
    req = {
      body: {
        accessToken: "valid-access-token",
        refreshToken: "valid-refresh-token",
        newPassword: "NewStrongPassword123!",
      },
    };

    const mockResult = { message: "Password berhasil diperbarui." };

    mockAuthService.resetPassword.mockResolvedValue(mockResult);

    await authController.resetPassword(req, res, next);

    expect(mockAuthService.resetPassword).toHaveBeenCalledWith("valid-access-token", "valid-refresh-token", "NewStrongPassword123!");

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Password berhasil diperbarui.",
    });
  });

  /**
   * Test: Login production mode + token size logging
   * - Harus skip console.log jika NODE_ENV = production
   */
  it("Login: Harus skip token size logging jika production mode", async () => {
    const oldEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    req = {
      body: {
        email: "user@example.com",
        password: "Password123!",
      },
    };

    const mockSession = {
      access_token: "token-123",
      refresh_token: "refresh-456",
      expires_in: 3600,
    };

    mockAuthService.loginUser.mockResolvedValue({
      session: mockSession,
      user: { id: "user-1", email: "user@example.com" },
    });

    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    await authController.login(req, res, next);

    // Jangan log jika production
    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining("[AUTH] Login Token Size"));

    consoleSpy.mockRestore();
    process.env.NODE_ENV = oldEnv;
  });

  /**
   * Test: Login dengan token size logging (development)
   */
  it("Login: Harus log token size jika development mode", async () => {
    const oldEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    req = {
      body: {
        email: "user@example.com",
        password: "Password123!",
      },
    };

    const mockSession = {
      access_token: "token-with-content-123",
      refresh_token: "refresh-456",
      expires_in: 3600,
    };

    mockAuthService.loginUser.mockResolvedValue({
      session: mockSession,
      user: { id: "user-1", email: "user@example.com" },
    });

    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    await authController.login(req, res, next);

    // Harus log size di development
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[AUTH] Login Token Size"));

    consoleSpy.mockRestore();
    process.env.NODE_ENV = oldEnv;
  });

  /**
   * Test: Login dengan cookie domain konfigurasi
   */
  it("Login: Harus include domain jika production dan COOKIE_DOMAIN set", async () => {
    const oldEnv = process.env.NODE_ENV;
    const oldDomain = process.env.COOKIE_DOMAIN;
    process.env.NODE_ENV = "production";
    process.env.COOKIE_DOMAIN = "example.com";

    req = {
      body: {
        email: "user@example.com",
        password: "Password123!",
      },
    };

    const mockSession = {
      access_token: "token-123",
      refresh_token: "refresh-456",
      expires_in: 3600,
    };

    mockAuthService.loginUser.mockResolvedValue({
      session: mockSession,
      user: { id: "user-1", email: "user@example.com" },
    });

    await authController.login(req, res, next);

    const cookieArgs = res.setHeader.mock.calls[0][1];
    // Check bahwa domain included dalam cookie
    expect(JSON.stringify(cookieArgs)).toContain("Domain=example.com");

    process.env.NODE_ENV = oldEnv;
    process.env.COOKIE_DOMAIN = oldDomain;
  });

  /**
   * Test: Login tanpa cookie domain di development
   */
  it("Login: Harus tidak include domain jika development", async () => {
    const oldEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    req = {
      body: {
        email: "user@example.com",
        password: "Password123!",
      },
    };

    const mockSession = {
      access_token: "token-123",
      refresh_token: "refresh-456",
      expires_in: 3600,
    };

    mockAuthService.loginUser.mockResolvedValue({
      session: mockSession,
      user: { id: "user-1", email: "user@example.com" },
    });

    await authController.login(req, res, next);

    const cookieArgs = res.setHeader.mock.calls[0][1];
    // Check bahwa domain TIDAK included
    expect(JSON.stringify(cookieArgs)).not.toContain("Domain=");

    process.env.NODE_ENV = oldEnv;
  });

  /**
   * Test: Logout dengan cookie options
   */
  it("Logout: Harus clear cookies dengan maxAge -1", async () => {
    req = {};

    mockAuthService.logoutUser.mockResolvedValue();

    await authController.logout(req, res, next);

    const cookieArgs = res.setHeader.mock.calls[0][1];

    // Verify maxAge = -1 untuk clear cookies
    expect(JSON.stringify(cookieArgs)).toContain("Max-Age=-1");
  });
});
