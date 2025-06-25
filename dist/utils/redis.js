"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisConnection = exports.redisClient = void 0;
const redis_1 = require("redis");
exports.redisClient = (0, redis_1.createClient)({
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: 12658
    }
});
const redisConnection = async () => {
    exports.redisClient.on('error', (err) => {
        console.log('Redis Client Error', err);
    });
    exports.redisClient.on('ready', () => {
        console.log('=> Redis Ready');
    });
    await exports.redisClient.connect();
};
exports.redisConnection = redisConnection;
