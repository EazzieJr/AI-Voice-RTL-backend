import express, { Response, NextFunction } from "express";
import { profile_management_service } from "../../services/client/profile";
import { AuthRequest } from "../../middleware/authRequest";
import AuthMiddleware from "../../middleware/auth";
import { upload } from "../../middleware/multerConfig";
import { upload as load } from "../../utils/upload";

const authenticate = AuthMiddleware.authenticate;

const router = express.Router();

router
    .put(
        "/edit-profile", 
        authenticate,
        load.single("svgFile"),
        (req: AuthRequest, res: Response, next: NextFunction) => profile_management_service.edit_profile(req, res, next))

export default router;