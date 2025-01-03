import { Request, Response, NextFunction } from "express";

interface Payload {
    status_code: number;
    success: boolean;
    error: string;
    payload: any;
    validation_errors?: string[];
}

const HTTP = {
    handle404(request: Request, response: Response, next: NextFunction): void {
        const return_data: Payload = {
            status_code: 404,
            success: false,
            error: "Resource not found",
            payload: null
        };

        response.locals.payload = return_data;

        next();
    },

    handleError(error: any, request: Request, response: Response, next: NextFunction): Response {
        console.log({ error });
        return response.status(error?.status_code || 500).json({
            success: false,
            status_code: error?.status_code || 500,
            error: error?.error || "Internal Server Error",
            payload: null,
            validation_errors: error?.validation_errors,
        });
    },

    processResponse(request: Request, response: Response, next: NextFunction): Response | void {
        if (!response.locals.payload) return next();

        const { status_code } = response.locals.payload;
        return response.status(status_code).json(response.locals.payload);
    },

    setupRequest(request: Request, response: Response, next: NextFunction): void {
        request.headers["access-control-allow-origin"] = "*";
        request.headers["access-control-allow-headers"] = "*";

        if (request.method === "OPTIONS") {
            request.headers["access-control-allow-methods"] = "GET, POST, PUT, PATCH, DELETE";
            response.status(200).json();
        }

        next();
    },
};

export default HTTP;