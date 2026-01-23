let video;
let bodyPose, faceMesh;
let poses = [];
let faces = [];
let connections;

// --- POLICES ---
let easeFont; 

// --- RÉSEAU (PEERJS) ---
let peer;
let conn; 
const HOST_ID = "biometral-grg-2026"; 
let networkStatus = "🔴 Déconnecté"; 

// --- DONNÉES JEU ---
let globalCaptureCount = 1;
// Liste sans accents pour éviter tout bug de transfert
const adjectives = [
  "Agite", "Nerveux", "Tendu", "Febrile", 
  "Inquiet", "Stresse", "Instable", "Impatient", 
  "Brusque", "Perturbe", "Panique", "Crispe", 
  "Survolte", "Traque", "Anxieux"
];

// --- SCÈNES ---
let currentScene = "HOME";
let startButton;
let loadingStartTime = 0;
const loadingDuration = 3000; 
let prepStartTime = 0;
const prepDuration = 10; 

// --- GAMEPLAY ---
let gameState = "GREEN";
let nextStateTime = 0;
let hasCaughtSomeone = false;
let redLightStartTime = 0;

// --- DEBUG ---
let isPaused = false;
let pauseStartTime = 0;

// --- RÉGLAGES DE SENSIBILITÉ ---
// Seuil de mouvement normalisé (0.01 = 1% de la taille de la tête)
let sensitivityThreshold = 0.01; 
// Vitesse de remplissage de la jauge
let scoreMultiplier = 50; 
let soloGaugeLimit = 500;

// Mémoire des positions précédentes (Centre de gravité)
let prevCentroids = {}; 
let accumulatedScores = {};

// --- ML5 CONFIG (ROBUSTE) ---
let bodyOptions = { 
    modelType: "MULTIPOSE_LIGHTNING", 
    enableSmoothing: true, 
    minConfidence: 0.25, 
    maxPoses: 5 
};
let faceOptions = { 
    maxFaces: 5,
    refineLandmarks: false, 
    flipped: false, 
    minConfidence: 0.25
};

function preload() {
  bodyPose = ml5.bodyPose(bodyOptions);
  faceMesh = ml5.faceMesh(faceOptions);
  easeFont = loadFont('EaseDisplayTRIAL-Medium.ttf');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();

  setupPeer();

  // Callbacks sécurisés
  bodyPose.detectStart(video, results => { poses = results || []; });
  faceMesh.detectStart(video, results => { faces = results || []; });
  
  connections = bodyPose.getSkeleton();

  startButton = createButton('Commencer le scan ↗');
  styleButton();
  centerButton();
  startButton.mousePressed(triggerLoading);
  
  textFont('Arial'); 
}

// --- GESTION RÉSEAU AUTO-RECONNECT ---
function setupPeer() {
    try {
        if(peer) peer.destroy();
        peer = new Peer(HOST_ID, { debug: 1 });
        
        peer.on('open', (id) => {
            console.log("Serveur OK: " + id);
            networkStatus = "🟠 Attente mobile (" + id + ")";
        });
        
        peer.on('connection', (c) => {
            conn = c;
            networkStatus = "🟢 Mobile connecté !";
            conn.on('close', () => networkStatus = "🟠 Attente mobile...");
            conn.on('error', () => networkStatus = "🟠 Erreur co.");
        });

        peer.on('error', (err) => {
            if(err.type !== 'unavailable-id') {
                // Tentative de reconnexion auto
                setTimeout(setupPeer, 3000);
            } else {
                networkStatus = "❌ ID déjà pris. Rafraîchir.";
            }
        });
    } catch(e) { console.error(e); }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  video.size(width, height);
  centerButton();
}

function centerButton() {
  if(startButton) startButton.position(width / 2 - 120, height / 2 - 25);
}

function styleButton() {
  startButton.size(240, 50);
  startButton.style('font-family', 'Arial, sans-serif');
  startButton.style('font-size', '18px');
  startButton.style('background-color', 'white');
  startButton.style('color', 'black');
  startButton.style('border', '1px solid black'); 
  startButton.style('cursor', 'pointer');
  startButton.style('font-weight', 'bold');
}

// --- NAVIGATION ---
function triggerLoading() { currentScene = "LOADING"; startButton.hide(); loadingStartTime = millis(); }
function triggerPrep() { currentScene = "PREP"; prepStartTime = millis(); }
function startGame() { currentScene = "GAME"; setNextState("GREEN"); }

