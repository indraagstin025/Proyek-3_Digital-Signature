import BaseError from "../errors/BaseError.js";
import multer from "multer";
import { Prisma } from "@prisma/client";

const errorHandler = (err, req, res, next) => {
  if (process.env.NODE_ENV !== "production") {
    console.log("--- ERROR LOG ---");
    console.error(err);
    console.log("-----------------");
  } else {
    console.error(`ERROR: ${err.message}`);
  }

  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      status: "fail",
      code: "INVALID_JSON_FORMAT",
      message: "Format JSON yang dikirim tidak valid. Cek kembali tanda kurung atau koma.",
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const field = err.meta?.target ? err.meta.target.join(", ") : "Field";
      return res.status(409).json({
        status: "fail",
        code: "DATA_CONFLICT",
        message: `Data pada ${field} sudah terdaftar. Gunakan data lain.`,
      });
    }

    if (err.code === "P2025") {
      return res.status(404).json({
        status: "fail",
        code: "RESOURCE_NOT_FOUND",
        message: "Data yang ingin diakses atau diubah tidak ditemukan.",
      });
    }
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        status: "fail",
        code: "LIMIT_FILE_SIZE",
        message: `Ukuran file terlalu besar. Maksimal ${process.env.MAX_FILE_SIZE_MB || 5} MB.`,
      });
    }
    return res.status(400).json({
      status: "fail",
      code: err.code,
      message: err.message,
    });
  }

  if (err instanceof BaseError) {
    return res.status(err.statusCode).json({
      status: err.status,
      code: err.code,
      message: err.message,
    });
  }

  const errorMessage = process.env.NODE_ENV === "production" ? "Terjadi kesalahan internal pada server." : err.message;

  return res.status(500).json({
    status: "error",
    code: "INTERNAL_SERVER_ERROR",
    message: errorMessage,

    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};

export default errorHandler;
