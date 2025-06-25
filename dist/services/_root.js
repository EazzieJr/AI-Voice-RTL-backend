"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class RootService {
    constructor() { }
    ;
    handle_validation_errors(error, res, next) {
        if (error) {
            const errorMessages = error.details.map((detail) => detail.message.replace(/\"/g, ""));
            return res.status(400).json({
                error: "Validation failed",
                validation_errors: errorMessages,
                status_code: 400
            });
        }
    }
}
;
exports.default = RootService;
