import RootService from "./_root";
import { Request, Response, NextFunction } from "express";

class CallService extends RootService {
    async retell_webhook(req: Request, res: Response, next: NextFunction): Promise<Response>{
        try {
            const payload = req.body;

            const { event, data } = payload;

            const todays = new Date();
            todays.setHours(0, 0, 0, 0);
            const todayString = todays.toISOString().split("T")[0];

            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, "0");
            const day = String(today.getDate()).padStart(2, "0");
            const hours = String(today.getHours()).padStart(2, "0");
            const minutes = String(today.getMinutes()).padStart(2, "0");

            const todayStringWithTime = `${year}-${month}-${day}`;
            const time = `${hours}: ${minutes}`;
            try {
                if (event === "call_started") {
                    console.log(`call started for: ${data.call_id}`);
                } else if (event === "call_ended") {
                    console.log(`call ended: ${data.call_id}`);
                } else if (event === "call_analyzed") {
                    console.log(`call analyzed for: ${data.call_id}`);
                } else {
                    return res.status(500).json({ 
                        error: "Invalid event detected",
                        event_gotten: event
                    });
                };
            } catch (e) {
                console.error("Error reading event and data: " + e);
                next(e);
            };

            console.log("pay: ", payload);
            return res.status(204).send();
            
        } catch (e) {
            console.error("Error while accessing webhook from retell: " + e);
            next(e);
        };
    };
};

export const call_service = new CallService();