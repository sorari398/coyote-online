import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:3001');

function App() {
  const [roomName, setRoomName] = useState("");
  const [userName, setUserName] = useState("");
  const [joined, setJoined] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [inputVal, setInputVal] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    socket.on("updateState", (data) => {
      setGameState(data);
      const isMyTurn = data.players[data.currentTurn]?.id === socket.id;
      if (isMyTurn && data.gameStatus === "playing") {
        setInputVal(data.lastCount + 1);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    });
    socket.on("joinError", (msg) => { alert(msg); setJoined(false); });
    return () => { socket.off("updateState"); socket.off("joinError"); };
  }, []);

  const handleJoin = () => {
    if (!roomName || !userName) return alert("情報を入力してください");
    socket.emit("joinRoom", { roomName, userName });
    setJoined(true);
  };

  if (!joined) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
        <h1>🌵 Coyote Online 🌵</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '250px', margin: 'auto' }}>
          <input placeholder="合言葉" value={roomName} onChange={(e) => setRoomName(e.target.value)} style={inputStyle} />
          <input placeholder="名前" value={userName} onChange={(e) => setUserName(e.target.value)} style={inputStyle} />
          <button onClick={handleJoin} style={mainBtnStyle}>ルームに参加</button>
        </div>
      </div>
    );
  }

  if (!gameState) return <p style={{ textAlign: 'center', marginTop: '50px' }}>接続中...</p>;

  const me = gameState.players.find(p => p.id === socket.id);
  const isMyTurn = gameState.players[gameState.currentTurn]?.id === socket.id;
  const iAmDead = me?.life <= 0;

  return (
    <div style={containerStyle}>
      <button onClick={() => setShowHelp(true)} style={helpBtnStyle}>?</button>

      {showHelp && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <button onClick={() => setShowHelp(false)} style={closeBtnStyle}>×</button>
            <h2 style={{ color: '#8d6e63' }}>🌵 ルール</h2>
            <p>・<strong>❤️は3つ。</strong>負けると1つ減ります。</p>
            <p>・<strong>NIGHT:</strong> 合計値は「0」として扱います。出たラウンド終了後に山札リセット。</p>
            <p>・<strong>脱落者:</strong> 全員のカードが見えるようになります。</p>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '10px' }}>
        <span>ルーム: {roomName}</span> | <span>🎴 山札残り: {gameState.deck?.length}枚</span>
        {gameState.needsShuffle && <span style={{ color: '#d32f2f', marginLeft: '10px', fontWeight: 'bold' }}>🌙 夜カード出現中 (次でシャッフル)</span>}
      </div>
      
      <div style={messageBoxStyle}><strong>{gameState.gameMessage}</strong></div>

      <div style={layoutGridStyle}>
        <div style={{ flex: 1 }}>
          <div style={cardsContainerStyle}>
            {gameState.players.map((p, i) => {
              const active = gameState.gameStatus === "playing" && gameState.currentTurn === i;
              const isPlayerDead = p.life <= 0;
              const canSeeCard = gameState.gameStatus === "result" || p.id !== socket.id || iAmDead;

              return (
                <div key={p.id} style={{
                  ...cardStyle,
                  opacity: isPlayerDead ? 0.5 : 1,
                  border: active ? '5px solid #ff9800' : '2px solid #5d4037',
                  transform: active ? 'scale(1.05)' : 'scale(1)',
                  backgroundColor: isPlayerDead ? '#ccc' : (p.card === 'NIGHT' && canSeeCard ? '#333' : 'white'),
                  color: (p.card === 'NIGHT' && canSeeCard) ? 'white' : 'black'
                }}>
                  <div style={cardHeaderStyle}>{p.isHost && "👑"}{p.name}</div>
                  <div style={cardNumStyle}>
                    {isPlayerDead ? "OUT" : (canSeeCard ? (
                      p.card === 'NIGHT' ? (
                        <div style={{ fontSize: '24px' }}>NIGHT<br/><span style={{ fontSize: '18px' }}>(0)</span></div>
                      ) : p.card
                    ) : "?")}
                  </div>
                  <div style={lifeStyle}>
                    {Array.from({ length: p.life }).map((_, idx) => <span key={idx}>❤️</span>)}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={panelStyle}>
            {gameState.gameStatus === "waiting" && me?.isHost && (
              <button onClick={() => socket.emit("startGame", roomName)} style={mainBtnStyle}>新しくゲームを開始</button>
            )}

            {gameState.gameStatus === "playing" && (
              <div>
                <p>現在の宣言: <strong style={{ color: 'red', fontSize: '32px' }}>{gameState.lastCount}</strong></p>
                {isMyTurn ? (
                  <div style={{ marginTop: '15px' }}>
                    <input ref={inputRef} type="number" value={inputVal} onChange={(e) => setInputVal(Number(e.target.value))} style={numInputStyle} />
                    <button onClick={() => socket.emit("declare", { roomName, num: inputVal })} style={gameBtnStyle}>宣言</button>
                    <button onClick={() => socket.emit("callCoyote", roomName)} style={{ ...gameBtnStyle, backgroundColor: '#d32f2f' }}>コヨーテ！</button>
                  </div>
                ) : <p style={{ color: '#888' }}>{iAmDead ? "観戦中..." : "待機中..."}</p>}
              </div>
            )}

            {gameState.gameStatus === "result" && me?.isHost && (
              <button onClick={() => socket.emit("nextRound", roomName)} style={mainBtnStyle}>次のラウンドへ</button>
            )}
          </div>
        </div>

        <div style={sidebarStyle}>
          <h4 style={{ margin: '0 0 10px 0' }}>履歴</h4>
          <div style={historyListStyle}>
            {gameState.history?.map((h, i) => (
              <div key={i} style={historyItemStyle}><strong>{h.name}</strong>: {h.count}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const containerStyle = { backgroundColor: '#f0e6d2', minHeight: '100vh', padding: '20px', textAlign: 'center', fontFamily: 'sans-serif', position: 'relative' };
const layoutGridStyle = { display: 'flex', justifyContent: 'center', gap: '20px', maxWidth: '1000px', margin: 'auto', flexWrap: 'wrap' };
const cardsContainerStyle = { display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '30px', flexWrap: 'wrap' };
const cardStyle = { width: '120px', height: '170px', borderRadius: '12px', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', transition: 'all 0.3s' };
const cardHeaderStyle = { position: 'absolute', top: '8px', width: '100%', fontSize: '12px', fontWeight: 'bold' };
const cardNumStyle = { fontSize: '36px', fontWeight: 'bold', lineHeight: '1' };
const lifeStyle = { position: 'absolute', bottom: '8px', width: '100%', fontSize: '14px' };
const panelStyle = { background: '#fff', padding: '25px', borderRadius: '20px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', display: 'inline-block', minWidth: '350px' };
const sidebarStyle = { width: '180px', backgroundColor: 'white', padding: '15px', borderRadius: '15px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' };
const historyListStyle = { textAlign: 'left', fontSize: '14px', overflowY: 'auto', maxHeight: '350px' };
const historyItemStyle = { padding: '5px 0', borderBottom: '1px dashed #eee' };
const messageBoxStyle = { background: '#fff', padding: '10px 20px', borderRadius: '10px', display: 'inline-block', marginBottom: '20px' };
const inputStyle = { padding: '12px', borderRadius: '5px', border: '1px solid #ccc' };
const numInputStyle = { width: '70px', fontSize: '20px', padding: '5px', textAlign: 'center' };
const mainBtnStyle = { padding: '12px 24px', backgroundColor: '#4caf50', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' };
const gameBtnStyle = { padding: '10px 20px', marginLeft: '10px', backgroundColor: '#8d6e63', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' };
const helpBtnStyle = { position: 'absolute', top: '20px', right: '20px', width: '40px', height: '40px', borderRadius: '50%', border: 'none', backgroundColor: '#8d6e63', color: 'white', fontSize: '24px', cursor: 'pointer' };
const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContentStyle = { backgroundColor: 'white', padding: '30px', borderRadius: '20px', maxWidth: '400px', textAlign: 'left', position: 'relative' };
const closeBtnStyle = { position: 'absolute', top: '10px', right: '15px', border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer' };

export default App;