import { PDFDocument } from "pdf-lib";
import QRCode from "qrcode";
import crypto from "crypto";
import path from "path";
import DocumentError from "../errors/DocumentError.js";
import SignatureError from "../errors/SignatureError.js";
import CommonError from "../errors/CommonError.js";

/**
 * @description Service untuk memproses file PDF, menambahkan tanda tangan digital, 
 * serta menyisipkan QR Code untuk verifikasi dokumen.
 */
export class PDFService {
  /**
   * @param {object} versionRepository - Repository untuk mengelola versi dokumen.
   * @param {object} signatureRepository - Repository untuk mengelola tanda tangan.
   * @param {object} fileStorage - Service penyimpanan file (misalnya Supabase, S3, dsb).
   */
  constructor(versionRepository, signatureRepository, fileStorage) {
    this.versionRepository = versionRepository;
    this.signatureRepository = signatureRepository;
    this.fileStorage = fileStorage;
  }

  /**
   * @description Menghasilkan PDF baru dengan tanda tangan yang sudah ditempelkan dan (opsional) QR Code.
   * 
   * @async
   * @param {string} documentVersionId - ID versi dokumen asli.
   * @param {Array<object>} signaturesToEmbed - Daftar tanda tangan yang akan ditempel.
   * @param {number} signaturesToEmbed[].pageNumber - Nomor halaman tempat tanda tangan ditempel (1-based).
   * @param {number} signaturesToEmbed[].positionX - Posisi horizontal relatif (0-1) dari tanda tangan di halaman.
   * @param {number} signaturesToEmbed[].positionY - Posisi vertikal relatif (0-1) dari tanda tangan di halaman.
   * @param {number} signaturesToEmbed[].width - Lebar relatif (0-1) tanda tangan dibandingkan dengan lebar halaman.
   * @param {number} signaturesToEmbed[].height - Tinggi relatif (0-1) tanda tangan dibandingkan dengan tinggi halaman.
   * @param {string} signaturesToEmbed[].method - Metode tanda tangan (contoh: "canvas").
   * @param {string} signaturesToEmbed[].signatureImageUrl - Data base64 atau URL gambar tanda tangan.
   * @param {object} [options={}] - Opsi tambahan.
   * @param {boolean} [options.displayQrCode=false] - Apakah menampilkan QR Code pada halaman terakhir.
   * @param {string} [options.verificationUrl] - URL yang akan dikodekan ke dalam QR Code.
   * 
   * @returns {Promise<{signedFileBuffer: Buffer, publicUrl: string}>} 
   * Objek berisi buffer file PDF final dan URL publik dari file yang diupload.
   * 
   * @throws {DocumentError.NotFound} Jika versi dokumen tidak ditemukan.
   * @throws {SignatureError.MissingSignatureData} Jika tidak ada data tanda tangan yang diberikan.
   * @throws {DocumentError.Encrypted} Jika dokumen PDF terenkripsi.
   * @throws {CommonError.DatabaseError} Jika gagal mengambil versi dokumen dari repository.
   * @throws {CommonError.InternalServerError} Jika terjadi kesalahan internal saat memproses PDF.
   */
  async generateSignedPdf(documentVersionId, signaturesToEmbed, options = {}) {
    let version;
    try {
      version = await this.versionRepository.findById(documentVersionId);
    } catch (dbError) {
      throw CommonError.DatabaseError(`Gagal mengambil versi dokumen: ${dbError.message}`);
    }

    if (!version) {
      throw DocumentError.NotFound(`Versi dokumen dengan ID '${documentVersionId}'`);
    }

    if (!signaturesToEmbed || signaturesToEmbed.length === 0) {
      throw SignatureError.MissingSignatureData();
    }

    const pdfBuffer = await this.fileStorage.downloadFileAsBuffer(version.url);
    let pdfDoc;
    try {
      pdfDoc = await PDFDocument.load(pdfBuffer);
    } catch (error) {
      if (error.message && error.message.includes("is encrypted")) {
        throw DocumentError.Encrypted();
      }

      throw CommonError.InternalServerError(`Gagal memproses PDF: ${error.message}`);
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

    // Tambahkan QR Code jika diminta
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
    const uniqueFileName = `${crypto.randomBytes(16).toString("hex")}${ext}`;
    const signedFilePath = `signed-documents/${documentOwnerId}/${uniqueFileName}`;
    const finalUrl = await this.fileStorage.uploadFile(signedFilePath, signedPdfBytes, "application/pdf");

    return {
      signedFileBuffer: Buffer.from(signedPdfBytes),
      publicUrl: finalUrl,
    };
  }
}
