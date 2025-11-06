// admin.js - MULTI-DEVICE READY
let currentGame = null;
let gameInterval = null;
let storageInitialized = false;

// Initialize admin interface
async function initAdmin() {
    console.log('🔄 Starting admin initialization...');
    
    try {
        if (typeof sharedStorage === 'undefined') {
            setTimeout(initAdmin, 500);
            return;
        }
        
        const success = await sharedStorage.init();
        if (!success) {
            throw new Error('Failed to initialize storage');
        }
        
        storageInitialized = true;
        await loadCurrentGame();
        switchTab('setup');
        startGameMonitoring();
        
        const storageInfo = sharedStorage.getDatabaseInfo();
        const statusMessage = storageInfo.multiDevice 
            ? '🌐 Multi-Device Ready - Admin & Players on different devices' 
            : '💾 Single Device - Update Firebase rules for multi-device';
        
        updateConnectionStatus(statusMessage);
        addSyncButton();
        
        console.log('✅ Admin fully initialized - Multi-Device:', storageInfo.multiDevice);
        
    } catch (error) {
        console.error('❌ Admin initialization failed:', error);
        setTimeout(initAdmin, 1000);
    }
}

function updateConnectionStatus(message) {
    let statusElement = document.getElementById('connection-status');
    if (!statusElement) {
        const header = document.querySelector('.header');
        statusElement = document.createElement('div');
        statusElement.id = 'connection-status';
        statusElement.style.cssText = 'position: absolute; top: 20px; right: 20px; background: var(--success); color: white; padding: 5px 10px; border-radius: 15px; font-size: 12px;';
        header.style.position = 'relative';
        header.appendChild(statusElement);
    }
    statusElement.textContent = message;
}

function addSyncButton() {
    const navButtons = document.querySelector('.nav-buttons');
    const syncButton = document.createElement('button');
    syncButton.textContent = '🔄 Sync';
    syncButton.onclick = forceSync;
    syncButton.style.background = 'var(--info)';
    syncButton.title = 'Force refresh from cloud';
    navButtons.appendChild(syncButton);
}

function switchTab(tabName, event) {
    if (event) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
    }
    
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    refreshTabContent(tabName);
}

function refreshTabContent(tabName) {
    switch(tabName) {
        case 'setup': refreshGameSetup(); break;
        case 'players': refreshPlayersList(); break;
        case 'control': refreshGameControl(); break;
        case 'results': refreshResults(); break;
    }
}

async function createNewGame() {
    try {
        const gameName = document.getElementById('game-name').value || 'My Kahoot Game';
        const gamePin = await generateGamePin();
        
        console.log('🎮 Creating new game with PIN:', gamePin);
        
        const newGame = {
            pin: gamePin,
            name: gameName,
            status: 'waiting',
            currentQuestion: 0,
            players: {},
            questions: [],
            createdAt: new Date().toISOString(),
            lastUpdated: Date.now(),
            settings: { timeLimit: 20, points: { first: 1000, second: 800, third: 600, participation: 500 } }
        };
        
        const games = await sharedStorage.getGames();
        games[gamePin] = newGame;
        await sharedStorage.saveGames(games);
        
        console.log('✅ Game created and saved');
        
        currentGame = newGame;
        updateGameDisplay();
        document.getElementById('game-name').value = '';
        
        showShareInfo(gamePin);
        
    } catch (error) {
        console.error('❌ Error creating game:', error);
        alert('❌ Error creating game: ' + error.message);
    }
}

function showShareInfo(gamePin) {
    const storageInfo = sharedStorage.getDatabaseInfo();
    const isMultiDevice = storageInfo.multiDevice;
    
    const shareMessage = `🎮 Game Created Successfully!

📋 Game PIN: ${gamePin}

${isMultiDevice ? '🌐 MULTI-DEVICE READY!' : '💾 SINGLE DEVICE MODE'}
${isMultiDevice ? 'Share this PIN with players on ANY device or network!' : 'Players must use the same device'}

${isMultiDevice ? '✅ Admin on computer, Players on phones/tablets\n✅ Different networks supported\n✅ Real-time updates' : '🔧 Update Firebase rules for multi-device access'}`;
    
    alert(shareMessage);
}

