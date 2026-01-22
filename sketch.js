let video;
let bodyPose, faceMesh;
let poses = [];
let faces = [];
let connections;

// --- POLICES D'ÉCRITURE ---
let fontMedium, fontRegular;

// --- CONFIGURATION RÉSEAU ---
let peer;
let conn; 
const HOST_ID = "biometral-grg-2026"; 
let networkStatus = "🔴 Déconnecté"; 

// --- VARIABLES TEXTE & COMPTEUR ---
let globalCaptureCount = 1;
// Liste sans accents
const adjectives = [
  "Agite", "Nerveux", "Tendu", "Febrile", 
  "Inquiet", "Stresse", "Instable", "Impatient", 
  "Brusque", "Perturbe", "Panique", "Crispe", 
  "Survolte", "Traque", "Anxieux"
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

// --- REGLAGES & DIFFICULTÉ ---
let noiseFilter = 0.5; 
let soloGaugeLimit = 500;
let prevAllFacesKeypoints = []; // On va devoir bien gérer ce tableau
let accumulatedScores = {};

// --- ML5 CONFIG (LIMITÉ À 5) ---
let bodyOptions = { 
    modelType: "MULTIPOSE_LIGHTNING", 
    enableSmoothing: true, 
    minConfidence: 0.3,
    maxPoses: 5 
};
let faceOptions = { 
    maxFaces: 5,
    refineLandmarks: false, 
    flipped: false, 
    minConfidence: 0.3
};

let expressionIndices = [1, 13, 14, 33, 263, 152];

function preload() {
  bodyPose = ml5.bodyPose(bodyOptions);
  faceMesh = ml5.faceMesh(faceOptions);
  
  fontMedium = loadFont('EaseDisplayTRIAL-Medium.ttf');
  fontRegular = loadFont('EaseDisplayTRIAL-Regular.ttf');
}

function setup() {
  // Optimisation: Utiliser P2D pour le rendu peut être plus stable graphiquement
  createCanvas(windowWidth, windowHeight);
  
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();

  // PeerJS setup avec gestion d'erreur améliorée
  setupPeer();

  bodyPose.detectStart(video, results => {
      // Sécurité : Si results est null ou undefined, on vide
      if(!results) poses = [];
      else poses = results.slice(0, 5);
  });
  
  faceMesh.detectStart(video, results => {
      if(!results) faces = [];
      else faces = results.slice(0, 5);
  });
  
  connections = bodyPose.getSkeleton();

  startButton = createButton('Commencer le scan ↗');
  styleButton();
  centerButton();
  startButton.mousePressed(triggerLoading);
  
  textFont('Arial'); 
}

function setupPeer() {
    try {
        if(peer) peer.destroy(); // Nettoyage si reconnexion
        peer = new Peer(HOST_ID, { debug: 1 });
        
        peer.on('open', (id) => {
            console.log('ID Serveur:', id);
            networkStatus = "🟠 Attente mobile (" + id + ")";
        });
        
        peer.on('connection', (c) => {
            conn = c;
            networkStatus = "🟢 Mobile connecté !";
            // Gestion de la fermeture du côté mobile
            conn.on('close', () => networkStatus = "🟠 Attente mobile...");
        });

        peer.on('error', (err) => {
            networkStatus = "❌ " + err.type;
            if(err.type === 'unavailable-id') networkStatus = "❌ ID pris. Rechargez.";
            // Tentative de reconnexion auto après 3s si déconnecté
            if(err.type === 'network' || err.type === 'disconnected') {
                setTimeout(setupPeer, 3000);
            }
        });
    } catch(e) {
        console.error("Erreur PeerJS:", e);
    }
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
  startButton.style('border-radius', '0px');
  startButton.style('font-weight', 'bold');
}

function cleanText(str) {
    if(!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// --- LOGIQUE NAVIGATION ---
function triggerLoading() {
  currentScene = "LOADING";
  startButton.hide();
  loadingStartTime = millis();
}

function triggerPrep() {
  currentScene = "PREP";
  prepStartTime = millis();
}

function startGame() {
  currentScene = "GAME";
  setNextState("GREEN");
}

function keyPressed() {
  if (currentScene === "GAME" && key === ' ') {
    isPaused = !isPaused;
    if (isPaused) pauseStartTime = millis();
    else {
      let pauseDuration = millis() - pauseStartTime;
      nextStateTime += pauseDuration;
      if(gameState === "RED") redLightStartTime += pauseDuration;
    }
  }
}

// --- RENDU (DRAW) OPTIMISÉ ---
function draw() {
  background(255);

  // Sécurité: Si la vidéo n'est pas prête, on ne dessine rien pour éviter les erreurs
  if (!video.loadedmetadata) return;

  if (currentScene === "HOME") {
    drawSharedHeader();
  } else if (currentScene === "LOADING") {
    drawLoadingScene();
  } else if (currentScene === "PREP") {
    // Optimisation : dessiner l'image directement sans passer par des buffers intermédiaires
    image(video, 0, 0, width, height);
    drawPrepScene();
  } else if (currentScene === "GAME") {
    image(video, 0, 0, width, height);
    if (isPaused) {
      drawDebugOverlay();
    } else {
      drawGameLogic();
    }
  }
}

function drawSharedHeader(specificSubtitle) {
  textAlign(LEFT, TOP);
  fill(0);
  noStroke();
  
  textFont(fontMedium);
  textSize(48); 
  text(cleanText("Biometral"), 50, 50);

  textFont(fontRegular);
  textSize(20); 
  let sub = specificSubtitle || "Workshop GRG 2026";
  text(cleanText(sub), 50, 100); 
}

function drawLoadingScene() {
  drawSharedHeader("PrintVision Statix2000 - Initialisation...");
  let elapsed = millis() - loadingStartTime;
  let progress = constrain(elapsed / loadingDuration, 0, 1);
  let centerX = width / 2;
  let centerY = height / 2;
  
  textAlign(CENTER, CENTER);
  fill(0); noStroke();
  
  textFont(fontMedium);
  textSize(36);
  text(cleanText("Chargement du systeme"), centerX, centerY - 50);
  
  textFont('Arial');
  textSize(16);
  text(Math.floor(progress * 100) + "%", centerX, centerY + 50);
  
  let barWidth = 300; let barHeight = 10; 
  let barX = centerX - barWidth / 2; let barY = centerY;
  
  fill(220); rect(barX, barY, barWidth, barHeight);
  let currentFillWidth = barWidth * progress;
  
  stroke(50);
  line(barX, barY + barHeight/2, barX + currentFillWidth, barY + barHeight/2);
  noStroke();

  if (progress >= 1.0) triggerPrep();
}

function drawPrepScene() {
  fill(255, 255, 255, 100);
  rect(0,0,width,height);
  drawSharedHeader("Initialisation des capteurs...");
  
  let elapsed = (millis() - prepStartTime) / 1000;
  let remaining = Math.ceil(prepDuration - elapsed);
  
  if (remaining <= 0) {
    startGame();
    return;
  }
  
  textAlign(CENTER, CENTER);
  fill(0); noStroke();
  
  textFont(fontMedium);
  textSize(200);
  text(remaining, width/2, height/2);
  
  textFont(fontRegular);
  textSize(24);
  text(cleanText("Placez-vous dans la zone"), width/2, height/2 + 120);
}

function drawGameLogic() {
  checkGameState();
  
  // Analyse seulement si des visages sont détectés pour économiser CPU
  let frameData = [];
  if (faces.length > 0) {
      frameData = analyzeMovements();
  }

  // Dessin des overlays
  drawSkeleton(color(255, 255, 255, 150));
  drawFaceBoxes(color(255, 255, 255, 180));
  drawSharedHeader("Scan en cours...");
  
  // Status Réseau
  textFont('Arial'); textSize(14); textAlign(RIGHT, TOP);
  if(networkStatus.includes("🟢")) fill(0, 200, 0);
  else if(networkStatus.includes("❌")) fill(255, 0, 0);
  else fill(255, 165, 0);
  text(networkStatus, width - 20, 20);

  if (gameState === "RED") {
     textAlign(CENTER, CENTER);
     fill(255, 0, 0); noStroke();
     
     textFont(fontMedium); textSize(180);
     text("Scan", width / 2, height / 2);
 
     fill(255); noStroke();
     textFont(fontRegular); textSize(32); 
     text(cleanText("Detection de mouvement"), width/2, height/2 + 100);
 
     if (millis() - redLightStartTime < 1000) return;
 
     for (let d of frameData) {
         if (!accumulatedScores[d.faceIndex]) accumulatedScores[d.faceIndex] = 0;
         if (d.score > 0) {
             accumulatedScores[d.faceIndex] += d.score * 8;
         }
         
         textFont('Arial'); 
         if (faces.length === 1) {
             drawSurvivalGauge(d.box, accumulatedScores[d.faceIndex]);
         } else {
             drawAgitationScore(d.box, accumulatedScores[d.faceIndex]);
         }
     }
  }
}

function drawDebugOverlay() {
  background(255, 255, 255, 220);
  drawSharedHeader("Mode maintenance");
  fill(0); noStroke(); textAlign(CENTER, CENTER);
  
  textFont(fontMedium); textSize(200);
  text("Debug", width/2, height/2);
  
  fill(50); textAlign(LEFT, BOTTOM); textSize(18); textFont('Arial');
  let infoY = height - 50;
  text("FPS : " + Math.floor(frameRate()), 50, infoY);
  text("Visages : " + faces.length, 250, infoY);
  
  drawSkeleton(color(0, 0, 0, 50));
  drawFaceBoxes(color(0, 0, 0, 50));
}

function setNextState(newState) {
  if (gameState === "RED" && newState === "GREEN") {
     checkVerdict();
  }
  gameState = newState;
  hasCaughtSomeone = false;
  accumulatedScores = {};
  
  if (newState === "GREEN") nextStateTime = millis() + random(2000, 5000);
  else {
    nextStateTime = millis() + random(5000, 9000);
    redLightStartTime = millis();
  }
}

function checkVerdict() {
  let maxScore = 0;
  let loserIndex = -1;
  let playerCount = 0;
  
  for (let index in accumulatedScores) {
    playerCount++;
    if (accumulatedScores[index] > maxScore) {
      maxScore = accumulatedScores[index];
      loserIndex = index;
    }
  }
  
  let shouldSnap = false;
  if (playerCount === 1) {
      if (maxScore > soloGaugeLimit) shouldSnap = true;
  } else {
      if (maxScore > 50) shouldSnap = true;
  }
  
  // VERIFICATION CRITIQUE : Est-ce que le visage existe encore ?
  if (shouldSnap && faces[loserIndex]) {
       try {
           let face = faces[loserIndex];
           let box = getFaceBox(face);
           takeSnapshot(box); 
           hasCaughtSomeone = true;
       } catch(e) {
           console.error("Erreur capture", e);
       }
  }
}

function checkGameState() {
  if (millis() > nextStateTime) {
    if (gameState === "GREEN") setNextState("RED");
    else setNextState("GREEN");
  }
}

function drawSkeleton(col) {
  if(!poses) return; // Sécurité
  stroke(col); strokeWeight(2);
  for (let i = 0; i < poses.length; i++) {
    let pose = poses[i];
    if(!pose.keypoints) continue;
    for (let j = 0; j < connections.length; j++) {
      let pointA = pose.keypoints[connections[j][0]];
      let pointB = pose.keypoints[connections[j][1]];
      if (pointA && pointB && pointA.confidence > 0.3 && pointB.confidence > 0.3) {
          line(pointA.x, pointA.y, pointB.x, pointB.y);
      }
    }
  }
}

function getFaceBox(face) {
   // Sécurité si keypoints manquant
   if(!face || !face.keypoints) return {x:0, y:0, w:0, h:0};
   
   let minX = width, maxX = 0, minY = height, maxY = 0;
   for(let j=0; j<face.keypoints.length; j+=5){
      let kp = face.keypoints[j];
      minX = min(minX, kp.x); maxX = max(maxX, kp.x);
      minY = min(minY, kp.y); maxY = max(maxY, kp.y);
   }
   return {x: minX, y: minY, w: maxX - minX, h: maxY - minY};
}

function drawFaceBoxes(col) {
  noFill(); stroke(col); strokeWeight(1); 
  for (let i = 0; i < faces.length; i++) {
    let box = getFaceBox(faces[i]);
    if(box.w > 0) {
        rect(box.x, box.y, box.w, box.h);
        line(box.x + box.w/2 - 10, box.y + box.h/2, box.x + box.w/2 + 10, box.y + box.h/2);
        line(box.x + box.w/2, box.y + box.h/2 - 10, box.x + box.w/2, box.y + box.h/2 + 10);
    }
  }
}

function analyzeMovements() {
  let results = [];
  let currentAllFacesKps = [];

  for (let i = 0; i < faces.length; i++) {
    let face = faces[i];
    let movementScore = 0;
    let box = getFaceBox(face);
    let faceScale = max(box.w, 20); 

    let currentExp = [];
    // Sécurité sur les indices
    for(let idx of expressionIndices) {
        if(face.keypoints[idx]) {
            currentExp.push({x: face.keypoints[idx].x, y: face.keypoints[idx].y});
        }
    }
    currentAllFacesKps.push(currentExp);

    if(prevAllFacesKeypoints[i] && prevAllFacesKeypoints[i].length === currentExp.length) {
       let totalDist = 0;
       let validCount = 0;
       
       for(let j=0; j<currentExp.length; j++) {
         let d = dist(currentExp[j].x, currentExp[j].y, prevAllFacesKeypoints[i][j].x, prevAllFacesKeypoints[i][j].y);
         if (d > (noiseFilter * (faceScale / 100))) {
            totalDist += d;
            validCount++;
         }
       }
       
       if (validCount > 0) {
           movementScore = (totalDist / validCount) / faceScale * 100;
       }
    }
    results.push({ faceIndex: i, score: movementScore, box: box });
  }
  
  // Nettoyage mémoire : On ne garde que les données des visages actuels
  prevAllFacesKeypoints = currentAllFacesKps;
  return results;
}

function drawSurvivalGauge(box, value) {
  let barWidth = box.w;
  let barHeight = 8;
  let x = box.x;
  let y = box.y - 30;
  fill(30, 30, 30, 200); noStroke();
  rect(x, y, barWidth, barHeight);
  let fillPercent = map(value, 0, soloGaugeLimit, 0, barWidth);
  fillPercent = constrain(fillPercent, 0, barWidth);
  
  if (value < soloGaugeLimit * 0.5) fill(0, 255, 0);
  else if (value < soloGaugeLimit * 0.8) fill(255, 165, 0);
  else fill(255, 0, 0);
  
  rect(x, y, fillPercent, barHeight);
  stroke(255); strokeWeight(1); noFill();
  rect(x, y, barWidth, barHeight);
  
  fill(255); noStroke(); textFont('Arial');
  textSize(14); textAlign(CENTER, BOTTOM); 
  text("Niveau d'alerte", x + barWidth/2, y - 5);
}

function drawAgitationScore(box, value) {
  let x = box.x;
  let y = box.y - 25;
  fill(255, 0, 0); noStroke();
  textFont('Arial'); textSize(18); textAlign(CENTER);
  text("Mvt: " + Math.floor(value), x + box.w/2, y);
}

// --- FONCTION DE CAPTURE SÉCURISÉE ---
function takeSnapshot(box) {
  // 1. Validation des dimensions pour éviter les crashs de création graphique
  let padding = 50;
  let x = Math.floor(max(0, box.x - padding));
  let y = Math.floor(max(0, box.y - padding));
  let w = Math.floor(min(width - x, box.w + padding * 2));
  let h = Math.floor(min(height - y, box.h + padding * 2));

  // Sécurité absolue : si l'image est trop petite, on annule
  if (w < 10 || h < 10) {
      console.log("Capture annulée : zone trop petite");
      return;
  }

  // 2. Utilisation d'un bloc try/catch pour la création graphique
  let pg;
  try {
    pg = createGraphics(w, h);
    pg.image(video, 0, 0, w, h, x, y, w, h);
    
    // Compression JPEG 0.5 pour alléger l'envoi réseau et éviter les lags
    let dataUrl = pg.canvas.toDataURL('image/jpeg', 0.5); 
    
    let randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
    let idNum = globalCaptureCount.toString().padStart(3, '0');

    if (conn && conn.open) {
        conn.send({
            image: dataUrl,
            id: "Individu " + idNum,
            adj: cleanText(randomAdj)
        });
        console.log(`📡 Envoyé : Individu ${idNum}`);
    } else {
        console.log("⚠️ Non envoyé (pas de connexion mobile)");
    }
    globalCaptureCount++;
    
  } catch (err) {
      console.error("Erreur snapshot:", err);
  } finally {
      // 3. NETTOYAGE IMPÉRATIF DE LA MÉMOIRE
      if (pg) {
          pg.remove(); 
          pg = null;
      }
  }
}
