"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.admin_service = void 0;
const _root_1 = __importDefault(require("../_root"));
const userModel_1 = require("../../models/userModel");
const admin_1 = require("../../validations/client/admin");
const contact_model_1 = require("../../models/contact_model");
class AdminService extends _root_1.default {
    async delete_list(request, response, next) {
        try {
            const clientId = request.user._id;
            const body = request.body;
            const check_user = await userModel_1.userModel.findById(clientId);
            if (!check_user)
                return response.status(400).json({ error: "User not found" });
            if (!check_user.isAdmin)
                return response.status(403).json({ error: "Client is not an Admin" });
            const { error } = admin_1.DeleteListSchema.validate(body, { abortEarly: false });
            if (error)
                return this.handle_validation_errors(error, response, next);
            const tag = body.tag;
            const result = await Promise.all([
                contact_model_1.contactModel.deleteMany({ tag }),
                userModel_1.userModel.findOneAndUpdate({ 'agents.tag': tag }, { $pull: { 'agents.$[].tag': tag } }, { new: true })
            ]);
            if (!result[0].acknowledged)
                return response.status(500).json({ error: "Failed to delete contacts" });
            console.log("Delete result: ", result);
            return response.status(200).json({ message: "Contacts deleted successfully" });
        }
        catch (error) {
            console.error("Error deleting call history: " + error);
            next(error);
        }
        ;
    }
    ;
}
exports.admin_service = new AdminService();
