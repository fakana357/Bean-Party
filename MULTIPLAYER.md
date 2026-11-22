# Bean Party online

The server is `server/main.ts` (Deno). It serves the game and runs rooms.

Run it:

    deno run -A server/main.ts          # http://localhost:8000
    PORT=9000 deno run -A server/main.ts

Friends open the server's address in a browser and press PLAY ONLINE.
On a home PC that means your LAN address (or a tunnel such as `cloudflared tunnel --url http://localhost:8000`).

Deno Deploy: create a project from this folder with entrypoint `server/main.ts`
(`deployctl deploy --project=bean-party --entrypoint=server/main.ts`), keep it to a single region.
A page hosted somewhere else can point at a server with `?server=your-host`.

How it works: every client runs the same deterministic simulation (seeded RNG, fixed 1/40 s tick).
The server only stamps player inputs with the tick they apply on and streams ticks to the room (lockstep).
The intro pauses the tick clock until everyone has seen it. Clients send a state hash every 200 ticks;
a mismatch shows "Out of sync". A player who disconnects is taken over by a bot.
Vote to skip: more than half of the players skip the current minigame (it ends as a draw).
