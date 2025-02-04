import express, { Request, Response, NextFunction } from "express";
import { admin_service } from "../services/admin";
import { AuthRequest } from "../middleware/authRequest";

const router = express.Router();

router
    .post("/search-client", (req: AuthRequest, res: Response, next: NextFunction) => {
            admin_service.search_client(req, res, next);
    })
    
  
export default router;