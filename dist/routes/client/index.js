"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
const email_campaign_route_1 = __importDefault(require("./email_campaign.route"));
const voice_data_route_1 = __importDefault(require("./voice_data.route"));
const profile_route_1 = __importDefault(require("./profile.route"));
router.use("/", email_campaign_route_1.default);
router.use("/", voice_data_route_1.default);
router.use("/", profile_route_1.default);
exports.default = router;
