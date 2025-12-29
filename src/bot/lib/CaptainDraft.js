// CaptainDraft: Manages captain-mode team selection
// Captains take turns picking players by number from available pool

const CaptainDraft = (function () {
  let state = {
    draftMode: false,
    currentTeam: 1, // Which team is picking (1 or 2)
    currentCaptain: null, // player object
    availablePlayers: [], // pool of unpicked players
    team1Captain: null,
    team2Captain: null,
    team1Roster: [],
    team2Roster: [],
  };

  function startDraft(availablePlayers, team1CaptainId, team2CaptainId, playerMap) {
    state.draftMode = true;
    state.currentTeam = 1;
    state.availablePlayers = availablePlayers.filter((p) => {
      const entry = playerMap[p.id];
      return p.id !== team1CaptainId && p.id !== team2CaptainId && entry && entry.afk !== true;
    });
    state.team1Captain = playerMap[team1CaptainId];
    state.team2Captain = playerMap[team2CaptainId];
    state.team1Roster = [state.team1Captain];
    state.team2Roster = [state.team2Captain];
    state.currentCaptain = state.team1Captain;
  }

  function getRosteredList() {
    const list = state.availablePlayers.map((p, idx) => (idx + 1) + '. ' + p.name).join('\n');
    return list;
  }

  function getRosterSummary() {
    const t1 = state.team1Roster.map((p) => p.name).join(', ');
    const t2 = state.team2Roster.map((p) => p.name).join(', ');
    return 'Красные: ' + t1 + '\nСиние: ' + t2;
  }

  function pickPlayer(playerIndex) {
    // playerIndex is 1-based (user typed 1, 2, 3...)
    const idx = playerIndex - 1;
    if (idx < 0 || idx >= state.availablePlayers.length) {
      return { success: false, message: 'Неверный номер игрока.' };
    }

    const player = state.availablePlayers[idx];
    state.availablePlayers.splice(idx, 1);

    if (state.currentTeam === 1) {
      state.team1Roster.push(player);
      state.currentTeam = 2;
    } else {
      state.team2Roster.push(player);
      state.currentTeam = 1;
    }

    state.currentCaptain = state.currentTeam === 1 ? state.team1Captain : state.team2Captain;

    // Check if draft is complete (all players assigned or one team full)
    const maxSize = Math.ceil(state.availablePlayers.length / 2) + 1; // estimate based on remaining
    if (state.team1Roster.length >= maxSize || state.team2Roster.length >= maxSize || state.availablePlayers.length === 0) {
      // Distribute remaining to balance
      while (state.availablePlayers.length > 0) {
        const p = state.availablePlayers.shift();
        if (state.team1Roster.length <= state.team2Roster.length) {
          state.team1Roster.push(p);
        } else {
          state.team2Roster.push(p);
        }
      }
      state.draftMode = false;
      return { success: true, message: 'Драфт завершен!', complete: true };
    }

    return { success: true, message: 'Игрок ' + player.name + ' добавлен в команду ' + (state.currentTeam === 1 ? 'красные' : 'синие') + '.', complete: false };
  }

  function getCurrentCaptain() {
    return state.currentCaptain;
  }

  function getTeamRosters() {
    return { team1: state.team1Roster, team2: state.team2Roster };
  }

  function isDraftActive() {
    return state.draftMode;
  }

  function resetDraft() {
    state.draftMode = false;
    state.currentTeam = 1;
    state.currentCaptain = null;
    state.availablePlayers = [];
    state.team1Captain = null;
    state.team2Captain = null;
    state.team1Roster = [];
    state.team2Roster = [];
  }

  function removeFromAvailable(playerId) {
    state.availablePlayers = state.availablePlayers.filter((p) => p.id !== playerId);
  }

  function addToAvailable(playerObj) {
    if (!playerObj || playerObj.afk === true) return;
    const exists = state.availablePlayers.some((p) => p.id === playerObj.id);
    if (!exists) {
      state.availablePlayers.push(playerObj);
    }
  }

  return {
    startDraft,
    getRosteredList,
    getRosterSummary,
    pickPlayer,
    getCurrentCaptain,
    getTeamRosters,
    isDraftActive,
    resetDraft,
    removeFromAvailable,
    addToAvailable,
  };
})();