async function generateGamePin() {
    let pin;
    const games = await sharedStorage.getGames();
    do {
        pin = Math.floor(100000 + Math.random() * 900000).toString();
    } while (games[pin]);
    return pin;
}

async function loadCurrentGame() {
    try {
        const games = await sharedStorage.getGames();
        const gamePins = Object.keys(games).filter(pin => games[pin]);
        
        if (gamePins.length > 0) {
            const latestPin = gamePins.reduce((latest, pin) => {
                return (games[pin].lastUpdated || 0) > (games[latest].lastUpdated || 0) ? pin : latest;
            }, gamePins[0]);
            
            currentGame = games[latestPin];
            console.log('🎯 Loaded current game:', currentGame.pin);
            updateGameDisplay();
            
            const storageInfo = sharedStorage.getDatabaseInfo();
            updateConnectionStatus(storageInfo.multiDevice ? '🌐 Multi-Device - Game Loaded' : '💾 Single Device - Game Loaded');
        } else {
            currentGame = null;
            updateGameDisplay();
            updateConnectionStatus('📭 No Games Found');
        }
    } catch (error) {
        console.error('❌ Error loading current game:', error);
        currentGame = null;
        updateGameDisplay();
    }
}

function updateGameDisplay() {
    const gamePinElement = document.getElementById('current-game-pin');
    const gameInfoElement = document.getElementById('game-info');
    
    const storageInfo = sharedStorage.getDatabaseInfo();
    const storageType = storageInfo.multiDevice ? '🌐 Multi-Device Cloud' : '💾 Single Device Local';
    
    if (currentGame) {
        gamePinElement.textContent = currentGame.pin;
        gameInfoElement.innerHTML = `
            <p><strong>Game Name:</strong> ${currentGame.name}</p>
            <p><strong>Status:</strong> <span class="status-${currentGame.status}">${currentGame.status.toUpperCase()}</span></p>
            <p><strong>Players Joined:</strong> ${Object.keys(currentGame.players).length}</p>
            <p><strong>Questions:</strong> ${currentGame.questions.length}</p>
            <p><strong>Storage:</strong> ${storageType}</p>
            <p><strong>Last Updated:</strong> ${new Date(currentGame.lastUpdated).toLocaleTimeString()}</p>
        `;
    } else {
        gamePinElement.textContent = 'No active game';
        gameInfoElement.innerHTML = '<p>Create a new game to get started!</p>';
    }
    
    refreshQuestionsList();
}

async function addQuestion() {
    if (!currentGame) {
        alert('Please create a game first');
        return;
    }
    
    const questionText = document.getElementById('question-text').value;
    const option1 = document.getElementById('option1').value;
    const option2 = document.getElementById('option2').value;
    const option3 = document.getElementById('option3').value;
    const option4 = document.getElementById('option4').value;
    const correctAnswer = parseInt(document.getElementById('correct-answer').value);
    const timeLimit = parseInt(document.getElementById('time-limit').value) || 20;
    
    if (!questionText || !option1 || !option2 || !option3 || !option4) {
        alert('Please fill in all fields');
        return;
    }
    
    const question = {
        text: questionText,
        options: [option1, option2, option3, option4],
        correctAnswer: correctAnswer,
        timeLimit: timeLimit
    };
    
    currentGame.questions.push(question);
    await saveGame();
    
    // Clear form
    document.getElementById('question-text').value = '';
    document.getElementById('option1').value = '';
    document.getElementById('option2').value = '';
    document.getElementById('option3').value = '';
    document.getElementById('option4').value = '';
    
    refreshQuestionsList();
    alert('✅ Question added successfully!');
}

