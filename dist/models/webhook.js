"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookModel = void 0;
const mongoose_1 = require("mongoose");
const WebhookSchema = new mongoose_1.Schema({}, { strict: false });
exports.WebhookModel = (0, mongoose_1.model)("Webhook", WebhookSchema);
