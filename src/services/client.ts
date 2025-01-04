import RootService from "./_root";
import { Request, Response, NextFunction } from "express";

class ClientService extends RootService {

};

export const client_service = new ClientService();