import app from "express";
const router = app.Router();

import client_route from "./client";
import call_route from "./call";
import admin_route from "./admin";

router.use("/client", client_route);
router.use("/call", call_route);
router.use("/admin", admin_route);

export default router;