import crypto from "crypto";
// BARU: Impor semua kelas error yang relevan
import SignatureError from "../errors/SignatureError.js";
import CommonError from "../errors/CommonError.js";

export class SignatureService {
    constructor(signatureRepository, documentRepository, versionRepository, pdfService) {
        this.signatureRepository = signatureRepository;
        this.documentRepository = documentRepository;
        this.versionRepository = versionRepository;
        this.pdfService = pdfService;
    }

    async addPersonalSignature(userId, originalVersionId, signatureData, auditData, options = { displayQrCode: true }) {
        let originalVersion;
        try {
            originalVersion = await this.versionRepository.findById(originalVersionId);
        } catch (dbError) {
            throw CommonError.DatabaseError(`Gagal mengambil data versi: ${dbError.message}`);
        }

        // REFAKTOR: Error dipisah agar lebih jelas dan akurat
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

        // REFAKTOR: Gunakan error yang lebih spesifik jika dokumen tidak ditemukan (seharusnya tidak terjadi)
        if (!document) {
            throw CommonError.InternalServerError(`Inkonsistensi data: Dokumen dengan ID '${originalVersion.documentId}' tidak ditemukan.`);
        }

        // REFAKTOR: Gunakan error yang spesifik untuk aturan bisnis
        if (document.status === "completed") {
            throw SignatureError.AlreadyCompleted();
        }

        // Proses selanjutnya dibungkus dalam try...catch untuk menangani kegagalan penulisan data
        try {
            const newVersion = await this.versionRepository.create({
                documentId: originalVersion.documentId,
                userId: userId,
                url: "",
            });

            const dataToSave = {
                signer: { connect: { id: userId } },
                documentVersion: { connect: { id: newVersion.id } },
                ...signatureData,
                ...auditData,
                displayQrCode: options.displayQrCode,
            };
            const newSignatureRecord = await this.signatureRepository.createPersonal(dataToSave);

            const verificationUrl = `https://websiteanda.com/verify/${newSignatureRecord.id}`;
            const pdfOptions = { displayQrCode: options.displayQrCode, verificationUrl };

            const { signedFileBuffer, publicUrl } = await this.pdfService.generateSignedPdf(originalVersionId, [signatureData], pdfOptions);

            const signedHash = crypto.createHash("sha256").update(signedFileBuffer).digest("hex");

            await this.versionRepository.update(newVersion.id, {
                url: publicUrl,
                signedFileHash: signedHash,
            });

            return this.documentRepository.update(originalVersion.documentId, {
                currentVersionId: newVersion.id,
                status: "completed",
                signedFileUrl: publicUrl,
            });
        } catch (processError) {
            // Menangkap semua kemungkinan error selama proses pembuatan versi & PDF
            throw CommonError.InternalServerError(`Proses penandatanganan gagal: ${processError.message}`);
        }
    }

    async getVerificationDetails(signatureId) {
        let signature;
        try {
            signature = await this.signatureRepository.findById(signatureId);
        } catch (dbError) {
            throw CommonError.DatabaseError(`Gagal mengambil data tanda tangan: ${dbError.message}`);
        }

        // REFAKTOR: Gunakan error yang spesifik
        if (!signature) {
            throw SignatureError.NotFound(signatureId);
        }

        return {
            signerName: signature.signer.name,
            signerEmail: signature.signer.email,
            documentTitle: signature.documentVersion.document.title,
            signedAt: signature.signedAt,
            signatureImageUrl: signature.signatureImageUrl,
            ipAddress: signature.ipAddress,
        };
    }
}