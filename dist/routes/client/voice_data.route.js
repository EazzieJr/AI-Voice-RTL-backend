"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const voice_data_1 = require("../../services/client/voice_data");
const auth_1 = __importDefault(require("../../middleware/auth"));
const authenticate = auth_1.default.authenticate;
const router = express_1.default.Router();
router
    .post("/voice-kpi", authenticate, (req, res, next) => voice_data_1.voice_data_service.voice_kpi(req, res, next));
exports.default = router;
