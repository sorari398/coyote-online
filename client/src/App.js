import React, { useState, useEffect } from "react";
import io from "socket.io-client";

const socket = io();

function App() {
  const [userName, setUserName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [room, setRoom] = useState(null);
  const [inRoom, setInRoom] = useState(false);
  const [declareNum, setDeclareNum] = useState(0);
  // ★追加: ヘルプ画面の表示フラグ
  const [showHelp, setShowHelp] = useState(false);

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

  // --- ログイン画面 ---
  if (!inRoom) {
    return (
      <div style={styles.container}>
        <div style={styles.loginCard}>
          <h1 style={styles.title}>COYOTE<br/><span style={{fontSize: '1.2rem', color: '#e67e22'}}>ONLINE</span></h1>
          <div style={styles.inputGroup}>
            <input style={styles.input} placeholder="プレイヤー名" onChange={(e) => setUserName(e.target.value)} />
            <input style={styles.input} placeholder="合言葉（ルーム名）" onChange={(e) => setRoomName(e.target.value)} />
            <button onClick={handleJoin} style={styles.mainButton}>荒野へ出る</button>
          </div>
        </div>
      </div>
    );
  }

  if (!room) return <div style={styles.container}>接続中...</div>;

  const me = room.players.find(p => p.id === socket.id);
  const isMyTurn = room.gameStatus === "playing" && room.players[room.currentTurn]?.id === socket.id;

  // --- ゲーム画面 ---
  return (
    <div style={styles.container}>
      {/* ★追加: ルール説明モーダル */}
      {showHelp && (
        <div style={styles.modalOverlay} onClick={() => setShowHelp(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h2 style={{color: '#d35400'}}>🐺 コヨーテ・ルール</h2>
            <div style={styles.ruleSection}>
              <h4>🃏 カードの種類</h4>
              <ul style={styles.ruleList}>
                <li><strong>正の数 (1〜20):</strong> 合計に加算</li>
                <li><strong>負の数 (-5):</strong> 合計からマイナス</li>
                <li><strong>x2:</strong> 全計算の最後に合計を2倍にする</li>
                <li><strong>MAX→0:</strong> 場にある最大の正の数を0にする</li>
                <li><strong>NIGHT:</strong> ラウンド終了後に山札をシャッフル</li>
              </ul>
              <h4>⚔️ 遊び方</h4>
              <p>自分のカードだけが見えません。前の人より大きい合計値を予想して宣言しましょう。超えたと思ったら「コヨーテ！」</p>
              <h4>👑 進行</h4>
              <p>ライフ3。2ラウンド目以降は前の敗者から開始します。</p>
            </div>
            <button onClick={() => setShowHelp(false)} style={styles.closeButton}>閉じる</button>
          </div>
        </div>
      )}

      <header style={styles.header}>
        <span style={styles.roomTag}>ROOM: {roomName}</span>
        <div style={{display: 'flex', gap: '10px'}}>
          {/* ★追加: ヘルプボタン */}
          <button onClick={() => setShowHelp(true)} style={styles.helpButton}>📖 ルール</button>
          <button onClick={() => window.location.reload()} style={styles.exitButton}>退室</button>
        </div>
      </header>

      <div style={styles.gameBoard}>
        <div style={styles.messageBanner}>{room.gameMessage}</div>

        <div style={styles.playerGrid}>
          {room.players.map((p, idx) => {
            const isActive = idx === room.currentTurn && room.gameStatus === "playing";
            return (
              <div key={p.id} style={{
                ...styles.playerCard,
                boxShadow: isActive ? "0 0 20px #ff9800" : "0 4px 6px rgba(0,0,0,0.1)",
                transform: isActive ? "scale(1.05)" : "scale(1)",
                opacity: p.life <= 0 ? 0.6 : 1,
                border: isActive ? "3px solid #ff9800" : "2px solid transparent"
              }}>
                <div style={styles.playerInfo}>
                  {p.isHost && "👑 "} {p.name}
                </div>
                <div style={styles.cardVisual}>
                  {room.gameStatus === "playing" && p.id === socket.id ? "？" : p.card}
                </div>
                <div style={styles.lifeArea}>{"❤️".repeat(p.life)}</div>
              </div>
            );
          })}
        </div>

        <div style={styles.actionSection}>
          {room.gameStatus === "waiting" && me?.isHost && (
            <button onClick={startGame} style={styles.startButton}>全員揃った！ゲーム開始</button>
          )}

          {isMyTurn && (
            <div style={styles.turnBox}>
              <h3 style={{margin: '0 0 10px 0', color: '#d35400'}}>あなたの番です</h3>
              <div style={styles.controlGroup}>
                <input type="number" value={declareNum} min={room.lastCount + 1} 
                  onChange={(e) => setDeclareNum(e.target.value)} style={styles.numberInput} />
                <button onClick={handleDeclare} style={styles.declareButton}>宣言する</button>
              </div>
              {room.lastCount > 0 && (
                <button onClick={callCoyote} style={styles.coyoteButton}>コヨーテ！(判定)</button>
              )}
            </div>
          )}

          {room.gameStatus === "result" && me?.isHost && (
            <button onClick={nextRound} style={styles.startButton}>次のラウンドを開始</button>
          )}
        </div>

        {room.history.length > 0 && (
          <div style={styles.historyBox}>
            <strong style={{fontSize: '0.8rem'}}>最近の宣言:</strong>
            <div style={styles.historyList}>
              {room.history.slice(0, 3).map((h, i) => (
                <span key={i} style={styles.historyItem}>{h.name}: {h.count}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- デザイン設定 ---
const styles = {
  // ... (既存のスタイルはそのまま)
  container: {
    minHeight: "100vh", backgroundColor: "#f3e5ab", backgroundImage: "radial-gradient(#e5d392 1px, transparent 1px)",
    backgroundSize: "20px 20px", fontFamily: "'Segoe UI', Roboto, sans-serif", display: "flex",
    flexDirection: "column", alignItems: "center", padding: "20px", color: "#2c3e50"
  },
  loginCard: { backgroundColor: "white", padding: "40px", borderRadius: "20px", boxShadow: "0 10px 25px rgba(0,0,0,0.1)", textAlign: "center", marginTop: "10vh" },
  title: { fontSize: "3rem", margin: "0 0 20px 0", letterSpacing: "5px", color: "#d35400", textShadow: "2px 2px 0px #fff" },
  inputGroup: { display: "flex", flexDirection: "column", gap: "15px" },
  input: { padding: "12px", borderRadius: "8px", border: "2px solid #ddd", fontSize: "1rem" },
  mainButton: { padding: "15px", backgroundColor: "#d35400", color: "white", border: "none", borderRadius: "8px", fontSize: "1.2rem", fontWeight: "bold", cursor: "pointer" },
  header: { width: "100%", maxWidth: "800px", display: "flex", justifyContent: "space-between", marginBottom: "20px" },
  roomTag: { background: "#fff", padding: "5px 15px", borderRadius: "20px", fontWeight: "bold" },
  exitButton: { background: "transparent", border: "none", cursor: "pointer", color: "#7f8c8d" },
  
  // ★追加: ヘルプボタン用スタイル
  helpButton: { background: "#fff", border: "1px solid #ddd", borderRadius: "20px", padding: "5px 15px", cursor: "pointer", fontSize: "0.9rem" },
  
  // ★追加: モーダル用スタイル
  modalOverlay: { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  modalContent: { backgroundColor: "white", padding: "30px", borderRadius: "20px", maxWidth: "90%", maxHeight: "80%", overflowY: "auto", position: "relative", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" },
  ruleSection: { textAlign: "left", marginBottom: "20px" },
  ruleList: { paddingLeft: "20px", lineHeight: "1.6" },
  closeButton: { width: "100%", padding: "10px", backgroundColor: "#d35400", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" },

  gameBoard: { width: "100%", maxWidth: "800px" },
  messageBanner: { backgroundColor: "#fff", padding: "15px", borderRadius: "10px", textAlign: "center", marginBottom: "20px", fontWeight: "bold" },
  playerGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "15px", marginBottom: "30px" },
  playerCard: { backgroundColor: "white", borderRadius: "12px", padding: "15px", textAlign: "center", transition: "all 0.3s ease" },
  playerInfo: { fontSize: "0.9rem", fontWeight: "bold", marginBottom: "10px" },
  cardVisual: { fontSize: "2rem", fontWeight: "bold", color: "#e67e22", backgroundColor: "#fdf2e9", borderRadius: "8px", padding: "10px 0", marginBottom: "10px" },
  lifeArea: { fontSize: "0.8rem" },
  actionSection: { textAlign: "center", marginBottom: "20px" },
  startButton: { padding: "15px 30px", fontSize: "1.1rem", backgroundColor: "#27ae60", color: "white", border: "none", borderRadius: "30px", cursor: "pointer" },
  turnBox: { backgroundColor: "#fff", padding: "20px", borderRadius: "15px", border: "2px solid #ff9800", display: "inline-block" },
  controlGroup: { display: "flex", gap: "10px", justifyContent: "center", marginBottom: "15px" },
  numberInput: { width: "80px", fontSize: "1.5rem", padding: "5px", textAlign: "center" },
  declareButton: { padding: "0 20px", backgroundColor: "#ff9800", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold" },
  coyoteButton: { width: "100%", padding: "10px", backgroundColor: "#c0392b", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold" },
  historyBox: { backgroundColor: "rgba(255,255,255,0.5)", padding: "10px", borderRadius: "10px" },
  historyList: { display: "flex", gap: "10px", justifyContent: "center", marginTop: "5px" },
  historyItem: { fontSize: "0.8rem", background: "#fff", padding: "2px 8px", borderRadius: "4px" }
};

export default App;