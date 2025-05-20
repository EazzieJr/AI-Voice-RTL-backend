import { model, Schema } from "mongoose";
import argon2 from "argon2";
import { Document } from "mongoose";

export interface IAgent {
  agentId?: string;
  tag?: string[];
  alias?: string;
  name?: string;
};

export interface ILoginDetail {
  loginTime?: Date;
  ipAddress?: string;
  successful?: boolean;
};

export interface IUser extends Document {
  email?: string;
  password: string;
  username: string;
  group: string;
  isAdmin?: boolean;
  agents?: IAgent[];
  passwordHash?: string;
  name?: string;
  loginDetails?: ILoginDetail[];
  svgUrl?: string;
  autoEmail?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

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
    }
  },
  {
    timestamps: true,
  },
);

userSchema.pre("save", async function () {
  this.passwordHash = await argon2.hash(this.password);
});

export const userModel = model("User", userSchema);
