import { createApp } from './app.mjs';
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1-65535.');
const server = createApp();
server.on('error', error => { console.error(`Could not start local server (${error.code}). Check PORT.`); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => {
  console.log(`CDAT Arena: http://127.0.0.1:${port}`);
  console.log('Local use only. Begin Arena Battle makes billable provider requests.');
  if (!process.env.GROQ_API_KEY || !process.env.HF_TOKEN) console.log('Configure fresh keys in .env before running a real battle.');
});
