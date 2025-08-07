"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.client_webhook_service = void 0;
const emailReply_1 = require("../../models/emailReply");
const _root_1 = __importDefault(require("../_root"));
class ClientWebhookService extends _root_1.default {
    async email_update_webhook(request, response) {
        try {
            console.log("Request body is: ", request.body);
            const body = request.body;
            console.log("Body gotten is: ", body);
            const { id, reply_category } = body;
            const update = await emailReply_1.ReplyModel.findOneAndUpdate({ _id: id }, { reply_category: reply_category }, { new: true });
            if (!update) {
                console.error("No email reply found with the given ID.");
                return;
            }
            ;
            console.log("Email reply updated: ", update);
            return response.status(200).json({
                message: "Email reply updated",
                data: update
            });
        }
        catch (error) {
            console.error("Unable to update email reply data: ", error);
        }
        ;
    }
    ;
}
;
exports.client_webhook_service = new ClientWebhookService();
