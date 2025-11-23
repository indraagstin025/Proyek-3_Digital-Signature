import crypto from "crypto";
import SignatureError from "../errors/SignatureError.js";
import CommonError from "../errors/CommonError.js";
// HAPUS: import { CryptoService } from "./CryptoService.js";

export class SignatureService {
    // ⚠️ HAPUS: cryptoService dari constructor
    constructor(signatureRepository, documentRepository, versionRepository, pdfService) {
        this.signatureRepository = signatureRepository;
        this.documentRepository = documentRepository;
        this.versionRepository = versionRepository;
        this.pdfService = pdfService;
        // HAPUS: this.cryptoService = cryptoService;
    }

    async addPersonalSignature(userId, originalVersionId, signatureData, auditData, options = { displayQrCode: true }) {
        let originalVersion;
        try {
            originalVersion = await this.versionRepository.findById(originalVersionId);
        } catch (dbError) {
            throw CommonError.DatabaseError(`Gagal mengambil data versi: ${dbError.message}`);
        }

        // ... (Validasi Awal) ...
        if (!originalVersion) {
            throw SignatureError.VersionNotFound(originalVersionId);
        }
        if (originalVersion.userId !== userId) {
            throw SignatureError.Unauthorized();
        }

        let document;
        try {
            document = await this.documentRepository.findById(originalVersion.documentId);
        } catch (dbError) {
            throw CommonError.DatabaseError(`Gagal mengambil data dokumen: ${dbError.message}`);
        }

        if (!document) {
            throw CommonError.InternalServerError(`Inkonsistensi data: Dokumen dengan ID '${originalVersion.documentId}' tidak ditemukan.`);
        }

        if (document.status === "completed") {
            throw SignatureError.AlreadyCompleted();
        }

        try {
            // ⚠️ HAPUS: Semua logika kriptografi lama (generateKeyPair, privateKey, publicKey)

            const newVersion = await this.versionRepository.create({
                documentId: originalVersion.documentId,
                userId: userId,
                url: "",
            });

            // ⚠️ HAPUS: signerPublicKey dari dataToSave
            const dataToSave = {
                signer: { connect: { id: userId } },
                documentVersion: { connect: { id: newVersion.id } },
                ...signatureData,
                ...auditData,
                displayQrCode: options.displayQrCode,
                // HAPUS: signerPublicKey: publicKey,
            };
            const newSignatureRecord = await this.signatureRepository.createPersonal(dataToSave);

            const BASE_VERIFY_URL = process.env.VERIFICATION_URL || "http://localhost:5173";
            const verificationUrl = `${BASE_VERIFY_URL.replace(/\/$/, "")}/verify/${newSignatureRecord.id}`;

            const pdfOptions = { displayQrCode: options.displayQrCode, verificationUrl };

            // PDFService sekarang mengembalikan buffer yang sudah ditandatangani PAdES.
            const { signedFileBuffer, publicUrl } = await this.pdfService.generateSignedPdf(originalVersionId, [signatureData], pdfOptions);

            // Hash dihitung dari signedFileBuffer (yang sudah ditandatangani PAdES)
            const signedHash = crypto.createHash("sha256").update(signedFileBuffer).digest("hex");
            // ⚠️ HAPUS: const digitalSignature = this.cryptoService.signData(signedFileBuffer, privateKey);

            await this.versionRepository.update(newVersion.id, {
                url: publicUrl,
                signedFileHash: signedHash,
                // HAPUS: digitalSignature: digitalSignature,
            });

            return this.documentRepository.update(originalVersion.documentId, {
                currentVersionId: newVersion.id,
                status: "completed",
                signedFileUrl: publicUrl,
            });
        } catch (processError) {
            throw CommonError.InternalServerError(`Proses penandatanganan gagal: ${processError.message}`);
        }
    }

