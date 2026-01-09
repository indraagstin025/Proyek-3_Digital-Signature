import axios from "axios";
import FormData from "form-data";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:5000";

export const aiService = {
  /**
   * Hybrid Analysis: Mengirim dokumen ke Python untuk dianalisis.
   * [UPDATED] Menerima parameter docType dari database untuk dikirim ke AI.
   * * @param {string|Buffer} sourceData - URL string atau File Buffer
   * @param {string} mode - 'url' atau 'buffer'
   * @param {string} docType - Tipe dokumen dari input user (Wajib dikirim)
   */
  async analyzeDocumentContent(sourceData, mode, docType) {
    const finalDocType = docType || "General";

    console.log(`📡 [AI Service] Mengirim request ke Python...`);
    console.log(`   - Mode: ${mode}`);
    console.log(`   - Tipe: "${finalDocType}"`);

    try {
      let response;

      if (mode === "url") {
        if (typeof sourceData !== "string") {
          throw new Error("Mode URL dipilih, tapi data bukan string.");
        }

        response = await axios.post(
          `${AI_SERVICE_URL}/analyze-content`,
          {
            file_url: sourceData,
            document_type: finalDocType,
          },
          {
            headers: { "Content-Type": "application/json" },
            timeout: 120000,
          }
        );
      } else if (mode === "buffer") {
        const form = new FormData();
        form.append("file", sourceData, "document.pdf");
        form.append("document_type", finalDocType);

        response = await axios.post(`${AI_SERVICE_URL}/analyze-content`, form, {
          headers: { ...form.getHeaders() },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 120000,
        });
      } else {
        throw new Error("Mode tidak valid (harus 'url' atau 'buffer').");
      }

      const result = response.data;

      if (result.status === "success" && result.data) {
        return result.data;
      }

      return result;
    } catch (error) {
      console.error("❌ AI Service Error:", error.message);

      if (error.code === "ECONNREFUSED" || error.message.includes("ECONNREFUSED")) {
        return { error: "Layanan AI sedang offline. Mohon periksa koneksi server." };
      }

      return { error: error.message };
    }
  },
};
