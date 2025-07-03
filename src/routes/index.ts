import app from "express";
const router = app.Router();

import new_client_route from "./client/index";
import client_route from "./client";
import call_route from "./call";
import admin_route from "./admin";
import user_route from "./user";

router.use("/client", new_client_route);
router.use("/client", client_route);
router.use("/call", call_route);
router.use("/admin", admin_route);
router.use("/user", user_route);

export default router;