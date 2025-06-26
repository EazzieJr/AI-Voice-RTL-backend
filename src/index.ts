import dotenv from "dotenv";
// Load up env file which contains credentials
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

import { Server } from "./server";

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

const server = new Server();
server.listen(PORT);
