import { PDFDocument } from "pdf-lib";
import QRCode from "qrcode";
import crypto from "crypto";
import path from "path";
import AppError from "../validators/AppError.js";

export class PDFService {
  constructor(versionRepository, signatureRepository, fileStorage) {
    this.versionRepository = versionRepository;
    this.signatureRepository = signatureRepository;
    this.fileStorage = fileStorage;
  }

  /**
   * @description Menghasilkan PDF yang sudah ditandatangani dan (opsional) diberi QR code verifikasi.
   * @param {string} documentVersionId - ID versi dokumen asli.
   * @param {Array<object>} signaturesToEmbed - Array berisi objek data tanda tangan.
   * @param {object} options - Opsi tambahan, misal: { displayQrCode, verificationUrl }.
   * @returns {Promise<{signedFileBuffer: Buffer, publicUrl: string}>} Objek berisi buffer file final dan URL publiknya.
   */
  async generateSignedPdf(documentVersionId, signaturesToEmbed, options = {}) {
    const version = await this.versionRepository.findById(documentVersionId);
    if (!version) throw new Error("Versi dokumen tidak ditemukan.");

    if (!signaturesToEmbed || signaturesToEmbed.length === 0) {
      throw new Error("Tidak ada tanda tangan untuk ditempelkan.");
    }

    const pdfBuffer = await this.fileStorage.downloadFileAsBuffer(version.url);
      let pdfDoc;
      try {
          pdfDoc = await PDFDocument.load(pdfBuffer);
      } catch (error) {
          if (error.message && error.message.includes('is encrypted')) {
              const encryptedError = new AppError(
                  'Dokumen ini terproteksi kata sandi atau terenkripsi dan tidak dapat diubah.',
                  403
              );
              encryptedError.code = "DOCUMENT_ENCRYPTED";
              throw encryptedError; // ⬅️ HARUS AppError, jangan pakai new Error
          }
          throw error;
      }

    for (const signature of signaturesToEmbed) {
      let imageBytes;
      if (signature.method === "canvas") {
        const base64Data = signature.signatureImageUrl.replace(/^data:image\/png;base64,/, "");
        imageBytes = Buffer.from(base64Data, "base64");
      }

      if (imageBytes) {
        const embeddedImage = await pdfDoc.embedPng(imageBytes);
        const page = pdfDoc.getPage(signature.pageNumber - 1);
        const { width: pageWidth, height: pageHeight } = page.getSize();

        const absoluteWidth = signature.width * pageWidth;
        const absoluteHeight = signature.height * pageHeight;
        const absoluteX = signature.positionX * pageWidth;
        const y_pdf = pageHeight - signature.positionY * pageHeight - absoluteHeight;

        page.drawImage(embeddedImage, {
          x: absoluteX,
          y: y_pdf,
          width: absoluteWidth,
          height: absoluteHeight,
        });
      }
    }

    if (options.displayQrCode && options.verificationUrl) {
      try {
        const qrCodeDataURL = await QRCode.toDataURL(options.verificationUrl);
        console.log("PDFService - QR Code Data URL berhasil dibuat (awal):", qrCodeDataURL.substring(0, 50) + "...");
        const qrImageBytes = Buffer.from(qrCodeDataURL.split(",")[1], "base64");
        const embeddedQrImage = await pdfDoc.embedPng(qrImageBytes);

        const lastPage = pdfDoc.getPage(pdfDoc.getPageCount() - 1);
        lastPage.drawImage(embeddedQrImage, {
          x: 40,
          y: 40,
          width: 80,
          height: 80,
        });

        console.log("PDFService - Gambar QR code berhasil ditempelkan ke PDF.");
      } catch (err) {
        console.error("Gagal membuat atau menempelkan QR code:", err);
      }
    }

      const signedPdfBytes = await pdfDoc.save();
      const documentOwnerId = version.userId;
      const ext = path.extname(version.document.title);
      const uniqueFileName = `${crypto.randomBytes(16).toString('hex')}${ext}`;
      const signedFilePath = `signed-documents/${documentOwnerId}/${uniqueFileName}`;
      const finalUrl = await this.fileStorage.uploadFile(signedFilePath, signedPdfBytes, "application/pdf");

    return {
      signedFileBuffer: Buffer.from(signedPdfBytes),
      publicUrl: finalUrl,
    };
  }
}
