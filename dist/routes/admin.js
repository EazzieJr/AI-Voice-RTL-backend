"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const admin_1 = require("../services/admin");
const router = express_1.default.Router();
router
    .post("/search-client", (req, res, next) => {
    admin_1.admin_service.search_client(req, res, next);
});
exports.default = router;