function refreshQuestionsList() {
    const list = document.getElementById('questions-list');
    
    if (!currentGame || currentGame.questions.length === 0) {
        list.innerHTML = '<p class="no-data">No questions added yet</p>';
        return;
    }
    
    list.innerHTML = currentGame.questions.map((q, index) => `
        <div class="question-item">
            <h4>Question ${index + 1}</h4>
            <p><strong>Q:</strong> ${q.text}</p>
            <p><strong>Options:</strong></p>
            <ol>${q.options.map((opt, optIndex) => `<li>${opt} ${optIndex + 1 === q.correctAnswer ? '✅' : ''}</li>`).join('')}</ol>
            <p><strong>Time Limit:</strong> ${q.timeLimit} seconds</p>
            <button onclick="deleteQuestion(${index})" class="danger">Delete Question</button>
        </div>
    `).join('');
}

async function deleteQuestion(index) {
    if (confirm('Are you sure you want to delete this question?')) {
        currentGame.questions.splice(index, 1);
        await saveGame();
        refreshQuestionsList();
    }
}

function refreshPlayersList() {
    const list = document.getElementById('players-list');
    
    if (!currentGame || Object.keys(currentGame.players).length === 0) {
        list.innerHTML = '<p class="no-data">No players have joined yet</p>';
        return;
    }
    
    list.innerHTML = Object.values(currentGame.players).map(player => `
        <div class="player-card">
            <h4>${player.name}</h4>
            <p>🎯 Score: ${player.score || 0} points</p>
            <p>🟢 Online</p>
            <p>🕐 Joined: ${new Date(player.joinedAt).toLocaleTimeString()}</p>
        </div>
    `).join('');
}

async function startGame() {
    if (!currentGame) {
        alert('Please create a game first');
        return;
    }
    
    if (currentGame.questions.length === 0) {
        alert('Please add at least one question before starting the game');
        return;
    }
    
    if (Object.keys(currentGame.players).length === 0) {
        alert('Wait for at least one player to join before starting the game');
        return;
    }
    
    currentGame.status = 'playing';
    currentGame.currentQuestion = 0;
    currentGame.startedAt = new Date().toISOString();
    
    Object.keys(currentGame.players).forEach(playerId => {
        currentGame.players[playerId].score = 0;
        currentGame.players[playerId].answers = {};
    });
    
    await saveGame();
    refreshGameControl();
    
    alert('🎮 Game Started!\n\nPlayers can now begin answering questions.');
}

async function nextQuestion() {
    if (!currentGame || currentGame.status !== 'playing') return;
    
    if (currentGame.currentQuestion < currentGame.questions.length - 1) {
        currentGame.currentQuestion++;
        await saveGame();
        refreshGameControl();
    } else {
        await endGame();
    }
}

async function endGame() {
    if (!currentGame) return;
    
    currentGame.status = 'finished';
    currentGame.endedAt = new Date().toISOString();
    calculateFinalScores();
    
    await saveGame();
    refreshGameControl();
    refreshResults();
    
    alert('🏆 Game Ended!\n\nFinal results are now available to all players.');
}

function calculateFinalScores() {
    if (!currentGame) return;
    
    const sortedPlayers = Object.entries(currentGame.players)
        .sort(([,a], [,b]) => (b.score || 0) - (a.score || 0));
    
    sortedPlayers.forEach(([playerId, player], index) => {
        let bonus = 0;
        if (index === 0) bonus = currentGame.settings.points.first;
        else if (index === 1) bonus = currentGame.settings.points.second;
        else if (index === 2) bonus = currentGame.settings.points.third;
        else bonus = currentGame.settings.points.participation;
        
        player.score = (player.score || 0) + bonus;
        player.position = index + 1;
    });
}

