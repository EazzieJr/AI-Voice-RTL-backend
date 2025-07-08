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
    .get("/campaign-details-analytics", authenticate, (req, res, next) => email_campaign_1.email_campaign_service.campaign_details_analytics(req, res, next))
    .post("/email-reach-graph", authenticate, (req, res, next) => {
    email_campaign_1.email_campaign_service.email_reach_graph(req, res, next);
});
exports.default = router;
