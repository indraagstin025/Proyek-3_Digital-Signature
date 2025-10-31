import pkg from "pdf-lib";
const { PDFDocument, StandardFonts, rgb, Permissions } = pkg;
import QRCode from "qrcode";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import signerPkg from "node-signpdf";
const signer = signerPkg.default;
import { plainAddPlaceholder } from "node-signpdf/dist/helpers/index.js";

import DocumentError from "../errors/DocumentError.js";
import SignatureError from "../errors/SignatureError.js";
import CommonError from "../errors/CommonError.js";

const CERT_PATH =
    process.env.CERT_FILE_PATH ||
    path.join(process.cwd(), "config", "certs", "signer_cert.p12");
const CERT_PASSWORD = process.env.CERT_PASSWORD;

export class PDFService {
    constructor(versionRepository, signatureRepository, fileStorage) {
        this.versionRepository = versionRepository;
        this.signatureRepository = signatureRepository;
        this.fileStorage = fileStorage;
    }

    async generateSignedPdf(documentVersionId, signaturesToEmbed, options = {}) {
        let version;
        try {
            version = await this.versionRepository.findById(documentVersionId);
        } catch (err) {
            throw CommonError.DatabaseError(
                `Gagal mengambil versi dokumen: ${err.message}`
            );
        }

        if (!version)
            throw DocumentError.NotFound(
                `Versi dokumen dengan ID '${documentVersionId}'`
            );

        if (!signaturesToEmbed?.length)
            throw SignatureError.MissingSignatureData();

        const pdfBuffer = await this.fileStorage.downloadFileAsBuffer(version.url);

        let pdfDoc;
        try {
            pdfDoc = await PDFDocument.load(pdfBuffer);
        } catch (error) {
            if (error.message?.includes("is encrypted"))
                throw DocumentError.Encrypted();
            throw CommonError.InternalServerError(
                `Gagal memproses PDF: ${error.message}`
            );
        }

        for (const sig of signaturesToEmbed) {
            if (!sig.signatureImageUrl) continue;

            const base64Data = sig.signatureImageUrl.replace(
                /^data:image\/png;base64,/,
                ""
            );
            const imageBytes = Buffer.from(base64Data, "base64");
            const embeddedImage = await pdfDoc.embedPng(imageBytes);
            const page = pdfDoc.getPage(sig.pageNumber - 1);
            const { width: pw, height: ph } = page.getSize();
            const { width: imgWidth, height: imgHeight } = embeddedImage.size();
            const imgRatio = imgWidth / imgHeight;
            const boxWidth = sig.width * pw;
            const boxHeight = sig.height * ph;
            const boxRatio = boxWidth / boxHeight;

            let finalWidth, finalHeight;
            if (imgRatio > boxRatio) {
                finalWidth = boxWidth;
                finalHeight = finalWidth / imgRatio;
            } else {
                // Gambar lebih tinggi dari kotak
                finalHeight = boxHeight;
                finalWidth = finalHeight * imgRatio;
            }
            // --- AKHIR PERBAIKAN RASIO ASPEK ---


            // --- ✅ AWAL PERBAIKAN PRESISI (CENTERING) ---

            // Hitung 'padding' atau spasi kosong di dalam kotak
            const xPadding = (boxWidth - finalWidth) / 2;
            const yPadding = (boxHeight - finalHeight) / 2;

            // Terapkan padding ini ke posisi X dan Y
            // 1. Ambil X kotak, tambahkan padding X
            const x = (sig.positionX * pw) + xPadding;

            // 2. Ambil Y kotak (dari atas), tambahkan padding Y
            const y_from_top = (sig.positionY * ph) + yPadding;

            // 3. Konversi Y (dari atas) ke sistem koordinat pdf-lib (dari bawah)
            const y = ph - y_from_top - finalHeight;

            // --- ✅ AKHIR PERBAIKAN PRESISI ---


            page.drawImage(embeddedImage, {
                x,
                y,
                width: finalWidth,
                height: finalHeight,
            });
        }

        // ======== 2️⃣ Tambahkan QR Code opsional ========
        if (options.displayQrCode && options.verificationUrl) {
            try {
                const qrDataUrl = await QRCode.toDataURL(options.verificationUrl);
                const qrBytes = Buffer.from(qrDataUrl.split(",")[1], "base64");
                const embeddedQr = await pdfDoc.embedPng(qrBytes);

                const lastPage = pdfDoc.getPage(pdfDoc.getPageCount() - 1);
                lastPage.drawImage(embeddedQr, { x: 40, y: 40, width: 80, height: 80 });
            } catch (err) {
                console.error("Gagal membuat atau menempelkan QR code:", err);
            }
        }

        // ======== 3️⃣ [BARU] Proteksi PDF agar tidak dapat diedit (SEBELUM DISIMPAN) ========
        // Ini harus dilakukan SEBELUM `pdfDoc.save()`
        try {
            pdfDoc.encrypt({
                ownerPassword: CERT_PASSWORD || "readonly", // Gunakan password yang aman
                permissions: {
                    // Izinkan mencetak
                    printing: Permissions.HighResolution,
                    // Larang semua hal lainnya
                    modifying: false,
                    copying: false,
                    annotating: false,
                    fillingForms: false,
                    contentAccessibility: false,
                    documentAssembly: false,
                },
            });
        } catch (err) {
            console.warn(
                "Gagal mengunci PDF, lanjut tanpa proteksi:",
                err.message
            );
        }

        // ======== 4️⃣ Simpan PDF visual (setelah semua modifikasi pdf-lib) ========
        const pdfVisualBytes = await pdfDoc.save({
            useObjectStreams: false, // penting untuk node-signpdf
        });

        // ======== 5️⃣ Tambahkan placeholder tanda tangan ========
        const pdfWithPlaceholder = plainAddPlaceholder({
            pdfBuffer: Buffer.from(pdfVisualBytes),
            reason: "Digital Signature by DigiSign Service",
            contactInfo: "support@websiteanda.com",
            name: "DigiSign System",
            location: "Indonesia",
        });

        // ======== 6️⃣ Tanda tangani PDF menggunakan sertifikat P12 ========
        if (!fs.existsSync(CERT_PATH)) {
            throw CommonError.InternalServerError(
                `File sertifikat P12 tidak ditemukan: ${CERT_PATH}`
            );
        }

        let signedPdfBuffer;
        try {
            const p12Buffer = fs.readFileSync(CERT_PATH);
            signedPdfBuffer = signer.sign(pdfWithPlaceholder, p12Buffer, {
                passphrase: CERT_PASSWORD,
            });
        } catch (err) {
            throw CommonError.InternalServerError(
                `Gagal menandatangani dokumen: ${err.message}`
            );
        }

        // HAPUS BLOK 6 YANG LAMA (proteksi setelah sign)

        // ======== 7️⃣ Upload hasil ke storage ========
        const documentOwnerId = version.userId;
        const ext = path.extname(version.document.title) || ".pdf";
        const uniqueName = `${crypto.randomBytes(16).toString("hex")}${ext}`;
        const signedPath = `signed-documents/${documentOwnerId}/${uniqueName}`;

        const finalUrl = await this.fileStorage.uploadFile(
            signedPath,
            signedPdfBuffer,
            "application/pdf"
        );

        // ======== ✅ Return hasil ========
        return {
            signedFileBuffer: Buffer.from(signedPdfBuffer),
            publicUrl: finalUrl,
        };
    }
}