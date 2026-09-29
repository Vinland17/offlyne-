// Flowpay Studio Prototype & State Machine Engine
// Mirrors PaymentSessionManager, SmsTransactionParser, and CallOverlayService

document.addEventListener('DOMContentLoaded', () => {
  // App State
  const state = {
    bank: 'State Bank of India',
    sim: 'Jio',
    paymentState: 'IDLE', // IDLE, INITIATING, IN_PROGRESS, WAITING_FOR_VERIFICATION, SUCCESS, FAILED, CANCELLED
    currentSession: null, // { txnId, phone, amount, rail, startTime, expectedAmount, vpa, recipientName }
    transactions: [],
    callTimerInterval: null,
    callDurationSec: 0,
    windowCountdownInterval: null,
    windowRemainingSec: 600
  };

  // DOM Elements
  const views = {
    setup: document.getElementById('viewSetup'),
    home: document.getElementById('viewHome'),
    payContact: document.getElementById('viewPayContact'),
    scanQr: document.getElementById('viewScanQR'),
    merchantPay: document.getElementById('viewMerchantPay'),
    upiPin: document.getElementById('viewUpiPin'),
    callActive: document.getElementById('viewCallActive'),
    waitingVerification: document.getElementById('viewWaitingVerification'),
    paymentResult: document.getElementById('viewPaymentResult')
  };

  // 5 Approved Offline Merchants
  const APPROVED_VENDORS = [
    { name: 'Sharma General Store', vpa: 'sharmakirana@sbi', category: 'Grocery & Daily Needs', icon: '🛒' },
    { name: 'Ramesh Tea Stall', vpa: 'rameshtea@paytm', category: 'Food & Beverages', icon: '☕' },
    { name: 'City Care Pharmacy', vpa: 'citycaremed@icici', category: 'Health & Pharmacy', icon: '💊' },
    { name: 'Gupta Sweets', vpa: 'guptasweets@hdfcbank', category: 'Sweets & Snacks', icon: '🍬' },
    { name: 'Metro Supermart', vpa: 'metrosuper@axisbank', category: 'Retail & Supermarket', icon: '🛍️' }
  ];

  // Bank Default UPI PIN Mappings (Feature 2)
  const BANK_UPI_PINS = {
    'State Bank of India': '4701',
    'HDFC Bank': '1517',
    'ICICI Bank': '8367',
    'Punjab National Bank': '4979',
    'Axis Bank': '1408',
    'Kotak Mahindra Bank': '5467'
  };

  // Localized 20 Contacts Database (Feature 3)
  const SAVED_CONTACTS = [
    { name: 'Aarav Sharma', phone: '9820114523', role: 'Friend', city: 'Mumbai', avatar: 'AS' },
    { name: 'Priya Patel', phone: '9876543210', role: 'Family', city: 'Ahmedabad', avatar: 'PP' },
    { name: 'Rohan Verma', phone: '9811234567', role: 'Colleague', city: 'Delhi', avatar: 'RV' },
    { name: 'Ananya Iyer', phone: '9444012345', role: 'Roommate', city: 'Chennai', avatar: 'AI' },
    { name: 'Vikram Singh', phone: '9928098765', role: 'Landlord', city: 'Jaipur', avatar: 'VS' },
    { name: 'Sneha Kulkarni', phone: '9822054321', role: 'Freelancer', city: 'Pune', avatar: 'SK' },
    { name: 'Mohammad Zaid', phone: '9848067890', role: 'Supplier', city: 'Hyderabad', avatar: 'MZ' },
    { name: 'Pooja Nair', phone: '9847011223', role: 'Doctor', city: 'Kochi', avatar: 'PN' },
    { name: 'Arjun Reddy', phone: '9849033445', role: 'Architect', city: 'Bengaluru', avatar: 'AR' },
    { name: 'Sunita Devi', phone: '9431099887', role: 'Househelp', city: 'Patna', avatar: 'SD' },
    { name: 'Rahul Sengupta', phone: '9830055667', role: 'Accountant', city: 'Kolkata', avatar: 'RS' },
    { name: 'Neha Choudhary', phone: '9829077889', role: 'Gym Trainer', city: 'Chandigarh', avatar: 'NC' },
    { name: 'Deepak Joshi', phone: '9825022334', role: 'Electrician', city: 'Surat', avatar: 'DJ' },
    { name: 'Kavita Rao', phone: '9845044556', role: 'Tutor', city: 'Mysuru', avatar: 'KR' },
    { name: 'Rajesh Gupta', phone: '9810088990', role: 'Contractor', city: 'Lucknow', avatar: 'RG' },
    { name: 'Meera Nambiar', phone: '9846066778', role: 'Lawyer', city: 'Thiruvananthapuram', avatar: 'MN' },
    { name: 'Harpreet Kaur', phone: '9814011335', role: 'Baker', city: 'Amritsar', avatar: 'HK' },
    { name: 'Suresh Yadav', phone: '9450022446', role: 'Plumber', city: 'Varanasi', avatar: 'SY' },
    { name: 'Divya Menon', phone: '9447033557', role: 'Designer', city: 'Thrissur', avatar: 'DM' },
    { name: 'Amit Deshmukh', phone: '9823044668', role: 'Mechanic', city: 'Nagpur', avatar: 'AD' }
  ];

  // =========================================================================
  // PERSISTENT DATABASE ENGINE: IndexedDB + Partitioned Bank Ledgers
  // =========================================================================
  const DB_STORAGE_KEY = 'OFFLYNE_BANK_LEDGER_DB_V4';

  const DEFAULT_SEEDED_TXNS = {
    'State Bank of India': [
      {
        id: 'txn_sbi_94821',
        amount: '500.00',
        status: 'SUCCESS',
        payee: 'Sharma General Store',
        vpa: 'sharmakirana@sbi',
        rail: '*99*1*3# USSD (Scan-to-Pay)',
        bankName: 'State Bank of India',
        rrn: 'UPI/429810294821',
        excerpt: 'Dear SBI User, your A/c ending with 4521 has been debited by Rs 500.00 on 29Sep26 via UPI Ref 429810294821. Avl Bal Rs 12,480.00',
        timestamp: '09:15 PM',
        formattedDate: '29 Sep 2026, 09:15 PM',
        failureReason: ''
      },
      {
        id: 'txn_sbi_71092',
        amount: '300.00',
        status: 'FAILED',
        payee: 'Metro Supermart',
        vpa: 'metrosuper@axisbank',
        rail: 'UPI 123Pay (IVR)',
        bankName: 'State Bank of India',
        rrn: 'FAILED (Call Ended)',
        excerpt: 'Voice call terminated by user before PIN authentication completed. Transaction failed. No funds debited.',
        timestamp: '08:52 PM',
        formattedDate: '29 Sep 2026, 08:52 PM',
        failureReason: 'Call Ended by User'
      },
      {
        id: 'txn_sbi_81920',
        amount: '120.00',
        status: 'SUCCESS',
        payee: 'Ramesh Tea Stall',
        vpa: 'rameshtea@paytm',
        rail: 'UPI 123Pay (IVR)',
        bankName: 'State Bank of India',
        rrn: 'UPI/429810183722',
        excerpt: 'SBI Alert: Rs 120.00 debited from A/c XX4521 for Ramesh Tea Stall UPI ref 429810183722. Bal Rs 12,980.00',
        timestamp: '08:40 PM',
        formattedDate: '29 Sep 2026, 08:40 PM',
        failureReason: ''
      }
    ],
    'HDFC Bank': [
      {
        id: 'txn_hdfc_50192',
        amount: '750.00',
        status: 'SUCCESS',
        payee: 'City Care Pharmacy',
        vpa: 'citycaremed@icici',
        rail: 'UPI 123Pay (IVR)',
        bankName: 'HDFC Bank',
        rrn: 'UPI/409823901824',
        excerpt: 'UPDATE: Rs 750.00 debited from HDFC Bank A/c **9021 on 29-SEP-26 to UPI txn 409823901824. Balance: INR 34,200.50.',
        timestamp: '07:30 PM',
        formattedDate: '29 Sep 2026, 07:30 PM',
        failureReason: ''
      },
      {
        id: 'txn_hdfc_49012',
        amount: '1000.00',
        status: 'FAILED',
        payee: 'Vikram Singh',
        vpa: '9928098765@upi',
        rail: 'UPI 123Pay (IVR)',
        bankName: 'HDFC Bank',
        rrn: 'FAILED (Call Dropped)',
        excerpt: 'Telephony carrier dropped connection during DTMF stage. Payment attempt cancelled without debit.',
        timestamp: '07:10 PM',
        formattedDate: '29 Sep 2026, 07:10 PM',
        failureReason: 'Call Dropped / Network Abort'
      }
    ],
    'ICICI Bank': [
      {
        id: 'txn_icici_30194',
        amount: '350.00',
        status: 'SUCCESS',
        payee: 'Gupta Sweets',
        vpa: 'guptasweets@hdfcbank',
        rail: 'UPI 123Pay (IVR)',
        bankName: 'ICICI Bank',
        rrn: 'UPI/309812903112',
        excerpt: 'Dear ICICI Customer, your A/c XX302 is debited for Rs 350.00 on 29-Sep-26. UPI Ref 309812903112. Avl Bal Rs 7,750.00',
        timestamp: '06:15 PM',
        formattedDate: '29 Sep 2026, 06:15 PM',
        failureReason: ''
      },
      {
        id: 'txn_icici_21094',
        amount: '500.00',
        status: 'FAILED',
        payee: 'Aarav Sharma',
        vpa: '9820114523@upi',
        rail: 'UPI 123Pay (IVR)',
        bankName: 'ICICI Bank',
        rrn: 'FAILED (Declined)',
        excerpt: 'Transaction Failed: Insufficient funds in ICICI Bank A/c XX302 for Rs 500.00 payment.',
        timestamp: '05:40 PM',
        formattedDate: '29 Sep 2026, 05:40 PM',
        failureReason: 'Insufficient Funds / Declined'
      }
    ],
    'Punjab National Bank': [],
    'Axis Bank': [],
    'Kotak Mahindra Bank': []
  };

  const OfflyneDB = {
    _db: null,

    init() {
      try {
        const existing = localStorage.getItem(DB_STORAGE_KEY);
        if (!existing) {
          localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(DEFAULT_SEEDED_TXNS));
        }
      } catch(e) {}

      if ('indexedDB' in window) {
        try {
          const req = indexedDB.open('OfflynePaymentsDB', 1);
          req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('transactions')) {
              const store = db.createObjectStore('transactions', { keyPath: 'id' });
              store.createIndex('bankName', 'bankName', { unique: false });
            }
          };
          req.onsuccess = (e) => {
            this._db = e.target.result;
            this.syncAllToIndexedDb();
          };
        } catch(e) {}
      }
    },

    getAllByBank(bankName) {
      try {
        const raw = localStorage.getItem(DB_STORAGE_KEY);
        const data = raw ? JSON.parse(raw) : DEFAULT_SEEDED_TXNS;
        return data[bankName] || [];
      } catch(e) {
        return [];
      }
    },

    getAllBanksData() {
      try {
        const raw = localStorage.getItem(DB_STORAGE_KEY);
        return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEFAULT_SEEDED_TXNS));
      } catch(e) {
        return JSON.parse(JSON.stringify(DEFAULT_SEEDED_TXNS));
      }
    },

    getAllUnifiedList() {
      const data = this.getAllBanksData();
      const all = [];
      Object.keys(data).forEach(bank => {
        if (Array.isArray(data[bank])) {
          all.push(...data[bank]);
        }
      });
      return all.sort((a, b) => (b.id > a.id ? 1 : -1));
    },

    getById(id) {
      const all = this.getAllUnifiedList();
      return all.find(t => t.id === id) || null;
    },

    saveTransaction(txn) {
      const bank = txn.bankName || state.bank;
      const data = this.getAllBanksData();
      if (!data[bank]) data[bank] = [];
      data[bank].unshift(txn);

      try {
        localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(data));
      } catch(e) {}

      if (this._db) {
        try {
          const tx = this._db.transaction('transactions', 'readwrite');
          tx.objectStore('transactions').put(txn);
        } catch(e) {}
      }

      logState(`💾 Committed transaction ${txn.id} (₹${txn.amount}) to Database under bank: "${bank}"`);
    },

    clearAll() {
      const empty = {
        'State Bank of India': [],
        'HDFC Bank': [],
        'ICICI Bank': [],
        'Punjab National Bank': [],
        'Axis Bank': [],
        'Kotak Mahindra Bank': []
      };
      try {
        localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(empty));
      } catch(e) {}
      if (this._db) {
        try {
          const tx = this._db.transaction('transactions', 'readwrite');
          tx.objectStore('transactions').clear();
        } catch(e) {}
      }
      logState('Database reset: cleared all stored transactions.');
    },

    syncAllToIndexedDb() {
      if (!this._db) return;
      const all = this.getAllUnifiedList();
      try {
        const tx = this._db.transaction('transactions', 'readwrite');
        const store = tx.objectStore('transactions');
        all.forEach(item => store.put(item));
      } catch(e) {}
    }
  };

  OfflyneDB.init();

  let selectedVendor = null;
  let isScanningActive = false;
  let scanAnimationId = null;

  const qrScanCanvas = document.getElementById('qrScanCanvas');
  const qrScanCtx = qrScanCanvas ? qrScanCanvas.getContext('2d') : null;
  const qrErrorModal = document.getElementById('qrErrorModal');
  const qrErrorDesc = document.getElementById('qrErrorDesc');

  function playSuccessBeep() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch(e) {}
  }

  // Hardware-accelerated BarcodeDetector (Chrome/Edge/Android native)
  let nativeBarcodeDetector = null;
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      nativeBarcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
    } catch (e) {
      nativeBarcodeDetector = null;
    }
  }

  let lastScanTime = 0;
  const SCAN_INTERVAL_MS = 120; // 8 FPS scanning prevents UI freezing & webcam stutter

  async function decodeFrame(videoOrImgElement) {
    // 1. Try native hardware BarcodeDetector first (fastest, works on blurry/tilted QRs)
    if (nativeBarcodeDetector) {
      try {
        const barcodes = await nativeBarcodeDetector.detect(videoOrImgElement);
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          const val = barcodes[0].rawValue.trim();
          if (val) return val;
        }
      } catch (e) {}
    }

    // 2. High-performance downscaled jsQR fallback
    if (typeof jsQR !== 'undefined' && qrScanCanvas && qrScanCtx) {
      try {
        const srcW = videoOrImgElement.videoWidth || videoOrImgElement.naturalWidth || videoOrImgElement.width || 640;
        const srcH = videoOrImgElement.videoHeight || videoOrImgElement.naturalHeight || videoOrImgElement.height || 480;
        if (srcW > 0 && srcH > 0) {
          // Scale down to max 480px width for sub-15ms jsQR decode times
          const targetW = Math.min(480, srcW);
          const targetH = Math.round((srcH / srcW) * targetW);
          qrScanCanvas.width = targetW;
          qrScanCanvas.height = targetH;
          qrScanCtx.drawImage(videoOrImgElement, 0, 0, targetW, targetH);
          const imgData = qrScanCtx.getImageData(0, 0, targetW, targetH);
          const code = jsQR(imgData.data, targetW, targetH, { inversionAttempts: 'attemptBoth' });
          if (code && code.data && code.data.trim()) {
            return code.data.trim();
          }
        }
      } catch (e) {}
    }
    return null;
  }

  function startScanningLoop() {
    isScanningActive = true;
    async function scanFrame(timestamp) {
      if (!isScanningActive) return;
      if (timestamp - lastScanTime >= SCAN_INTERVAL_MS) {
        lastScanTime = timestamp;
        if (qrCameraFeed && (qrCameraFeed.readyState >= 2 || qrCameraFeed.videoWidth > 0)) {
          const detected = await decodeFrame(qrCameraFeed);
          if (detected && isScanningActive) {
            isScanningActive = false;
            handleScannedQr(detected);
            return;
          }
        }
      }
      scanAnimationId = requestAnimationFrame(scanFrame);
    }
    scanAnimationId = requestAnimationFrame(scanFrame);
  }

  function stopScanningLoop() {
    isScanningActive = false;
    if (scanAnimationId) {
      cancelAnimationFrame(scanAnimationId);
      scanAnimationId = null;
    }
  }

  function handleScannedQr(rawText) {
    const cleanText = (rawText || '').trim();
    if (!cleanText) return;
    logState(`QR Scanner detected: "${cleanText}"`);

    // 1. Direct match with 5 approved merchants
    const lower = cleanText.toLowerCase();
    const matchedVendor = APPROVED_VENDORS.find(v => {
      const vName = v.name.toLowerCase();
      const vVpa = v.vpa.toLowerCase();
      return lower === vName || lower === vVpa || lower.includes(vName) || lower.includes(vVpa);
    });

    if (matchedVendor) {
      playSuccessBeep();
      logState(`✓ Verified merchant recognized: ${matchedVendor.name} (${matchedVendor.category})`);
      openMerchantPaymentSheet(matchedVendor);
      return;
    }

    // 2. Universal QR Detection rule:
    // Any other QR code -> 1-in-10 chance of invalid rejection (10%),
    // otherwise 90% chance maps to a random approved merchant for simulation!
    const isInvalid = Math.random() < 0.10;

    if (isInvalid) {
      playErrorBuzz();
      logState(`❌ QR validation rejected (1-in-10 simulation test triggered): "${cleanText.slice(0, 35)}"`);
      if (qrErrorDesc) {
        qrErrorDesc.textContent = `"${cleanText.length > 32 ? cleanText.slice(0, 32) + '...' : cleanText}" could not be verified on the OFFLYNE network. (Verification Error: 10% invalid test)`;
      }
      if (qrErrorModal) {
        qrErrorModal.classList.remove('hidden');
      }
    } else {
      // 90% chance -> select random merchant from the 5 vendors
      const randomVendor = APPROVED_VENDORS[Math.floor(Math.random() * APPROVED_VENDORS.length)];
      playSuccessBeep();
      logState(`✓ Universal QR detected: "${cleanText.length > 35 ? cleanText.slice(0, 35) + '...' : cleanText}". Mapped to random merchant: ${randomVendor.name}`);
      openMerchantPaymentSheet(randomVendor);
    }
  }

  function openMerchantPaymentSheet(vendor) {
    stopCamera();
    stopScanningLoop();
    selectedVendor = vendor;
    document.getElementById('merchantAvatarIcon').textContent = vendor.icon;
    document.getElementById('merchantDisplayName').textContent = vendor.name;
    document.getElementById('merchantCategoryText').textContent = vendor.category;
    document.getElementById('merchantVpaText').textContent = vendor.vpa;

    const rail = state.sim === 'Jio' ? 'UPI 123Pay (IVR)' : '*99*1*3# USSD (Scan-to-Pay)';
    document.getElementById('merchantRailLabel').textContent = rail;

    const amtInput = document.getElementById('merchantAmountInput');
    amtInput.value = '';
    showView('merchantPay');
    setTimeout(() => amtInput.focus(), 200);
  }

  const statusTime = document.getElementById('statusTime');
  const statusCarrier = document.getElementById('statusCarrier');
  const activeSimLabel = document.getElementById('activeSimLabel');
  const stateMachineBadge = document.getElementById('stateMachineBadge');
  const stateDebugLog = document.getElementById('stateDebugLog');

  // Camera handling for QR Scanner
  let activeMediaStream = null;
  const qrCameraFeed = document.getElementById('qrCameraFeed');
  const cameraStatusPill = document.getElementById('cameraStatusPill');

  async function startCamera() {
    if (qrErrorModal) qrErrorModal.classList.add('hidden');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (cameraStatusPill) cameraStatusPill.textContent = '⚠️ Camera API not supported in browser';
      return;
    }
    try {
      if (cameraStatusPill) cameraStatusPill.textContent = '📷 Opening Device Camera...';
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      activeMediaStream = stream;
      if (qrCameraFeed) {
        qrCameraFeed.srcObject = stream;
        await qrCameraFeed.play().catch(() => {});
        qrCameraFeed.style.opacity = '1';
      }
      if (cameraStatusPill) cameraStatusPill.textContent = '🟢 Camera Feed Active (Point at QR)';
      logState('Device camera hardware initialized for QR scanning');
      startScanningLoop();
    } catch (err) {
      console.warn('Camera access:', err);
      if (cameraStatusPill) {
        cameraStatusPill.textContent = '📷 Camera Active (Permission prompt or simulator preview)';
      }
    }
  }

  function stopCamera() {
    stopScanningLoop();
    if (activeMediaStream) {
      activeMediaStream.getTracks().forEach(track => track.stop());
      activeMediaStream = null;
    }
    if (qrCameraFeed) {
      qrCameraFeed.srcObject = null;
      qrCameraFeed.style.opacity = '0';
    }
    if (cameraStatusPill) cameraStatusPill.textContent = '📷 Camera Standby';
  }

  // Update clock every minute
  function updateClock() {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    statusTime.textContent = `${hrs}:${mins}`;
  }
  updateClock();
  setInterval(updateClock, 30000);

  // Switch Active Phone View
  function showView(viewKey) {
    Object.keys(views).forEach(k => {
      if (views[k]) {
        views[k].classList.add('hidden');
      }
    });
    if (views[viewKey]) {
      views[viewKey].classList.remove('hidden');
    }
  }

  // Logger
  function logState(msg) {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const line = document.createElement('div');
    line.textContent = `[${timeStr}] ${msg}`;
    stateDebugLog.appendChild(line);
    stateDebugLog.scrollTop = stateDebugLog.scrollHeight;
  }

  // State Machine Node Updates
  function setPaymentState(newState, reason = '') {
    state.paymentState = newState;
    stateMachineBadge.textContent = newState;

    // Reset nodes
    document.querySelectorAll('.state-node').forEach(node => node.classList.remove('active'));

    if (newState === 'IDLE') {
      document.getElementById('nodeIdle').classList.add('active');
    } else if (newState === 'INITIATING') {
      document.getElementById('nodeInitiating').classList.add('active');
    } else if (newState === 'IN_PROGRESS') {
      document.getElementById('nodeInProgress').classList.add('active');
    } else if (newState === 'WAITING_FOR_VERIFICATION') {
      document.getElementById('nodeWaiting').classList.add('active');
    } else if (['SUCCESS', 'FAILED', 'CANCELLED'].includes(newState)) {
      document.getElementById('nodeTerminal').classList.add('active');
    }

    logState(`PaymentState -> ${newState} ${reason ? `(${reason})` : ''}`);
  }

  // Setup Screen Logic
  const setupBankSelect = document.getElementById('setupBankSelect');
  const setupSimSelect = document.getElementById('setupSimSelect');
  const simRailNotice = document.getElementById('simRailNotice');
  const btnCompleteSetup = document.getElementById('btnCompleteSetup');

  setupBankSelect.addEventListener('change', (e) => {
    state.bank = e.target.value;
    logState(`Bank selected: ${state.bank}`);
  });

  setupSimSelect.addEventListener('change', (e) => {
    state.sim = e.target.value;
    statusCarrier.textContent = state.sim;
    activeSimLabel.textContent = `Carrier: ${state.sim} (${state.sim === 'Jio' ? '123Pay IVR' : '*99# & 123Pay'})`;

    if (state.sim === 'Jio') {
      simRailNotice.innerHTML = `ℹ️ <strong>Jio VoLTE:</strong> USSD (*99#) is disabled because Jio is an all-IP network. Payments will automatically route through <strong>UPI 123Pay IVR rail</strong>.`;
      document.getElementById('homeRailBadge').textContent = 'UPI 123Pay Rail Active';
      document.getElementById('qrRailSub').textContent = 'Converts QR to 123Pay IVR';
    } else {
      simRailNotice.innerHTML = `✅ <strong>GSM Telco Detected (${state.sim}):</strong> Both <strong>*99# USSD</strong> and <strong>UPI 123Pay IVR</strong> rails are available!`;
      document.getElementById('homeRailBadge').textContent = 'Dual Rails (*99# & 123Pay)';
      document.getElementById('qrRailSub').textContent = 'Dials *99*1*3# USSD';
    }
  });

  btnCompleteSetup.addEventListener('click', () => {
    state.bank = setupBankSelect.value;
    document.getElementById('homeBankLabel').textContent = state.bank;
    if (recentBankFilterTag && filterByActiveBank) {
      recentBankFilterTag.textContent = state.bank;
    }
    logState(`Setup complete. Bank: ${state.bank}, Carrier: ${state.sim}`);
    updateTransactionHistoryUI();
    renderDatabaseInspector();
    showView('home');
  });

  // Home Screen Actions
  document.getElementById('btnPayContact').addEventListener('click', () => {
    showView('payContact');
  });

  document.getElementById('btnScanQR').addEventListener('click', () => {
    showView('scanQr');
    startCamera();
  });

  document.getElementById('btnBackFromPayContact').addEventListener('click', () => {
    showView('home');
  });

  document.getElementById('btnBackFromScanQR').addEventListener('click', () => {
    stopCamera();
    showView('home');
  });

  document.getElementById('btnOpenSettings').addEventListener('click', () => {
    stopCamera();
    showView('setup');
  });

  // DTMF String Calculation (Upi123CallStringBuilder)
  const payPhoneInput = document.getElementById('payPhoneInput');
  const payAmountInput = document.getElementById('payAmountInput');
  const dtmfPreviewCode = document.getElementById('dtmfPreviewCode');

  function updateDtmfString() {
    const rawPhone = payPhoneInput.value.replace(/\D/g, '');
    const rawAmount = payAmountInput.value.trim();
    const serviceNumber = "08045163666"; // NPCI published 123Pay service line
    const phonePart = rawPhone || 'XXXXXXXXXX';
    const amtPart = rawAmount || '0';
    // tel:<service>,,1,<phone>,,<amount>,,1
    dtmfPreviewCode.textContent = `tel:${serviceNumber},,1,${phonePart},,${amtPart},,1`;
  }

  // =========================================================================
  // FEATURE 3: Contact Matching, Directory Picker & Safety Warning System
  // =========================================================================
  const contactMatchBadge = document.getElementById('contactMatchBadge');
  const matchContactName = document.getElementById('matchContactName');
  const matchContactTag = document.getElementById('matchContactTag');
  const contactUnknownBadge = document.getElementById('contactUnknownBadge');

  function checkContactMatch(rawInput) {
    const cleanPhone = (rawInput || '').replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      const match = SAVED_CONTACTS.find(c => c.phone === cleanPhone);
      if (match) {
        if (contactMatchBadge) {
          matchContactName.textContent = match.name;
          matchContactTag.textContent = `${match.role} • ${match.city}`;
          contactMatchBadge.classList.remove('hidden');
        }
        if (contactUnknownBadge) contactUnknownBadge.classList.add('hidden');
        return match;
      } else {
        if (contactMatchBadge) contactMatchBadge.classList.add('hidden');
        if (contactUnknownBadge) contactUnknownBadge.classList.remove('hidden');
        return null;
      }
    } else {
      if (contactMatchBadge) contactMatchBadge.classList.add('hidden');
      if (contactUnknownBadge) contactUnknownBadge.classList.add('hidden');
      return null;
    }
  }

  payPhoneInput.addEventListener('input', () => {
    updateDtmfString();
    checkContactMatch(payPhoneInput.value);
  });
  payAmountInput.addEventListener('input', updateDtmfString);

  function selectContactForPayment(contact) {
    payPhoneInput.value = contact.phone;
    updateDtmfString();
    checkContactMatch(contact.phone);
    setTimeout(() => {
      payAmountInput.focus();
    }, 150);
  }

  // Populate Quick Contacts Tray (Top 6)
  const quickContactsTray = document.getElementById('quickContactsTray');
  if (quickContactsTray) {
    quickContactsTray.innerHTML = '';
    SAVED_CONTACTS.slice(0, 6).forEach(contact => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'quick-contact-chip';
      chip.innerHTML = `<span class="chip-avatar">${contact.avatar}</span> <span>${contact.name}</span>`;
      chip.addEventListener('click', () => {
        selectContactForPayment(contact);
      });
      quickContactsTray.appendChild(chip);
    });
  }

  // Contact Picker Directory Modal
  const contactPickerModal = document.getElementById('contactPickerModal');
  const contactDirectoryList = document.getElementById('contactDirectoryList');
  const contactSearchInput = document.getElementById('contactSearchInput');

  function renderContactPickerList(filterTerm = '') {
    if (!contactDirectoryList) return;
    contactDirectoryList.innerHTML = '';
    const term = filterTerm.trim().toLowerCase();

    const filtered = SAVED_CONTACTS.filter(c => 
      c.name.toLowerCase().includes(term) ||
      c.phone.includes(term) ||
      c.city.toLowerCase().includes(term) ||
      c.role.toLowerCase().includes(term)
    );

    if (filtered.length === 0) {
      contactDirectoryList.innerHTML = '<div style="text-align:center; padding: 24px; color: var(--text-muted); font-size: 0.8rem;">No contacts found matching "' + filterTerm + '"</div>';
      return;
    }

    filtered.forEach(contact => {
      const item = document.createElement('div');
      item.className = 'contact-list-item';
      item.innerHTML = `
        <div class="contact-avatar">${contact.avatar}</div>
        <div class="contact-details">
          <div class="contact-name-row">
            <span class="contact-name">${contact.name}</span>
            <span class="contact-role-tag">${contact.role}</span>
          </div>
          <span class="contact-sub">+91 ${contact.phone.slice(0, 5)} ${contact.phone.slice(5)} • ${contact.city}</span>
        </div>
      `;
      item.addEventListener('click', () => {
        selectContactForPayment(contact);
        if (contactPickerModal) contactPickerModal.classList.add('hidden');
      });
      contactDirectoryList.appendChild(item);
    });
  }

  if (document.getElementById('btnOpenContactPicker')) {
    document.getElementById('btnOpenContactPicker').addEventListener('click', () => {
      if (contactSearchInput) contactSearchInput.value = '';
      renderContactPickerList('');
      if (contactPickerModal) contactPickerModal.classList.remove('hidden');
    });
  }

  if (document.getElementById('btnCloseContactPicker')) {
    document.getElementById('btnCloseContactPicker').addEventListener('click', () => {
      if (contactPickerModal) contactPickerModal.classList.add('hidden');
    });
  }

  if (contactSearchInput) {
    contactSearchInput.addEventListener('input', (e) => {
      renderContactPickerList(e.target.value);
    });
  }

  // =========================================================================
  // TRANSACTION DETAILS INSPECTOR (Right Side) & BANK DATABASE CONTROLLER
  // =========================================================================
  function openTransactionDetails(txnId) {
    const txn = OfflyneDB.getById(txnId);
    if (!txn) {
      logState(`Transaction ${txnId} not found in database.`);
      return;
    }

    // 1. Switch right-side desktop panel to Tab 4 (Txn Details Inspector)
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    const tabBtn = document.getElementById('tabBtnTxnInspector');
    const tabContent = document.getElementById('tabTxnInspector');
    if (tabBtn) tabBtn.classList.add('active');
    if (tabContent) {
      tabContent.classList.add('active');
      tabContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // 2. Populate right-side inspector fields
    const isSuccess = (txn.status === 'SUCCESS');
    const inspBadge = document.getElementById('inspStatusBadge');
    const inspHero = document.getElementById('inspHeroBox');
    const inspBubble = document.getElementById('inspIconBubble');
    const inspSuccessSvg = document.getElementById('inspSuccessSvg');
    const inspFailedSvg = document.getElementById('inspFailedSvg');
    const inspAmount = document.getElementById('inspAmount');
    const inspStatusLabel = document.getElementById('inspStatusLabel');
    const inspTimestamp = document.getElementById('inspTimestamp');

    if (inspBadge) {
      inspBadge.textContent = txn.status;
      inspBadge.className = `inspector-badge ${isSuccess ? 'success' : 'failed'}`;
    }
    if (inspHero) {
      inspHero.className = `inspector-hero ${isSuccess ? 'hero-success' : 'hero-failed'}`;
    }
    if (inspBubble) {
      inspBubble.className = `insp-icon-bubble ${isSuccess ? 'bubble-success' : 'bubble-failed'}`;
    }
    if (inspSuccessSvg) inspSuccessSvg.classList.toggle('hidden', !isSuccess);
    if (inspFailedSvg) inspFailedSvg.classList.toggle('hidden', isSuccess);

    if (inspAmount) {
      inspAmount.textContent = `₹${parseFloat(txn.amount).toFixed(2)}`;
      inspAmount.className = isSuccess ? 'insp-hero-amount' : 'insp-hero-amount status-failed-amt';
    }
    if (inspStatusLabel) {
      inspStatusLabel.textContent = isSuccess 
        ? 'Payment Completed & Bank Verified' 
        : `Payment Failed (${txn.failureReason || 'Call Ended / Aborted'})`;
      inspStatusLabel.className = `insp-hero-status-label ${isSuccess ? 'lbl-success' : 'lbl-failed'}`;
    }
    if (inspTimestamp) inspTimestamp.textContent = txn.formattedDate || txn.timestamp;

    const inspBank = document.getElementById('inspBank');
    const inspTxnId = document.getElementById('inspTxnId');
    const inspPayee = document.getElementById('inspPayee');
    const inspVpa = document.getElementById('inspVpa');
    const inspRail = document.getElementById('inspRail');
    const inspRrn = document.getElementById('inspRrn');
    const inspSmsQuote = document.getElementById('inspSmsQuote');

    if (inspBank) inspBank.textContent = txn.bankName;
    if (inspTxnId) inspTxnId.textContent = txn.id;
    if (inspPayee) inspPayee.textContent = txn.payee;
    if (inspVpa) inspVpa.textContent = txn.vpa || (txn.payee.includes('@') ? txn.payee : `${txn.payee.replace(/\s+/g, '').toLowerCase()}@upi`);
    if (inspRail) inspRail.textContent = txn.rail;
    if (inspRrn) inspRrn.textContent = txn.rrn || (isSuccess ? 'UPI/429810294821' : 'N/A (Failed)');
    if (inspSmsQuote) inspSmsQuote.textContent = `"${txn.excerpt}"`;

    // 3. Update Audit Checks
    const chkPaise = document.getElementById('chkPaiseExact');
    const chkDebit = document.getElementById('chkDebitKeyword');
    const chkWindow = document.getElementById('chkWindowTime');
    const chkPaiseText = document.getElementById('chkPaiseExactText');
    const chkDebitText = document.getElementById('chkDebitKeywordText');
    const chkWindowText = document.getElementById('chkWindowTimeText');

    if (isSuccess) {
      if (chkPaise) chkPaise.className = 'insp-check-item pass';
      if (chkDebit) chkDebit.className = 'insp-check-item pass';
      if (chkWindow) chkWindow.className = 'insp-check-item pass';
      if (chkPaiseText) chkPaiseText.textContent = 'Amount Match: Verified exact match against payment session';
      if (chkDebitText) chkDebitText.textContent = 'Debit Keyword: Confirmed funds deducted from account';
      if (chkWindowText) chkWindowText.textContent = 'Security Window: Ingested within 10-minute validity threshold';
    } else {
      if (chkPaise) chkPaise.className = 'insp-check-item fail';
      if (chkDebit) chkDebit.className = 'insp-check-item fail';
      if (chkWindow) chkWindow.className = 'insp-check-item fail';
      if (chkPaiseText) chkPaiseText.textContent = 'Transaction Aborted: Money was not deducted from bank account';
      if (chkDebitText) chkDebitText.textContent = `Failure Reason: ${txn.failureReason || 'Call terminated before completion'}`;
      if (chkWindowText) chkWindowText.textContent = 'Audit Result: Rejected by OFFLYNE security guard';
    }

    logState(`Opened transaction details on right-side inspector: ${txn.id} [${txn.status}]`);
  }

  // Back from right-side inspector
  if (document.getElementById('btnCloseInspector')) {
    document.getElementById('btnCloseInspector').addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      const simTabBtn = document.querySelector('.tab-btn[data-tab="tabSimulator"]');
      const simTabContent = document.getElementById('tabSimulator');
      if (simTabBtn) simTabBtn.classList.add('active');
      if (simTabContent) simTabContent.classList.add('active');
    });
  }

  // Copy ID from right-side inspector
  if (document.getElementById('btnCopyInspTxnId')) {
    document.getElementById('btnCopyInspTxnId').addEventListener('click', () => {
      const code = document.getElementById('inspTxnId');
      if (code && navigator.clipboard) {
        navigator.clipboard.writeText(code.textContent).then(() => {
          alert(`Copied Transaction ID: ${code.textContent}`);
        }).catch(() => {});
      }
    });
  }

  // Sidebar Tab 2: Bank Database & Ledgers Inspector
  const bankLedgerCards = document.getElementById('bankLedgerCards');
  const dbBankFilter = document.getElementById('dbBankFilter');
  const dbTableBody = document.getElementById('dbTableBody');
  let currentDbFilterBank = 'ALL';

  function renderDatabaseInspector() {
    if (!bankLedgerCards || !dbTableBody) return;

    const allData = OfflyneDB.getAllBanksData();
    const allBanks = [
      'State Bank of India',
      'HDFC Bank',
      'ICICI Bank',
      'Punjab National Bank',
      'Axis Bank',
      'Kotak Mahindra Bank'
    ];

    // 1. Render Bank Ledger Summary Cards
    bankLedgerCards.innerHTML = allBanks.map(bank => {
      const items = allData[bank] || [];
      const totalVolume = items.filter(t => t.status === 'SUCCESS').reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      const isSelected = (currentDbFilterBank === bank);
      return `
        <div class="bank-ledger-card ${isSelected ? 'selected' : ''}" data-bank="${bank}">
          <span class="bank-ledger-name" title="${bank}">${bank}</span>
          <div class="bank-ledger-stats">
            <span class="bank-ledger-volume">₹${totalVolume.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span class="bank-ledger-count">${items.length} txn${items.length === 1 ? '' : 's'}</span>
          </div>
        </div>
      `;
    }).join('');

    bankLedgerCards.querySelectorAll('.bank-ledger-card').forEach(card => {
      card.addEventListener('click', () => {
        const bank = card.dataset.bank;
        currentDbFilterBank = (currentDbFilterBank === bank) ? 'ALL' : bank;
        if (dbBankFilter) dbBankFilter.value = currentDbFilterBank;
        renderDatabaseInspector();
      });
    });

    // 2. Render Table Rows (No View button here as requested)
    const txns = (currentDbFilterBank === 'ALL')
      ? OfflyneDB.getAllUnifiedList()
      : OfflyneDB.getAllByBank(currentDbFilterBank);

    if (txns.length === 0) {
      dbTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding: 24px; color: var(--text-muted);">
            No records in ${currentDbFilterBank === 'ALL' ? 'database' : currentDbFilterBank} ledger yet.
          </td>
        </tr>
      `;
      return;
    }

    dbTableBody.innerHTML = txns.map(t => {
      const isFail = (t.status === 'FAILED');
      return `
        <tr>
          <td><code>${t.id}</code></td>
          <td><strong>${t.bankName}</strong></td>
          <td>${t.payee}</td>
          <td><strong class="${isFail ? 'status-failed-amt' : ''}">₹${parseFloat(t.amount).toFixed(2)}</strong></td>
          <td><span class="bank-sub-tag ${isFail ? 'fail-tag' : ''}">${isFail ? (t.failureReason || 'Failed') : t.rail}</span></td>
          <td><span class="txn-status-badge status-${t.status.toLowerCase()}">${t.status}</span></td>
        </tr>
      `;
    }).join('');
  }

  if (dbBankFilter) {
    dbBankFilter.addEventListener('change', (e) => {
      currentDbFilterBank = e.target.value;
      renderDatabaseInspector();
    });
  }

  if (document.getElementById('btnExportDbJson')) {
    document.getElementById('btnExportDbJson').addEventListener('click', () => {
      const json = JSON.stringify(OfflyneDB.getAllBanksData(), null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `offlyne_bank_ledgers_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      logState('Exported complete Bank Ledgers Database as JSON');
    });
  }

  if (document.getElementById('btnClearDb')) {
    document.getElementById('btnClearDb').addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all bank ledgers in the database?')) {
        OfflyneDB.clearAll();
        updateTransactionHistoryUI();
        renderDatabaseInspector();
      }
    });
  }

  renderDatabaseInspector();

  // Out-of-Contacts Warning Modal Elements
  let pendingUnsavedPayDetails = null;
  const contactWarningModal = document.getElementById('contactWarningModal');
  const warnModalAmount = document.getElementById('warnModalAmount');
  const warnModalPhone = document.getElementById('warnModalPhone');
  const btnCancelWarning = document.getElementById('btnCancelWarning');
  const btnProceedWarning = document.getElementById('btnProceedWarning');

  // Initiate UPI 123Pay Call -> Checks Saved Contacts List
  document.getElementById('btnInitiate123Pay').addEventListener('click', () => {
    const phone = payPhoneInput.value.replace(/\D/g, '');
    const amount = payAmountInput.value.trim();

    if (phone.length !== 10) {
      alert('Please enter a valid 10-digit Indian phone number.');
      payPhoneInput.focus();
      return;
    }
    const amtNum = parseInt(amount, 10);
    if (isNaN(amtNum) || amtNum < 1 || amtNum > 5000) {
      alert('Amount must be between ₹1 and ₹5,000 (UPI 123Pay limit).');
      payAmountInput.focus();
      return;
    }

    const matched = SAVED_CONTACTS.find(c => c.phone === phone);

    if (matched) {
      // Recognized contact: Direct to UPI PIN Screen
      logState(`Recipient recognized as saved contact: ${matched.name} (${matched.city})`);
      openUpiPinSheet({
        phone: `+91 ${phone}`,
        amount: amtNum.toString(),
        rail: 'UPI 123Pay (IVR)',
        recipientName: `${matched.name} (${matched.role})`,
        vpa: `${phone}@upi`,
        previousView: 'payContact'
      });
    } else {
      // OUT OF CONTACTS: Issue authentic UPI safety warning modal!
      logState(`⚠️ Payee +91 ${phone} is NOT in saved contacts. Issuing UPI safety warning modal.`);
      pendingUnsavedPayDetails = {
        phone: `+91 ${phone}`,
        amount: amtNum.toString(),
        rail: 'UPI 123Pay (IVR)',
        recipientName: `+91 ${phone.slice(0, 5)} ${phone.slice(5)} (Unknown Payee)`,
        vpa: `${phone}@upi`,
        previousView: 'payContact'
      };

      if (warnModalAmount) warnModalAmount.textContent = `₹${amtNum.toLocaleString('en-IN')}`;
      if (warnModalPhone) warnModalPhone.textContent = `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;
      if (contactWarningModal) contactWarningModal.classList.remove('hidden');
    }
  });

  if (btnCancelWarning) {
    btnCancelWarning.addEventListener('click', () => {
      if (contactWarningModal) contactWarningModal.classList.add('hidden');
      pendingUnsavedPayDetails = null;
      logState('Payment cancelled from safety warning modal.');
      payPhoneInput.focus();
    });
  }

  if (btnProceedWarning) {
    btnProceedWarning.addEventListener('click', () => {
      if (contactWarningModal) contactWarningModal.classList.add('hidden');
      if (pendingUnsavedPayDetails) {
        const details = pendingUnsavedPayDetails;
        pendingUnsavedPayDetails = null;
        logState(`User acknowledged out-of-contacts warning. Proceeding to UPI PIN for ${details.phone}.`);
        openUpiPinSheet(details);
      }
    });
  }

  // Dismiss QR Error Modal
  if (document.getElementById('btnDismissQrError')) {
    document.getElementById('btnDismissQrError').addEventListener('click', () => {
      if (qrErrorModal) qrErrorModal.classList.add('hidden');
      startScanningLoop();
    });
  }

  // Manual Capture & Tap-to-Scan Fallbacks
  async function triggerManualCaptureScan() {
    logState('Manual capture initiated by user...');
    if (cameraStatusPill) cameraStatusPill.textContent = '⚡ Analyzing in-frame QR...';
    
    // First try analyzing active camera feed
    if (qrCameraFeed && (qrCameraFeed.readyState >= 2 || qrCameraFeed.videoWidth > 0)) {
      const code = await decodeFrame(qrCameraFeed);
      if (code) {
        handleScannedQr(code);
        return;
      }
    }
    
    // Camera feed blurry or lighting low -> trigger universal simulation QR code detection
    logState('Camera frame blurry or low contrast. Triggering offline QR detection simulation.');
    handleScannedQr('OFFLYNE-CAMERA-SCAN-' + Math.floor(1000 + Math.random() * 9000));
  }

  const btnCaptureCurrentFrame = document.getElementById('btnCaptureCurrentFrame');
  if (btnCaptureCurrentFrame) {
    btnCaptureCurrentFrame.addEventListener('click', triggerManualCaptureScan);
  }

  const viewfinderBox = document.getElementById('viewfinderBox');
  if (viewfinderBox) {
    viewfinderBox.addEventListener('click', triggerManualCaptureScan);
  }

  const qrFileInput = document.getElementById('qrFileInput');
  if (qrFileInput) {
    qrFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      logState(`User loaded QR image file: ${file.name}`);
      if (cameraStatusPill) cameraStatusPill.textContent = '🖼️ Processing QR image...';
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
          const code = await decodeFrame(img);
          if (code) {
            handleScannedQr(code);
          } else {
            logState(`Decoded uploaded QR image (${file.name}). Triggering simulation.`);
            handleScannedQr(`OFFLYNE-FILE-${file.name.replace(/\.[^/.]+$/, '')}`);
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
      qrFileInput.value = '';
    });
  }

  // Back from Merchant Payment Sheet
  if (document.getElementById('btnBackFromMerchantPay')) {
    document.getElementById('btnBackFromMerchantPay').addEventListener('click', () => {
      showView('scanQr');
      startCamera();
    });
  }

  // Proceed from Merchant Payment Sheet -> Routes to UPI PIN Screen
  if (document.getElementById('btnProceedMerchantPin')) {
    document.getElementById('btnProceedMerchantPin').addEventListener('click', () => {
      if (!selectedVendor) return;
      const amtInput = document.getElementById('merchantAmountInput');
      const amt = amtInput.value.trim();
      const amtNum = parseInt(amt, 10);
      if (isNaN(amtNum) || amtNum < 1 || amtNum > 5000) {
        alert('Please enter a valid amount between ₹1 and ₹5,000.');
        amtInput.focus();
        return;
      }

      const rail = state.sim === 'Jio' ? 'UPI 123Pay (Jio VoLTE)' : '*99*1*3# USSD (Scan-to-Pay)';
      openUpiPinSheet({
        phone: selectedVendor.vpa,
        amount: amtNum.toString(),
        rail: rail,
        recipientName: selectedVendor.name,
        vpa: selectedVendor.vpa,
        previousView: 'merchantPay'
      });
    });
  }

  // =========================================================================
  // FEATURE 2: NPCI Authentic UPI PIN Controller & Custom Numeric Keypad
  // =========================================================================
  let enteredPin = '';
  let isPinMasked = true;
  let activePendingPayment = null;

  function playKeyClickSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(540, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.04);
    } catch(e) {}
  }

  function playErrorBuzz() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.28);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.28);
    } catch(e) {}
  }

  function playPinSuccessChime() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      [587.33, 880].forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);
        gain.gain.setValueAtTime(0.18, now + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.09 + 0.16);
        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.16);
      });
    } catch(e) {}
  }

  function updatePinDots() {
    for (let i = 0; i < 4; i++) {
      const dot = document.getElementById(`pinDot${i}`);
      if (!dot) continue;
      if (i < enteredPin.length) {
        dot.classList.add('filled');
        if (!isPinMasked) {
          dot.classList.add('unmasked');
          dot.textContent = enteredPin[i];
        } else {
          dot.classList.remove('unmasked');
          dot.textContent = '●';
        }
      } else {
        dot.classList.remove('filled', 'unmasked');
        dot.textContent = '';
      }
    }
  }

  function openUpiPinSheet(details) {
    stopCamera();
    activePendingPayment = details;
    enteredPin = '';
    isPinMasked = true;

    // Populate Payee & Amount
    const payeeElem = document.getElementById('pinPayeeName');
    const subElem = document.getElementById('pinPayeeSub');
    const amtElem = document.getElementById('pinAmountDisplay');
    const bankElem = document.getElementById('pinBankName');

    if (payeeElem) payeeElem.textContent = details.recipientName || details.phone;
    if (subElem) subElem.textContent = details.vpa || details.phone;
    if (amtElem) amtElem.textContent = Number(details.amount).toLocaleString('en-IN');
    if (bankElem) bankElem.textContent = state.bank;
    const dotsRow = document.getElementById('pinDotsRow');
    if (dotsRow) dotsRow.classList.remove('shake', 'success');

    const errFeedback = document.getElementById('pinErrorFeedback');
    if (errFeedback) errFeedback.classList.add('hidden');

    const eyeOpen = document.getElementById('eyeOpenIcon');
    const eyeClosed = document.getElementById('eyeClosedIcon');
    if (eyeOpen) eyeOpen.classList.remove('hidden');
    if (eyeClosed) eyeClosed.classList.add('hidden');

    updatePinDots();
    showView('upiPin');
    logState(`NPCI UPI PIN sheet opened for ${state.bank}. Amount: ₹${details.amount}`);
  }

  function validateUpiPin() {
    if (!activePendingPayment) return;
    const requiredPin = BANK_UPI_PINS[state.bank] || '4701';
    const dotsRow = document.getElementById('pinDotsRow');
    const errFeedback = document.getElementById('pinErrorFeedback');
    const errMsg = document.getElementById('pinErrorMsg');

    if (enteredPin === requiredPin) {
      // Correct PIN
      playPinSuccessChime();
      if (dotsRow) {
        dotsRow.classList.remove('shake');
        dotsRow.classList.add('success');
      }
      if (errFeedback) errFeedback.classList.add('hidden');
      logState(`✓ UPI PIN verified successfully with ${state.bank}!`);

      setTimeout(() => {
        if (dotsRow) dotsRow.classList.remove('success');
        const sessionDetails = activePendingPayment;
        activePendingPayment = null;
        startPaymentSession(sessionDetails);
      }, 420);
    } else {
      // Incorrect PIN
      playErrorBuzz();
      if (dotsRow) dotsRow.classList.add('shake');
      if (errFeedback && errMsg) {
        errMsg.textContent = 'Incorrect UPI PIN. Please try again.';
        errFeedback.classList.remove('hidden');
      }
      logState(`❌ Incorrect UPI PIN entered for ${state.bank}.`);

      setTimeout(() => {
        if (dotsRow) dotsRow.classList.remove('shake');
        enteredPin = '';
        updatePinDots();
      }, 700);
    }
  }

  // Keypad Number keys
  document.querySelectorAll('.keypad-btn[data-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (enteredPin.length < 4) {
        playKeyClickSound();
        enteredPin += btn.dataset.key;
        updatePinDots();
        if (enteredPin.length === 4) {
          setTimeout(validateUpiPin, 180);
        }
      }
    });
  });

  // Keypad Backspace
  const btnKeypadBksp = document.getElementById('btnKeypadBackspace');
  if (btnKeypadBksp) {
    btnKeypadBksp.addEventListener('click', () => {
      if (enteredPin.length > 0) {
        playKeyClickSound();
        enteredPin = enteredPin.slice(0, -1);
        updatePinDots();
        const errFeedback = document.getElementById('pinErrorFeedback');
        if (errFeedback) errFeedback.classList.add('hidden');
      }
    });
  }

  // Keypad Submit
  const btnKeypadSub = document.getElementById('btnKeypadSubmit');
  if (btnKeypadSub) {
    btnKeypadSub.addEventListener('click', () => {
      if (enteredPin.length === 4) {
        validateUpiPin();
      } else {
        playErrorBuzz();
        const errFeedback = document.getElementById('pinErrorFeedback');
        const errMsg = document.getElementById('pinErrorMsg');
        if (errFeedback && errMsg) {
          errMsg.textContent = 'Please enter all 4 digits of your UPI PIN.';
          errFeedback.classList.remove('hidden');
        }
      }
    });
  }

  // Toggle Mask Visibility
  const btnTogglePinVisibility = document.getElementById('btnTogglePinVisibility');
  if (btnTogglePinVisibility) {
    btnTogglePinVisibility.addEventListener('click', () => {
      isPinMasked = !isPinMasked;
      const eyeOpen = document.getElementById('eyeOpenIcon');
      const eyeClosed = document.getElementById('eyeClosedIcon');
      if (isPinMasked) {
        if (eyeOpen) eyeOpen.classList.remove('hidden');
        if (eyeClosed) eyeClosed.classList.add('hidden');
      } else {
        if (eyeOpen) eyeOpen.classList.add('hidden');
        if (eyeClosed) eyeClosed.classList.remove('hidden');
      }
      updatePinDots();
    });
  }

  // Back from UPI PIN Screen
  const btnBackFromUpiPin = document.getElementById('btnBackFromUpiPin');
  if (btnBackFromUpiPin) {
    btnBackFromUpiPin.addEventListener('click', () => {
      if (activePendingPayment && activePendingPayment.previousView) {
        showView(activePendingPayment.previousView);
      } else {
        showView('home');
      }
      activePendingPayment = null;
      enteredPin = '';
    });
  }

  // Physical Keyboard listener for UPI PIN view
  window.addEventListener('keydown', (e) => {
    if (views.upiPin && !views.upiPin.classList.contains('hidden')) {
      if (e.key >= '0' && e.key <= '9') {
        if (enteredPin.length < 4) {
          playKeyClickSound();
          enteredPin += e.key;
          updatePinDots();
          if (enteredPin.length === 4) {
            setTimeout(validateUpiPin, 180);
          }
        }
      } else if (e.key === 'Backspace') {
        if (enteredPin.length > 0) {
          playKeyClickSound();
          enteredPin = enteredPin.slice(0, -1);
          updatePinDots();
        }
      } else if (e.key === 'Enter') {
        if (enteredPin.length === 4) {
          validateUpiPin();
        }
      } else if (e.key === 'Escape') {
        if (btnBackFromUpiPin) btnBackFromUpiPin.click();
      }
    }
  });

  // Quick Amount Chips Listeners
  document.querySelectorAll('#merchantQuickAmts .quick-amt-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const amtAdd = parseInt(btn.dataset.amt, 10);
      const input = document.getElementById('merchantAmountInput');
      const cur = parseInt(input.value, 10) || 0;
      input.value = cur + amtAdd;
    });
  });

  document.querySelectorAll('#contactQuickAmts .quick-amt-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const amtAdd = parseInt(btn.dataset.amt, 10);
      const input = document.getElementById('payAmountInput');
      const cur = parseInt(input.value, 10) || 0;
      input.value = cur + amtAdd;
      updateDtmfString();
    });
  });

  // QR Preset chips
  document.querySelectorAll('.preset-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const vendorName = chip.dataset.vendor;
      if (vendorName) {
        const vendor = APPROVED_VENDORS.find(v => v.name === vendorName);
        if (vendor) {
          playSuccessBeep();
          openMerchantPaymentSheet(vendor);
        }
      }
    });
  });

  // Test Invalid QR button
  if (document.getElementById('btnTestInvalidQr')) {
    document.getElementById('btnTestInvalidQr').addEventListener('click', () => {
      handleScannedQr('Starbucks Coffee #402');
    });
  }

  // Start Payment Session (PaymentSessionManager.begin)
  function startPaymentSession(details) {
    stopCamera();
    const txnId = 'txn_' + Math.random().toString(36).substring(2, 9);
    state.currentSession = {
      txnId,
      phone: details.phone,
      amount: details.amount,
      rail: details.rail,
      recipientName: details.recipientName,
      vpa: details.vpa || null,
      startTime: Date.now()
    };

    setPaymentState('INITIATING', `PENDING row inserted for ${txnId}, amt ₹${details.amount}`);

    // Update In-Call Overlay UI
    document.getElementById('overlayRecipient').textContent = details.recipientName || details.phone;
    document.getElementById('overlayAmount').textContent = `₹${details.amount}`;
    document.getElementById('callTargetName').textContent = details.rail.includes('USSD') ? '*99*1*3# GSM USSD' : 'NPCI UPI 123Pay';
    document.getElementById('overlayStepText').textContent = 'Dialing... automated audio stream muted';

    showView('callActive');

    // Simulate Call Progression
    state.callDurationSec = 0;
    clearInterval(state.callTimerInterval);
    state.callTimerInterval = setInterval(() => {
      state.callDurationSec++;
      const mins = String(Math.floor(state.callDurationSec / 60)).padStart(2, '0');
      const secs = String(state.callDurationSec % 60).padStart(2, '0');
      document.getElementById('callDurationTimer').textContent = `${mins}:${secs}`;

      // Simulate DTMF steps
      if (state.callDurationSec === 3) {
        setPaymentState('IN_PROGRESS', 'OFFHOOK detected by CallStateCoordinator');
        document.getElementById('overlayProgressFill').style.width = '30%';
        document.getElementById('overlayStepText').textContent = 'Step 1/3: Transmitting payee identifier tones...';
      } else if (state.callDurationSec === 8) {
        document.getElementById('overlayProgressFill').style.width = '60%';
        document.getElementById('overlayStepText').textContent = 'Step 2/3: Transmitting amount digits...';
      } else if (state.callDurationSec === 14) {
        document.getElementById('overlayProgressFill').style.width = '85%';
        document.getElementById('overlayStepText').textContent = 'Step 3/3: UPI PIN being authenticated...';
      } else if (state.callDurationSec === 22) {
        // Auto end call after PIN entered
        handleCallEnded(true);
      }
    }, 1000);
  }

  // End Call Button
  document.getElementById('btnEndCall').addEventListener('click', () => {
    handleCallEnded(false);
  });

  function handleCallEnded(normalCompletion = true) {
    clearInterval(state.callTimerInterval);

    if (!normalCompletion) {
      // Call ended by user or prematurely dropped -> Record as FAILED transaction
      const reason = (state.callDurationSec < 5)
        ? 'Call ended < 5s before transaction could complete'
        : 'Call ended by user before bank authorization';
      logState(`Call terminated by user. Registering FAILED transaction: "${reason}"`);
      handlePaymentFailed(reason);
      return;
    }

    // Call completed tone sequence normally -> Transition to WAITING_FOR_VERIFICATION
    setPaymentState('WAITING_FOR_VERIFICATION', '10-minute bank SMS verification window armed');

    document.getElementById('waitExpectedAmt').textContent = `₹${state.currentSession.amount}`;
    document.getElementById('waitSessionId').textContent = state.currentSession.txnId;

    // Start 10-minute window countdown
    state.windowRemainingSec = 600;
    clearInterval(state.windowCountdownInterval);
    state.windowCountdownInterval = setInterval(() => {
      state.windowRemainingSec--;
      if (state.windowRemainingSec <= 0) {
        clearInterval(state.windowCountdownInterval);
        handlePaymentFailed('Timeout: 10-minute window expired with no bank SMS');
      } else {
        const m = String(Math.floor(state.windowRemainingSec / 60)).padStart(2, '0');
        const s = String(state.windowRemainingSec % 60).padStart(2, '0');
        document.getElementById('waitWindowTime').textContent = `${m}:${s}`;
      }
    }, 1000);

    showView('waitingVerification');
  }

  // Bank SMS Ingestion Pipeline & Parser
  // Mirrors SmsTransactionParser.kt & SmsIngestionPipeline.kt
  function processIncomingSms(sender, body) {
    logState(`SmsIngestionPipeline.ingest() from ${sender}`);
    logState(`Raw SMS: "${body.substring(0, 70)}..."`);

    // Extract Amount (Skip "Avl Bal")
    // Match Rs. / INR / by / for followed by numbers
    let extractedAmount = null;
    const debitKeywords = /(debited|spent|paid|dr\b|deducted)/i;
    const creditKeywords = /(credited|salary|refund|cr\b|received)/i;
    const failKeywords = /(failed|declined|insufficient|unsuccessful|rejected)/i;

    const amtMatch = body.match(/(?:rs\.?|inr|by|for)\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
    if (amtMatch) {
      extractedAmount = amtMatch[1];
    }

    // Check for RRN / Ref
    let rrn = 'UPI/' + Math.floor(100000000000 + Math.random() * 900000000000);
    const rrnMatch = body.match(/(?:ref|rrn|upi\s*ref|txn)\s*(?:no\.?)?\s*([0-9a-zA-Z]+)/i);
    if (rrnMatch) {
      rrn = 'UPI/' + rrnMatch[1];
    }

    // 1. Check if this is an incoming CREDIT
    if (creditKeywords.test(body) && !debitKeywords.test(body)) {
      logState(`⚠️ Ingestion dropped: Unrelated incoming CREDIT SMS detected. Payment window remains open for real debit.`);
      alert(`[SMS Received from ${sender}]: Incoming credit recognized and ignored. The active payment is an outgoing debit.`);
      return;
    }

    // 2. Check if this is a FAILURE SMS
    if (failKeywords.test(body)) {
      handlePaymentFailed('Bank reported payment as failed: Insufficient balance or issuer decline.');
      return;
    }

    // 3. Must be a DEBIT
    if (!debitKeywords.test(body)) {
      logState(`⚠️ Ingestion dropped: SMS did not contain debit confirmation keywords.`);
      return;
    }

    // 4. Verify Paise-Exact Amount
    if (state.currentSession) {
      const expected = parseFloat(state.currentSession.amount).toFixed(2);
      const actual = extractedAmount ? parseFloat(extractedAmount).toFixed(2) : '0.00';

      if (expected !== actual) {
        logState(`⚠️ Ingestion mismatch: Debit amount ₹${actual} does NOT match expected session ₹${expected}. Dropped.`);
        alert(`Amount Mismatch Warning:\nReceived SMS for ₹${actual}, but expected ₹${expected}.\nOperation window remains open for the correct transaction.`);
        return;
      }
    }

    // SUCCESS CONFIRMED!
    handlePaymentSuccess({
      amount: extractedAmount || (state.currentSession ? state.currentSession.amount : '500'),
      sender,
      body,
      rrn
    });
  }

  function handlePaymentSuccess(data) {
    clearInterval(state.windowCountdownInterval);
    setPaymentState('SUCCESS', `Bank confirmation verified via ${data.sender}`);

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const txn = {
      id: state.currentSession ? state.currentSession.txnId : 'txn_' + Date.now(),
      amount: data.amount,
      status: 'SUCCESS',
      payee: state.currentSession ? state.currentSession.recipientName : '+91 98765 43210',
      vpa: state.currentSession ? (state.currentSession.vpa || state.currentSession.phone) : '+91 98765 43210',
      rail: state.currentSession ? state.currentSession.rail : 'UPI 123Pay (IVR)',
      bankName: state.bank,
      rrn: data.rrn,
      excerpt: data.body,
      timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      formattedDate: dateFormatted,
      failureReason: ''
    };

    // Commit to persistent database under bank name
    OfflyneDB.saveTransaction(txn);
    updateTransactionHistoryUI();
    renderDatabaseInspector();

    // Populate PaymentResultActivity View
    document.getElementById('resultSuccessIcon').classList.remove('hidden');
    document.getElementById('resultFailIcon').classList.add('hidden');
    document.getElementById('resultIconCircle').style.color = '#10b981';
    document.getElementById('resultIconCircle').style.borderColor = '#10b981';
    document.getElementById('resultTitle').textContent = 'Payment Successful';
    document.getElementById('resultAmountText').textContent = `₹${parseFloat(txn.amount).toFixed(2)}`;
    document.getElementById('resultBankConfirmedLabel').textContent = `Confirmed by ${data.sender} via SMS`;
    document.getElementById('receiptPayee').textContent = txn.payee;
    document.getElementById('receiptRrn').textContent = txn.rrn;
    document.getElementById('receiptTime').textContent = txn.timestamp;
    document.getElementById('receiptRail').textContent = txn.rail;
    document.getElementById('receiptSmsExcerpt').textContent = `"${txn.excerpt.substring(0, 100)}..."`;

    showView('paymentResult');
  }

  function handlePaymentFailed(reason) {
    clearInterval(state.callTimerInterval);
    clearInterval(state.windowCountdownInterval);
    setPaymentState('FAILED', reason);

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const failedTxn = {
      id: state.currentSession ? state.currentSession.txnId : 'txn_' + Date.now(),
      amount: state.currentSession ? state.currentSession.amount : '500.00',
      status: 'FAILED',
      payee: state.currentSession ? state.currentSession.recipientName : 'Merchant / Payee',
      vpa: state.currentSession ? (state.currentSession.vpa || state.currentSession.phone) : 'payee@upi',
      rail: state.currentSession ? state.currentSession.rail : 'UPI 123Pay (IVR)',
      bankName: state.bank,
      rrn: 'FAILED (Call Ended)',
      excerpt: `Payment Failed: ${reason}. Telephony stream aborted. No funds debited.`,
      timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      formattedDate: dateFormatted,
      failureReason: reason
    };

    // Save failed transaction to database
    OfflyneDB.saveTransaction(failedTxn);
    updateTransactionHistoryUI();
    renderDatabaseInspector();

    document.getElementById('resultSuccessIcon').classList.add('hidden');
    document.getElementById('resultFailIcon').classList.remove('hidden');
    document.getElementById('resultIconCircle').style.color = '#ef4444';
    document.getElementById('resultIconCircle').style.borderColor = '#ef4444';
    document.getElementById('resultTitle').textContent = 'Payment Failed';
    document.getElementById('resultAmountText').textContent = state.currentSession ? `₹${parseFloat(state.currentSession.amount).toFixed(2)}` : '₹0.00';
    document.getElementById('resultBankConfirmedLabel').textContent = reason;

    showView('paymentResult');
  }

  document.getElementById('btnAcknowledgeResult').addEventListener('click', () => {
    setPaymentState('IDLE', 'User acknowledged result');
    state.currentSession = null;
    showView('home');
  });

  let filterByActiveBank = true;
  const recentBankFilterTag = document.getElementById('recentBankFilterTag');
  const btnToggleBankFilter = document.getElementById('btnToggleBankFilter');

  if (btnToggleBankFilter) {
    btnToggleBankFilter.addEventListener('click', () => {
      filterByActiveBank = !filterByActiveBank;
      if (filterByActiveBank) {
        btnToggleBankFilter.textContent = 'By Bank';
        btnToggleBankFilter.classList.add('active');
        if (recentBankFilterTag) recentBankFilterTag.textContent = state.bank;
      } else {
        btnToggleBankFilter.textContent = 'All Banks';
        btnToggleBankFilter.classList.remove('active');
        if (recentBankFilterTag) recentBankFilterTag.textContent = 'All Banks';
      }
      updateTransactionHistoryUI();
    });
  }

  function updateTransactionHistoryUI() {
    const list = document.getElementById('homeTxnList');
    if (!list) return;

    if (recentBankFilterTag && filterByActiveBank) {
      recentBankFilterTag.textContent = state.bank;
    }

    const txns = filterByActiveBank 
      ? OfflyneDB.getAllByBank(state.bank) 
      : OfflyneDB.getAllUnifiedList();

    const countElem = document.getElementById('txnCount');
    if (countElem) {
      countElem.textContent = `${txns.length} items`;
    }

    if (txns.length === 0) {
      list.innerHTML = `
        <div class="empty-txns">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <p>No transactions in ${filterByActiveBank ? state.bank : 'database'}</p>
          <span>Offline payments verified via bank SMS will show here</span>
        </div>`;
      return;
    }

    list.innerHTML = txns.map(t => {
      const isFail = (t.status === 'FAILED');
      return `
        <div class="txn-item" data-id="${t.id}" title="Click to inspect transaction on right side">
          <div class="txn-left">
            <span class="txn-payee">${t.payee}</span>
            <span class="txn-meta">${t.formattedDate || t.timestamp} • ${t.bankName}</span>
            <span class="bank-sub-tag ${isFail ? 'fail-tag' : ''}" style="font-size:0.62rem; margin-top:2px;">
              ${isFail ? (t.failureReason || 'Call Ended') : t.rail}
            </span>
          </div>
          <div class="txn-right">
            <span class="txn-amt ${isFail ? 'status-failed-amt' : ''}">₹${parseFloat(t.amount).toFixed(2)}</span>
            <div class="txn-action-row">
              <span class="txn-status-badge status-${t.status.toLowerCase()}">${t.status}</span>
              <button type="button" class="btn-txn-view" data-id="${t.id}" title="Inspect transaction details on right side">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                View
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach click listeners to transaction items and view buttons -> Opens right-side inspector
    list.querySelectorAll('.txn-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        if (id) openTransactionDetails(id);
      });
    });

    list.querySelectorAll('.btn-txn-view').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (id) openTransactionDetails(id);
      });
    });
  }

  // Initial population of transaction list
  updateTransactionHistoryUI();

  // Right Pane: SMS Template Buttons
  document.getElementById('btnSmsSbiSuccess').addEventListener('click', () => {
    const amt = state.currentSession ? state.currentSession.amount : '500';
    const body = `Dear SBI User, your A/c ending with 4521 has been debited by Rs ${amt}.00 on 29Sep26 via UPI Ref 429810294821. Avl Bal Rs 12,480.00`;
    processIncomingSms('VK-SBIINB', body);
  });

  document.getElementById('btnSmsHdfcSuccess').addEventListener('click', () => {
    const amt = state.currentSession ? state.currentSession.amount : '500';
    const body = `UPDATE: Rs ${amt}.00 debited from HDFC Bank A/c **9021 on 29-SEP-26 to UPI txn 409823901824. Balance: INR 34,200.50.`;
    processIncomingSms('AD-HDFCBK', body);
  });

  document.getElementById('btnSmsMismatch').addEventListener('click', () => {
    const wrongAmt = '250';
    const body = `Dear ICICI Customer, your A/c XX302 is debited for Rs ${wrongAmt}.00 on 29-Sep-26. UPI Ref 309812903. Avl Bal Rs 8,100.`;
    processIncomingSms('VM-ICICIB', body);
  });

  document.getElementById('btnSmsFailed').addEventListener('click', () => {
    const body = `Transaction Failed: Your payment of Rs 500 via UPI has failed due to insufficient funds in Axis Bank A/c 5542.`;
    processIncomingSms('AX-AXISBK', body);
  });

  document.getElementById('btnSmsCredit').addEventListener('click', () => {
    const body = `PNB Alert: Your A/c ending 1204 has been CREDITED with Rs 45,000.00 on 29-Sep-26 by SALARY CREDIT. Avl Bal Rs 48,200.`;
    processIncomingSms('BP-PNBSMS', body);
  });

  document.getElementById('btnInjectCustomSms').addEventListener('click', () => {
    const sender = document.getElementById('customSmsSender').value.trim() || 'BK-TEST';
    const body = document.getElementById('customSmsBody').value.trim();
    if (!body) return;
    processIncomingSms(sender, body);
  });

  // Telephony Simulation buttons
  document.getElementById('btnSimOffhook').addEventListener('click', () => {
    if (state.paymentState === 'INITIATING') {
      setPaymentState('IN_PROGRESS', 'Simulated OFFHOOK event');
    }
  });

  document.getElementById('btnSimCallEnd').addEventListener('click', () => {
    if (state.paymentState === 'IN_PROGRESS' || state.paymentState === 'INITIATING') {
      state.callDurationSec = 15;
      handleCallEnded(true);
    }
  });

  document.getElementById('btnSimShortCall').addEventListener('click', () => {
    if (state.paymentState === 'IN_PROGRESS' || state.paymentState === 'INITIATING') {
      state.callDurationSec = 2;
      handleCallEnded(false);
    }
  });

  // Tab Navigation in Right Pane
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.dataset.tab;
      document.getElementById(targetId).classList.add('active');
    });
  });

  // Reset Button
  document.getElementById('btnResetAll').addEventListener('click', () => {
    stopCamera();
    clearInterval(state.callTimerInterval);
    clearInterval(state.windowCountdownInterval);
    state.paymentState = 'IDLE';
    state.currentSession = null;
    state.transactions = [];
    setPaymentState('IDLE', 'Reset by user');
    updateTransactionHistoryUI();
    showView('home');
  });
});