function keyPressed() {
  if (currentScene === "GAME" && key === ' ') {
    isPaused = !isPaused;
    if (isPaused) pauseStartTime = millis();
    else {
      let duration = millis() - pauseStartTime;
      nextStateTime += duration;
      if(gameState === "RED") redLightStartTime += duration;
    }
  }
}

// --- RENDU GRAPHIQUE ---
function draw() {
  background(255);
  // Sécurité absolue : si la vidéo n'est pas chargée, on ne fait rien
  if (!video.loadedmetadata) return;

  if (currentScene === "HOME") {
      drawSharedHeader();
  } else if (currentScene === "LOADING") {
      drawLoadingScene();
  } else if (currentScene === "PREP") {
      image(video, 0, 0, width, height);
      drawPrepScene();
  } else if (currentScene === "GAME") {
      image(video, 0, 0, width, height);
      if (isPaused) drawDebugOverlay();
      else drawGameLogic();
  }
}

function drawSharedHeader(sub) {
  textAlign(LEFT, TOP); fill(0); noStroke();
  // Seul le titre en Ease
  textFont(easeFont); textSize(48); text("Biometral", 50, 50);
  textFont('Arial'); textSize(20); text(sub || "Workshop GRG 2026", 50, 100); 
}

function drawLoadingScene() {
  drawSharedHeader("PrintVision Statix2000 - Initialisation...");
  let progress = constrain((millis() - loadingStartTime) / loadingDuration, 0, 1);
  let cx = width / 2, cy = height / 2;
  
  textAlign(CENTER, CENTER); fill(0);
  textFont('Arial'); textStyle(BOLD); textSize(36); text("Chargement du système", cx, cy - 50);
  textStyle(NORMAL); textSize(16); text(Math.floor(progress * 100) + "%", cx, cy + 50);
  
  let bw = 300, bh = 10;
  fill(220); rect(cx - bw/2, cy, bw, bh);
  fill(0); rect(cx - bw/2, cy, bw * progress, bh);
  
  if (progress >= 1.0) triggerPrep();
}

function drawPrepScene() {
  fill(255, 255, 255, 100); rect(0,0,width,height);
  drawSharedHeader("Initialisation des capteurs...");
  let remaining = Math.ceil(prepDuration - (millis() - prepStartTime) / 1000);
  if (remaining <= 0) { startGame(); return; }
  
  textAlign(CENTER, CENTER); fill(0);
  // Ease pour le gros chiffre
  textFont(easeFont); textSize(200); text(remaining, width/2, height/2);
  textFont('Arial'); textSize(24); text("Placez-vous dans la zone", width/2, height/2 + 120);
}

function drawGameLogic() {
  checkGameState();
  
  // 1. ANALYSE (Priorité Squelette)
  // On récupère une liste propre de joueurs, même si le visage est perdu
  let players = analyzePlayersRobust();

  // 2. DESSIN
  drawSmartSkeleton();
  drawPlayerBoxes(players); 
  drawSharedHeader("Scan en cours...");
  
  // 3. UI RÉSEAU
  textFont('Arial'); textSize(14); textAlign(RIGHT, TOP);
  if(networkStatus.includes("🟢")) fill(0, 200, 0);
  else fill(255, 0, 0);
  text(networkStatus, width - 20, 20);

  // 4. JEU (RED LIGHT)
  if (gameState === "RED") {
     textAlign(CENTER, CENTER); fill(255, 0, 0); noStroke();
     // Titre Scan en Ease
     textFont(easeFont); textSize(180); text("Scan", width / 2, height / 2);
     
     fill(255); textFont('Arial'); textSize(32); text("Détection de mouvement", width/2, height/2 + 100);
 
     if (millis() - redLightStartTime < 1000) return; // Délai 1s
 
     // Boucle sur les joueurs détectés
     for (let p of players) {
         let pIndex = p.index; // Index unique du squelette
         
         if (!accumulatedScores[pIndex]) accumulatedScores[pIndex] = 0;
         accumulatedScores[pIndex] += p.score;
         
         textFont('Arial'); 
         if (players.length === 1) {
             drawSurvivalGauge(p.box, accumulatedScores[pIndex]);
         } else {
             drawAgitationScore(p.box, accumulatedScores[pIndex]);
         }
     }
  }
}

function drawDebugOverlay() {
  background(255, 255, 255, 220);
  drawSharedHeader("Mode maintenance");
  fill(0); noStroke(); textAlign(CENTER, CENTER);
  textFont(easeFont); textSize(150); text("Debug", width/2, height/2);
  fill(50); textAlign(LEFT, BOTTOM); textSize(18); textFont('Arial');
  let infoY = height - 50;
  text("FPS : " + Math.floor(frameRate()), 50, infoY);
  text("Squelettes : " + poses.length, 200, infoY);
}

