// shared-storage-firebase.js - MULTI-DEVICE FOCUSED
class FirebaseStorage {
    constructor() {
        this.firebaseConfig = {
            apiKey: "AIzaSyD-FE6-LeZjl9GBn61dqKzbX34mI20LXD4",
            authDomain: "krishna-4422.firebaseapp.com",
            databaseURL: "https://krishna-4422-default-rtdb.firebaseio.com",
            projectId: "krishna-4422",
            storageBucket: "krishna-4422.firebasestorage.app",
            messagingSenderId: "632904988205",
            appId: "1:632904988205:web:61b65635a1262084baeaa4"
        };
        
        this.app = null;
        this.db = null;
        this.listeners = [];
        this.initialized = false;
        this.useLocalStorage = false;
        this.connectionTested = false;
        
        console.log('🚀 Initializing Multi-Device Storage System...');
        this.initializeStorage();
    }

    async initializeStorage() {
        try {
            console.log('📡 Loading Firebase SDK for multi-device access...');
            
            // Load Firebase scripts
            await this.loadFirebaseScripts();
            
            // Initialize Firebase
            this.app = firebase.initializeApp(this.firebaseConfig);
            this.db = firebase.database();
            this.initialized = true;
            
            console.log('✅ Firebase initialized successfully');
            
            // Test Firebase connection
            const firebaseWorking = await this.testFirebaseConnection();
            
            if (firebaseWorking) {
                this.useLocalStorage = false;
                console.log('🎯🔥 MULTI-DEVICE MODE ACTIVATED!');
                console.log('📱 Admin and Players can use different devices');
                console.log('🌐 Real-time sync across all devices and networks');
                this.showMultiDeviceSuccess();
            } else {
                this.useLocalStorage = true;
                console.log('💾 SINGLE DEVICE MODE - Firebase blocked');
                this.showMultiDeviceBlocked();
            }
            
        } catch (error) {
            console.warn('⚠️ Firebase failed, single device mode only');
            this.useLocalStorage = true;
            this.initialized = true;
            this.showMultiDeviceBlocked();
        }
    }

    showMultiDeviceSuccess() {
        console.log('%c🌈 MULTI-DEVICE ACCESS ENABLED!', 'color: green; font-size: 16px; font-weight: bold;');
        console.log('✅ Admin on one device');
        console.log('✅ Players on different devices');
        console.log('✅ Different networks supported');
        console.log('✅ Real-time synchronization');
    }

    showMultiDeviceBlocked() {
        console.warn('%c🚨 MULTI-DEVICE ACCESS BLOCKED', 'color: red; font-size: 14px; font-weight: bold;');
        console.warn('🔧 To enable multi-device:');
        console.warn('1. Go to Firebase Console → Realtime Database → Rules');
        console.warn('2. Replace rules with: { "rules": { ".read": true, ".write": true } }');
        console.warn('3. Click "Publish" and wait 2 minutes');
        console.warn('4. Refresh this page');
    }

