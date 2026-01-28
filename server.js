/* eslint-disable */
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// --- ゲームロジック用変数 ---
let rooms = {};
const INITIAL_DECK = [
  20, 15, 15, 10, 10, 10, 5, 5, 5, 5, 
  4, 4, 4, 4, 3, 3, 3, 3, 2, 2, 2, 2, 
  1, 1, 1, 1, 0, 0, 0, 0, -5, -5, 
  'x2', 'MAX->0', 'NIGHT'
];

function calculateTotal(players) {
  let cards = players.filter(p => p.life > 0).map(p => p.card);
  let numbers = cards.filter(c => typeof c === 'number');
  let total = numbers.reduce((a, b) => a + b, 0);
  if (cards.includes('MAX->0') && numbers.length > 0) {
    total -= Math.max(...numbers.filter(n => n > 0));
  }
  if (cards.includes('x2')) {
    total *= 2;
  }
  return total;
}

// --- Socket.io 通信ロジック ---
io.on("connection", (socket) => {
  socket.on("joinRoom", ({ roomName, userName }) => {
    if (!rooms[roomName]) {
      rooms[roomName] = { 
        players: [], gameStatus: "waiting", lastCount: 0, 
        currentTurn: 0, gameMessage: "待機中...", history: [],
        deck: [...INITIAL_DECK], needsShuffle: false 
      };
    }
    const room = rooms[roomName];
    if (room.players.some(p => p.name === userName)) {
      socket.emit("joinError", "その名前はすでに使われています。");
      return;
    }
    socket.join(roomName);
    room.players.push({ id: socket.id, name: userName || "名無し", card: 0, isHost: room.players.length === 1, life: 3 });
    io.to(roomName).emit("updateState", room);
  });

  socket.on("startGame", (roomName) => {
    const room = rooms[roomName];
    if (room) {
      room.gameStatus = "playing";
      room.lastCount = 0; room.currentTurn = 0; room.history = [];
      room.deck = [...INITIAL_DECK]; room.needsShuffle = false;
      room.players.forEach(p => {
        p.life = 3;
        const cardIndex = Math.floor(Math.random() * room.deck.length);
        p.card = room.deck.splice(cardIndex, 1)[0];
        if (p.card === 'NIGHT') room.needsShuffle = true;
      });
      room.gameMessage = "ゲーム開始！残りカード: " + room.deck.length;
      io.to(roomName).emit("updateState", room);
    }
  });

  socket.on("declare", ({ roomName, num }) => {
    const room = rooms[roomName];
    if (room?.gameStatus === "playing") {
      if (num <= room.lastCount) return;
      const playerName = room.players[room.currentTurn].name;
      room.lastCount = num;
      room.history.unshift({ name: playerName, count: num });
      do {
        room.currentTurn = (room.currentTurn + 1) % room.players.length;
      } while (room.players[room.currentTurn].life <= 0);
      room.gameMessage = `${playerName}が ${num} を宣言。`;
      io.to(roomName).emit("updateState", room);
    }
  });

  socket.on("callCoyote", (roomName) => {
    const room = rooms[roomName];
    if (room?.gameStatus === "playing") {
      const total = calculateTotal(room.players);
      const caller = room.players.find(p => p.id === socket.id);
      let prevIdx = (room.currentTurn + room.players.length - 1) % room.players.length;
      while (room.players[prevIdx].life <= 0) {
        prevIdx = (prevIdx + room.players.length - 1) % room.players.length;
      }
      const prevPlayer = room.players[prevIdx];
      let loser = room.lastCount > total ? prevPlayer : caller;
      loser.life -= 1;
      room.gameStatus = "result";
      room.gameMessage = `判定：合計は【${total}】！負けは【${loser.name}】`;
      const survivors = room.players.filter(p => p.life > 0);
      if (survivors.length === 1) {
        room.gameMessage = `🎊 優勝は【${survivors[0].name}】です！！ 🎊`;
        room.gameStatus = "waiting";
      }
      io.to(roomName).emit("updateState", room);
    }
  });

  socket.on("nextRound", (roomName) => {
    const room = rooms[roomName];
    if (room) {
      room.gameStatus = "playing"; room.lastCount = 0; room.history = [];
      if (room.deck.length < room.players.filter(p => p.life > 0).length || room.needsShuffle) {
        room.deck = [...INITIAL_DECK]; room.needsShuffle = false;
        room.gameMessage = "山札をシャッフルしました！";
      }
      room.players.forEach(p => {
        if (p.life > 0) {
          const cardIndex = Math.floor(Math.random() * room.deck.length);
          p.card = room.deck.splice(cardIndex, 1)[0];
          if (p.card === 'NIGHT') room.needsShuffle = true;
        } else { p.card = "脱落"; }
      });
      room.currentTurn = room.players.findIndex(p => p.life > 0);
      io.to(roomName).emit("updateState", room);
    }
  });

  socket.on("disconnect", () => {
    for (const roomName in rooms) {
      const room = rooms[roomName];
      const index = room.players.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        room.players.splice(index, 1);
        if (room.players.length === 0) {
          delete rooms[roomName];
        } else {
          room.players[0].isHost = true;
          io.to(roomName).emit("updateState", room);
        }
      }
    }
  });
});

// --- 本番環境用の配信設定 (ここが重要！) ---
if (process.env.NODE_ENV === 'production') {
  // Reactのビルドフォルダ（client/build）を静的ファイルとして提供
  app.use(express.static(path.join(__dirname, 'client/build')));
  
  // どんなリクエストに対してもReactのindex.htmlを返す
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}

server.listen(PORT, () => {
  console.log(`Coyote server is running on port ${PORT}`);
});