let video;
let bodyPose, faceMesh;
let poses = [];
let faces = [];
let connections;

// --- FONTS ---
let easeFont; // For big titles only

// --- NETWORK (PEERJS) ---
let peer;
let conn; 
const HOST_ID = "biometral-grg-2026"; 
let networkStatus = "🔴 Déconnecté"; 

// --- GAME DATA ---
let globalCaptureCount = 1;
// Adjectives list (no accents for maximum safety during transfer)
const adjectives = [
  "Agite", "Nerveux", "Tendu", "Febrile", 
  "Inquiet", "Stresse", "Instable", "Impatient", 
  "Brusque", "Perturbe", "Panique", "Crispe", 
  "Survolte", "Traque", "Anxieux"
];

// --- SCENES ---
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

// --- DETECTION SETTINGS (STABILITY) ---
// Threshold: How much relative movement triggers detection
let sensitivityThreshold = 0.05; 
// Multiplier to make the score go up faster
let scoreMultiplier = 80; 
let soloGaugeLimit = 500;

// Memory for previous positions
let prevPosesKeypoints = {}; 
let accumulatedScores = {};

// --- ML5 CONFIG (LIMITED TO 5 PEOPLE) ---
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
  // Load standard font for p5
  easeFont = loadFont('EaseDisplayTRIAL-Medium.ttf');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();

  setupPeer();

  // Callbacks with security (.slice) to limit load
  bodyPose.detectStart(video, results => {
      poses = results ? results.slice(0, 5) : [];
  });
  
  faceMesh.detectStart(video, results => {
      faces = results ? results.slice(0, 5) : [];
  });
  
  connections = bodyPose.getSkeleton();

  // Button creation (Arial Style)
  startButton = createButton('Commencer le scan ↗');
  styleButton();
  centerButton();
  startButton.mousePressed(triggerLoading);
  
  // Default font for the sketch
  textFont('Arial'); 
}

