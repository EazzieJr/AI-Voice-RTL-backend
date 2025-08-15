"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middleware/auth"));
const admin_1 = require("../../services/client/admin");
const authenticate = auth_1.default.authenticate;
const router = express_1.default.Router();
router
    .delete("/delete-list", authenticate, (request, response, next) => admin_1.admin_service.delete_list(request, response, next));
exports.default = router;