function refreshGameControl() {
    const startBtn = document.getElementById('start-btn');
    const nextBtn = document.getElementById('next-btn');
    const endBtn = document.getElementById('end-btn');
    const questionDisplay = document.getElementById('current-question-display');
    
    if (!currentGame) {
        startBtn.classList.remove('hidden');
        nextBtn.classList.add('hidden');
        endBtn.classList.add('hidden');
        questionDisplay.classList.add('hidden');
        return;
    }
    
    switch(currentGame.status) {
        case 'waiting':
            startBtn.classList.remove('hidden');
            nextBtn.classList.add('hidden');
            endBtn.classList.add('hidden');
            questionDisplay.classList.add('hidden');
            break;
        case 'playing':
            startBtn.classList.add('hidden');
            nextBtn.classList.remove('hidden');
            endBtn.classList.remove('hidden');
            questionDisplay.classList.remove('hidden');
            showCurrentQuestion();
            break;
        case 'finished':
            startBtn.classList.add('hidden');
            nextBtn.classList.add('hidden');
            endBtn.classList.add('hidden');
            questionDisplay.classList.add('hidden');
            break;
    }
}

function showCurrentQuestion() {
    if (!currentGame || currentGame.status !== 'playing') return;
    
    const question = currentGame.questions[currentGame.currentQuestion];
    if (!question) return;
    
    document.getElementById('current-question-text').textContent = question.text;
    document.getElementById('question-timer').textContent = question.timeLimit;
    
    const optionsContainer = document.getElementById('current-options');
    optionsContainer.innerHTML = question.options.map((option, index) => {
        const optionLetter = String.fromCharCode(65 + index);
        const isCorrect = (index + 1) === question.correctAnswer;
        return `
            <div class="option ${isCorrect ? 'correct-answer' : ''}">
                <span class="option-letter">${optionLetter}</span>
                <span class="option-text">${option}</span>
                ${isCorrect ? ' ✅' : ''}
            </div>
        `;
    }).join('');
}

function refreshResults() {
    refreshLeaderboard();
    refreshQuestionResults();
}

function refreshLeaderboard() {
    const leaderboard = document.getElementById('live-leaderboard');
    
    if (!currentGame || Object.keys(currentGame.players).length === 0) {
        leaderboard.innerHTML = '<p class="no-data">No players yet</p>';
        return;
    }
    
    const sortedPlayers = Object.entries(currentGame.players)
        .sort(([,a], [,b]) => (b.score || 0) - (a.score || 0));
    
    leaderboard.innerHTML = sortedPlayers.map(([playerId, player], index) => {
        let medal = '';
        if (index === 0) medal = '🥇';
        else if (index === 1) medal = '🥈';
        else if (index === 2) medal = '🥉';
        
        return `
            <div class="leaderboard-item ${index < 3 ? 'top-three' : ''}">
                <div>
                    <span class="position">${medal} ${index + 1}</span>
                    <span>${player.name}</span>
                </div>
                <div>${player.score || 0} pts</div>
            </div>
        `;
    }).join('');
}