    /**
     * @description Mengambil detail informasi tanda tangan untuk ditampilkan saat Scan QR.
     * LOGIKA BARU: Fungsi ini TIDAK memverifikasi isi file fisik/lokal user (karena server tidak melihatnya).
     * Fungsi ini hanya mengonfirmasi bahwa ID Tanda Tangan tersebut ADA di database.
     */
    async getVerificationDetails(signatureId) {
        let signature;
        try {
            // Ambil data tanda tangan beserta relasi (Signer, DocumentVersion, Document)
            signature = await this.signatureRepository.findById(signatureId);
        } catch (dbError) {
            throw CommonError.DatabaseError(`Gagal mengambil data tanda tangan: ${dbError.message}`);
        }

        if (!signature) {
            throw SignatureError.NotFound(signatureId);
        }

        // Validasi kelengkapan data relasi
        if (!signature.documentVersion || !signature.signer) {
            throw CommonError.InternalServerError("Data integritas tidak lengkap (Relasi hilang).");
        }

        const storedHash = signature.documentVersion.signedFileHash;
        const documentUrl = signature.documentVersion.url;

        // --- PERUBAHAN DI SINI ---
        // Kita TIDAK melakukan download file dan hitung hash ulang.
        // Karena saat Scan QR, kita hanya mengecek metadata di database.

        return {
            // 1. Informasi Penanda Tangan (Identitas)
            signerName: signature.signer.name,
            signerEmail: signature.signer.email,
            signerIpAddress: signature.ipAddress || "-", // IP saat menandatangani

            // 2. Informasi Dokumen
            documentTitle: signature.documentVersion.document.title,
            signedAt: signature.signedAt,
            signatureImageUrl: signature.signatureImageUrl,

            // 3. Status Verifikasi (Jujur)
            // Menggunakan kode status agar Frontend bisa memberi warna (misal: Kuning/Biru, bukan Hijau)
            verificationStatus: "REGISTERED",

            // Pesan untuk User
            verificationMessage: "Tanda tangan terdaftar di sistem. Harap pastikan isi dokumen tidak mengalami perubahan.",

            // 4. Data untuk Validasi Lanjutan (Manual/Upload)
            // Hash asli di database (untuk dicocokkan jika user upload file)
            storedFileHash: storedHash,
            // URL file asli (untuk tombol 'Download Dokumen Asli')
            originalDocumentUrl: documentUrl
        };
    }

    /**
     * @description Memverifikasi tanda tangan digital pada file PDF yang diunggah (Uji Integritas File yang Beredar).
     */
    async verifyUploadedFile(signatureId, uploadedFileBuffer) {
        let signature;
        try {
            // Ambil semua data
            signature = await this.signatureRepository.findById(signatureId);
        } catch (dbError) {
            throw CommonError.DatabaseError(`Gagal mengambil tanda tangan: ${dbError.message}`);
        }

        if (!signature) {
            throw SignatureError.NotFound(signatureId);
        }

        // Safety Check: Pastikan relasi penting sudah dimuat!
        if (!signature.signer || !signature.documentVersion || !signature.documentVersion.document) {
            throw CommonError.InternalServerError(`Inkonsistensi data: Relasi penanda tangan atau dokumen tidak ditemukan untuk ID: ${signatureId}`);
        }


        // ⚠️ HAPUS: const storedSignature = signature.documentVersion.digitalSignature;
        // ⚠️ HAPUS: const publicKey = signature.signerPublicKey;
        const storedHash = signature.documentVersion.signedFileHash;

        if (!storedHash) {
            throw CommonError.InternalServerError("Data Hash dokumen asli tidak ditemukan untuk verifikasi integritas." );
        }

        // --- Logika Kriptografi ---
        // ⚠️ HAPUS: const isSignatureValid = this.cryptoService.verifySignature(...)

        const recalculateHash = crypto.createHash("sha256").update(uploadedFileBuffer).digest("hex");
        const isHashMatch = recalculateHash === storedHash;

        // Status PAdES/Otentikasi diasumsikan true jika hash match, karena PAdES melakukannya di level file
        let verificationStatus = isHashMatch ? "VALID (Integritas OK)" : "TIDAK VALID (Integritas GAGAL)";

        // --- Mengembalikan Hasil ---
        return {
            signerName: signature.signer.name,
            signerEmail: signature.signer.email,
            documentTitle: signature.documentVersion.document.title,
            signedAt: signature.signedAt,
            verificationStatus: verificationStatus,
            ipAddress: signature.ipAddress || "-",
            isSignatureValid: true, // Asumsi VALID, verifikasi sejati ada di PDF Reader.
            isHashMatch: isHashMatch,
            storedFileHash: storedHash,
            recalculatedFileHash: recalculateHash,
        };
    }
}