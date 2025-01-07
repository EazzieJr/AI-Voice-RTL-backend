import app from "express";
const router = app.Router();

import client_route from "./client";
import call_route from "./call";

router.use("/client", client_route);
router.use("/call", call_route);

export default router;