// --- COEUR DE L'ANALYSE (SQUELETTE D'ABORD) ---
// C'est cette fonction qui garantit que ça ne plante jamais
function analyzePlayersRobust() {
  let results = [];
  
  // On itère sur les SQUELETTES (Poses) car c'est la base du corps
  for (let i = 0; i < poses.length; i++) {
    let pose = poses[i];
    
    // Si pas de points clés, on ignore
    if(!pose.keypoints) continue;

    // 1. Tenter de trouver le VISAGE correspondant
    let matchedFace = null;
    let nose = pose.keypoints[0]; // Nez
    
    if (nose && nose.confidence > 0.1) {
        let bestDist = 200; // Rayon de recherche (pixels)
        for(let face of faces) {
            // On calcule le centre du visage
            let box = getFaceBox(face);
            let cx = box.x + box.w/2;
            let cy = box.y + box.h/2;
            let d = dist(nose.x, nose.y, cx, cy);
            if (d < bestDist) {
                bestDist = d;
                matchedFace = face;
            }
        }
    }

    // 2. Définir la BOITE (Box)
    let finalBox;
    if (matchedFace) {
        // Idéal : On a le visage
        finalBox = getFaceBox(matchedFace);
    } else {
        // Secours : On estime la tête via le squelette
        finalBox = estimateHeadBox(pose);
    }

    // Sécurité : Si la boite est invalide ou hors champ, on passe
    if (finalBox.w < 10 || finalBox.x < -50 || finalBox.x > width+50) continue;

    // 3. Calcul du Mouvement (Centroïde)
    let currentScore = 0;
    let sumX = 0, sumY = 0, count = 0;
    
    // On utilise les points stables du squelette (Nez, Épaules, Hanches)
    let indices = [0, 5, 6, 11, 12]; 
    for(let idx of indices) {
        let kp = pose.keypoints[idx];
        if(kp && kp.confidence > 0.25) {
            sumX += kp.x;
            sumY += kp.y;
            count++;
        }
    }

    // Si on a assez de points pour calculer un centre
    if (count > 0) {
        let avgX = sumX / count;
        let avgY = sumY / count;
        
        let prev = prevCentroids[i]; // Mémoire liée à l'index du squelette
        if (prev) {
            let d = dist(avgX, avgY, prev.x, prev.y);
            // Normalisation par la taille de la tête (pour gérer la distance)
            let scale = max(finalBox.w, 30);
            
            // Si le mouvement dépasse le seuil
            if (d > sensitivityThreshold * (scale/10)) {
                currentScore = (d / scale) * scoreMultiplier * 100;
            }
        }
        prevCentroids[i] = {x: avgX, y: avgY};
    } else {
        prevCentroids[i] = null;
    }

    results.push({ 
        index: i, 
        score: currentScore, 
        box: finalBox 
    });
  }
  
  return results;
}

// --- UTILITAIRES DE DESSIN ET CALCUL ---

function drawSmartSkeleton() {
  noFill(); stroke(255, 255, 255, 150); strokeWeight(2);
  for (let pose of poses) {
    if(!pose.keypoints) continue;
    for (let j = 0; j < connections.length; j++) {
      let kA = pose.keypoints[connections[j][0]];
      let kB = pose.keypoints[connections[j][1]];
      if (kA && kB && kA.confidence > 0.2 && kB.confidence > 0.2) {
          line(kA.x, kA.y, kB.x, kB.y);
      }
    }
  }
}

function drawPlayerBoxes(players) {
    noFill(); stroke(255, 255, 255, 180); strokeWeight(1);
    for(let p of players) {
        let box = p.box;
        rect(box.x, box.y, box.w, box.h);
        line(box.x + box.w/2, box.y + box.h/2 - 10, box.x + box.w/2, box.y + box.h/2 + 10);
        line(box.x + box.w/2 - 10, box.y + box.h/2, box.x + box.w/2 + 10, box.y + box.h/2);
    }
}

function getFaceBox(face) {
   if(!face || !face.keypoints) return {x:0, y:0, w:0, h:0};
   let minX = width, maxX = 0, minY = height, maxY = 0;
   for(let j=0; j<face.keypoints.length; j+=5){
      let kp = face.keypoints[j];
      minX = min(minX, kp.x); maxX = max(maxX, kp.x);
      minY = min(minY, kp.y); maxY = max(maxY, kp.y);
   }
   return {x: minX, y: minY, w: maxX - minX, h: maxY - minY};
}

