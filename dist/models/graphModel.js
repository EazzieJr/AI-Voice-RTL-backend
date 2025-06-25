"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyGraphModel = void 0;
const mongoose_1 = require("mongoose");
const graphSchema = new mongoose_1.Schema({
    date: {
        type: String,
        required: true,
    },
    agentId: { type: String, required: true },
    hourlyCalls: {
        type: Map,
        of: Number,
    },
}, { timestamps: true });
exports.dailyGraphModel = (0, mongoose_1.model)("graphStats", graphSchema);