    async loadFirebaseScripts() {
        const scripts = [
            'https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js',
            'https://www.gstatic.com/firebasejs/9.6.10/firebase-database-compat.js'
        ];
        
        for (const src of scripts) {
            await this.loadScript(src);
        }
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => {
                console.warn(`❌ Failed to load: ${src}`);
                resolve();
            };
            document.head.appendChild(script);
        });
    }

    async testFirebaseConnection() {
        return new Promise((resolve) => {
            console.log('🔍 Testing Firebase multi-device access...');
            
            const timeout = setTimeout(() => {
                console.warn('⏰ Firebase connection timeout');
                resolve(false);
            }, 5000);

            // Test simple read operation first
            this.db.ref('.info/connected').once('value')
                .then(() => {
                    console.log('✅ Firebase read access confirmed');
                    
                    // Test write access
                    const testData = {
                        timestamp: Date.now(),
                        test: 'multi_device_test',
                        message: 'Testing cross-device access'
                    };

                    return this.db.ref('multiDeviceTest').set(testData);
                })
                .then(() => {
                    console.log('✅ Firebase write access confirmed');
                    this.db.ref('multiDeviceTest').remove();
                    clearTimeout(timeout);
                    resolve(true);
                })
                .catch((error) => {
                    clearTimeout(timeout);
                    if (error.code === 'PERMISSION_DENIED') {
                        console.warn('❌ Firebase permissions BLOCK multi-device access');
                    }
                    resolve(false);
                });
        });
    }

    async waitForInitialization() {
        let attempts = 0;
        while (!this.initialized && attempts < 30) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        if (!this.initialized) {
            throw new Error('Storage initialization timeout');
        }
        return true;
    }

    async init() {
        await this.waitForInitialization();
        return true;
    }

    async testConnection() {
        await this.waitForInitialization();
        
        if (this.useLocalStorage) {
            return {
                success: true,
                multiDevice: false,
                message: '❌ SINGLE DEVICE ONLY - Update Firebase rules for multi-device',
                instructions: 'Go to Firebase Console → Realtime Database → Rules → Set: { "rules": { ".read": true, ".write": true } } → Publish'
            };
        } else {
            return {
                success: true,
                multiDevice: true,
                message: '✅ MULTI-DEVICE READY! Admin and Players can use different devices and networks',
                instructions: 'Works across phones, tablets, computers - real-time sync!'
            };
        }
    }

    async getGames() {
        await this.waitForInitialization();
        
        if (this.useLocalStorage) {
            const games = JSON.parse(localStorage.getItem('kahoot_games') || '{}');
            console.log('📥 Games from localStorage (single device):', Object.keys(games).length);
            return games;
        } else {
            try {
                const snapshot = await this.db.ref('games').once('value');
                const games = snapshot.val() || {};
                console.log('📥 Games from Firebase (multi-device):', Object.keys(games).length);
                return games;
            } catch (error) {
                console.warn('❌ Firebase read failed, using localStorage');
                this.useLocalStorage = true;
                return this.getGames();
            }
        }
    }

    async saveGames(games) {
        await this.waitForInitialization();
        
        if (this.useLocalStorage) {
            localStorage.setItem('kahoot_games', JSON.stringify(games));
            console.log('💾 Saved to localStorage (single device)');
            this.notifyListeners(games);
            return true;
        } else {
            try {
                await this.db.ref('games').set(games);
                console.log('💾 Saved to Firebase (multi-device)');
                this.notifyListeners(games);
                return true;
            } catch (error) {
                console.warn('❌ Firebase save failed, using localStorage');
                this.useLocalStorage = true;
                return this.saveGames(games);
            }
        }
    }

    startMonitoring(callback) {
        this.addListener(callback);
        
        if (this.useLocalStorage) {
            console.log('👂 Single device monitoring (polling)');
            this.monitoringInterval = setInterval(async () => {
                const games = await this.getGames();
                callback(games);
            }, 2000);
        } else {
            console.log('👂 Multi-device real-time monitoring');
            this.db.ref('games').on('value', (snapshot) => {
                const games = snapshot.val() || {};
                callback(games);
            }, (error) => {
                console.error('❌ Firebase monitoring error, switching to single device');
                this.useLocalStorage = true;
                this.startMonitoring(callback);
            });
        }
    }

    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        if (this.db && !this.useLocalStorage) {
            this.db.ref('games').off();
        }
        this.listeners = [];
    }

    addListener(callback) {
        this.listeners.push(callback);
    }

    removeListener(callback) {
        this.listeners = this.listeners.filter(listener => listener !== callback);
    }

    notifyListeners(games) {
        this.listeners.forEach(listener => {
            try {
                listener(games);
            } catch (error) {
                console.error('Listener error:', error);
            }
        });
    }

    async forceSync() {
        return await this.getGames();
    }

    getDatabaseInfo() {
        return {
            multiDevice: !this.useLocalStorage,
            storage: this.useLocalStorage ? 'LocalStorage (Single Device)' : 'Firebase (Multi-Device)',
            status: this.useLocalStorage ? '❌ Limited to one device' : '✅ Multi-device ready'
        };
    }
}

// Create global instance
const sharedStorage = new FirebaseStorage();
window.sharedStorage = sharedStorage;

console.log('🎯 Multi-device storage system loaded!');