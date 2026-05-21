import express from 'express';
import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const stateFile = path.join(rootDir, 'data', 'realtime-state.json');
const PORT = Number(process.env.PORT || 4173);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: true,
    credentials: true
  }
});

const initialState = {
  version: 1,
  records: {}
};

let state = { ...initialState };

async function loadState() {
  try {
    const raw = await fs.readFile(stateFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.records) {
      state = {
        version: Number(parsed.version || 1),
        records: parsed.records
      };
    }
  } catch {
    state = { ...initialState };
  }
}

async function persistState() {
  await fs.mkdir(path.dirname(stateFile), { recursive: true });
  await fs.writeFile(stateFile, JSON.stringify(state, null, 2), 'utf8');
}

function broadcastToRooms(payload) {
  const rooms = Array.from(new Set([...(payload.rooms || []), 'network_room']));
  rooms.forEach((room) => {
    io.to(room).emit('sync:patch', payload);
  });
}

function applyUpdates(updates = []) {
  updates.forEach((update) => {
    if (!update || !update.key) return;
    if (update.action === 'remove' || typeof update.value === 'undefined') {
      delete state.records[update.key];
      return;
    }
    state.records[update.key] = update.value;
  });
  state.version += 1;
}

app.use(express.static(rootDir, { extensions: ['html'] }));

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, version: state.version });
});

io.on('connection', (socket) => {
  socket.emit('sync:snapshot', { version: state.version, records: state.records });

  socket.on('session:join', ({ session, rooms = [] } = {}) => {
    const joinedRooms = new Set(['network_room', ...(rooms || [])]);
    if (session?.role) joinedRooms.add(`${session.role}s_room`);
    if (session?.role) joinedRooms.add(`${session.role}_room`);
    if (session?.id) joinedRooms.add(`session:${session.id}`);
    joinedRooms.forEach((room) => socket.join(room));
  });

  socket.on('session:leave', () => {
    socket.rooms.forEach((room) => {
      if (room !== socket.id) socket.leave(room);
    });
  });

  socket.on('snapshot:request', () => {
    socket.emit('sync:snapshot', { version: state.version, records: state.records });
  });

  socket.on('operational:event', async (payload = {}) => {
    const updates = Array.isArray(payload.updates) ? payload.updates : [];
    if (!updates.length) {
      broadcastToRooms({
        ...payload,
        sourceId: socket.id,
        version: state.version,
        ts: Date.now()
      });
      return;
    }

    applyUpdates(updates);
    await persistState();

    const response = {
      ...payload,
      sourceId: socket.id,
      version: state.version,
      ts: Date.now()
    };
    broadcastToRooms(response);
  });

  socket.on('disconnect', () => {
    socket.removeAllListeners();
  });
});

await loadState();

httpServer.listen(PORT, () => {
  console.log(`ReGenX realtime server listening on http://localhost:${PORT}`);
});