import { Schema, model } from "mongoose";
import { Ilogs } from "../utils/types";
const dailyStatsSchema = new Schema<Ilogs>(
  {
    day: { type: String },
    totalCalls:{type: Number},
    totalTransffered:{type: Number},
    totalAnsweredByVm:{type: Number},
    totalFailed: {type:Number},
    totalAppointment:{type: Number},
    totalCallAnswered:{type:Number},
    agentId:{type:String},
    jobProcessedBy:{type:String},
    totalDialNoAnswer:{type: Number},
    totalAnsweredByIVR:{type:Number},
    totalCallInactivity:{type:Number},
    totalCallDuration:{type: Number}

  },
  { timestamps: true },
);

// Create model for daily call statistics
export const DailyStatsModel = model("DailyStats", dailyStatsSchema);
