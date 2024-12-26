import { Schema, model } from "mongoose";

const graphSchema = new Schema(
  {
    date: {
      type: String,
      required: true,
    },
    agentId: { type: String, required: true },
    hourlyCalls: {
      type: Map,
      of: Number,
    },
  },
  { timestamps: true },
);

export const dailyGraphModel = model("graphStats", graphSchema);
