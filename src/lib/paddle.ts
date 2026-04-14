import { Paddle } from '@paddle/paddle-node-sdk';
export const paddleClient = new Paddle(process.env.PADDLE_API_KEY!);
