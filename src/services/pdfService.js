import { PDFDocument } from "pdf-lib";
import QRCode from "qrcode";

export class PDFService {
  constructor(versionRepository, signatureRepository, fileStorage) {
    this.versionRepository = versionRepository;
    this.signatureRepository = signatureRepository;
    this.fileStorage = fileStorage;
  }

  /**
   * @description Menghasilkan PDF yang sudah ditandatangani berdasarkan versi dokumen dan data tanda tangan berbasis rasio.
   * @param {string} documentVersionId - ID versi dokumen asli.
   * @param {Array<object>} signaturesToEmbed - Array berisi objek data tanda tangan dalam bentuk rasio (0-1).
   * @returns {Promise<string>} URL publik dari file PDF yang sudah ditandatangani.
   */
  async generateSignedPdf(documentVersionId, signaturesToEmbed) {
    const version = await this.versionRepository.findById(documentVersionId);
    if (!version) throw new Error("Versi dokumen tidak ditemukan.");

    if (!signaturesToEmbed || signaturesToEmbed.length === 0) {
      throw new Error("Tidak ada tanda tangan untuk ditempelkan.");
    }

    const pdfBuffer = await this.fileStorage.downloadFileAsBuffer(version.url);
    const pdfDoc = await PDFDocument.load(pdfBuffer);

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

        const absoluteY_from_top = signature.positionY * pageHeight;

        const y_pdf = pageHeight - absoluteY_from_top - absoluteHeight;

        page.drawImage(embeddedImage, {
          x: absoluteX,
          y: y_pdf,
          width: absoluteWidth,
          height: absoluteHeight,
        });
      }
    }

    const signedPdfBytes = await pdfDoc.save();

    const documentOwnerId = version.userId;
    const safeTitle = version.document.title.replace(/[^a-z0-9]/gi, "_");
    const signedFilePath = `${documentOwnerId}/signed/${safeTitle}-signed-${Date.now()}.pdf`;

    const finalUrl = await this.fileStorage.uploadFile(signedFilePath, signedPdfBytes, "application/pdf");

    return finalUrl;
  }
}
