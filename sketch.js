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
  // Chargement des modèles
  bodyPose = ml5.bodyPose(bodyOptions);
  faceMesh = ml5.faceMesh(faceOptions);
  
  // CHARGEMENT DES POLICES (On utilise les .ttf pour p5.js)
  fontMedium = loadFont('EaseDisplayTRIAL-Medium.ttf');
  fontRegular = loadFont('EaseDisplayTRIAL-Regular.ttf');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();

  // PeerJS setup
  peer = new Peer(HOST_ID, { debug: 2 });
  
  peer.on('open', (id) => {
      console.log('ID Serveur:', id);
      networkStatus = "🟠 En attente du mobile... (ID: " + id + ")";
  });
  
  peer.on('connection', (c) => {
      conn = c;
      networkStatus = "🟢 Mobile connecté !";
  });

  peer.on('error', (err) => {
      console.error(err);
      networkStatus = "❌ Erreur: " + err.type;
      if(err.type === 'unavailable-id') networkStatus = "❌ ID déjà pris. Rechargez.";
  });

  peer.on('disconnected', () => {
      networkStatus = "⚠️ Déconnecté.";
      peer.reconnect();
  });

  bodyPose.detectStart(video, results => poses = results);
  faceMesh.detectStart(video, results => faces = results);
  connections = bodyPose.getSkeleton();

  startButton = createButton('Commencer le scan ↗');
  styleButton();
  centerButton();
  startButton.mousePressed(triggerLoading);
  
  // Par défaut Arial, on changera pour les titres
  textFont('Arial'); 
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  video.size(width, height);
  centerButton();
}

function centerButton() {
  startButton.position(width / 2 - 120, height / 2 - 25);
}

function styleButton() {
  // Le bouton reste en Arial (info/interface)
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
    if (isPaused) {
      pauseStartTime = millis();
    } else {
      let pauseDuration = millis() - pauseStartTime;
      nextStateTime += pauseDuration;
      if(gameState === "RED") redLightStartTime += pauseDuration;
    }
  }
}

// --- SHARED HEADER ---
function drawSharedHeader(specificSubtitle) {
  textAlign(LEFT, TOP);
  fill(0);
  noStroke();
  
  // TITRE : EaseDisplay Medium
  textFont(fontMedium);
  textSize(48); 
  text("Biometral", 50, 50);

  // SOUS-TITRE : EaseDisplay Regular
  textFont(fontRegular);
  textSize(20); 
  let sub = specificSubtitle || "Workshop GRG 2026";
  text(sub, 50, 100); 
}

