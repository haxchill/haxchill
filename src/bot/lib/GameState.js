const GameState = (function () {
  let state = {
    players: {},
    playerList: [],
    gameSize: 1,
    gameInProgress: false,
    winnerTeam: null,
    draftMode: false,
    team1Captain: null,
    team2Captain: null,
    chooseMode: false,
  };

  function getSize() {
    return state.gameSize;
  }

  function getActivePlayers() {
    return Object.values(state.players).filter(p => p.team !== null && !p.afk);
  }

  function getTotalPlayers() {
    return Object.values(state.players).filter(p => !p.afk).length;
  }

  function getPlayersByTeam(team) {
    return Object.values(state.players).filter(p => p.team === team);
  }

  function calcNextSize(totalPlayers) {
    if (totalPlayers <= 2) return 1;
    if (totalPlayers <= 4) return 2;
    if (totalPlayers <= 6) return 3;
    return 4;
  }

  function assignCaptains() {
    const players = Object.values(state.players).filter(p => !p.afk);
    
    if (players.length < 9) {
      state.team1Captain = null;
      state.team2Captain = null;
      state.draftMode = false;
      return;
    }

    state.team1Captain = players[0];
    state.team2Captain = players[1];
    state.draftMode = true;
  }
  
  function simpleAssignTeams() {
    const availableIds = Object.keys(state.players).filter(id => !state.players[id].afk);
    const total = availableIds.length;
    const nextSize = calcNextSize(total);
    
    Object.keys(state.players).forEach(id => {
      state.players[id].team = null;
    });
    
    for (let i = 0; i < availableIds.length && i < nextSize * 2; i++) {
      const playerId = availableIds[i];
      state.players[playerId].team = (i % 2 === 0) ? 1 : 2;
    }
    
    state.gameSize = nextSize;
  }

  function assignTeams(ctx) {
    const availableIds = Object.keys(state.players).filter(id => !state.players[id].afk);
    const total = availableIds.length;
    const nextSize = calcNextSize(total);
    const toAssign = nextSize * 2;

    const players = availableIds.map(id => [id, state.players[id]]);
    let team1Count = 0,
      team2Count = 0;

    const winners = getPlayersByTeam(state.winnerTeam).map(p => p.playerId || Object.keys(state.players).find(id => state.players[id] === p));
    const losers = availableIds.filter(id => state.players[id].team !== state.winnerTeam);

    Object.keys(state.players).forEach(id => {
      state.players[id].team = null;
    });

    if (state.winnerTeam && winners.length > 0) {
      for (let i = 0; i < Math.min(winners.length, nextSize); i++) {
        const id = winners[i];
        if (state.players[id]) {
          state.players[id].team = state.winnerTeam;
          if (state.winnerTeam === 1) team1Count++;
          else team2Count++;
        }
      }
    }

    const available = losers.concat(availableIds.filter(id => state.players[id].team === null));
    for (const id of available) {
      if (team1Count < nextSize && state.players[id].team === null) {
        state.players[id].team = 1;
        team1Count++;
      } else if (team2Count < nextSize && state.players[id].team === null) {
        state.players[id].team = 2;
        team2Count++;
      }
    }

    state.gameSize = nextSize;
    state.winnerTeam = null;
    state.gameInProgress = false;
  }

  function addPlayer(playerId, playerName) {
    state.players[playerId] = { id: playerId, name: playerName, team: null, afk: false };
    state.playerList.push({ id: playerId, name: playerName });
    
    if (!state.gameInProgress) {
      assignCaptains();
    }
  }

  function removePlayer(playerId) {
    delete state.players[playerId];
    state.playerList = state.playerList.filter(p => p.id !== playerId);
    
  }

  function setGameInProgress(flag) {
    state.gameInProgress = flag;
  }

  function setAFK(playerId, flag) {
    if (!state.players[playerId]) return;
    state.players[playerId].afk = !!flag;
    state.players[playerId].team = null;
  }

  function setWinnerTeam(team) {
    state.winnerTeam = team;
  }

  function resetGame() {
    state.winnerTeam = null;
    state.gameInProgress = false;
    state.draftMode = false;
    state.chooseMode = false;
  }

  function getState() {
    return JSON.parse(JSON.stringify(state));
  }

  function getCaptains() {
    return { team1Captain: state.team1Captain, team2Captain: state.team2Captain };
  }

  function isDraftMode() {
    return state.draftMode;
  }

  function setDraftMode(flag) {
    state.draftMode = flag;
  }

  function isChooseMode() {
    return state.chooseMode;
  }

  function setChooseMode(flag) {
    state.chooseMode = !!flag;
  }

  return {
    getSize,
    getActivePlayers,
    getTotalPlayers,
    getPlayersByTeam,
    calcNextSize,
    assignCaptains,
    assignTeams,
    simpleAssignTeams,
    addPlayer,
    removePlayer,
    setGameInProgress,
    setWinnerTeam,
    resetGame,
    getState,
    getCaptains,
    isDraftMode,
    setDraftMode,
    isChooseMode,
    setChooseMode,
    setAFK,
  };
})();
