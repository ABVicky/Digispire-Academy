// Vercel function: POST /api/email (used when Vercel's Root Directory is the repo root).
// The real code lives in digispire-app/server/ so it shares node_modules with the app.
export { default } from '../digispire-app/server/handlers/emailApi.js';