// --- DRAW LOOP ---
function draw() {
  background(255);

  if (currentScene === "HOME") {
    drawHomeScene();
  } else if (currentScene === "LOADING") {
    drawLoadingScene();
  } else if (currentScene === "PREP") {
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

function drawHomeScene() {
  drawSharedHeader();
}

function drawLoadingScene() {
  drawSharedHeader("PrintVision Statix2000 - Initialisation...");
  let elapsed = millis() - loadingStartTime;
  let progress = constrain(elapsed / loadingDuration, 0, 1);
  let centerX = width / 2;
  let centerY = height / 2;
  textAlign(CENTER, CENTER);
  fill(0);
  noStroke();
  
  // Titre Chargement : EaseDisplay Medium
  textFont(fontMedium);
  textSize(36);
  text("Chargement du système", centerX, centerY - 50);
  
  // Pourcentage : Arial (Info technique)
  textFont('Arial');
  textSize(16);
  text(Math.floor(progress * 100) + "%", centerX, centerY + 50);
  
  // Barre
  let barWidth = 300;
  let barHeight = 10; 
  let barX = centerX - barWidth / 2;
  let barY = centerY;
  noStroke();
  fill(220);
  rect(barX, barY, barWidth, barHeight);
  let currentFillWidth = barWidth * progress;
  for (let i = 0; i < currentFillWidth; i++) {
    let inter = map(i, 0, barWidth, 0, 1);
    let c = lerpColor(color(100), color(0), inter);
    stroke(c);
    line(barX + i, barY, barX + i, barY + barHeight);
  }
  noStroke();
  if (progress >= 1.0) {
    triggerPrep();
  }
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
  fill(0);
  noStroke();
  
  // Compte à rebours : EaseDisplay Medium (Gros titre)
  textFont(fontMedium);
  textSize(200);
  text(remaining, width/2, height/2);
  
  // Instruction : EaseDisplay Regular (Sous-titre)
  textFont(fontRegular);
  textSize(24);
  text("Placez-vous dans la zone", width/2, height/2 + 120);
}

function drawGameLogic() {
  checkGameState();
  let frameData = analyzeMovements();
  drawSkeleton(color(255, 255, 255, 150));
  drawFaceBoxes(color(255, 255, 255, 180));
  drawSharedHeader("Scan en cours...");
  
  // Status Réseau : Arial (Info technique)
  textFont('Arial');
  textSize(14);
  textAlign(RIGHT, TOP);
  if(networkStatus.includes("🟢")) fill(0, 200, 0);
  else if(networkStatus.includes("❌")) fill(255, 0, 0);
  else fill(255, 165, 0);
  text(networkStatus, width - 20, 20);

  if (gameState === "RED") {
     textAlign(CENTER, CENTER);
     fill(255, 0, 0);
     noStroke();
     
     // "Scan" : EaseDisplay Medium
     textFont(fontMedium);
     textSize(180);
     text("Scan", width / 2, height / 2);
 
     fill(255);
     noStroke();
     
     // "Détection..." : EaseDisplay Regular
     textFont(fontRegular);
     textSize(32); 
     text("Détection de mouvement", width/2, height/2 + 100);
 
     if (millis() - redLightStartTime < 1000) return;
 
     for (let d of frameData) {
         if (!accumulatedScores[d.faceIndex]) accumulatedScores[d.faceIndex] = 0;
         if (d.score > 0) {
             accumulatedScores[d.faceIndex] += d.score * 5;
         }
         // Jauges et scores restent en Arial (Info technique)
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
  fill(0);
  noStroke();
  textAlign(CENTER, CENTER);
  
  textFont(fontMedium);
  textSize(200);
  text("Debug", width/2, height/2);
  
  fill(50);
  textAlign(LEFT, BOTTOM);
  textSize(18);
  
  // Infos techniques en Arial
  textFont('Arial');
  let infoY = height - 50;
  text("FPS : " + Math.floor(frameRate()), 50, infoY);
  text("Visages détectés : " + faces.length, 250, infoY);
  text("Filtre de bruit : " + noiseFilter, 500, infoY);
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
  if (newState === "GREEN") {
    nextStateTime = millis() + random(2000, 5000);
  } else {
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
  if (shouldSnap && faces[loserIndex]) {
       let face = faces[loserIndex];
       let box = getFaceBox(face);
       takeSnapshot(box); 
       hasCaughtSomeone = true;
  }
}

function checkGameState() {
  if (millis() > nextStateTime) {
    if (gameState === "GREEN") {
      setNextState("RED");
    } else {
      setNextState("GREEN");
    }
  }
}

function drawSkeleton(col) {
  stroke(col); strokeWeight(1); 
  for (let i = 0; i < poses.length; i++) {
    let pose = poses[i];
    for (let j = 0; j < connections.length; j++) {
      let pointA = pose.keypoints[connections[j][0]];
      let pointB = pose.keypoints[connections[j][1]];
      if (pointA.confidence > 0.1 && pointB.confidence > 0.1) line(pointA.x, pointA.y, pointB.x, pointB.y);
    }
  }
}

function getFaceBox(face) {
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
    rect(box.x, box.y, box.w, box.h);
    line(box.x + box.w/2 - 10, box.y + box.h/2, box.x + box.w/2 + 10, box.y + box.h/2);
    line(box.x + box.w/2, box.y + box.h/2 - 10, box.x + box.w/2, box.y + box.h/2 + 10);
  }
}

function analyzeMovements() {
  let results = [];
  let currentAllFacesKps = [];
  for (let i = 0; i < faces.length; i++) {
    let face = faces[i];
    let movementScore = 0;
    let box = getFaceBox(face);
    let currentExp = [];
    for(let idx of expressionIndices) currentExp.push({x: face.keypoints[idx].x, y: face.keypoints[idx].y});
    currentAllFacesKps.push(currentExp);
    if(prevAllFacesKeypoints[i]) {
       let totalDist = 0;
       let validCount = 0;
       for(let j=0; j<currentExp.length; j++) {
         let d = dist(currentExp[j].x, currentExp[j].y, prevAllFacesKeypoints[i][j].x, prevAllFacesKeypoints[i][j].y);
         if (d > noiseFilter) {
            totalDist += d;
            validCount++;
         }
       }
       if (validCount > 0) movementScore = totalDist / validCount;
    }
    results.push({ faceIndex: i, score: movementScore, box: box });
  }
  prevAllFacesKeypoints = currentAllFacesKps;
  return results;
}

function drawSurvivalGauge(box, value) {
  let barWidth = box.w;
  let barHeight = 8;
  let x = box.x;
  let y = box.y - 30;
  fill(30, 30, 30, 200);
  noStroke();
  rect(x, y, barWidth, barHeight);
  let fillPercent = map(value, 0, soloGaugeLimit, 0, barWidth);
  fillPercent = constrain(fillPercent, 0, barWidth);
  if (value < soloGaugeLimit * 0.5) fill(0, 255, 0);
  else if (value < soloGaugeLimit * 0.8) fill(255, 165, 0);
  else fill(255, 0, 0);
  rect(x, y, fillPercent, barHeight);
  stroke(255); strokeWeight(1);
  noFill();
  rect(x, y, barWidth, barHeight);
  fill(255); noStroke();
  
  // Info jauge : Arial
  textFont('Arial');
  textSize(14); textAlign(CENTER, BOTTOM); 
  text("Niveau d'alerte", x + barWidth/2, y - 5);
}

function drawAgitationScore(box, value) {
  let x = box.x;
  let y = box.y - 25;
  fill(255, 0, 0);
  noStroke();
  
  // Score : Arial
  textFont('Arial');
  textSize(18); 
  textAlign(CENTER);
  text("Mvt: " + Math.floor(value), x + box.w/2, y);
}

function takeSnapshot(box) {
  let padding = 50;
  let x = max(0, box.x - padding);
  let y = max(0, box.y - padding);
  let w = min(width - x, box.w + padding * 2);
  let h = min(height - y, box.h + padding * 2);

  if (w > 0 && h > 0) {
    let pg = createGraphics(w, h);
    pg.image(video, 0, 0, w, h, x, y, w, h);
    let dataUrl = pg.canvas.toDataURL('image/jpeg', 0.6); 
    pg.remove();

    let randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
    let idNum = globalCaptureCount.toString().padStart(3, '0');

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
