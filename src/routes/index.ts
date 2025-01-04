import app from "express";
const router = app.Router();

import client_route from "./client";

router.use("/client", client_route);

export default router;