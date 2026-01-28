import React, { useState, useEffect } from "react";
import io from "socket.io-client";

const socket = io();

function App() {
  const [userName, setUserName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [room, setRoom] = useState(null);
  const [inRoom, setInRoom] = useState(false);
  const [declareNum, setDeclareNum] = useState(0);

  useEffect(() => {
    socket.on("updateState", (updatedRoom) => {
      setRoom(updatedRoom);
      setDeclareNum(updatedRoom.lastCount + 1);
    });

    socket.on("joinError", (msg) => {
      alert(msg);
      setInRoom(false);
    });

    return () => {
      socket.off("updateState");
      socket.off("joinError");
    };
  }, []);

  const handleJoin = () => {
    if (userName && roomName) {
      setInRoom(true);
      socket.emit("joinRoom", { roomName, userName });
    }
  };

  const startGame = () => socket.emit("startGame", roomName);
  const handleDeclare = () => socket.emit("declare", { roomName, num: parseInt(declareNum) });
  const callCoyote = () => socket.emit("callCoyote", roomName);
  const nextRound = () => socket.emit("nextRound", roomName);

  if (!inRoom) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h1>コヨーテ・オンライン 🐺</h1>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "300px", margin: "0 auto" }}>
          <input placeholder="名前" onChange={(e) => setUserName(e.target.value)} />
          <input placeholder="合言葉" onChange={(e) => setRoomName(e.target.value)} />
          <button onClick={handleJoin} style={{ padding: "10px", backgroundColor: "#4CAF50", color: "white" }}>ルームに入る</button>
        </div>
      </div>
    );
  }

  if (!room) return <div>読み込み中...</div>;

  const me = room.players.find(p => p.id === socket.id);
  const isMyTurn = room.gameStatus === "playing" && room.players[room.currentTurn]?.id === socket.id;

  return (
    <div style={{ padding: "10px", textAlign: "center", fontFamily: "sans-serif" }}>
      <h2>部屋: {roomName}</h2>
      <p style={{ background: "#eee", padding: "5px" }}>{room.gameMessage}</p>

      <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap", marginBottom: "20px" }}>
        {room.players.map((p, idx) => (
          <div key={p.id} style={{ 
            border: idx === room.currentTurn ? "3px solid #ff9800" : "1px solid #ccc",
            padding: "10px", borderRadius: "10px", width: "90px",
            backgroundColor: p.life <= 0 ? "#ddd" : "white"
          }}>
            <div style={{ fontSize: "0.8rem" }}>{p.name} {p.isHost && "👑"}</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", margin: "5px 0" }}>
              {room.gameStatus === "playing" && p.id === socket.id ? "？" : p.card}
            </div>
            <div>{"❤".repeat(p.life)}</div>
          </div>
        ))}
      </div>

      {room.gameStatus === "waiting" && me?.isHost && (
        <button onClick={startGame} style={{ padding: "10px 20px" }}>ゲーム開始</button>
      )}

      {isMyTurn && (
        <div style={{ border: "2px solid #ff9800", padding: "15px", borderRadius: "10px" }}>
          <p>あなたの番です！</p>
          <input type="number" value={declareNum} min={room.lastCount + 1} onChange={(e) => setDeclareNum(e.target.value)} style={{ width: "60px", fontSize: "1.2rem" }} />
          <button onClick={handleDeclare} style={{ marginLeft: "10px" }}>宣言</button>
          {room.lastCount > 0 && <button onClick={callCoyote} style={{ marginLeft: "10px", backgroundColor: "red", color: "white" }}>コヨーテ！</button>}
        </div>
      )}

      {room.gameStatus === "result" && me?.isHost && (
        <button onClick={nextRound} style={{ marginTop: "20px" }}>次のラウンドへ</button>
      )}

      <div style={{ marginTop: "20px", textAlign: "left", fontSize: "0.8rem" }}>
        <strong>履歴:</strong>
        {room.history.slice(0, 5).map((h, i) => <div key={i}>{h.name}: {h.count}</div>)}
      </div>

      <button onClick={() => window.location.reload()} style={{ marginTop: "20px", fontSize: "0.7rem" }}>退室する</button>
    </div>
  );
}

export default App;