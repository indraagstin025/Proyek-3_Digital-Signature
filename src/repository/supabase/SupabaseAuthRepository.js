import AuthRepository from "../interface/AuthRepository.js";
import AuthError from "../../errors/AuthError.js";
import CommonError from "../../errors/CommonError.js";

/**
 * @class SupabaseAuthRepository
 * @extends {AuthRepository}
 * @description
 * Repository untuk autentikasi menggunakan Supabase Auth + Prisma.
 *
 * Tanggung jawab:
 * - Menghubungkan ke Supabase Auth untuk proses login, register, dan reset password.
 * - Menyimpan serta menyinkronkan data pengguna di database lokal (Prisma).
 * - Menerjemahkan error dari Supabase/Prisma ke dalam AuthError atau CommonError.
 */
class SupabaseAuthRepository extends AuthRepository {
    /**
     * @param {import("@supabase/supabase-js").SupabaseClient} supabaseClient - Instance Supabase client
     * @param {import("@prisma/client").PrismaClient} prismaClient - Instance Prisma client
     * @throws {CommonError.InternalServerError} Jika parameter tidak disediakan
     */
    constructor(supabaseClient, prismaClient) {
        super();

        if (!supabaseClient) {
            throw CommonError.InternalServerError("SupabaseClient harus disediakan.");
        }
        if (!prismaClient) {
            throw CommonError.InternalServerError("PrismaClient harus disediakan.");
        }

        this.supabaseClient = supabaseClient;
        this.prisma = prismaClient;
    }

    // ---------------------------------------------------------------------------
    // REGISTER
    // ---------------------------------------------------------------------------

    /**
     * Mendaftarkan pengguna baru di Supabase Auth dan menyimpannya ke database lokal.
     * @param {string} email - Email pengguna
     * @param {string} password - Password pengguna
     * @param {{name: string, phoneNumber?: string, address?: string}} additionalData - Data tambahan pengguna
     * @returns {Promise<object>} Data pengguna yang berhasil dibuat
     * @throws {AuthError.EmailAlreadyExist|AuthError.PasswordTooWeak|CommonError.DatabaseError}
     */
    async registerUser(email, password, additionalData) {
        // 1️⃣ Registrasi ke Supabase
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
            console.error("Supabase Sign Up Error: Auth successful but user data missing.");
            throw AuthError.SupabaseError("Registrasi Supabase berhasil tapi data user tidak ditemukan.");
        }

        try {
            const newUserData = {
                id: authData.user.id,
                email: authData.user.email,
                name: additionalData.name,
                phoneNumber: additionalData.phoneNumber,
                address: additionalData.address,
            };

            // 2️⃣ Simpan ke Database Lokal
            return await this.prisma.user.create({ data: newUserData });
        } catch (dbError) {
            console.error("Prisma User Create Error:", dbError);

            if (dbError.code === "P2002" && dbError.meta?.target?.includes("email")) {
                throw AuthError.EmailAlreadyExist("Email sudah terdaftar.");
            }

            throw CommonError.DatabaseError(
                dbError.message || "Gagal menyimpan data pengguna ke database lokal."
            );
        }
    }

    // ---------------------------------------------------------------------------
    // LOGIN
    // ---------------------------------------------------------------------------

    /**
     * Melakukan login pengguna melalui Supabase Auth.
     * @param {string} email - Email pengguna
     * @param {string} password - Password pengguna
     * @returns {Promise<{session: object, user: object}>} Session aktif dan data pengguna
     * @throws {AuthError.InvalidCredentials|AuthError.UserNotFound|CommonError.NetworkError|AuthError.SupabaseError}
     */
    async loginUser(email, password) {
        try {
            // 1️⃣ Login ke Supabase
            const { data, error } = await this.supabaseClient.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                console.error("Supabase Login Error:", error);

                if (error.message.includes("Invalid login credentials")) {
                    throw AuthError.InvalidCredentials();
                }
                throw AuthError.SupabaseError(error.message);
            }

            if (!data.user || !data.session) {
                throw AuthError.UserNotFound();
            }

            // ✅ Cek email sudah diverifikasi
            if (!data.user.email_confirmed_at) {
                throw AuthError.EmailNotVerified("Silakan verifikasi email Anda sebelum login.");
            }

            // 2️⃣ Ambil data pengguna dari database lokal
            const localUser = await this.prisma.user.findUnique({
                where: { id: data.user.id },
                select: { id: true, email: true, name: true, isSuperAdmin: true },
            });

            if (!localUser) {
                console.error(
                    "Prisma User Find Error: User found in Supabase but not in local DB.",
                    data.user.id
                );
                throw AuthError.UserNotFound("Autentikasi berhasil, tapi data user tidak ditemukan di sistem.");
            }

            return { session: data.session, user: localUser };
        } catch (err) {
            if (err instanceof AuthError) throw err;

            console.error("Unexpected Login Error:", err);

            if (err.message?.includes("fetch failed")) {
                throw CommonError.NetworkError("Gagal menghubungi server autentikasi (Supabase).");
            }

            throw CommonError.InternalServerError(err.message);
        }
    }

    // ---------------------------------------------------------------------------
    // LOGOUT
    // ---------------------------------------------------------------------------

    /**
     * Melakukan logout pengguna dari Supabase.
     * @returns {Promise<{message: string}>} Pesan konfirmasi logout
     * @throws {AuthError.SupabaseError}
     */
    async logoutUser() {
        const { error } = await this.supabaseClient.auth.signOut();

        if (error) {
            throw AuthError.SupabaseError("Terjadi kesalahan saat proses logout.");
        }

        return { message: "Logout berhasil." };
    }

    // ---------------------------------------------------------------------------
    // FORGOT PASSWORD
    // ---------------------------------------------------------------------------

    /**
     * Mengirimkan email untuk reset password pengguna.
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

        return { message: "Jika email terdaftar, link reset telah dikirim." };
    }

    // ---------------------------------------------------------------------------
    // RESET PASSWORD
    // ---------------------------------------------------------------------------
    /**
     * @function exchangeCodeForSession
     * @description Menukarkan 'code' dari link email reset password menjadi session yang valid.
     * @param {string} code - Kode verifikasi dari URL.
     * @returns {Promise<user: object, session: object>} - Session dan data pengguna yang sesuai.
     * @throws {AuthError.ResetPasswordExpired | AuthError.ResetPasswordInvalid}
     */
    async exchangeCodeForSession(code) {
        const { data, error } = await this.supabaseClient.auth.exchangeCodeForSession(code);

        if (error) {
            console.error("Supabase Exchange Code Error:", error);
            if (error.message.includes("expired")) {
                throw AuthError.ResetPasswordExpired("Tautan resetPassword sudah kadaluarsa.");
            }

            throw AuthError.ResetPasswordInvalid("Kode reset password tidak valid atau telah digunakan.");
        }

        if (!data.session || !data.user) {
            throw AuthError.ResetPasswordInvalid("Gagal mendapatkan sesi dari kode yang diberikan.");
        }

        return data;
    }


}

export default SupabaseAuthRepository;
