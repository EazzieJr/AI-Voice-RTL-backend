import { dailyGraphModel } from "../models/graphModel";
import { DateTime } from "luxon"; 

export async function updateStatsByHour(
  agentId: string,
  date: string,
  timestamp: Date,
) {
  try {

    const pstTime = DateTime.fromJSDate(timestamp).setZone(
      "America/Los_Angeles",
    ); 
    const currentHour = pstTime.toFormat("HH"); 
    const hourKey = `${currentHour}:00`; 

    const statsUpdate = {
      $inc: {
        totalCalls: 1,
        [`hourlyCalls.${hourKey}`]: 1,
      },
    };

    const updatedStats = await dailyGraphModel.findOneAndUpdate(
      { date, agentId },
      statsUpdate,
      { upsert: true, new: true },
    );

    return updatedStats;
  } catch (error) {
    console.error("Error in updateStatsByHour:", error);
    throw error;
  }
}