// Fonction de secours mathématique si FaceMesh échoue
function estimateHeadBox(pose) {
    let nose = pose.keypoints[0];
    let leftEar = pose.keypoints[3];
    let rightEar = pose.keypoints[4];
    let leftShoulder = pose.keypoints[5];
    let rightShoulder = pose.keypoints[6];

    let cx = 0, cy = 0, size = 60; // Défaut

    if (nose && nose.confidence > 0.1) {
        cx = nose.x; cy = nose.y;
    } else if (leftShoulder && rightShoulder) {
        cx = (leftShoulder.x + rightShoulder.x) / 2;
        cy = (leftShoulder.y + rightShoulder.y) / 2 - 50;
    } else {
        return {x:0, y:0, w:0, h:0};
    }

    if (leftEar && rightEar && leftEar.confidence > 0.1) {
        size = dist(leftEar.x, leftEar.y, rightEar.x, rightEar.y) * 1.5;
    } else if (leftShoulder && rightShoulder) {
        size = dist(leftShoulder.x, leftShoulder.y, rightShoulder.x, rightShoulder.y) / 2.5;
    }

    return { x: cx - size/2, y: cy - size/2, w: size, h: size };
}

function drawSurvivalGauge(box, value) {
  let w = box.w, h = 8, x = box.x, y = box.y - 30;
  fill(30, 30, 30, 200); noStroke(); rect(x, y, w, h);
  let fillPct = constrain(map(value, 0, soloGaugeLimit, 0, w), 0, w);
  if (value < soloGaugeLimit * 0.5) fill(0, 255, 0);
  else if (value < soloGaugeLimit * 0.8) fill(255, 165, 0);
  else fill(255, 0, 0);
  rect(x, y, fillPct, h);
  stroke(255); noFill(); rect(x, y, w, h);
  fill(255); noStroke(); textFont('Arial'); textSize(12); textAlign(CENTER, BOTTOM); 
  text("Alerte", x + w/2, y - 2);
}

function drawAgitationScore(box, value) {
  let x = box.x, y = box.y - 25;
  fill(255, 0, 0); noStroke(); textFont('Arial');
  textSize(24); textAlign(CENTER);
  text(Math.floor(value), x + box.w/2, y);
}

// --- LOGIQUE JEU ---
function setNextState(newState) {
  if (gameState === "RED" && newState === "GREEN") checkVerdict();
  gameState = newState;
  hasCaughtSomeone = false;
  accumulatedScores = {}; 
  if (newState === "GREEN") nextStateTime = millis() + random(2000, 5000);
  else {
      nextStateTime = millis() + random(4000, 8000);
      redLightStartTime = millis();
  }
}

function checkVerdict() {
  let maxScore = 0;
  let loserIndex = -1;
  let players = analyzePlayersRobust();
  let threshold = (players.length <= 1) ? soloGaugeLimit : 50;
  
  for (let i in accumulatedScores) {
      if (accumulatedScores[i] > maxScore) {
          maxScore = accumulatedScores[i];
          loserIndex = i;
      }
  }
  
  // Si le score dépasse le seuil, on prend la photo du perdant
  if (maxScore > threshold) {
      // Retrouver la boite du joueur perdant
      let loser = players.find(p => p.index == loserIndex);
      if(loser) {
          takeSnapshot(loser.box); 
          hasCaughtSomeone = true;
      }
  }
}

function checkGameState() {
  if (millis() > nextStateTime) {
    if (gameState === "GREEN") setNextState("RED");
    else setNextState("GREEN");
  }
}

// --- CAPTURE & ENVOI ---
function takeSnapshot(box) {
  let pad = 50;
  let x = Math.floor(max(0, box.x - pad));
  let y = Math.floor(max(0, box.y - pad));
  let w = Math.floor(min(width - x, box.w + pad * 2));
  let h = Math.floor(min(height - y, box.h + pad * 2));

  if (w < 20 || h < 20) return;

  let pg;
  try {
    pg = createGraphics(w, h);
    pg.image(video, 0, 0, w, h, x, y, w, h);
    let dataUrl = pg.canvas.toDataURL('image/jpeg', 0.5); 
    let randAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
    let idNum = globalCaptureCount.toString().padStart(3, '0');

    if (conn && conn.open) {
        conn.send({ image: dataUrl, id: "Individu " + idNum, adj: randAdj });
        console.log(`📡 Envoyé : Individu ${idNum}`);
    }
    globalCaptureCount++;
  } catch (err) { console.error(err); } 
  finally { if (pg) pg.remove(); } 
}
