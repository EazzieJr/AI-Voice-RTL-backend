import { model, Schema } from "mongoose";
import argon2 from "argon2";

const agentSchema = new Schema({
  agentId: String,
  tag: [String],
  alias: String,
  name: String,
});

const loginSchema = new Schema({
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
const userSchema = new Schema(
  {
    email: {
      type: String,
      unique: true,
      required: [true, "provide an email"],
    },
    password: {
      type: String,
      required: [true, "provide a password"],
    },
    username: {
      type: String,
      required: true,
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

  },
  {
    timestamps: true,
  },
);
userSchema.pre("save", async function () {
  this.passwordHash = await argon2.hash(this.password);
});
export const userModel = model("User", userSchema);
