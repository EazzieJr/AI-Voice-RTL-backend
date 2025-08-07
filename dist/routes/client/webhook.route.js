"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const webhook_1 = require("../../services/client/webhook");
const router = express_1.default.Router();
router
    .post("/email-update-webhook", (request, response) => webhook_1.client_webhook_service.email_update_webhook(request, response));
exports.default = router;
