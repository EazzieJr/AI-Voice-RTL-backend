import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { userModel } from "../models/userModel";

interface AuthRequest extends Request {
  user?: any;
}

const authmiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer")) {
      return res.status(400).json({ message: "Authentication token required" });
    }
    const token = authHeader.split(" ")[1];
    try {
      const decodedToken = jwt.verify(
        token,
        process.env.JWT_SECRET,
      ) as JwtPayload;
      if (!decodedToken) {
        return res.status(400).json({ message: "Invalid token" });
      }
      req.user = await userModel
        .findById(decodedToken.userId)
        .select("-password");
      next();
    } catch (error) {
      console.log(error);
      return res.status(400).json({ message: "Auth failed" });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Failed to authenticate token" });
  }
};

export default authmiddleware;
