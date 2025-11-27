import BaseError from "../errors/BaseError.js";

export const checkAdminRole = (req, res, next) => {
  if (req.user && req.user.role === "super_admin") {
    next();
  } else {
    throw new BaseError("FORBIDDEN_ACCESS", 403, "Akses ditolak. Anda tidak memiliki izin admin.");
  }
};

export const checkUserRole = (req, res, next) => {
  if (req.user && (req.user.role === "basic_user" || req.user.role === "signer")) {
    next();
  } else {
    throw new BaseError("FORBIDDEN_ACCESS", 403, "Akses ditolak. Anda tidak memiliki izin.");
  }
};
