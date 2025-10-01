import AuthRepository from "../interface/AuthRepository.js";
import AuthError from "../../errors/AuthError.js";
import CommonError from "../../errors/CommonError.js";

/**
 * @class SupabaseAuthRepository
 * @extends {AuthRepository}
 * @description Implementasi AuthRepository menggunakan Supabase Auth + Prisma.
 * Layer ini bertanggung jawab untuk:
 * - Menghubungkan ke Supabase Auth untuk autentikasi.
 * - Menyimpan dan sinkronisasi data user ke database lokal melalui Prisma.
 * - Menerjemahkan error dari Supabase/Prisma ke AuthError/CommonError.
 */
class SupabaseAuthRepository extends AuthRepository {
  /**
   * @param {import("@supabase/supabase-js").SupabaseClient} supabaseClient - Instance Supabase client
   * @param {import("@prisma/client").PrismaClient} prismaClient - Instance Prisma client
   */
  constructor(supabaseClient, prismaClient) {
    super();
    if (!supabaseClient) throw CommonError.InternalServerError("SupabaseClient harus disediakan.");
    if (!prismaClient) throw CommonError.InternalServerError("PrismaClient harus disediakan.");

    this.supabaseClient = supabaseClient;
    this.prisma = prismaClient;
  }

  /**
   * @description Mendaftarkan user baru di Supabase Auth dan menyimpannya di database lokal.
   * @param {string} email - Email pengguna
   * @param {string} password - Password pengguna
   * @param {{name: string, phoneNumber?: string, address?: string}} additionalData - Data tambahan pengguna
   * @returns {Promise<object>} Data pengguna yang berhasil dibuat
   * @throws {AuthError.EmailAlreadyExist|AuthError.PasswordTooWeak|CommonError.DatabaseError}
   */
  async registerUser(email, password, additionalData) {
    try {
      const { data: authData, error: authError } = await this.supabaseClient.auth.signUp({
        email,
        password,
      });

      if (authError) {
        if (authError.message.includes("User already registered")) {
          throw AuthError.EmailAlreadyExist();
        }
        if (authError.message.includes("Password should be at least")) {
          throw AuthError.PasswordTooWeak(authError.message);
        }
        throw AuthError.SupabaseError(authError.message);
      }

      if (!authData.user) {
        throw AuthError.SupabaseError("Registrasi Supabase berhasil tapi user tidak ditemukan.");
      }

      const newUserData = {
        id: authData.user.id,
        email: authData.user.email,
        name: additionalData.name,
        phoneNumber: additionalData.phoneNumber,
        address: additionalData.address,
      };

      return await this.prisma.user.create({ data: newUserData });
    } catch (dbError) {
      if (dbError instanceof AuthError) {
        throw dbError;
      }

      if (dbError.config?.data?.authData?.user?.id) {
        await this.supabaseClient.auth.admin.deleteUser(dbError.config.data.authData.user.id);
      }
      throw CommonError.DatabaseError("Gagal menyimpan data pengguna ke database lokal.");
    }
  }

  /**
   * @description Melakukan login user melalui Supabase Auth.
   * @param {string} email - Email pengguna
   * @param {string} password - Password pengguna
   * @returns {Promise<{session: object, user: object}>} Session aktif dan data pengguna
   * @throws {AuthError.InvalidCredentials|AuthError.UserNotFound|CommonError.NetworkError}
   */
  async loginUser(email, password) {
    try {
      const { data, error } = await this.supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          throw AuthError.InvalidCredentials();
        }
        throw AuthError.SupabaseError(error.message);
      }

      if (!data.user || !data.session) {
        throw AuthError.UserNotFound();
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
      if (err instanceof AuthError) {
        throw err;
      }
      if (err.message?.includes("fetch failed")) {
        throw CommonError.NetworkError("Gagal menghubungi server autentikasi.");
      }
      throw CommonError.InternalServerError(err.message);
    }
  }

  /**
   * @description Melakukan logout user dari Supabase.
   * @returns {Promise<{message: string}>} Pesan konfirmasi logout
   * @throws {AuthError.SupabaseError}
   */
  async logoutUser() {
    const { error } = await this.supabaseClient.auth.signOut();
    if (error) {
      throw AuthError.SupabaseError("Terjadi kesalahan saat proses logout.");
    }
    return { message: "Logout berhasil" };
  }

  /**
   * @description Mengirimkan email untuk reset password pengguna.
   * @param {string} email - Email pengguna
   * @returns {Promise<{message: string}>} Pesan konfirmasi
   * @throws {AuthError.SupabaseError}
   */
  async forgotPassword(email) {
    const { error } = await this.supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: process.env.RESET_PASSWORD_URL,
    });
    if (error) {
      throw AuthError.SupabaseError("Gagal memproses permintaan reset password.");
    }
    return { message: "Jika email terdaftar, link reset terkirim." };
  }

  /**
   * @description Melakukan reset password berdasarkan token Supabase.
   * @param {string} token - Token reset password dari Supabase
   * @param {string} newPassword - Password baru
   * @returns {Promise<{message: string}>} Pesan konfirmasi keberhasilan reset password
   * @throws {AuthError.ResetPasswordExpired|AuthError.ResetPasswordInvalid|AuthError.SupabaseError}
   */
  async resetPassword(token, newPassword) {
    try {
      const { data: userData, error: userError } = await this.supabaseClient.auth.getUser(token);

      if (userError) {
        if (userError.message.includes("expired")) {
          throw AuthError.ResetPasswordExpired();
        }
        throw AuthError.ResetPasswordInvalid();
      }

      const userId = userData.user.id;

      const { error: updateError } = await this.supabaseClient.auth.admin.updateUserById(userId, { password: newPassword });

      if (updateError) {
        throw AuthError.SupabaseError(`Gagal memperbarui password: ${updateError.message}`);
      }

      return { message: "Password berhasil diubah." };
    } catch (err) {
      if (err instanceof AuthError) {
        throw err;
      }
      throw CommonError.InternalServerError(err.message);
    }
  }
}

export default SupabaseAuthRepository;
