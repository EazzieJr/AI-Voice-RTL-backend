"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const HTTP = {
    handle404(request, response, next) {
        const return_data = {
            status_code: 404,
            success: false,
            error: "Resource not found",
            payload: null
        };
        response.locals.payload = return_data;
        next();
    },
    handleError(error, request, response, next) {
        console.log({ error });
        return response.status((error === null || error === void 0 ? void 0 : error.status_code) || 500).json({
            success: false,
            status_code: (error === null || error === void 0 ? void 0 : error.status_code) || 500,
            error: (error === null || error === void 0 ? void 0 : error.error) || "Internal Server Error",
            payload: null,
            validation_errors: error === null || error === void 0 ? void 0 : error.validation_errors,
        });
    },
    processResponse(request, response, next) {
        if (!response.locals.payload)
            return next();
        const { status_code } = response.locals.payload;
        return response.status(status_code).json(response.locals.payload);
    },
    setupRequest(request, response, next) {
        request.headers["access-control-allow-origin"] = "*";
        request.headers["access-control-allow-headers"] = "*";
        if (request.method === "OPTIONS") {
            request.headers["access-control-allow-methods"] = "GET, POST, PUT, PATCH, DELETE";
            response.status(200).json();
        }
        next();
    },
};
exports.default = HTTP;
