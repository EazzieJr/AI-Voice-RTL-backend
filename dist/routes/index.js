"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
const client_1 = __importDefault(require("./client"));
const call_1 = __importDefault(require("./call"));
const admin_1 = __importDefault(require("./admin"));
router.use("/client", client_1.default);
router.use("/call", call_1.default);
router.use("/admin", admin_1.default);
exports.default = router;
