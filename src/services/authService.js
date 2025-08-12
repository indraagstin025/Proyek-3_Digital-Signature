import { supabase } from "../config/supabaseClient.js";
import * as userService from "./userService.js";

/**
 * Mendaftarkan user ke Supabase Auth, lalu menyimpannya ke database lokal.
 * @param {string} email
 * @param {string} password
 * @param {object} additionalData - Berisi nama, phoneNumber, dll.
 * @returns {object} - Berisi data dari Supabase dan user dari database lokal.
 */
export const registerUser = async (email, password, additionalData) => {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    throw new Error("Gagal mendaftarkan user di Supabase: " + authError.message);
  }
  if (!authData.user) {
    throw new Error("Registrasi Supabase berhasil namun data user tidak ditemukan.");
  }

  const newUserData = {
    id: authData.user.id,
    email: authData.user.email,
    name: additionalData.name,
    phoneNumber: additionalData.phoneNumber,
    address: additionalData.address,
  };

  try {
    const localUser = await userService.createUser(newUserData);
    return { authData, localUser };
  } catch (dbError) {
    console.error("User di Supabase sudah dibuat, tapi gagal simpan ke DB lokal. ID User Supabase:", authData.user.id);
    throw new Error(dbError.message);
  }
};

/**
 * Fungsi untuk melakukan Login
 * @param {string} email
 * @param {string} password
 * @return {object} - Session object dari Supabase jika berhasil
 */
export const loginUser = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        throw new Error(error.message);
    }

    return data;
};

/**
 * Fungsi untuk Melakukan Logout untuk User
 * @param {string} jwt - JSON Web token milik pengguna yang sedang Login.
 * @returns {object} - Hasil dari proses Logout.
 */
export const logoutUser = async (jwt) => {
    const { error } = await supabase.auth.signOut(jwt);

    if (error) {
        throw new Error('Gagal melakukan Logout: ' + error.message);
    }

    return {message: 'Logout Berhasil'};
};