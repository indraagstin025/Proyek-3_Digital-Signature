import { PDFService } from "../../src/services/pdfService.js";
import DocumentError from "../../src/errors/DocumentError.js";
import CommonError from "../../src/errors/CommonError.js";
import SignatureError from "../../src/errors/SignatureError.js";

// --- MOCK LIBRARY EXTERNAL ---
import fs from "fs";
import QRCode from "qrcode";
import signerPkg from "node-signpdf";
import { plainAddPlaceholder } from "node-signpdf/dist/helpers/index.js";
import pkg from "pdf-lib";

const { PDFDocument } = pkg;

// Mocking External Modules
jest.mock("fs");
jest.mock("qrcode");
jest.mock("node-signpdf", () => ({
  default: {
    sign: jest.fn(),
  },
}));
jest.mock("node-signpdf/dist/helpers/index.js", () => ({
  plainAddPlaceholder: jest.fn(),
}));

// Mocking PDF-Lib secara mendetail karena helper function 'createLockedStampAnnotation'
// mengakses struktur internal PDF (context, obj, dll)
jest.mock("pdf-lib", () => {
  const originalModule = jest.requireActual("pdf-lib");
  return {
    ...originalModule,
    PDFDocument: {
      load: jest.fn(),
    },
  };
});

describe("PDFService", () => {
  let pdfService;
  let mockVersionRepo;
  let mockSignatureRepo; // (Tidak terlalu dipakai di method ini, tapi tetap di-mock)
  let mockFileStorage;
  let mockPdfDoc;
  let mockPage;

  // Setup Dummy Data
  const mockVersionId = "ver-123";
  const mockUrl = "https://bucket/file.pdf";
  const mockPdfBuffer = Buffer.from("dummy-pdf-content");
  const mockSignedPdfBuffer = Buffer.from("signed-pdf-content");
  const mockSignatures = [
    {
      pageNumber: 1,
      width: 0.2,
      height: 0.1,
      positionX: 0.5,
      positionY: 0.5,
      signatureImageUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      signerName: "John Doe",
      signerEmail: "john@mail.com",
      ipAddress: "127.0.0.1",
      signedAt: new Date(),
      id: "sig-1",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // 1. Mock Repositories & Storage
    mockVersionRepo = {
      findById: jest.fn(),
    };
    mockSignatureRepo = {};
    mockFileStorage = {
      downloadFileAsBuffer: jest.fn(),
      uploadFile: jest.fn(),
    };

    // 2. Setup Environment Variables
    process.env.CERT_PASSWORD = "test-password";
    process.env.CERT_FILE_PATH = "./dummy.p12";

    // 3. Mock PDF-Lib Structures (Advanced Mocking untuk handle helper function)
    mockPage = {
      getSize: jest.fn().mockReturnValue({ width: 600, height: 800 }),
      drawText: jest.fn().mockReturnValue(mockPage), // Add drawText method
      drawLine: jest.fn().mockReturnValue(mockPage),
      drawImage: jest.fn().mockReturnValue(mockPage),
      node: {
        Annots: jest.fn().mockReturnValue([]), // Array untuk push annot
        set: jest.fn(),
      },
    };

    const mockContext = {
      obj: jest.fn((val) => ({ ref: "mock-ref", ...val })), // Mock PDFObject
      flateStream: jest.fn().mockReturnValue("mock-stream"),
      register: jest.fn().mockReturnValue("mock-ref"),
    };

    mockPdfDoc = {
      embedPng: jest.fn().mockResolvedValue({
        ref: "img-ref",
        size: jest.fn().mockReturnValue({ width: 100, height: 50 }),
      }),
      embedFont: jest.fn().mockResolvedValue("mock-font"),
      getPageCount: jest.fn().mockReturnValue(1),
      getPage: jest.fn().mockReturnValue(mockPage),
      addPage: jest.fn().mockReturnValue(mockPage),
      context: mockContext, // Penting untuk createLockedStampAnnotation
      save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      drawImage: jest.fn(),
      drawText: jest.fn(),
      drawLine: jest.fn(),
    };

    PDFDocument.load.mockResolvedValue(mockPdfDoc);

    // 4. Initialize Service
    pdfService = new PDFService(mockVersionRepo, mockSignatureRepo, mockFileStorage);
  });

  // =========================================================================
  // POSITIVE TEST CASES
  // =========================================================================

  test("should generate signed PDF successfully (Visual + Digital)", async () => {
    // Arrange
    mockVersionRepo.findById.mockResolvedValue({
      id: mockVersionId,
      url: mockUrl,
      userId: "user-1",
      document: { id: "doc-1", title: "contract.pdf" },
    });
    mockFileStorage.downloadFileAsBuffer.mockResolvedValue(mockPdfBuffer);

    // Mock FS untuk sertifikat
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(Buffer.from("p12-buffer"));

    // Mock Signing Libraries
    plainAddPlaceholder.mockReturnValue(Buffer.from("placeholder-pdf"));
    signerPkg.default.sign.mockReturnValue(mockSignedPdfBuffer);
    mockFileStorage.uploadFile.mockResolvedValue("https://bucket/signed-result.pdf");

    // Act
    const result = await pdfService.generateSignedPdf(mockVersionId, mockSignatures);

    // Assert
    expect(mockVersionRepo.findById).toHaveBeenCalledWith(mockVersionId);
    expect(mockFileStorage.downloadFileAsBuffer).toHaveBeenCalledWith(mockUrl);
    expect(PDFDocument.load).toHaveBeenCalled();

    // Pastikan gambar embed dipanggil (Visual Signature)
    expect(mockPdfDoc.embedPng).toHaveBeenCalled();

    // Pastikan Signing dipanggil
    expect(plainAddPlaceholder).toHaveBeenCalled();
    expect(signerPkg.default.sign).toHaveBeenCalledWith(expect.anything(), expect.anything(), { passphrase: "test-password" });

    // Pastikan Upload dipanggil
    expect(mockFileStorage.uploadFile).toHaveBeenCalledWith(expect.stringContaining("signed-documents/user-1/"), expect.anything(), "application/pdf");

    // Check Result
    expect(result).toHaveProperty("publicUrl", "https://bucket/signed-result.pdf");
    expect(result).toHaveProperty("signedFileBuffer");
  });

  test("should generate Audit Trail page if options provided", async () => {
    // Arrange
    mockVersionRepo.findById.mockResolvedValue({
      id: mockVersionId,
      url: mockUrl,
      userId: "user-1",
      document: { title: "file.pdf" },
    });
    mockFileStorage.downloadFileAsBuffer.mockResolvedValue(mockPdfBuffer);
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(Buffer.from("p12-buffer"));
    QRCode.toDataURL.mockResolvedValue("data:image/png;base64,dummyqr");
    signerPkg.default.sign.mockReturnValue(mockSignedPdfBuffer);

    // Act
    const options = { displayQrCode: true, verificationUrl: "https://verify.me" };
    const result = await pdfService.generateSignedPdf(mockVersionId, mockSignatures, options);

    // Assert
    expect(mockPdfDoc.addPage).toHaveBeenCalled(); // Audit trail bikin halaman baru
    expect(QRCode.toDataURL).toHaveBeenCalledWith("https://verify.me");
    expect(result.accessCode).toBeDefined(); // Access code digenerate
  });

  // =========================================================================
  // NEGATIVE TEST CASES (ERROR HANDLING)
  // =========================================================================

  test("should throw InternalServerError if CERT_PASSWORD is missing", async () => {
    delete process.env.CERT_PASSWORD;
    await expect(pdfService.generateSignedPdf(mockVersionId, mockSignatures)).rejects.toThrow(CommonError);
  });

  test("should throw DatabaseError if finding version fails", async () => {
    mockVersionRepo.findById.mockRejectedValue(new Error("DB Connection Failed"));
    await expect(pdfService.generateSignedPdf(mockVersionId, mockSignatures)).rejects.toThrow("Gagal mengambil versi dokumen");
  });

  test("should throw NotFound if version does not exist", async () => {
    mockVersionRepo.findById.mockResolvedValue(null);
    await expect(pdfService.generateSignedPdf(mockVersionId, mockSignatures)).rejects.toThrow(DocumentError);
  });

  test("should throw MissingSignatureData if signatures array is empty", async () => {
    mockVersionRepo.findById.mockResolvedValue({ id: "v1" });
    await expect(pdfService.generateSignedPdf(mockVersionId, [])).rejects.toThrow(SignatureError);
  });

  test("should throw Encrypted error if PDF is password protected", async () => {
    mockVersionRepo.findById.mockResolvedValue({ id: "v1", url: "url" });
    mockFileStorage.downloadFileAsBuffer.mockResolvedValue(mockPdfBuffer);

    // Simulate Encrypted PDF error
    PDFDocument.load.mockRejectedValue(new Error("File is encrypted"));

    await expect(pdfService.generateSignedPdf(mockVersionId, mockSignatures)).rejects.toThrow("Dokumen terenkripsi");
  });

  test("should throw InternalServerError if Certificate file is missing", async () => {
    mockVersionRepo.findById.mockResolvedValue({
      id: mockVersionId,
      url: mockUrl,
      userId: "u1",
      document: { title: "a.pdf" },
    });
    mockFileStorage.downloadFileAsBuffer.mockResolvedValue(mockPdfBuffer);

    // Mock FS existsSync false (File P12 tidak ada)
    fs.existsSync.mockReturnValue(false);
    // Base64 env juga tidak ada
    delete process.env.CERT_BASE64;

    await expect(pdfService.generateSignedPdf(mockVersionId, mockSignatures)).rejects.toThrow("Sertifikat Digital (P12) tidak ditemukan");
  });

  test("should throw InternalServerError if Signing fails", async () => {
    mockVersionRepo.findById.mockResolvedValue({
      id: mockVersionId,
      url: mockUrl,
      userId: "u1",
      document: { title: "a.pdf" },
    });
    mockFileStorage.downloadFileAsBuffer.mockResolvedValue(mockPdfBuffer);
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(Buffer.from("p12"));

    // Mock signer error
    signerPkg.default.sign.mockImplementation(() => {
      throw new Error("Signer crashed");
    });

    await expect(pdfService.generateSignedPdf(mockVersionId, mockSignatures)).rejects.toThrow("Gagal signing: Signer crashed");
  });

  // =========================================================================
  // BRANCH COVERAGE TESTS (Conditional Branches)
  // =========================================================================

  test("should skip signature if signatureImageUrl is missing", async () => {
    mockVersionRepo.findById.mockResolvedValue({
      id: mockVersionId,
      url: mockUrl,
      userId: "u1",
      document: { title: "a.pdf" },
    });
    mockFileStorage.downloadFileAsBuffer.mockResolvedValue(mockPdfBuffer);
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(Buffer.from("p12"));
    signerPkg.default.sign.mockReturnValue(mockSignedPdfBuffer);

    const sigsWithoutImage = [
      { pageNumber: 1, width: 0.2, height: 0.1, positionX: 0.5, positionY: 0.5 }, // No signatureImageUrl
    ];

    const result = await pdfService.generateSignedPdf(mockVersionId, sigsWithoutImage);
    expect(result).toBeDefined();
    expect(result.signedFileBuffer).toBeDefined();
  });

  test("should skip signature if width or height is missing", async () => {
    mockVersionRepo.findById.mockResolvedValue({
      id: mockVersionId,
      url: mockUrl,
      userId: "u1",
      document: { title: "a.pdf" },
    });
    mockFileStorage.downloadFileAsBuffer.mockResolvedValue(mockPdfBuffer);
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(Buffer.from("p12"));
    signerPkg.default.sign.mockReturnValue(mockSignedPdfBuffer);

    const sigsWithoutDimensions = [
      {
        pageNumber: 1,
        signatureImageUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        // No width/height
      },
    ];

    const result = await pdfService.generateSignedPdf(mockVersionId, sigsWithoutDimensions);
    expect(result).toBeDefined();
  });

  test("should skip signature if pageNumber is out of bounds", async () => {
    mockVersionRepo.findById.mockResolvedValue({
      id: mockVersionId,
      url: mockUrl,
      userId: "u1",
      document: { title: "a.pdf" },
    });
    mockFileStorage.downloadFileAsBuffer.mockResolvedValue(mockPdfBuffer);
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(Buffer.from("p12"));
    signerPkg.default.sign.mockReturnValue(mockSignedPdfBuffer);

    const sigsOutOfBounds = [
      {
        pageNumber: 999, // Out of bounds (PDF has 1 page)
        width: 0.2,
        height: 0.1,
        signatureImageUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      },
    ];

    const result = await pdfService.generateSignedPdf(mockVersionId, sigsOutOfBounds);
    expect(result).toBeDefined();
  });

  test("should use CERT_BASE64 if CERT_FILE_PATH does not exist", async () => {
    mockVersionRepo.findById.mockResolvedValue({
      id: mockVersionId,
      url: mockUrl,
      userId: "u1",
      document: { title: "a.pdf" },
    });
    mockFileStorage.downloadFileAsBuffer.mockResolvedValue(mockPdfBuffer);
    fs.existsSync.mockReturnValue(false); // P12 file doesn't exist
    process.env.CERT_BASE64 = Buffer.from("cert-data").toString("base64");
    signerPkg.default.sign.mockReturnValue(mockSignedPdfBuffer);

    const result = await pdfService.generateSignedPdf(mockVersionId, mockSignatures);
    expect(result).toBeDefined();
    expect(signerPkg.default.sign).toHaveBeenCalled();

    delete process.env.CERT_BASE64;
  });

  test("should generate PDF with audit trail when displayQrCode and verificationUrl options are provided", async () => {
    mockVersionRepo.findById.mockResolvedValue({
      id: mockVersionId,
      url: mockUrl,
      userId: "u1",
      document: { id: "doc-1", title: "contract.pdf" },
    });
    mockFileStorage.downloadFileAsBuffer.mockResolvedValue(mockPdfBuffer);
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(Buffer.from("p12"));
    signerPkg.default.sign.mockReturnValue(mockSignedPdfBuffer);
    QRCode.toDataURL.mockResolvedValue("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");

    const result = await pdfService.generateSignedPdf(mockVersionId, mockSignatures, {
      displayQrCode: true,
      verificationUrl: "https://verify.example.com/doc-123",
    });
    expect(result).toBeDefined();
    expect(mockPdfDoc.addPage).toHaveBeenCalled(); // Should add audit trail page
  });

  test("should handle PDF load error (non-encrypted)", async () => {
    mockVersionRepo.findById.mockResolvedValue({
      id: mockVersionId,
      url: mockUrl,
      userId: "u1",
      document: { title: "a.pdf" },
    });
    mockFileStorage.downloadFileAsBuffer.mockResolvedValue(mockPdfBuffer);

    // Mock PDFDocument.load with non-encrypted error
    PDFDocument.load.mockRejectedValue(new Error("Invalid PDF format"));

    await expect(pdfService.generateSignedPdf(mockVersionId, mockSignatures)).rejects.toThrow("Gagal memproses PDF: Invalid PDF format");
  });

  test("should handle signature with zero pageNumber (negative index)", async () => {
    mockVersionRepo.findById.mockResolvedValue({
      id: mockVersionId,
      url: mockUrl,
      userId: "u1",
      document: { title: "a.pdf" },
    });
    mockFileStorage.downloadFileAsBuffer.mockResolvedValue(mockPdfBuffer);
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(Buffer.from("p12"));
    signerPkg.default.sign.mockReturnValue(mockSignedPdfBuffer);

    const sigsWithZeroPageNumber = [
      {
        pageNumber: 0, // Zero or negative
        width: 0.2,
        height: 0.1,
        signatureImageUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      },
    ];

    const result = await pdfService.generateSignedPdf(mockVersionId, sigsWithZeroPageNumber);
    expect(result).toBeDefined();
  });

  test("should handle audit trail with many signatures causing page overflow", async () => {
    mockVersionRepo.findById.mockResolvedValue({
      id: mockVersionId,
      url: mockUrl,
      userId: "u1",
      document: { id: "doc-1", title: "contract.pdf" },
    });
    mockFileStorage.downloadFileAsBuffer.mockResolvedValue(mockPdfBuffer);
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(Buffer.from("p12"));
    signerPkg.default.sign.mockReturnValue(mockSignedPdfBuffer);
    QRCode.toDataURL.mockResolvedValue("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");

    // Create many signatures to test overflow logic
    const manySignatures = Array(20)
      .fill(null)
      .map((_, i) => ({
        pageNumber: 1,
        width: 0.2,
        height: 0.1,
        signatureImageUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        signerName: `Signer ${i}`,
        signerEmail: `signer${i}@mail.com`,
        ipAddress: `192.168.1.${i}`,
        signedAt: new Date(),
        id: `sig-${i}`,
      }));

    const result = await pdfService.generateSignedPdf(mockVersionId, manySignatures, {
      displayQrCode: true,
      verificationUrl: "https://verify.example.com/doc-123",
    });
    expect(result).toBeDefined();
  });

  test("should handle signature data without optional fields in audit trail", async () => {
    mockVersionRepo.findById.mockResolvedValue({
      id: mockVersionId,
      url: mockUrl,
      userId: "u1",
      document: { id: "doc-1", title: "contract.pdf" },
    });
    mockFileStorage.downloadFileAsBuffer.mockResolvedValue(mockPdfBuffer);
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(Buffer.from("p12"));
    signerPkg.default.sign.mockReturnValue(mockSignedPdfBuffer);
    QRCode.toDataURL.mockResolvedValue("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");

    const minimalSignatures = [
      {
        pageNumber: 1,
        width: 0.2,
        height: 0.1,
        positionX: 0.5,
        positionY: 0.5,
        signatureImageUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        // No signerName, signerEmail, ipAddress, signedAt, id
      },
    ];

    const result = await pdfService.generateSignedPdf(mockVersionId, minimalSignatures, {
      displayQrCode: true,
      verificationUrl: "https://verify.example.com/doc-123",
    });
    expect(result).toBeDefined();
  });
});
