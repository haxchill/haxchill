const WebSocket = require('ws');
const ByteBuffer = require('bytebuffer');

/**
 * Минимальное ядро headless-хоста HaxBall
 * Поддерживает: подключение, получение данных игры, управление диском, чат, голы.
 */
class HaxballCore {
    constructor(token, options = {}) {
        this.token = token;
        this.options = {
            name: options.name || '[BOT] Core',
            stadium: options.stadium || 'Classic',
            maxPlayers: options.maxPlayers || 12,
            noPlayer: options.noPlayer !== undefined ? options.noPlayer : true,
            ...options
        };

        this.ws = null;
        this.playerId = null;
        this.roomId = null;
        this.isConnected = false;

        // Состояние игры
        this.ball = null;
        this.players = [];
        this.scores = [0, 0];

        // Колбэки
        this._onReady = null;
        this._onGameTick = null;
        this._onTeamGoal = null;
        this._onPlayerJoin = null;
        this._onPlayerLeave = null;
        this._onChat = null;
    }

    // ─── ПОДКЛЮЧЕНИЕ ───────────────────────────────────────

    async connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket('wss://server.haxball.com/');

            this.ws.on('open', () => {
                this._sendLogin();
            });

            this.ws.on('message', (data) => {
                try {
                    this._handleMessage(data);
                } catch (err) {
                    console.error('Ошибка обработки пакета:', err);
                }
            });

            this.ws.on('close', (code, reason) => {
                this.isConnected = false;
                console.log(`Соединение закрыто: ${code} ${reason}`);
            });

            this.ws.on('error', (err) => {
                reject(err);
            });

            // Таймаут на подключение
            const timeout = setTimeout(() => {
                reject(new Error('Таймаут подключения к серверу HaxBall'));
            }, 10000);
        });
    }

    _sendLogin() {
        const tokenByteLength = Buffer.byteLength(this.token, 'utf8');
        const buf = new ByteBuffer(1 + tokenByteLength, ByteBuffer.LITTLE_ENDIAN);
        buf.writeUint8(0); // тип: login
        buf.writeUTF8String(this.token);
        this.ws.send(buf.flip().toBuffer());
    }

    // ─── ОБРАБОТКА ПАКЕТОВ ─────────────────────────────────

    _handleMessage(data) {
        const buf = new ByteBuffer(data, ByteBuffer.LITTLE_ENDIAN);
        const type = buf.readUint8();

        switch (type) {
            case 1: // Welcome
                this._handleWelcome(buf);
                break;
            case 50: // Game data (мяч, игроки, счёт)
                this._handleGameData(buf);
                if (this._onGameTick) this._onGameTick();
                break;
            case 64: // Goal
                const team = buf.readUint8();
                this.scores[team] = (this.scores[team] || 0) + 1;
                if (this._onTeamGoal) this._onTeamGoal(team);
                break;
            case 32: // Player join
                const player = this._readPlayer(buf);
                this.players.push(player);
                if (this._onPlayerJoin) this._onPlayerJoin(player);
                break;
            case 33: // Player leave
                const id = buf.readUint32();
                this.players = this.players.filter(p => p.id !== id);
                if (this._onPlayerLeave) this._onPlayerLeave(id);
                break;
            case 16: // Chat
                const senderId = buf.readUint32();
                const message = buf.readUTF8String();
                const sender = this.players.find(p => p.id === senderId) || { id: senderId, name: 'Unknown' };
                if (this._onChat) this._onChat(sender, message);
                break;
            default:
                // Игнорируем неизвестные пакеты
                break;
        }
    }

    _handleWelcome(buf) {
        this.playerId = buf.readUint32();
        this.roomId = buf.readUint32();
        this.isConnected = true;

        // Отправляем конфиг комнаты (имя, макс. игроков и т.д.)
        this._sendRoomConfig();

        if (this._onReady) this._onReady();
    }

    _sendRoomConfig() {
        const buf = new ByteBuffer(100, ByteBuffer.LITTLE_ENDIAN);
        buf.writeUint8(2); // тип: room config

        buf.writeUTF8String(this.options.name); // имя комнаты
        buf.writeUTF8String(this.options.stadium);
        buf.writeUint8(this.options.maxPlayers);
        buf.writeUint8(this.options.noPlayer ? 1 : 0); // noPlayer flag
        buf.writeUint8(0); // isPublic (0 = private, 1 = public)

        // Доп. настройки (можно оставить 0)
        buf.writeUint8(0); // maxPlayersPerTeam
        buf.writeUint8(0); // minPlayers
        buf.writeUint8(0); // timeLimit
        buf.writeUint8(0); // scoreLimit
        buf.writeUint8(0); // teamsLock
        buf.writeUint8(0); // allowTeams
        buf.writeUint8(0); // allowGuests
        buf.writeUint8(0); // stadiumVariant

        this.ws.send(buf.flip().toBuffer());
    }

    _handleGameData(buf) {
        // Мяч
        const ballX = buf.readFloat32();
        const ballY = buf.readFloat32();
        const ballVX = buf.readFloat32();
        const ballVY = buf.readFloat32();
        this.ball = { x: ballX, y: ballY, vx: ballVX, vy: ballVY };

        // Счёт
        this.scores[0] = buf.readUint16();
        this.scores[1] = buf.readUint16();

        // Игроки
        const players = [];
        const playerCount = buf.readUint8();
        for (let i = 0; i < playerCount; i++) {
            const id = buf.readUint32();
            const x = buf.readFloat32();
            const y = buf.readFloat32();
            const name = buf.readUTF8String();
            players.push({ id, x, y, name });
        }
        this.players = players;
    }

    _readPlayer(buf) {
        const id = buf.readUint32();
        const name = buf.readUTF8String();
        return { id, name };
    }

    // ─── УПРАВЛЕНИЕ ───────────────────────────────────────

    setDiscPosition(x, y) {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const buf = new ByteBuffer(9, ByteBuffer.LITTLE_ENDIAN);
        buf.writeUint8(32); // тип: set position
        buf.writeUint32(this.playerId);
        buf.writeFloat32(x);
        buf.writeFloat32(y);
        this.ws.send(buf.flip().toBuffer());
    }

    sendChat(message) {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const buf = new ByteBuffer(1 + message.length, ByteBuffer.LITTLE_ENDIAN);
        buf.writeUint8(16); // тип: chat
        buf.writeUTF8String(message);
        this.ws.send(buf.flip().toBuffer());
    }

    // ─── ГЕТТЕРЫ ──────────────────────────────────────────

    getBallPosition() {
        return this.ball ? { x: this.ball.x, y: this.ball.y } : null;
    }

    getScores() {
        return [...this.scores];
    }

    getPlayerList() {
        return [...this.players];
    }

    getPlayer(id) {
        return this.players.find(p => p.id === id);
    }

    // ─── СОБЫТИЯ ──────────────────────────────────────────

    onReady(callback) {
        this._onReady = callback;
    }

    onGameTick(callback) {
        this._onGameTick = callback;
    }

    onTeamGoal(callback) {
        this._onTeamGoal = callback;
    }

    onPlayerJoin(callback) {
        this._onPlayerJoin = callback;
    }

    onPlayerLeave(callback) {
        this._onPlayerLeave = callback;
    }

    onChat(callback) {
        this._onChat = callback;
    }
}

module.exports = HaxballCore;