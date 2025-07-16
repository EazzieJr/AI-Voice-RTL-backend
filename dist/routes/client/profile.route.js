"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const profile_1 = require("../../services/client/profile");
const auth_1 = __importDefault(require("../../middleware/auth"));
const upload_1 = require("../../utils/upload");
const authenticate = auth_1.default.authenticate;
const router = express_1.default.Router();
router
    .put("/edit-profile", authenticate, upload_1.upload.single("svgFile"), (req, res, next) => profile_1.profile_management_service.edit_profile(req, res, next));
exports.default = router;
