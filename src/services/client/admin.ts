import RootService from "../_root";
import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/authRequest";
import { userModel } from "../../models/userModel";
import { DeleteListSchema } from "../../validations/client/admin";
import { contactModel } from "../../models/contact_model";
import fs from "fs";
import * as Papa from "papaparse";
import { IContact } from "../../utils/types";
import { formatPhoneNumber } from "../../utils/formatter";

class AdminService extends RootService {
    async delete_list(request: AuthRequest, response: Response, next: NextFunction) {
        try {
            const clientId = request.user._id;
            const body = request.body;

            const check_user = await userModel.findById(clientId);
            if (!check_user) return response.status(400).json({ error: "User not found" });

            if (!check_user.isAdmin) return response.status(403).json({ error: "Client is not an Admin" });

            const { error } = DeleteListSchema.validate(body, { abortEarly: false });
            if (error) return this.handle_validation_errors(error, response, next);

            const tag = body.tag;

            const result = await Promise.all([
                contactModel.deleteMany({ tag }),
                userModel.findOneAndUpdate(
                    { 'agents.tag': tag },
                    { $pull: { 'agents.$[].tag': tag } },
                    { new: true }
                )
            ]);

            if (!result[0].acknowledged) return response.status(500).json({ error: "Failed to delete contacts" });

            console.log("Delete result: ", result);

            return response.status(200).json({ message: "Contacts deleted successfully" });

        } catch (error) {
            console.error("Error deleting call history: " + error);
            next(error);
        };
    };
}

export const admin_service = new AdminService();
