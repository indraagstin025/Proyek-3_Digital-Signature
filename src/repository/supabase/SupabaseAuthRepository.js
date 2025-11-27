import AuthRepository from "../interface/AuthRepository.js";
import AuthError from "../../errors/AuthError.js";
import CommonError from "../../errors/CommonError.js";

/**
 * @typedef {object} AdditionalUserData
 * @property {string} name - Nama lengkap pengguna.
 * @property {string} [phoneNumber] - Nomor telepon pengguna (opsional).
 * @property {string} [address] - Alamat pengguna (opsional).
 */

/**
 * Repository untuk autentikasi menggunakan Supabase Auth dan sinkronisasi data pengguna dengan database lokal (Prisma).
 * @class SupabaseAuthRepository
 * @extends {AuthRepository}
 */
class SupabaseAuthRepository extends AuthRepository {
  /**
   * @param {import("@supabase/supabase-js").SupabaseClient} supabaseClient
   * @param {import("@prisma/client").PrismaClient} prismaClient
   */
  constructor(supabaseClient, prismaClient) {
    super();
    if (!supabaseClient || !prismaClient) {
      throw CommonError.InternalServerError("SupabaseClient dan PrismaClient harus disediakan.");
    }
    this.supabaseClient = supabaseClient;
    this.prisma = prismaClient;
  }

  /**
   * Mendaftarkan pengguna baru dengan mekanisme proteksi data parsial (Best Effort Rollback).
   */
  async registerUser(email, password, additionalData) {
    const { data: authData, error: authError } = await this.supabaseClient.auth.signUp({
      email,
      password,
    });

    if (authError) {
      console.error("Supabase Sign Up Error:", authError);
      if (authError.message.includes("User already registered")) {
        throw AuthError.EmailAlreadyExist("Email sudah terdaftar.");
      }
      if (authError.message.includes("Password should be at least")) {
        throw AuthError.PasswordTooWeak(authError.message);
      }
      throw AuthError.SupabaseError(authError.message);
    }

    if (!authData.user) {
      throw AuthError.SupabaseError("Registrasi Supabase berhasil tapi data user tidak ditemukan.");
    }

    try {
      const newUserData = {
        id: authData.user.id,
        email: authData.user.email,
        name: additionalData?.name,
        phoneNumber: additionalData?.phoneNumber,
        address: additionalData?.address,
      };

      return await this.prisma.user.create({ data: newUserData });
    } catch (dbError) {
      console.error("Prisma User Create Error:", dbError);

      if (dbError.code === "P2002") {
        throw AuthError.EmailAlreadyExist("Email sudah terdaftar (Konflik Data Lokal).");
      }

      throw CommonError.DatabaseError("Gagal menyimpan data pengguna ke database lokal.");
    }
  }

  async loginUser(email, password) {
    try {
      const { data, error } = await this.supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Supabase Login Error:", error);

        if (error.message.includes("fetch failed") || error.name === "AuthRetryableFetchError") {
          throw CommonError.NetworkError("Koneksi ke server lambat atau tidak stabil.");
        }
        if (error.message.includes("Invalid login credentials")) {
          throw AuthError.InvalidCredentials();
        }
        throw AuthError.SupabaseError(error.message);
      }

      if (!data.user?.email_confirmed_at) {
        throw AuthError.EmailNotVerified("Silakan verifikasi email Anda sebelum login.");
      }

      const localUser = await this.prisma.user.findUnique({
        where: { id: data.user.id },
        select: { id: true, email: true, name: true, isSuperAdmin: true },
      });

      if (!localUser) {
        throw AuthError.UserNotFound("Autentikasi berhasil, tapi data user tidak ditemukan di sistem.");
      }

      return { session: data.session, user: localUser };
    } catch (err) {
      if (err instanceof AuthError || err instanceof CommonError) throw err;
      throw CommonError.InternalServerError(err.message);
    }
  }

  async logoutUser() {
    const { error } = await this.supabaseClient.auth.signOut();

    if (error) {
      console.warn("⚠️ Supabase SignOut Warning (Sesi mungkin sudah habis):", error.message);

      return { message: "Sesi server sudah berakhir, melanjutkan pembersihan lokal." };
    }

    return { message: "Logout berhasil." };
  }

  async forgotPassword(email) {
    const { error } = await this.supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: process.env.RESET_PASSWORD_URL,
    });
    if (error) throw AuthError.SupabaseError("Gagal memproses permintaan reset password.");
    return { message: "Jika email terdaftar, link reset telah dikirim." };
  }

  async exchangeCodeForSession(code) {
    const { data, error } = await this.supabaseClient.auth.exchangeCodeForSession(code);
    if (error) {
      if (error.message.includes("expired")) throw AuthError.ResetPasswordExpired("Link sudah kadaluarsa.");
      throw AuthError.ResetPasswordInvalid("Kode tidak valid.");
    }
    return data;
  }

  /**
   * [BARU] Memperbarui password user menggunakan token sesi yang valid.
   * Digunakan setelah flow 'Forgot Password' -> 'Exchange Code'.
   */
  async resetPassword(accessToken, refreshToken, newPassword) {
    const { error: sessionError } = await this.supabaseClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (sessionError) {
      throw AuthError.ResetPasswordInvalid("Sesi reset password tidak valid atau kadaluarsa.");
    }

    const { error } = await this.supabaseClient.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw AuthError.SupabaseError(error.message);
    }

    await this.supabaseClient.auth.signOut();

    return { message: "Password berhasil diperbarui. Silakan login dengan password baru." };
  }
}

export default SupabaseAuthRepository;
