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

  if (!accessToken && !refreshToken) {
    throw AuthError.MissingToken("Sesi tidak ditemukan. Silakan login.");
  }

  let supabaseUser = null;

  if (accessToken) {
    const { data, error } = await supabaseAuth.auth.getUser(accessToken);

    if (!error && data?.user) {
      supabaseUser = data.user;
    } else if (error) {
      const msg = error.message?.toLowerCase() || "";
      const isExpired = msg.includes("jwt expired") || msg.includes("token is expired");

      if (isExpired) {
        supabaseUser = null;
      } else {
        console.error("❌ Supabase Auth Reject:", msg);
        throw AuthError.InvalidToken("Token otentikasi tidak valid.");
      }
    }
  }

  if (!supabaseUser && refreshToken) {
    try {
      const { data, error } = await supabaseAuth.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error || !data.session) {
        throw AuthError.SessionExpired("Sesi berakhir. Silakan login kembali.");
      }

      supabaseUser = data.user;

      const isProduction = process.env.NODE_ENV === "production";

      const cookieOptions = {
        httpOnly: true,
        path: "/",

        secure: isProduction,

        sameSite: isProduction ? "none" : "lax",
      };

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
    } catch (refreshError) {
      throw AuthError.SessionExpired("Sesi Anda telah berakhir total. Silakan login kembali.");
    }
  }

  if (!supabaseUser) {
    throw AuthError.InvalidToken("Gagal memverifikasi identitas pengguna.");
  }

  const localUser = await prisma.user.findUnique({
    where: { id: supabaseUser.id },
    select: {
      id: true,
      email: true,
      name: true,
      isSuperAdmin: true,
    },
  });

  if (!localUser) {
    throw AuthError.UserNotFound("Akun pengguna valid, namun data tidak ditemukan di sistem kami.");
  }

  req.user = {
    id: localUser.id,
    email: localUser.email,
    name: localUser.name,
    role: localUser.isSuperAdmin ? "super_admin" : "basic_user",
  };

  next();
});

export default authMiddleware;