function setupPeer() {
    try {
        if(peer) peer.destroy();
        peer = new Peer(HOST_ID, { debug: 1 });
        
        peer.on('open', (id) => {
            console.log('ID Serveur:', id);
            networkStatus = "🟠 Attente mobile (" + id + ")";
        });
        
        peer.on('connection', (c) => {
            conn = c;
            networkStatus = "🟢 Mobile connecté !";
            conn.on('close', () => networkStatus = "🟠 Attente mobile...");
        });

        peer.on('error', (err) => {
            if(err.type === 'unavailable-id') networkStatus = "❌ ID déjà pris. Rechargez.";
            else setTimeout(setupPeer, 3000); // Auto-reconnect
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

// --- MAIN DRAW LOOP ---
function draw() {
  background(255);
  // Security: do nothing if video isn't ready
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

// --- DISPLAY FUNCTIONS ---

function drawSharedHeader(customSubtitle) {
  textAlign(LEFT, TOP); fill(0); noStroke();
  
  // TITLE: EASE Font
  textFont(easeFont); 
  textSize(48); 
  text("Biometral", 50, 50);

  // SUBTITLE: ARIAL Font
  textFont('Arial'); 
  textSize(20); 
  text(customSubtitle || "Workshop GRG 2026", 50, 100); 
}

function drawLoadingScene() {
  drawSharedHeader("PrintVision Statix2000 - Initialisation...");
  let progress = constrain((millis() - loadingStartTime) / loadingDuration, 0, 1);
  let cx = width / 2, cy = height / 2;
  
  textAlign(CENTER, CENTER); fill(0);
  
  // Loading Title: ARIAL
  textFont('Arial'); 
  textStyle(BOLD);
  textSize(36); 
  text("Chargement du système", cx, cy - 50);
  
  textStyle(NORMAL);
  textSize(16); 
  text(Math.floor(progress * 100) + "%", cx, cy + 50);
  
  // Progress Bar
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
  
  // Countdown: EASE Font
  textFont(easeFont); 
  textSize(200); 
  text(remaining, width/2, height/2);
  
  textFont('Arial'); 
  textSize(24); 
  text("Placez-vous dans la zone", width/2, height/2 + 120);
}

function drawGameLogic() {
  checkGameState();
  
  // 1. Analyze (only if faces are present)
  let movementData = [];
  if (faces.length > 0) {
      movementData = analyzeBodyMovements();
  }

  // 2. Draw
  drawSmartSkeleton();
  drawFaceBoxes(color(255, 255, 255, 180));
  drawSharedHeader("Scan en cours...");
  
  // 3. Network Status (Arial)
  textFont('Arial'); textSize(14); textAlign(RIGHT, TOP);
  if(networkStatus.includes("🟢")) fill(0, 200, 0);
  else fill(255, 0, 0);
  text(networkStatus, width - 20, 20);

  // 4. "RED LIGHT" Mode
  if (gameState === "RED") {
     textAlign(CENTER, CENTER); fill(255, 0, 0); noStroke();
     
     // KEYWORD: EASE Font
     textFont(easeFont); 
     textSize(180); 
     text("Scan", width / 2, height / 2);
     
     // Subtitle: ARIAL Font
     fill(255); 
     textFont('Arial'); 
     textSize(32); 
     text("Détection de mouvement", width/2, height/2 + 100);
 
     if (millis() - redLightStartTime < 1000) return; // Small delay
 
     // Scores and Gauges
     for (let data of movementData) {
         let fIndex = data.faceIndex;
         if (!accumulatedScores[fIndex]) accumulatedScores[fIndex] = 0;
         
         // Add calculated score
         accumulatedScores[fIndex] += data.score;
         
         // Display Gauges (All Arial)
         textFont('Arial'); 
         if (faces.length === 1) {
             drawSurvivalGauge(data.box, accumulatedScores[fIndex]);
         } else {
             drawAgitationScore(data.box, accumulatedScores[fIndex]);
         }
     }
  }
}

function drawDebugOverlay() {
  background(255, 255, 255, 220);
  drawSharedHeader("Mode maintenance");
  fill(0); noStroke(); textAlign(CENTER, CENTER);
  
  // KEYWORD: EASE Font
  textFont(easeFont); 
  textSize(150); 
  text("Debug", width/2, height/2);
  
  // Technical Info: ARIAL Font
  fill(50); textAlign(LEFT, BOTTOM); textSize(18); textFont('Arial');
  let infoY = height - 50;
  text("FPS : " + Math.floor(frameRate()), 50, infoY);
  text("Visages : " + faces.length, 200, infoY);
}

// --- INTELLIGENT DETECTION LOGIC (SCALED BY FACE SIZE) ---
function analyzeBodyMovements() {
  let results = [];
  
  for (let i = 0; i < faces.length; i++) {
    let face = faces[i];
    let box = getFaceBox(face);
    let movementScore = 0;
    
    // Associate Face <-> Body (nose closest to face center)
    let bestPose = null;
    let minDist = 9999;
    let faceCx = box.x + box.w/2;
    let faceCy = box.y + box.h/2;

    for(let pose of poses) {
        if(pose.keypoints && pose.keypoints[0]) {
            let d = dist(faceCx, faceCy, pose.keypoints[0].x, pose.keypoints[0].y);
            // Loose tolerance: body is roughly under the face
            if(d < box.w * 3 && d < minDist) { 
                minDist = d;
                bestPose = pose;
            }
        }
    }

    if (bestPose) {
        // 1. Calculate Scale based on FACE WIDTH
        // This replaces the shoulder calculation. 
        // If face is 50px wide, 1 unit = 50px.
        // We use a factor (e.g., * 3) to approximate a body scale relative to face
        let scaleUnit = box.w * 3; 

        // 2. Tracked Points (Shoulders, Elbows, Wrists)
        let indicesToCheck = [5, 6, 7, 8, 9, 10]; 
        let currentBodyPoints = [];
        let totalNormalizedDist = 0;
        let validPoints = 0;

        for(let idx of indicesToCheck) {
            let kp = bestPose.keypoints[idx];
            // Only check confident points
            if(kp && kp.confidence > 0.25) {
                currentBodyPoints.push({id: idx, x: kp.x, y: kp.y});
            }
        }

        // 3. Compare with previous frame
        let prevData = prevPosesKeypoints[i];
        if (prevData) {
            for(let currPt of currentBodyPoints) {
                let prevPt = prevData.find(p => p.id === currPt.id);
                if(prevPt) {
                    let distancePx = dist(currPt.x, currPt.y, prevPt.x, prevPt.y);
                    
                    // NORMALIZATION:
                    // Movement is divided by the scale unit. 
                    // This makes movement relative to distance from camera.
                    let normalizedMvt = distancePx / scaleUnit;

                    // Threshold check
                    if(normalizedMvt > sensitivityThreshold) {
                        totalNormalizedDist += normalizedMvt;
                        validPoints++;
                    }
                }
            }
        }

        if(validPoints > 0) {
            movementScore = (totalNormalizedDist / validPoints) * scoreMultiplier;
        }

        // Store for next frame
        prevPosesKeypoints[i] = currentBodyPoints;
    }
    results.push({ faceIndex: i, score: movementScore, box: box });
  }
  return results;
}

// --- DRAW SKELETON & FACE ---
function drawSmartSkeleton() {
  noFill(); stroke(255, 255, 255, 150); strokeWeight(2);
  for (let pose of poses) {
    if(!pose.keypoints) continue;
    for (let j = 0; j < connections.length; j++) {
      let kA = pose.keypoints[connections[j][0]];
      let kB = pose.keypoints[connections[j][1]];
      if (kA && kB && kA.confidence > 0.3 && kB.confidence > 0.3) {
          line(kA.x, kA.y, kB.x, kB.y);
      }
    }
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

function drawFaceBoxes(col) {
  noFill(); stroke(col); strokeWeight(1); 
  for (let face of faces) {
    let box = getFaceBox(face);
    if(box.w > 20) {
        rect(box.x, box.y, box.w, box.h);
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
  fill(255, 0, 0); noStroke(); textFont('Arial');
  textSize(24); textAlign(CENTER);
  text(Math.floor(value), x + box.w/2, y);
}

// --- GAME LOGIC ---
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
  let threshold = (faces.length === 1) ? soloGaugeLimit : 50;
  
  for (let i in accumulatedScores) {
      if (accumulatedScores[i] > maxScore) {
          maxScore = accumulatedScores[i];
          loserIndex = i;
      }
  }
  
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

// --- CAPTURE & SEND (SECURE) ---
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
    let dataUrl = pg.canvas.toDataURL('image/jpeg', 0.5); // Compression
    
    let randAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
    let idNum = globalCaptureCount.toString().padStart(3, '0');

    if (conn && conn.open) {
        conn.send({ image: dataUrl, id: "Individu " + idNum, adj: randAdj });
        console.log(`📡 Envoyé : Individu ${idNum}`);
    }
    globalCaptureCount++;
  } catch (err) { console.error(err); } 
  finally { if (pg) pg.remove(); } // Cleaning required
}