function refreshQuestionResults() {
    const resultsContainer = document.getElementById('question-results');
    
    if (!currentGame || currentGame.questions.length === 0) {
        resultsContainer.innerHTML = '<p class="no-data">No questions yet</p>';
        return;
    }
    
    resultsContainer.innerHTML = currentGame.questions.map((question, index) => {
        const correctAnswers = Object.values(currentGame.players).filter(player => 
            player.answers && player.answers[index] === question.correctAnswer
        ).length;
        
        const totalPlayers = Object.keys(currentGame.players).length;
        const percentage = totalPlayers > 0 ? Math.round((correctAnswers / totalPlayers) * 100) : 0;
        
        return `
            <div class="question-result">
                <h4>Question ${index + 1}</h4>
                <p>${question.text}</p>
                <p><strong>Correct Answers:</strong> ${correctAnswers}/${totalPlayers} (${percentage}%)</p>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

function startGameMonitoring() {
    console.log('⚡ Starting admin monitoring...');
    
    sharedStorage.startMonitoring(async (games) => {
        if (!currentGame && Object.keys(games).length > 0) {
            const latestPin = Object.keys(games).reduce((latest, pin) => {
                return (games[pin].lastUpdated || 0) > (games[latest].lastUpdated || 0) ? pin : latest;
            }, Object.keys(games)[0]);
            
            currentGame = games[latestPin];
            updateGameDisplay();
        } else if (currentGame && games[currentGame.pin]) {
            const updatedGame = games[currentGame.pin];
            if (updatedGame.lastUpdated > (currentGame.lastUpdated || 0)) {
                currentGame = updatedGame;
                updateGameDisplay();
                refreshTabContent(getActiveTab());
                updateConnectionStatus('🌐 Live Update');
            }
        } else if (currentGame && !games[currentGame.pin]) {
            alert('❌ Game was deleted');
            currentGame = null;
            updateGameDisplay();
        }
    });
}

function getActiveTab() {
    const activeTab = document.querySelector('.tab-content.active');
    return activeTab ? activeTab.id : 'setup';
}

async function saveGame() {
    if (!currentGame) return false;
    
    try {
        currentGame.lastUpdated = Date.now();
        const games = await sharedStorage.getGames();
        games[currentGame.pin] = currentGame;
        await sharedStorage.saveGames(games);
        
        console.log('💾 Game saved to storage');
        return true;
    } catch (error) {
        console.error('❌ Error saving game:', error);
        alert('❌ Error saving game: ' + error.message);
        return false;
    }
}

function refreshGameSetup() {
    updateGameDisplay();
    refreshQuestionsList();
}

async function forceSync() {
    updateConnectionStatus('🔄 Syncing...');
    const games = await sharedStorage.forceSync();
    if (currentGame && games[currentGame.pin]) {
        currentGame = games[currentGame.pin];
        updateGameDisplay();
        refreshTabContent(getActiveTab());
        updateConnectionStatus('🌐 Manual Sync Complete');
    } else {
        updateConnectionStatus('🌐 Sync Complete - No Changes');
    }
}

// Test Firebase connection
async function testFirebase() {
    const resultElement = document.getElementById('firebase-test-result');
    resultElement.innerHTML = '<p>🧪 Testing Multi-Device Access...</p>';
    
    if (typeof sharedStorage === 'undefined') {
        resultElement.innerHTML = '<p style="color: var(--warning)">⏳ Loading...</p>';
        setTimeout(testFirebase, 1000);
        return;
    }
    
    try {
        const result = await sharedStorage.testConnection();
        
        if (result.multiDevice) {
            resultElement.innerHTML = `
                <div style="background: var(--success); color: black; padding: 15px; border-radius: 10px; text-align: center;">
                    <h3>🎉 MULTI-DEVICE MODE ACTIVATED!</h3>
                    <p><strong>✅ Admin and Players can use different devices</strong></p>
                    <p>📱 Create game on computer → Players join from phones</p>
                    <p>🌐 Different networks supported</p>
                    <p>🚀 Real-time synchronization</p>
                </div>
            `;
        } else {
            resultElement.innerHTML = `
                <div style="background: var(--warning); color: black; padding: 15px; border-radius: 10px; text-align: center;">
                    <h3>🚨 SINGLE DEVICE MODE</h3>
                    <p><strong>Admin and Players must use the same device</strong></p>
                    <p>🔧 To enable multi-device:</p>
                    <ol style="text-align: left; margin: 10px 20px;">
                        <li>Go to <a href="https://console.firebase.google.com/" target="_blank">Firebase Console</a></li>
                        <li>Select project "krishna-4422"</li>
                        <li>Go to: Realtime Database → Rules</li>
                        <li>Replace ALL content with:</li>
                        <code style="display: block; background: #333; color: white; padding: 10px; margin: 10px; border-radius: 5px;">
                        { "rules": { ".read": true, ".write": true } }
                        </code>
                        <li>Click "Publish" and wait 2 minutes</li>
                        <li>Refresh this page</li>
                    </ol>
                </div>
            `;
        }
    } catch (error) {
        resultElement.innerHTML = '<p style="color: var(--warning)">⏳ Testing...</p>';
        setTimeout(testFirebase, 1000);
    }
}