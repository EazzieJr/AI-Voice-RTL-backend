import express, { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/authRequest";
import AuthMiddleware from "../../middleware/auth";
import { admin_service } from "../../services/client/admin";

const authenticate = AuthMiddleware.authenticate;

const router = express.Router();

router
    .delete("/delete-list", authenticate, (request: AuthRequest, response: Response, next: NextFunction) => admin_service.delete_list(request, response, next));

export default router;
