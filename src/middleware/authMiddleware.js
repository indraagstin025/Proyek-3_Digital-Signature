import supabaseAuth from "../config/supabaseAuth.js";
import prisma from "../config/prismaClient.js";
import AuthError from "../errors/AuthError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { serialize } from "cookie";

/**
 * Middleware untuk memproteksi rute privat.
 * Melakukan verifikasi token JWT Supabase, sinkronisasi dengan database lokal,
 * dan otomatis memperbarui token (Auto-Refresh) jika token akses kadaluwarsa.
 */
const authMiddleware = asyncHandler(async (req, res, next) => {
  let accessToken = req.cookies["sb-access-token"];
  const refreshToken = req.cookies["sb-refresh-token"];

  // 1. Cek Kelengkapan Token
  if (!accessToken && !refreshToken) {
    throw AuthError.MissingToken("Sesi tidak ditemukan. Silakan login.");
  }

  let supabaseUser = null;

  // 2. Cek Validitas Access Token (Jika ada)
  if (accessToken) {
    const { data, error } = await supabaseAuth.auth.getUser(accessToken);

    if (!error && data?.user) {
      supabaseUser = data.user;
    } else if (error) {
      const msg = error.message?.toLowerCase() || "";
      // Jika expired, biarkan lanjut ke logika refresh di bawah
      const isExpired = msg.includes("jwt expired") || msg.includes("token is expired");

      if (isExpired) {
        supabaseUser = null; // Reset user agar masuk ke logika refresh
      } else {
        console.error("❌ Supabase Auth Reject:", msg);
        throw AuthError.InvalidToken("Token otentikasi tidak valid.");
      }
    }
  }

  // 3. Logika Auto-Refresh (JANTUNG MASALAH SEBELUMNYA)
  if (!supabaseUser && refreshToken) {
    try {
      const { data, error } = await supabaseAuth.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error || !data.session) {
        throw AuthError.SessionExpired("Sesi berakhir. Silakan login kembali.");
      }

      supabaseUser = data.user;

      // --- PERBAIKAN PENTING DI SINI ---
      const isProduction = process.env.NODE_ENV === "production";
      const cookieDomain = process.env.COOKIE_DOMAIN; // Ambil dari .env (.moodvis.my.id)

      const cookieOptions = {
        httpOnly: true,
        path: "/",
        secure: isProduction,

        // GUNAKAN 'lax' agar konsisten dengan AuthController
        sameSite: "lax",

        // WAJIB: Tambahkan domain agar cookie baru bisa dibaca Frontend (www)
        domain: isProduction && cookieDomain ? cookieDomain : undefined,
      };

      // Set Cookie Baru dengan konfigurasi yang BENAR
      res.setHeader("Set-Cookie", [
        serialize("sb-access-token", data.session.access_token, {
          ...cookieOptions,
          maxAge: data.session.expires_in,
        }),
        serialize("sb-refresh-token", data.session.refresh_token, {
          ...cookieOptions,
          maxAge: 60 * 60 * 24 * 7,
        }),
      ]);

      // Update variable accessToken di memori agar request ini bisa lanjut
      accessToken = data.session.access_token;

    } catch (refreshError) {
      console.error("Refresh Error:", refreshError);
      // Hapus cookie jika refresh gagal total agar client tau harus login ulang
      res.setHeader("Set-Cookie", [
        serialize("sb-access-token", "", { maxAge: -1, path: '/' }),
        serialize("sb-refresh-token", "", { maxAge: -1, path: '/' })
      ]);
      throw AuthError.SessionExpired("Sesi Anda telah berakhir total. Silakan login kembali.");
    }
  }

  if (!supabaseUser) {
    throw AuthError.InvalidToken("Gagal memverifikasi identitas pengguna.");
  }

  // 4. Sinkronisasi dengan Database Lokal (Prisma)
  const localUser = await prisma.user.findUnique({
    where: { id: supabaseUser.id },
    select: {
      id: true,
      email: true,
      name: true,
      isSuperAdmin: true, // Pastikan field ini ada di schema prisma Anda
    },
  });

  if (!localUser) {
    throw AuthError.UserNotFound("Akun pengguna valid, namun data tidak ditemukan di sistem kami.");
  }

  // 5. Attach user ke Request Object
  req.user = {
    id: localUser.id,
    email: localUser.email,
    name: localUser.name,
    role: localUser.isSuperAdmin ? "super_admin" : "basic_user",
    token: accessToken // Opsional: Simpan token jika butuh diteruskan ke service lain
  };

  next();
});

export default authMiddleware;