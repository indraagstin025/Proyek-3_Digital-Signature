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
 *
 * @class SupabaseAuthRepository
 * @extends {AuthRepository}
 */
class SupabaseAuthRepository extends AuthRepository {
    /**
     * Menginisialisasi SupabaseAuthRepository.
     *
     * @param {import("@supabase/supabase-js").SupabaseClient} supabaseClient - Instance Supabase client yang sudah terkonfigurasi.
     * @param {import("@prisma/client").PrismaClient} prismaClient - Instance Prisma client untuk operasi database lokal.
     * @throws {CommonError.InternalServerError} Jika salah satu instance klien tidak disediakan.
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


    /**
     * Mendaftarkan pengguna baru di Supabase Auth dan menyimpan data pengguna ke database lokal (Prisma).
     *
     * @param {string} email - Email pengguna.
     * @param {string} password - Password pengguna.
     * @param {AdditionalUserData} additionalData - Data tambahan pengguna (nama, nomor telepon, alamat).
     * @returns {Promise<object>} Data pengguna dari database lokal yang berhasil dibuat.
     * @throws {AuthError.EmailAlreadyExist} Jika email sudah terdaftar di Supabase atau Prisma.
     * @throws {AuthError.PasswordTooWeak} Jika password tidak memenuhi kriteria Supabase.
     * @throws {AuthError.SupabaseError} Jika terjadi error spesifik Supabase lainnya.
     * @throws {CommonError.DatabaseError} Jika terjadi error saat menyimpan data ke Prisma.
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

            return await this.prisma.user.create({ data: newUserData });
        } catch (dbError) {
            console.error("Prisma User Create Error:", dbError);

            if (dbError.code === "P2002" && dbError.meta?.target?.includes("email")) {
                // Walaupun Supabase sudah check, ini adalah double check di level DB lokal
                throw AuthError.EmailAlreadyExist("Email sudah terdaftar.");
            }

            throw CommonError.DatabaseError(
                dbError.message || "Gagal menyimpan data pengguna ke database lokal."
            );
        }
    }


    /**
     * Melakukan login pengguna menggunakan email dan password melalui Supabase Auth.
     *
     * @param {string} email - Email pengguna.
     * @param {string} password - Password pengguna.
     * @returns {Promise<{session: object, user: object}>} Objek yang berisi session aktif Supabase dan data pengguna lokal yang terseleksi.
     * @throws {AuthError.InvalidCredentials} Jika kombinasi email/password salah.
     * @throws {AuthError.UserNotFound} Jika data pengguna tidak ditemukan di database lokal.
     * @throws {AuthError.EmailNotVerified} Jika email belum diverifikasi.
     * @throws {CommonError.NetworkError} Jika terjadi masalah koneksi saat menghubungi Supabase.
     * @throws {AuthError.SupabaseError} Jika terjadi error spesifik Supabase lainnya.
     * @throws {CommonError.InternalServerError} Untuk error tak terduga lainnya.
     */
    async loginUser(email, password) {
        try {
            const { data, error } = await this.supabaseClient.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                console.error("Supabase Login Error:", error);

                if (
                    error.message.includes("fetch failed") ||
                    error.status === 0 ||
                    error.name === 'AuthRetryableFetchError'
                ) {
                    throw CommonError.NetworkError("Koneksi ke server lambat atau tidak stabil, Silahkan coba lagi beberapa saat.");
                }

                if (error.message.includes("Invalid login credentials")) {
                    throw AuthError.InvalidCredentials();
                }

                throw AuthError.SupabaseError(error.message);
            }

            if (!data.user || !data.session) {
                throw AuthError.UserNotFound();
            }

            if (!data.user.email_confirmed_at) {
                throw AuthError.EmailNotVerified("Silakan verifikasi email Anda sebelum login.");
            }

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
            // Jika error sudah dikenali (instance dari AuthError atau CommonError), teruskan
            if (err instanceof AuthError || err instanceof CommonError) throw err;

            console.error("Unexpected Login Error:", err);

            // Fallback untuk error yang di-throw oleh sistem
            if (err.message?.includes("fetch failed") || err.code === 'ENOTFOUND') {
                throw CommonError.NetworkError("Gagal menghubungi server autentikasi (Supabase).");
            }

            throw CommonError.InternalServerError(err.message);
        }
    }


    /**
     * Melakukan logout pengguna dari Supabase (menghapus sesi di sisi server dan lokal).
     *
     * @returns {Promise<{message: string}>} Pesan konfirmasi logout.
     * @throws {AuthError.SupabaseError} Jika terjadi kesalahan saat proses logout di Supabase.
     */
    async logoutUser() {
        const { error } = await this.supabaseClient.auth.signOut();

        if (error) {
            throw AuthError.SupabaseError("Terjadi kesalahan saat proses logout.");
        }

        return { message: "Logout berhasil." };
    }


    /**
     * Mengirimkan email untuk memulai proses reset password pengguna.
     *
     * @param {string} email - Email pengguna yang meminta reset password.
     * @returns {Promise<{message: string}>} Pesan konfirmasi bahwa email reset telah dikirim (jika email terdaftar).
     * @throws {AuthError.SupabaseError} Jika gagal memproses permintaan reset password.
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

    /**
     * Menukarkan kode verifikasi dari URL (biasanya setelah reset password) menjadi sesi aktif.
     *
     * @param {string} code - Kode verifikasi dari URL.
     * @returns {Promise<{user: object, session: object}>} Sesi dan data pengguna yang sesuai.
     * @throws {AuthError.ResetPasswordExpired} Jika tautan reset password sudah kadaluarsa.
     * @throws {AuthError.ResetPasswordInvalid} Jika kode verifikasi tidak valid atau gagal mendapatkan sesi.
     */
    async exchangeCodeForSession(code) {
        const { data, error } = await this.supabaseClient.auth.exchangeCodeForSession(code);

        if (error) {
            console.error("Supabase Exchange Code Error:", error);
            if (error.message.includes("expired")) {
                throw AuthError.ResetPasswordExpired("Tautan reset password sudah kadaluarsa.");
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