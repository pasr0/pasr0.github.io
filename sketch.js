let video;
let bodyPose, faceMesh;
let poses = [];
let faces = [];
let connections;

// --- CONFIGURATION RÉSEAU ---
let peer;
let conn; 
// On utilise un ID unique pour éviter les conflits
const HOST_ID = "biometral-grg-2026"; 
let networkStatus = "🔴 Déconnecté"; // Pour l'affichage

// --- VARIABLES TEXTE & COMPTEUR ---
let globalCaptureCount = 1;
const adjectives = [
  "Agité·e", "Nerveux·se", "Tendu·e", "Fébrile", 
  "Inquiet·e", "Stressé·e", "Instable", "Impatient·e", 
  "Brusque", "Perturbé·e", "Paniqué·e", "Crispé·e", 
  "Survolté·e", "Traqué·e", "Anxieux·se"
];

// --- GESTION DES SCÈNES ---
let currentScene = "HOME";

// --- VARIABLES UI ---
let startButton;
let loadingStartTime = 0;
const loadingDuration = 3000; 
let prepStartTime = 0;
const prepDuration = 10; 

// --- VARIABLES JEU ---
let gameState = "GREEN";
let nextStateTime = 0;
let hasCaughtSomeone = false;
let redLightStartTime = 0;

// --- VARIABLES DEBUG ---
let isPaused = false;
let pauseStartTime = 0;

// --- REGLAGES ---
let noiseFilter = 1.2;
let soloGaugeLimit = 500;
let prevAllFacesKeypoints = [];
let accumulatedScores = {};

// --- ML5 CONFIG ---
let bodyOptions = { modelType: "MULTIPOSE_LIGHTNING", enableSmoothing: true, minConfidence: 0.2 };
let faceOptions = { maxFaces: 4, refineLandmarks: false, flipped: false, minConfidence: 0.2 };
let expressionIndices = [1, 13, 14, 33, 263, 152];

function preload() {
  bodyPose = ml5.bodyPose(bodyOptions);
  faceMesh = ml5.faceMesh(faceOptions);
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();

  // --- INITIALISATION PEERJS AVEC DIAGNOSTIC ---
  peer = new Peer(HOST_ID, {
      debug: 2
  });
  
  peer.on('open', (id) => {
      console.log('ID Serveur:', id);
      networkStatus = "🟠 En attente du mobile... (ID: " + id + ")";
  });
  
  peer.on('connection', (c) => {
      conn = c;
      networkStatus = "🟢 Mobile connecté !";
      console.log("Connexion établie");
  });

  peer.on('error', (err) => {
      console.error(err);
      networkStatus = "❌ Erreur: " + err.type;
      if(err.type === 'unavailable-id') {
          networkStatus = "❌ ID déjà pris. Rechargez la page.";
      }
  });

  peer.on('disconnected', () => {
      networkStatus = "⚠️ Déconnecté du serveur cloud.";
      peer.reconnect();
  });

  bodyPose.detectStart(video, results => poses = results);
  faceMesh.detectStart(video, results => faces = results);
  connections = bodyPose.getSkeleton();

  startButton = createButton('Commencer le scan ↗');
  styleButton();
  centerButton();
  startButton.mousePressed(triggerLoading);
  textFont('Arial');
}

// ... LE RESTE DU CODE (windowResized, draw, etc.) RESTE IDENTIQUE ...
// ... SAUF la fonction drawGameLogic ci-dessous qu'il faut mettre à jour pour voir le statut ...

function drawGameLogic() {
  checkGameState();
  let frameData = analyzeMovements();
  drawSkeleton(color(255, 255, 255, 150));
  drawFaceBoxes(color(255, 255, 255, 180));
  drawSharedHeader("Scan en cours...");
  
  // --- AFFICHAGE DU STATUT RÉSEAU (NOUVEAU) ---
  textSize(14);
  textAlign(RIGHT, TOP);
  if(networkStatus.includes("🟢")) fill(0, 200, 0);
  else if(networkStatus.includes("❌")) fill(255, 0, 0);
  else fill(255, 165, 0);
  text(networkStatus, width - 20, 20);
  // ---------------------------------------------

  if (gameState === "RED") {
     // ... (Le reste de votre code RED ne change pas) ...
     textAlign(CENTER, CENTER);
     fill(255, 0, 0);
     noStroke();
     textStyle(BOLD);
     textSize(180);
     text("Scan", width / 2, height / 2);
 
     fill(255);
     noStroke();
     textStyle(NORMAL);
     textSize(32); 
     text("Détection de mouvement", width/2, height/2 + 100);
 
     if (millis() - redLightStartTime < 1000) return;
 
     for (let d of frameData) {
         if (!accumulatedScores[d.faceIndex]) accumulatedScores[d.faceIndex] = 0;
         if (d.score > 0) {
             accumulatedScores[d.faceIndex] += d.score * 5;
         }
         if (faces.length === 1) {
             drawSurvivalGauge(d.box, accumulatedScores[d.faceIndex]);
         } else {
             drawAgitationScore(d.box, accumulatedScores[d.faceIndex]);
         }
     }
  }
}

// ... Assurez vous d'avoir la fonction takeSnapshot avec le bon HOST_ID et peer.conn ...
function takeSnapshot(box) {
  // ... (Début identique : calcul padding, w, h) ...
  let padding = 50;
  let x = max(0, box.x - padding);
  let y = max(0, box.y - padding);
  let w = min(width - x, box.w + padding * 2);
  let h = min(height - y, box.h + padding * 2);

  if (w > 0 && h > 0) {
    let pg = createGraphics(w, h);
    pg.image(video, 0, 0, w, h, x, y, w, h);
    let dataUrl = pg.canvas.toDataURL('image/jpeg', 0.6); // Compression 0.6
    pg.remove();

    let randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
    let idNum = globalCaptureCount.toString().padStart(3, '0');

    // ENVOI SÉCURISÉ
    if (conn && conn.open) {
        conn.send({
            image: dataUrl,
            id: "Individu " + idNum,
            adj: randomAdj
        });
        console.log(`📡 Envoyé : Individu ${idNum}`);
    } else {
        console.log("⚠️ Échec envoi : Mobile non connecté.");
    }
    
    globalCaptureCount++;
  }
}

// ... LE RESTE DES FONCTIONS UTILITAIRES RESTE IDENTIQUE ...
