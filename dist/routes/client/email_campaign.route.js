"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const email_campaign_1 = require("../../services/client/email_campaign");
const auth_1 = __importDefault(require("../../middleware/auth"));
const authenticate = auth_1.default.authenticate;
const router = express_1.default.Router();
router
    .post("/campaign-details-analytics", authenticate, (req, res, next) => email_campaign_1.email_campaign_service.campaign_details_analytics(req, res, next))
    .post("/lead-replies", authenticate, (req, res, next) => email_campaign_1.email_campaign_service.fetch_replies(req, res, next));
exports.default = router;
