"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const call_1 = require("../services/call");
const router = express_1.default.Router();
router
    .post("/webhook", (req, res, next) => {
    call_1.call_service.retell_webhook(req, res, next);
})
    .post("/schedule", (req, res, next) => {
    call_1.call_service.schedule_call(req, res, next);
})
    .post("/cancel-schedule", (req, res, next) => {
    call_1.call_service.cancel_schedule(req, res, next);
})
    .post("/correct-contacts", (req, res, next) => {
    call_1.call_service.correct_contacts(req, res, next);
})
    .post("/inbound-webhook", (req, res, next) => {
    call_1.call_service.inbound_call_webhook(req, res, next);
})
    .put("/update-outcome", (req, res, next) => {
    call_1.call_service.call_outcome_script(req, res, next);
});
exports.default = router;
