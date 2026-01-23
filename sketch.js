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
const adjectives = [
  "Nerveux", "Tendu", "Febrile", 
  "Inquiet", "Stress", "Instable", "Impatient", 
  "Brusque", "Panique",
  "Survolte", "Anxieux"
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

// --- RÉGLAGES ---
let sensitivityThreshold = 0.5; 
let scoreMultiplier = 2.5;      
let soloGaugeLimit = 500;

// Mémoire
let prevCentroids = {}; 
let accumulatedScores = {};

// --- ML5 CONFIG (MIRRORED) ---
let bodyOptions = { 
    modelType: "MULTIPOSE_LIGHTNING", 
    enableSmoothing: true, 
    minConfidence: 0.25, 
    maxPoses: 5,
    flipped: true // <--- MODIF: Pour le miroir
};
let faceOptions = { 
    maxFaces: 5,
    refineLandmarks: false, 
    flipped: true, // <--- MODIF: Pour le miroir
    minConfidence: 0.25
};

function preload() {
  bodyPose = ml5.bodyPose(bodyOptions);
  faceMesh = ml5.faceMesh(faceOptions);
  easeFont = loadFont('EaseDisplayTRIAL-Medium.ttf');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  video = createCapture(VIDEO, () => {
      console.log("Vidéo chargée");
  });
  video.size(width, height);
  video.hide();

  setupPeer();

  bodyPose.detectStart(video, results => { poses = results || []; });
  faceMesh.detectStart(video, results => { faces = results || []; });
  
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
        peer.on('open', (id) => networkStatus = "🟠 Attente  (" + id + ")");
        peer.on('connection', (c) => {
            conn = c;
            networkStatus = "🟢 Connecté ";
            conn.on('close', () => networkStatus = "🟠 Attente ...");
        });
        peer.on('error', (err) => {
            if(err.type !== 'unavailable-id') setTimeout(setupPeer, 3000);
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

// --- BOUCLE DE DESSIN ---
function draw() {
  background(255);
  if (!video.loadedmetadata) return;

  if (currentScene === "HOME") {
      drawSharedHeader();
  } else if (currentScene === "LOADING") {
      drawLoadingScene();
  } else if (currentScene === "PREP") {
      // MODIF MIROIR : On inverse l'affichage vidéo
      push();
      translate(width, 0);
      scale(-1, 1);
      image(video, 0, 0, width, height);
      pop();
      
      drawPrepScene();
  } else if (currentScene === "GAME") {
      // MODIF MIROIR : On inverse tout (Vidéo + Squelettes)
      // On sauvegarde le contexte
      push();
      // On fait le miroir
      translate(width, 0);
      scale(-1, 1);
      
      // 1. Dessin Vidéo
      image(video, 0, 0, width, height);
      
      // 2. Logique & Dessin Squelettes (dans le contexte miroir)
      if (!isPaused) {
          // ANALYSE
          let players = [];
          try {
              players = analyzePlayersSafe();
          } catch(e) {}
  
          // DESSIN ÉLÉMENTS
          drawSmartSkeleton();
          drawPlayerBoxes(players);
          
          // GESTION JEU RED LIGHT (Logique visuelle déplacée ici pour être dans le miroir)
          handleGameLogicInsideTransform(players);
      } else {
          // Si pause, on dessine juste les squelettes fixes
          drawSmartSkeleton();
      }
      
      // Fin du contexte miroir
      pop(); 
      
      // --- INTERFACE (NON INVERSÉE) ---
      drawSharedHeader("Scan en cours...");
      
      // UI RÉSEAU
      textFont('Arial'); textSize(14); textAlign(RIGHT, TOP);
      if(networkStatus.includes("🟢")) fill(0, 200, 0);
      else fill(255, 0, 0);
      text(networkStatus, width - 20, 20);
      
      // TEXTES DU JEU (Doivent être lisibles, donc hors du miroir)
      if (gameState === "RED") {
          textAlign(CENTER, CENTER); fill(255, 0, 0); noStroke();
          textFont(easeFont); textSize(180); text("Scan", width / 2, height / 2);
          fill(255); textFont('Arial'); textSize(32); text("Détection de mouvement", width/2, height/2 + 100);
      }
      
      if(isPaused) drawDebugOverlay();
  }
}

function handleGameLogicInsideTransform(players) {
    // Cette fonction gère la logique qui doit être alignée avec la vidéo inversée
    
    // GESTION JEU
    checkGameState();

    if (gameState === "RED") {
        if (millis() - redLightStartTime < 1000) return; 

        for (let p of players) {
            let pIndex = p.index;
            if (!accumulatedScores[pIndex]) accumulatedScores[pIndex] = 0;
            accumulatedScores[pIndex] += p.score;
            
            // Pour dessiner le texte/jauge à l'endroit, on doit annuler le scale(-1, 1) localement
            push();
            translate(p.box.x + p.box.w/2, p.box.y); 
            scale(-1, 1); // On ré-inverse juste pour le texte
            translate(-(p.box.x + p.box.w/2), -p.box.y);
            
            // On dessine la jauge relative à la box
            // Note: les coordonnées de box sont déjà inversées par ML5 "flipped:true"
            // mais comme on est dans un context scale(-1, 1), ça s'aligne.
            
            // Simplification : On dessine directement, mais le texte sera à l'envers
            // Astuce : On utilise une fonction de dessin qui gère le texte à l'endroit
            drawGaugeCorrected(p.box, accumulatedScores[pIndex], players.length);
            
            pop();
        }
    }
}

function drawGaugeCorrected(box, value, playerCount) {
    // Comme on est dans un contexte miroir, le texte serait inversé.
    // On doit le dessiner "à l'envers" pour qu'il apparaisse "à l'endroit".
    
    let w = box.w, h = 8, x = box.x, y = box.y - 30;
    
    // Dessin Jauge (Géométrie OK en miroir)
    fill(30, 30, 30, 200); noStroke(); rect(x, y, w, h);
    let fillPct = constrain(map(value, 0, soloGaugeLimit, 0, w), 0, w);
    if (value < soloGaugeLimit * 0.5) fill(0, 255, 0);
    else if (value < soloGaugeLimit * 0.8) fill(255, 165, 0);
    else fill(255, 0, 0);
    rect(x, y, fillPct, h);
    stroke(255); noFill(); rect(x, y, w, h);

    // Dessin Texte (On doit le remettre à l'endroit)
    push();
    translate(x + w/2, y - 2);
    scale(-1, 1); // Ré-inversion pour le texte
    fill(255); noStroke(); textFont('Arial'); textSize(12); textAlign(CENTER, BOTTOM); 
    
    if(playerCount > 1) text(Math.floor(value), 0, 0);
    else text("Alerte", 0, 0);
    
    pop();
}


function drawSharedHeader(sub) {
  textAlign(LEFT, TOP); fill(0); noStroke();
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

// --- ANALYSE ANTI-CRASH ---
function analyzePlayersSafe() {
  let results = [];
  
  for (let i = 0; i < poses.length; i++) {
    let pose = poses[i];
    if(!pose || !pose.keypoints) continue;

    let matchedFace = null;
    let nose = pose.keypoints[0]; 
    
    if (nose && nose.confidence > 0.1) {
        let bestDist = 300; 
        for(let face of faces) {
            let box = getFaceBox(face);
            if(box.w > 0) {
                let cx = box.x + box.w/2;
                let cy = box.y + box.h/2;
                let d = dist(nose.x, nose.y, cx, cy);
                if (d < bestDist) {
                    bestDist = d;
                    matchedFace = face;
                }
            }
        }
    }

    let finalBox;
    if (matchedFace) {
        finalBox = getFaceBox(matchedFace);
    } else {
        finalBox = estimateHeadBox(pose);
    }

    if (finalBox.w < 5 || isNaN(finalBox.x)) continue;

    let currentScore = 0;
    let sumX = 0, sumY = 0, count = 0;
    
    let indices = [0, 5, 6, 9, 10]; 
    for(let idx of indices) {
        let kp = pose.keypoints[idx];
        if(kp && kp.confidence > 0.2 && !isNaN(kp.x) && !isNaN(kp.y)) {
            sumX += kp.x;
            sumY += kp.y;
            count++;
        }
    }

    if (count > 0) {
        let avgX = sumX / count;
        let avgY = sumY / count;
        
        let prev = prevCentroids[i];
        if (prev) {
            let d = dist(avgX, avgY, prev.x, prev.y);
            let scale = max(finalBox.w, 30);
            
            if (d > sensitivityThreshold * (scale/10)) {
                currentScore = (d / scale) * scoreMultiplier * 100;
            }
        }
        prevCentroids[i] = {x: avgX, y: avgY};
    } else {
        prevCentroids[i] = null;
    }

    results.push({ index: i, score: currentScore, box: finalBox });
  }
  
  return results;
}

// --- UTILITAIRES ---
function drawSmartSkeleton() {
  if(!connections || connections.length === 0) return;
  noFill(); stroke(255, 255, 255, 150); strokeWeight(2);
  
  for (let pose of poses) {
    if(!pose.keypoints) continue;
    for (let j = 0; j < connections.length; j++) {
      let idxA = connections[j][0];
      let idxB = connections[j][1];
      let kA = pose.keypoints[idxA];
      let kB = pose.keypoints[idxB];
      if (kA && kB && kA.confidence > 0.25 && kB.confidence > 0.25) {
          line(kA.x, kA.y, kB.x, kB.y);
      }
    }
  }
}

function drawPlayerBoxes(players) {
    noFill(); stroke(255, 255, 255, 180); strokeWeight(1);
    for(let p of players) {
        let box = p.box;
        if(box && box.w > 0) {
            rect(box.x, box.y, box.w, box.h);
            line(box.x + box.w/2, box.y + box.h/2 - 10, box.x + box.w/2, box.y + box.h/2 + 10);
            line(box.x + box.w/2 - 10, box.y + box.h/2, box.x + box.w/2 + 10, box.y + box.h/2);
        }
    }
}

function getFaceBox(face) {
   if(!face || !face.keypoints) return {x:0, y:0, w:0, h:0};
   let minX = width, maxX = 0, minY = height, maxY = 0;
   for(let j=0; j<face.keypoints.length; j+=5){
      let kp = face.keypoints[j];
      if(kp) {
          minX = min(minX, kp.x); maxX = max(maxX, kp.x);
          minY = min(minY, kp.y); maxY = max(maxY, kp.y);
      }
   }
   return {x: minX, y: minY, w: maxX - minX, h: maxY - minY};
}

function estimateHeadBox(pose) {
    let nose = pose.keypoints[0];
    let leftEar = pose.keypoints[3];
    let rightEar = pose.keypoints[4];
    let leftShoulder = pose.keypoints[5];
    let rightShoulder = pose.keypoints[6];

    let cx = 0, cy = 0, size = 60;

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

// --- LOGIQUE JEU ---
function setNextState(newState) {
  if (gameState === "RED" && newState === "GREEN") checkVerdict();
  gameState = newState;
  hasCaughtSomeone = false;
  accumulatedScores = {}; 
  
  if (newState === "GREEN") {
      nextStateTime = millis() + random(2000, 5000);
  } else {
      // MODIF: TEMPS DE SCAN (10 à 15 secondes)
      nextStateTime = millis() + random(10000, 15000); 
      redLightStartTime = millis();
  }
}

function checkVerdict() {
  let maxScore = 0;
  let loserIndex = -1;
  let players = [];
  try { players = analyzePlayersSafe(); } catch(e){}
  
  let threshold = (players.length <= 1) ? soloGaugeLimit : 50;
  
  for (let i in accumulatedScores) {
      if (accumulatedScores[i] > maxScore) {
          maxScore = accumulatedScores[i];
          loserIndex = i;
      }
  }
  
  if (maxScore > threshold) {
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

// --- CAPTURE & ENVOI (MIROIR APPLIQUÉ) ---
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
    
    // MODIF MIROIR SUR LA PHOTO:
    // On doit dessiner la vidéo inversée dans le buffer pour que la photo soit WYSIWYG
    pg.push();
    // On inverse tout le buffer
    pg.translate(w, 0);
    pg.scale(-1, 1);
    
    // On dessine l'image. Attention aux coordonnées.
    // Si on veut la portion de l'écran qui correspond à la boite "miroir", 
    // on doit dessiner la vidéo entière décalée.
    // Méthode simplifiée : on dessine la vidéo entière inversée, puis on get() la zone ?
    // Non, `pg` a déjà la taille de la boite.
    
    // Le plus simple pour que la photo corresponde exactement à l'écran miroir :
    // On dessine la partie correspondante de la vidéo brute.
    // Comme la vidéo brute est "normale", mais affichée "miroir" à l'écran :
    // La zone à x sur l'écran correspond à (width - x - w) sur la vidéo brute.
    
    let rawX = width - x - w; // Coordonnée X sur la vidéo brute
    pg.image(video, 0, 0, w, h, rawX, y, w, h);
    
    pg.pop();

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
