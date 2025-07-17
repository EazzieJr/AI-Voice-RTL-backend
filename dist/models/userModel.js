"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userModel = void 0;
const mongoose_1 = require("mongoose");
const argon2_1 = __importDefault(require("argon2"));
const types_1 = require("../utils/types");
;
;
;
const agentSchema = new mongoose_1.Schema({
    agentId: String,
    tag: [String],
    alias: String,
    name: String,
    type: {
        type: String,
        default: "outbound" // replace "defaultType" with your desired default value
    }
});
const loginSchema = new mongoose_1.Schema({
    loginTime: {
        type: Date,
        default: Date.now,
    },
    ipAddress: {
        type: String,
    },
    successful: {
        type: Boolean,
    },
});
const userSchema = new mongoose_1.Schema({
    email: {
        type: String,
        unique: true
    },
    password: {
        type: String,
        required: [true, "provide a password"],
    },
    username: {
        type: String,
        required: [true, "provide a username"],
    },
    group: {
        type: String,
        required: [true, "provide a group"],
    },
    isAdmin: {
        type: Boolean,
        default: false,
    },
    agents: [agentSchema],
    passwordHash: {
        type: String,
    },
    name: {
        type: String,
    },
    loginDetails: [loginSchema],
    svgUrl: {
        type: String
    },
    autoEmail: {
        type: String,
        unique: true
    },
    clientType: {
        type: String,
        enum: Object.values(types_1.ClientType),
        default: types_1.ClientType.MIXED,
    }
}, {
    timestamps: true,
});
userSchema.pre("save", async function () {
    this.passwordHash = await argon2_1.default.hash(this.password);
});
exports.userModel = (0, mongoose_1.model)("User", userSchema);
