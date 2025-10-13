import asyncHandler from "../utils/asyncHandler.js";

export const createAdminController = (adminService) => {
    return {
        getAllUsers: asyncHandler(async (req, res) => {
            const users = await adminService.getAllUsers();
            res.status(200).json({ success: true, count: users.length, data: users });
        }),

        createUser: asyncHandler(async (req, res) => {
            const { email, password, name, isSuperAdmin } = req.body;
            const newUser = await adminService.createNewUser({ email, password, name, isSuperAdmin });
            res.status(201).json({
                success: true,
                message: 'User berhasil dibuat oleh admin.',
                data: newUser
            });
        }),

        updateUser: asyncHandler(async (req, res) => {
            const { userId } = req.params;
            const updatedUser = await adminService.updateUser(userId, req.body);
            res.status(200).json({
                success: true,
                message: 'User berhasil diperbaharui.',
                data: updatedUser
            });
        }),

        deleteUser: asyncHandler(async (req, res) => {
            const { userId } = req.params;
            await adminService.deleteUser(userId);
            res.status(200).json({
                success: true,
                message: `User dengan ID ${userId} berhasil dihapus`
            });
        }),
    };
};