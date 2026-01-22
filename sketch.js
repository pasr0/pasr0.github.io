let video;
let bodyPose, faceMesh;
let poses = [];
let faces = [];
let connections;

// --- POLICES ---
let fontMedium, fontRegular;

// --- RÉSEAU ---
let peer;
let conn; 
const HOST_ID = "biometral-grg-2026"; 
let networkStatus = "🔴 Déconnecté"; 

// --- DONNÉES JEU ---
let globalCaptureCount = 1;
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

// --- RÉGLAGES DE SENSIBILITÉ (NOUVEAU) ---
// Seuil de mouvement : 0.05 signifie "bouger de 5% de la largeur de ses épaules"
let sensitivityThreshold = 0.04; 
// Multiplicateur de score pour que la jauge monte vite
let scoreMultiplier = 80; 
let soloGaugeLimit = 500;

// Mémoire des positions précédentes (Squelettes)
let prevPosesKeypoints = {}; 
let accumulatedScores = {};

// --- ML5 CONFIG ---
let bodyOptions = { 
    modelType: "MULTIPOSE_LIGHTNING", 
    enableSmoothing: true, 
    minConfidence: 0.25, // Assez bas pour détecter de loin
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
  fontMedium = loadFont('EaseDisplayTRIAL-Medium.ttf');
  fontRegular = loadFont('EaseDisplayTRIAL-Regular.ttf');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();

  setupPeer();

  bodyPose.detectStart(video, results => {
      if(results) poses = results.slice(0, 5);
      else poses = [];
  });
  
  faceMesh.detectStart(video, results => {
      if(results) faces = results.slice(0, 5);
      else faces = [];
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
        if(peer) peer.destroy();
        peer = new Peer(HOST_ID, { debug: 1 });
        peer.on('open', (id) => networkStatus = "🟠 Attente mobile (" + id + ")");
        peer.on('connection', (c) => {
            conn = c;
            networkStatus = "🟢 Mobile connecté !";
            conn.on('close', () => networkStatus = "🟠 Attente mobile...");
        });
        peer.on('error', (err) => {
            if(err.type === 'unavailable-id') networkStatus = "❌ ID pris. Rechargez.";
            else setTimeout(setupPeer, 3000);
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

function cleanText(str) {
    if(!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

// --- DESSIN PRINCIPAL ---
function draw() {
  background(255);
  if (!video.loadedmetadata) return;

  if (currentScene === "HOME") drawSharedHeader();
  else if (currentScene === "LOADING") drawLoadingScene();
  else if (currentScene === "PREP") {
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
  textFont(fontMedium); textSize(48); text(cleanText("Biometral"), 50, 50);
  textFont(fontRegular); textSize(20); text(cleanText(sub || "Workshop GRG 2026"), 50, 100); 
}

function drawLoadingScene() {
  drawSharedHeader("PrintVision Statix2000 - Initialisation...");
  let progress = constrain((millis() - loadingStartTime) / loadingDuration, 0, 1);
  let cx = width / 2, cy = height / 2;
  
  textAlign(CENTER, CENTER); fill(0);
  textFont(fontMedium); textSize(36); text(cleanText("Chargement du systeme"), cx, cy - 50);
  textFont('Arial'); textSize(16); text(Math.floor(progress * 100) + "%", cx, cy + 50);
  
  let bw = 300, bh = 10;
  fill(220); rect(cx - bw/2, cy, bw, bh);
  fill(0); rect(cx - bw/2, cy, bw * progress, bh); // Barre simple noire
  
  if (progress >= 1.0) triggerPrep();
}

function drawPrepScene() {
  fill(255, 255, 255, 100); rect(0,0,width,height);
  drawSharedHeader("Initialisation des capteurs...");
  let remaining = Math.ceil(prepDuration - (millis() - prepStartTime) / 1000);
  
  if (remaining <= 0) { startGame(); return; }
  
  textAlign(CENTER, CENTER); fill(0);
  textFont(fontMedium); textSize(200); text(remaining, width/2, height/2);
  textFont(fontRegular); textSize(24); text(cleanText("Placez-vous dans la zone"), width/2, height/2 + 120);
}

// --- COEUR DU JEU ---
function drawGameLogic() {
  checkGameState();
  
  // 1. Analyse du mouvement global (Corps)
  let movementData = analyzeBodyMovements();

  // 2. Dessin des squelettes et visages
  drawSmartSkeleton(); // Dessin amélioré
  drawFaceBoxes(color(255, 255, 255, 180));
  drawSharedHeader("Scan en cours...");
  
  // Status Réseau
  textFont('Arial'); textSize(14); textAlign(RIGHT, TOP);
  if(networkStatus.includes("🟢")) fill(0, 200, 0);
  else fill(255, 0, 0);
  text(networkStatus, width - 20, 20);

  if (gameState === "RED") {
     textAlign(CENTER, CENTER); fill(255, 0, 0); noStroke();
     textFont(fontMedium); textSize(180); text("Scan", width / 2, height / 2);
     fill(255); textFont(fontRegular); textSize(32); text(cleanText("Detection de mouvement"), width/2, height/2 + 100);
 
     if (millis() - redLightStartTime < 1000) return; // Délai de grâce 1s
 
     // Application des scores et affichage jauges
     for (let data of movementData) {
         let fIndex = data.faceIndex;
         if (!accumulatedScores[fIndex]) accumulatedScores[fIndex] = 0;
         
         // Accumulation du score
         accumulatedScores[fIndex] += data.score;
         
         textFont('Arial'); 
         if (faces.length === 1) {
             drawSurvivalGauge(data.box, accumulatedScores[fIndex]);
         } else {
             drawAgitationScore(data.box, accumulatedScores[fIndex]);
         }
     }
  }
}

// --- NOUVELLE LOGIQUE DE DÉTECTION ---
function analyzeBodyMovements() {
  let results = [];
  
  // Pour chaque visage détecté
  for (let i = 0; i < faces.length; i++) {
    let face = faces[i];
    let box = getFaceBox(face);
    let movementScore = 0;
    
    // On cherche le squelette qui correspond à ce visage
    // (Celui dont le nez est le plus proche du centre du visage)
    let bestPose = null;
    let minDist = 9999;
    
    // Le centre du visage
    let faceCx = box.x + box.w/2;
    let faceCy = box.y + box.h/2;

    for(let pose of poses) {
        // Le nez est souvent le point 0 du squelette
        if(pose.keypoints && pose.keypoints[0]) {
            let d = dist(faceCx, faceCy, pose.keypoints[0].x, pose.keypoints[0].y);
            // Si le nez est à moins de "1 largeur de visage" du centre du visage
            if(d < box.w * 1.5 && d < minDist) {
                minDist = d;
                bestPose = pose;
            }
        }
    }

    // SI on a trouvé un corps attaché à ce visage
    if (bestPose) {
        // 1. Calcul de l'échelle (Largeur Épaules) pour normaliser distance/proximité
        let leftShoulder = bestPose.keypoints[5];
        let rightShoulder = bestPose.keypoints[6];
        let scaleUnit = 100; // Valeur par défaut si échec

        if(leftShoulder.confidence > 0.1 && rightShoulder.confidence > 0.1) {
            scaleUnit = dist(leftShoulder.x, leftShoulder.y, rightShoulder.x, rightShoulder.y);
        } else {
            // Repli : on utilise la largeur du visage * 3 comme approximation
            scaleUnit = box.w * 3;
        }

        // 2. Points à surveiller (Poignets, Coudes, Épaules) - On ignore les jambes souvent cachées
        // Indices: 5,6 (Épaules), 7,8 (Coudes), 9,10 (Poignets)
        let indicesToCheck = [5, 6, 7, 8, 9, 10]; 
        let currentBodyPoints = [];
        let totalNormalizedDist = 0;
        let validPoints = 0;

        // Récupération des points actuels
        for(let idx of indicesToCheck) {
            let kp = bestPose.keypoints[idx];
            if(kp && kp.confidence > 0.2) { // Seulement si point fiable
                currentBodyPoints.push({id: idx, x: kp.x, y: kp.y});
            }
        }

        // Comparaison avec l'image d'avant
        let prevData = prevPosesKeypoints[i]; // On utilise l'index du visage comme clé
        if (prevData) {
            for(let currPt of currentBodyPoints) {
                // Trouver le même point dans le passé
                let prevPt = prevData.find(p => p.id === currPt.id);
                if(prevPt) {
                    let distancePx = dist(currPt.x, currPt.y, prevPt.x, prevPt.y);
                    
                    // NORMALISATION : Distance en pixels / Largeur Épaules
                    // Ex: bouger de 10px sur une largeur d'épaule de 100px = 0.1
                    let normalizedMvt = distancePx / scaleUnit;

                    // Si le mouvement dépasse le seuil (ex: 4% de la largeur d'épaule)
                    if(normalizedMvt > sensitivityThreshold) {
                        totalNormalizedDist += normalizedMvt;
                        validPoints++;
                    }
                }
            }
        }

        // Moyenne du mouvement global
        if(validPoints > 0) {
            // Le score final est boosté par le multiplicateur
            movementScore = (totalNormalizedDist / validPoints) * scoreMultiplier;
        }

        // Sauvegarde pour la prochaine frame
        prevPosesKeypoints[i] = currentBodyPoints;
    }

    results.push({ faceIndex: i, score: movementScore, box: box });
  }
  
  return results;
}

function drawSmartSkeleton() {
  noFill(); stroke(255, 255, 255, 150); strokeWeight(2);
  
  for (let pose of poses) {
    // Dessiner les os seulement si confiance suffisante
    for (let j = 0; j < connections.length; j++) {
      let kA = pose.keypoints[connections[j][0]];
      let kB = pose.keypoints[connections[j][1]];
      // Seuil confiance 0.3 pour éviter les squelettes "fantômes"
      if (kA && kB && kA.confidence > 0.3 && kB.confidence > 0.3) {
          line(kA.x, kA.y, kB.x, kB.y);
      }
    }
    // Dessiner les articulations principales
    fill(255, 0, 0); noStroke();
    for(let kp of pose.keypoints) {
        if(kp.confidence > 0.3) circle(kp.x, kp.y, 5);
    }
  }
}

// --- UTILITAIRES & LOGIQUE JEU (Inchangés mais nettoyés) ---

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

function drawFaceBoxes(col) {
  noFill(); stroke(col); strokeWeight(1); 
  for (let face of faces) {
    let box = getFaceBox(face);
    if(box.w > 20) { // On ne dessine pas les micro-bugs
        rect(box.x, box.y, box.w, box.h);
        // Croix de visée
        line(box.x + box.w/2, box.y + box.h/2 - 10, box.x + box.w/2, box.y + box.h/2 + 10);
        line(box.x + box.w/2 - 10, box.y + box.h/2, box.x + box.w/2 + 10, box.y + box.h/2);
    }
  }
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
  fill(255, 0, 0); noStroke(); fontRegular ? textFont(fontRegular) : textFont('Arial');
  textSize(24); textAlign(CENTER);
  text(Math.floor(value), x + box.w/2, y);
}

function drawDebugOverlay() {
  background(255, 255, 255, 220);
  drawSharedHeader("Mode maintenance");
  fill(0); noStroke(); textAlign(CENTER, CENTER);
  textFont(fontMedium); textSize(100); text("PAUSE", width/2, height/2);
}

// --- LOGIQUE ÉTATS ---
function setNextState(newState) {
  if (gameState === "RED" && newState === "GREEN") checkVerdict();
  gameState = newState;
  hasCaughtSomeone = false;
  accumulatedScores = {}; // Reset des scores au début du feu vert
  
  if (newState === "GREEN") nextStateTime = millis() + random(2000, 5000);
  else {
      nextStateTime = millis() + random(4000, 8000);
      redLightStartTime = millis();
  }
}

function checkVerdict() {
  let maxScore = 0;
  let loserIndex = -1;
  let activePlayers = 0;
  
  for (let i in accumulatedScores) {
      if(accumulatedScores[i] > 10) activePlayers++; // Filtre ceux qui n'ont pas bougé du tout
      if (accumulatedScores[i] > maxScore) {
          maxScore = accumulatedScores[i];
          loserIndex = i;
      }
  }
  
  let threshold = (faces.length === 1) ? soloGaugeLimit : 50;
  
  if (maxScore > threshold && faces[loserIndex]) {
       takeSnapshot(getFaceBox(faces[loserIndex])); 
       hasCaughtSomeone = true;
  }
}

function checkGameState() {
  if (millis() > nextStateTime) {
    if (gameState === "GREEN") setNextState("RED");
    else setNextState("GREEN");
  }
}

// --- CAPTURE ET ENVOI ---
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
        conn.send({ image: dataUrl, id: "Individu " + idNum, adj: cleanText(randAdj) });
    }
    globalCaptureCount++;
  } catch (err) { console.error(err); } 
  finally { if (pg) pg.remove(); }
}
